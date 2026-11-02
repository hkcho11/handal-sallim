package com.handalsallim.recurringexpense;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.handalsallim.TestcontainersConfiguration;
import com.handalsallim.recurringexpense.application.FixedExpenseService;
import com.handalsallim.recurringexpense.application.ScheduledChargeService;
import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ScheduledChargeApiTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;
  @Autowired FixedExpenseService fixed;
  @Autowired ScheduledChargeService scheduled;
  MockMvc mvc;
  UUID user, partner, outsider, space, category, sub, method, expense;

  UUID user() {
    UUID id = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO users(id,display_name,status,created_at,updated_at) VALUES (?,'테스트','ACTIVE',now(),now())",
        id);
    return id;
  }

  void member(UUID person, UUID target, String role) {
    jdbc.update(
        "INSERT INTO space_members(space_id,user_id,role,status,joined_at,created_at,updated_at) VALUES (?,?,?,'ACTIVE',now(),now(),now())",
        target,
        person,
        role);
  }

  UUID space(UUID owner, String mode) {
    UUID id = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO spaces(id,management_mode,status,created_by,created_at,updated_at) VALUES (?,?,'ACTIVE',?,now(),now())",
        id,
        mode,
        owner);
    member(owner, id, "OWNER");
    return id;
  }

  @BeforeEach
  void setup() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
    user = user();
    partner = user();
    outsider = user();
    space = space(user, "SHARED");
    member(partner, space, "MEMBER");
    space(outsider, "SOLO");
    category = UUID.randomUUID();
    sub = UUID.randomUUID();
    method = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO categories(id,space_id,name,applies_to,status,created_at,updated_at) VALUES (?,?,'통신','EXPENSE','ACTIVE',now(),now())",
        category,
        space);
    jdbc.update(
        "INSERT INTO expense_subcategories(id,space_id,category_id,name,status,created_at) VALUES (?,?,?,'인터넷','ACTIVE',now())",
        sub,
        space,
        category);
    jdbc.update(
        "INSERT INTO payment_methods(id,space_id,name,type,status,created_at,updated_at) VALUES (?,?,'현금','CASH','ACTIVE',now(),now())",
        method,
        space);
  }

  UUID create(LocalDate first, int interval, int day) {
    return fixed
        .create(
            user,
            UUID.randomUUID(),
            new FixedExpenseDetails(
                "인터넷", 30000, interval, day, first, null, method, category, sub, null))
        .id();
  }

  UUID charge(UUID id, LocalDate due) {
    return jdbc.queryForObject(
        "SELECT id FROM scheduled_charges WHERE recurring_expense_id=? AND due_date=?",
        UUID.class,
        id,
        due);
  }

  MockHttpServletRequestBuilder complete(
      UUID by, UUID id, long amount, LocalDate paidOn, long version) {
    return post("/api/scheduled-charges/" + id + "/complete")
        .principal(() -> by.toString())
        .contentType(MediaType.APPLICATION_JSON)
        .content(
            "{\"amount\":"
                + amount
                + ",\"paidOn\":\""
                + paidOn
                + "\",\"paymentMethodId\":\""
                + method
                + "\",\"version\":"
                + version
                + "}");
  }

  @Test
  void generatesMissingCyclesWithLeapYearsAndKeepsIndependentFirstDateAndUniqueRows()
      throws Exception {
    expense = create(LocalDate.of(2024, 1, 17), 1, 31);
    assertNotNull(charge(expense, LocalDate.of(2024, 1, 17)));
    assertNotNull(charge(expense, LocalDate.of(2024, 2, 29)));
    assertNotNull(charge(expense, LocalDate.of(2025, 2, 28)));
    int before = scheduled.list(user, expense).size();
    scheduled.list(partner, expense);
    scheduled.list(user, expense);
    assertEquals(before, scheduled.list(user, expense).size());
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id=?", Integer.class, space));
    UUID quarter = create(LocalDate.of(2024, 1, 17), 3, 31);
    assertNotNull(charge(quarter, LocalDate.of(2024, 4, 30)));
    UUID annual = create(LocalDate.of(2024, 2, 29), 12, 29);
    assertNotNull(charge(annual, LocalDate.of(2025, 2, 28)));
    mvc.perform(get("/api/dashboard/fixed-costs?month=2027-02").principal(() -> user.toString()))
        .andExpect(status().isOk());
    assertNotNull(charge(expense, LocalDate.of(2027, 2, 28)));
  }

  @Test
  void actualCompletionCreatesOneSharedTransactionAndNextCycleWithoutDoubleCounting()
      throws Exception {
    LocalDate first = LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).withDayOfMonth(1);
    expense = create(first, 1, 1);
    UUID id = charge(expense, first);
    mvc.perform(complete(partner, id, 35000, first, 0))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.actualAmount").value(35000));
    mvc.perform(complete(partner, id, 35000, first, 0)).andExpect(status().isOk());
    mvc.perform(complete(user, id, 34000, first, 0)).andExpect(status().isConflict());
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE scheduled_charge_id=? AND amount=35000 AND visibility='SHARED' AND created_by=?",
            Integer.class,
            id,
            partner));
    assertNull(
        jdbc.queryForObject(
            "SELECT expected_amount FROM scheduled_charges WHERE recurring_expense_id=? AND due_date=?",
            Long.class,
            expense,
            first.plusMonths(1)));
    mvc.perform(
            get("/api/dashboard/fixed-costs?month=" + YearMonth.from(first))
                .principal(() -> user.toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.charges[0].actualAmount").value(35000));
    mvc.perform(
            get("/api/recurring-expenses/" + expense + "/charges")
                .principal(() -> partner.toString()))
        .andExpect(status().isOk());
    mvc.perform(
            get("/api/recurring-expenses/" + expense + "/charges")
                .principal(() -> outsider.toString()))
        .andExpect(status().isNotFound());
    mvc.perform(complete(outsider, id, 35000, first, 0)).andExpect(status().isNotFound());
  }

  @Test
  void rejectsFutureDatesStaleFormsArchivedMethodsAndInvalidMoney() throws Exception {
    LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Seoul"));
    expense = create(today, 1, today.getDayOfMonth());
    UUID id = charge(expense, today);
    mvc.perform(complete(user, id, 30000, today.plusDays(1), 0)).andExpect(status().isBadRequest());
    mvc.perform(complete(user, id, 0, today, 0)).andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/scheduled-charges/" + id + "/complete")
                .principal(() -> user.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"amount\":1.5,\"paidOn\":\""
                        + today
                        + "\",\"paymentMethodId\":\""
                        + method
                        + "\",\"version\":0}"))
        .andExpect(status().isBadRequest());
    mvc.perform(complete(user, id, 9_007_199_254_740_992L, today, 0))
        .andExpect(status().isBadRequest());
    mvc.perform(complete(user, id, 30000, today, 5)).andExpect(status().isConflict());
    jdbc.update("UPDATE payment_methods SET status='ARCHIVED' WHERE id=?", method);
    mvc.perform(complete(user, id, 30000, today, 0)).andExpect(status().isBadRequest());
    assertEquals(
        "PENDING",
        jdbc.queryForObject("SELECT status FROM scheduled_charges WHERE id=?", String.class, id));
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id=?", Integer.class, space));
  }

  @Test
  void simultaneousConfirmationsFromBothMembersCreateOneTransaction() throws Exception {
    LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Seoul"));
    expense = create(today, 1, today.getDayOfMonth());
    UUID id = charge(expense, today);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a =
          pool.submit(
              () ->
                  mvc.perform(complete(user, id, 30000, today, 0))
                      .andReturn()
                      .getResponse()
                      .getStatus());
      var b =
          pool.submit(
              () ->
                  mvc.perform(complete(partner, id, 30000, today, 0))
                      .andReturn()
                      .getResponse()
                      .getStatus());
      assertEquals(200, a.get(15, java.util.concurrent.TimeUnit.SECONDS));
      assertEquals(200, b.get(15, java.util.concurrent.TimeUnit.SECONDS));
    }
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE scheduled_charge_id=?", Integer.class, id));
  }

  @Test
  void transactionFailureRollsBackCompletionAndRetrySucceeds() throws Exception {
    LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Seoul"));
    expense = create(today, 1, today.getDayOfMonth());
    UUID id = charge(expense, today);
    String constraint = "fail_charge_" + UUID.randomUUID().toString().replace("-", "");
    jdbc.execute(
        "ALTER TABLE transactions ADD CONSTRAINT "
            + constraint
            + " CHECK (scheduled_charge_id IS DISTINCT FROM '"
            + id
            + "'::uuid) NOT VALID");
    try {
      mvc.perform(complete(user, id, 30000, today, 0)).andExpect(status().isInternalServerError());
      assertEquals(
          "PENDING",
          jdbc.queryForObject("SELECT status FROM scheduled_charges WHERE id=?", String.class, id));
      assertEquals(
          0,
          jdbc.queryForObject(
              "SELECT count(*) FROM transactions WHERE scheduled_charge_id=?", Integer.class, id));
    } finally {
      jdbc.execute("ALTER TABLE transactions DROP CONSTRAINT " + constraint);
    }
    mvc.perform(complete(user, id, 30000, today, 0)).andExpect(status().isOk());
  }
}
