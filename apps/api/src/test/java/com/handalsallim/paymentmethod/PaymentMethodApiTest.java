package com.handalsallim.paymentmethod;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.handalsallim.FixedOctoberClockConfiguration;
import com.handalsallim.TestcontainersConfiguration;
import com.handalsallim.recurringexpense.application.FixedExpenseService;
import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import({TestcontainersConfiguration.class, FixedOctoberClockConfiguration.class})
class PaymentMethodApiTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;
  @Autowired FixedExpenseService expenses;
  MockMvc mvc;
  UUID user;
  UUID space;
  UUID category;

  @BeforeEach
  void setup() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
    user = UUID.randomUUID();
    space = UUID.randomUUID();
    category = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, '테스트 사용자', 'ACTIVE', now(), now())",
        user);
    jdbc.update(
        "INSERT INTO spaces (id, management_mode, time_zone, status, created_by, created_at, updated_at) VALUES (?, 'SOLO', 'Asia/Seoul', 'ACTIVE', ?, now(), now())",
        space,
        user);
    jdbc.update(
        "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) VALUES (?, ?, 'OWNER', 'ACTIVE', now(), now(), now())",
        space,
        user);
    jdbc.update(
        "INSERT INTO categories (id, space_id, name, applies_to, status, created_at, updated_at) VALUES (?, ?, '통신', 'EXPENSE', 'ACTIVE', now(), now())",
        category,
        space);
  }

  String body(String name, long version) {
    return """
      {"name":"%s","type":"CARD","holderUserId":"%s","color":"#315beb","version":%d}
      """
        .formatted(name, user, version);
  }

  UUID create() throws Exception {
    UUID id = UUID.randomUUID();
    mvc.perform(
            post("/api/payment-methods")
                .principal(user::toString)
                .header("Idempotency-Key", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("생활비 카드", 0)))
        .andExpect(status().isCreated())
        .andExpect(header().string("Cache-Control", "no-store"));
    return id;
  }

  @Test
  void acceptsNewTypesAndReclassifiesExistingCardsWithoutChangingIdentity() throws Exception {
    UUID legacy = create();
    for (String type :
        new String[] {"CREDIT_CARD", "DEBIT_CARD", "SIMPLE_PAY", "ACCOUNT", "CASH"}) {
      UUID id = UUID.randomUUID();
      mvc.perform(
              post("/api/payment-methods")
                  .principal(user::toString)
                  .header("Idempotency-Key", id)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body("새 결제수단", 0).replace("CARD", type)))
          .andExpect(status().isCreated())
          .andExpect(jsonPath("$.type").value(type));
    }
    mvc.perform(
            put("/api/payment-methods/" + legacy)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("생활비 카드", 0).replace("CARD", "DEBIT_CARD")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(legacy.toString()))
        .andExpect(jsonPath("$.type").value("DEBIT_CARD"));
    mvc.perform(get("/api/recurring-expenses/options").principal(user::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paymentMethods.length()").value(6));
    mvc.perform(
            post("/api/payment-methods")
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("잘못된 종류", 0).replace("CARD", "UNKNOWN")))
        .andExpect(status().isBadRequest());
  }

  @Test
  void retriesCreationRejectsStaleEditsAndEnforcesSpaceBoundary() throws Exception {
    UUID id = create();
    mvc.perform(
            post("/api/payment-methods")
                .principal(user::toString)
                .header("Idempotency-Key", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("생활비 카드", 0)))
        .andExpect(status().isCreated());
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM payment_methods WHERE space_id = ?", Integer.class, space));
    mvc.perform(
            put("/api/payment-methods/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("변경 카드", 0)))
        .andExpect(status().isOk());
    mvc.perform(
            put("/api/payment-methods/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("덮어쓰기", 0)))
        .andExpect(status().isConflict());
    mvc.perform(
            post("/api/payment-methods/" + id + "/archive")
                .principal(user::toString)
                .param("version", "0"))
        .andExpect(status().isConflict());
    mvc.perform(get("/api/payment-methods")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/payment-methods").principal(UUID.randomUUID()::toString))
        .andExpect(status().isForbidden());
    UUID foreign = UUID.randomUUID();
    mvc.perform(
            put("/api/payment-methods/" + foreign)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("다른 공간", 0)))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/api/payment-methods")
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("카드", 0).replace(user.toString(), foreign.toString())))
        .andExpect(status().isBadRequest());
  }

  @Test
  void archivesWithoutChangingCompletedChargesOrTheirRevision() throws Exception {
    UUID id = create();
    UUID subcategory =
        expenses.formOptions(user).subcategories().stream()
            .filter(item -> item.categoryId().equals(category))
            .findFirst()
            .orElseThrow()
            .id();
    var expense =
        expenses.create(
            user,
            UUID.randomUUID(),
            new FixedExpenseDetails(
                "통신비",
                30000,
                1,
                10,
                LocalDate.of(2026, 10, 10),
                null,
                id,
                category,
                subcategory,
                "통신비"));
    UUID oldRevision =
        jdbc.queryForObject(
            "SELECT recurring_expense_revision_id FROM scheduled_charges WHERE id = ?",
            UUID.class,
            expense.firstChargeId());
    jdbc.update(
        "UPDATE scheduled_charges SET status = 'COMPLETED', actual_amount = 30000, actual_paid_on = due_date, actual_payment_method_id = ?, completed_by = ?, completed_at = now() WHERE id = ?",
        id,
        user,
        expense.firstChargeId());
    UUID pending = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO scheduled_charges (id, space_id, recurring_expense_id, recurring_expense_revision_id, due_date, expense_name, expected_amount, planned_payment_method_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, '2026-11-10', '통신비', 30000, ?, 'PENDING', now(), now())",
        pending,
        space,
        expense.id(),
        oldRevision,
        id);
    mvc.perform(
            post("/api/payment-methods/" + id + "/archive")
                .principal(user::toString)
                .param("version", "0"))
        .andExpect(status().isNoContent());
    assertEquals(
        id,
        jdbc.queryForObject(
            "SELECT default_payment_method_id FROM recurring_expense_revisions WHERE id = ?",
            UUID.class,
            oldRevision));
    assertEquals(
        id,
        jdbc.queryForObject(
            "SELECT actual_payment_method_id FROM scheduled_charges WHERE id = ?",
            UUID.class,
            expense.firstChargeId()));
    assertEquals(
        oldRevision,
        jdbc.queryForObject(
            "SELECT recurring_expense_revision_id FROM scheduled_charges WHERE id = ?",
            UUID.class,
            expense.firstChargeId()));
    assertNull(
        jdbc.queryForObject(
            "SELECT planned_payment_method_id FROM scheduled_charges WHERE id = ?",
            UUID.class,
            pending));
    assertNotEquals(
        oldRevision,
        jdbc.queryForObject(
            "SELECT recurring_expense_revision_id FROM scheduled_charges WHERE id = ?",
            UUID.class,
            pending));
    mvc.perform(get("/api/recurring-expenses/options").principal(user::toString))
        .andExpect(jsonPath("$.paymentMethods").isEmpty());
    mvc.perform(
            post("/api/payment-methods/" + id + "/archive")
                .principal(user::toString)
                .param("version", "0"))
        .andExpect(status().isNoContent());
    assertEquals(
        2,
        jdbc.queryForObject(
            "SELECT count(*) FROM recurring_expense_revisions WHERE recurring_expense_id = ?",
            Integer.class,
            expense.id()));
  }
}
