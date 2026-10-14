package com.handalsallim.transaction;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.handalsallim.TestcontainersConfiguration;
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
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class PersonalExpenseApiTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;
  MockMvc mvc;
  UUID user;
  UUID partner;
  UUID space;
  UUID category;
  UUID method;

  @BeforeEach
  void setup() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
    user = UUID.randomUUID();
    partner = UUID.randomUUID();
    space = UUID.randomUUID();
    category = UUID.randomUUID();
    method = UUID.randomUUID();
    for (UUID id : new UUID[] {user, partner}) {
      jdbc.update(
          "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, '테스트 사용자', 'ACTIVE', now(), now())",
          id);
    }
    jdbc.update(
        "INSERT INTO spaces (id, management_mode, time_zone, status, created_by, created_at, updated_at) VALUES (?, 'SHARED', 'Asia/Seoul', 'ACTIVE', ?, now(), now())",
        space,
        user);
    for (UUID id : new UUID[] {user, partner}) {
      jdbc.update(
          "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) VALUES (?, ?, 'MEMBER', 'ACTIVE', now(), now(), now())",
          space,
          id);
    }
    jdbc.update(
        "INSERT INTO categories (id, space_id, name, applies_to, status, created_at, updated_at) VALUES (?, ?, '식비', 'EXPENSE', 'ACTIVE', now(), now())",
        category,
        space);
    jdbc.update(
        "INSERT INTO payment_methods (id, space_id, name, type, status, created_at, updated_at) VALUES (?, ?, '현금', 'CASH', 'ACTIVE', now(), now())",
        method,
        space);
  }

  private String body(String amount, String date, long version) {
    return """
        {"name":"테스트 지출","amount":%s,"occurredOn":"%s","categoryId":"%s","paymentMethodId":"%s","memo":"테스트 메모","privateConfirmed":true,"version":%d}
        """
        .formatted(amount, date, category, method, version);
  }

  private UUID create(UUID key, String content) throws Exception {
    mvc.perform(
            post("/api/personal-expenses")
                .principal(user::toString)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(content))
        .andExpect(status().isCreated())
        .andExpect(header().string("Cache-Control", "no-store"));
    return jdbc.queryForObject(
        "SELECT id FROM transactions WHERE space_id = ? AND created_by = ? AND creation_key = ?",
        UUID.class,
        space,
        user,
        key);
  }

  @Test
  void createsReadsUpdatesAndPermanentlyDeletesWithoutChangingOtherRecords() throws Exception {
    UUID id = create(UUID.randomUUID(), body("12300", "2026-10-14", 0));
    mvc.perform(get("/api/personal-expenses").principal(user::toString).param("month", "2026-10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalAmount").value("12300"))
        .andExpect(jsonPath("$.items[0].name").value("테스트 지출"));
    mvc.perform(get("/api/personal-expenses/" + id).principal(user::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.memo").value("테스트 메모"));
    mvc.perform(
            put("/api/personal-expenses/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("20000", "2026-11-01", 0)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value(1));
    mvc.perform(get("/api/personal-expenses").principal(user::toString).param("month", "2026-10"))
        .andExpect(jsonPath("$.totalAmount").value("0"))
        .andExpect(jsonPath("$.items.length()").value(0));
    mvc.perform(get("/api/personal-expenses").principal(user::toString).param("month", "2026-11"))
        .andExpect(jsonPath("$.totalAmount").value("20000"));
    UUID other = create(UUID.randomUUID(), body("3000", "2026-11-02", 0));
    mvc.perform(
            delete("/api/personal-expenses/" + id).principal(user::toString).param("version", "1"))
        .andExpect(status().isNoContent());
    assertEquals(
        0,
        jdbc.queryForObject("SELECT count(*) FROM transactions WHERE id = ?", Integer.class, id));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE id = ?", Integer.class, other));
    mvc.perform(get("/api/personal-expenses/" + id).principal(user::toString))
        .andExpect(status().isNotFound());
  }

  @Test
  void partnerCannotLearnAboutReadUpdateOrDeletePersonalExpense() throws Exception {
    UUID id = create(UUID.randomUUID(), body("12000", "2026-10-14", 0));
    mvc.perform(
            get("/api/personal-expenses").principal(partner::toString).param("month", "2026-10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalAmount").value("0"))
        .andExpect(jsonPath("$.items.length()").value(0));
    mvc.perform(get("/api/personal-expenses/" + id).principal(partner::toString))
        .andExpect(status().isNotFound());
    mvc.perform(
            put("/api/personal-expenses/" + id)
                .principal(partner::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("999", "2026-10-14", 0)))
        .andExpect(status().isNotFound());
    mvc.perform(
            delete("/api/personal-expenses/" + id)
                .principal(partner::toString)
                .param("version", "0"))
        .andExpect(status().isNotFound());
    UUID outsider = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, '테스트 외부 사용자', 'ACTIVE', now(), now())",
        outsider);
    mvc.perform(get("/api/personal-expenses/" + id).principal(outsider::toString))
        .andExpect(status().isForbidden());
    jdbc.update(
        "UPDATE space_members SET status = 'LEFT' WHERE space_id = ? AND user_id = ?", space, user);
    mvc.perform(get("/api/personal-expenses/" + id).principal(user::toString))
        .andExpect(status().isForbidden());
  }

  @Test
  void concurrentRetriesCreateExactlyOneAndConflictingPayloadIsRejected() throws Exception {
    UUID key = UUID.randomUUID();
    String content = body("12000", "2026-10-14", 0);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var a = executor.submit(() -> create(key, content));
      var b = executor.submit(() -> create(key, content));
      assertEquals(a.get(), b.get());
    }
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id = ?", Integer.class, space));
    mvc.perform(
            post("/api/personal-expenses")
                .principal(user::toString)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("13000", "2026-10-14", 0)))
        .andExpect(status().isConflict());
  }

  @Test
  void staleUpdateAndDeleteCannotOverwriteLatestRecord() throws Exception {
    UUID id = create(UUID.randomUUID(), body("12000", "2026-10-14", 0));
    mvc.perform(
            put("/api/personal-expenses/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("15000", "2026-10-15", 0)))
        .andExpect(status().isOk());
    mvc.perform(
            put("/api/personal-expenses/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("17000", "2026-10-16", 0)))
        .andExpect(status().isConflict());
    mvc.perform(
            delete("/api/personal-expenses/" + id).principal(user::toString).param("version", "0"))
        .andExpect(status().isConflict());
    assertEquals(
        15000L,
        jdbc.queryForObject("SELECT amount FROM transactions WHERE id = ?", Long.class, id));
  }

  @Test
  void anotherSpaceCannotAccessExpenseOrSupplyItsCategoryAndPaymentMethod() throws Exception {
    UUID id = create(UUID.randomUUID(), body("12000", "2026-10-14", 0));
    UUID outsider = UUID.randomUUID();
    UUID otherSpace = UUID.randomUUID();
    UUID otherCategory = UUID.randomUUID();
    UUID otherMethod = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, '테스트 사용자', 'ACTIVE', now(), now())",
        outsider);
    jdbc.update(
        "INSERT INTO spaces (id, management_mode, time_zone, status, created_by, created_at, updated_at) VALUES (?, 'SOLO', 'Asia/Seoul', 'ACTIVE', ?, now(), now())",
        otherSpace,
        outsider);
    jdbc.update(
        "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) VALUES (?, ?, 'OWNER', 'ACTIVE', now(), now(), now())",
        otherSpace,
        outsider);
    jdbc.update(
        "INSERT INTO categories (id, space_id, name, applies_to, status, created_at, updated_at) VALUES (?, ?, '식비', 'EXPENSE', 'ACTIVE', now(), now())",
        otherCategory,
        otherSpace);
    jdbc.update(
        "INSERT INTO payment_methods (id, space_id, name, type, status, created_at, updated_at) VALUES (?, ?, '현금', 'CASH', 'ACTIVE', now(), now())",
        otherMethod,
        otherSpace);
    mvc.perform(get("/api/personal-expenses/" + id).principal(outsider::toString))
        .andExpect(status().isNotFound());
    mvc.perform(
            put("/api/personal-expenses/" + id)
                .principal(outsider::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("15000", "2026-10-14", 0)))
        .andExpect(status().isNotFound());
    mvc.perform(
            delete("/api/personal-expenses/" + id)
                .principal(outsider::toString)
                .param("version", "0"))
        .andExpect(status().isNotFound());
    for (String content :
        new String[] {
          body("1200", "2026-10-14", 0).replace(category.toString(), otherCategory.toString()),
          body("1200", "2026-10-14", 0).replace(method.toString(), otherMethod.toString())
        }) {
      mvc.perform(
              post("/api/personal-expenses")
                  .principal(user::toString)
                  .header("Idempotency-Key", UUID.randomUUID())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(content))
          .andExpect(status().isBadRequest());
    }
    assertThrows(
        org.springframework.dao.DataIntegrityViolationException.class,
        () ->
            jdbc.update("UPDATE transactions SET category_id = ? WHERE id = ?", otherCategory, id));
    assertThrows(
        org.springframework.dao.DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "UPDATE transactions SET payment_method_id = ? WHERE id = ?", otherMethod, id));
  }

  @Test
  void rejectsFractionalStringZeroOverflowBadDateAndMissingRequiredFields() throws Exception {
    for (String amount : new String[] {"1.5", "\"12000\"", "0", "-1", "9007199254740992", "null"}) {
      mvc.perform(
              post("/api/personal-expenses")
                  .principal(user::toString)
                  .header("Idempotency-Key", UUID.randomUUID())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body(amount, "2026-10-14", 0)))
          .andExpect(status().isBadRequest());
    }
    for (String content :
        new String[] {
          body("1200", "2026-02-30", 0),
          body("1200", "2026-10-14", 0).replace("테스트 지출", " "),
          body("1200", "2026-10-14", 0).replace(category.toString(), UUID.randomUUID().toString()),
          body("1200", "2026-10-14", 0).replace(method.toString(), UUID.randomUUID().toString()),
          body("1200", "2026-10-14", 0)
              .replace("\"privateConfirmed\":true", "\"privateConfirmed\":false")
        }) {
      mvc.perform(
              post("/api/personal-expenses")
                  .principal(user::toString)
                  .header("Idempotency-Key", UUID.randomUUID())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(content))
          .andExpect(status().isBadRequest());
    }
    mvc.perform(get("/api/personal-expenses").param("month", "2026-10"))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/api/personal-expenses").principal(user::toString).param("month", "2026-13"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void preservesArchivedReferencesOnEditButRejectsNewUseAndIncomeCategory() throws Exception {
    UUID id = create(UUID.randomUUID(), body("12000", "2026-10-14", 0));
    jdbc.update("UPDATE categories SET status = 'ARCHIVED' WHERE id = ?", category);
    jdbc.update("UPDATE payment_methods SET status = 'ARCHIVED' WHERE id = ?", method);
    mvc.perform(
            put("/api/personal-expenses/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("13000", "2026-10-14", 0)))
        .andExpect(status().isOk());
    mvc.perform(
            post("/api/personal-expenses")
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("12000", "2026-10-14", 0)))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/personal-expenses/options").principal(user::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.categories.length()").value(0))
        .andExpect(jsonPath("$.paymentMethods.length()").value(0));
    jdbc.update(
        "UPDATE categories SET status = 'ACTIVE', applies_to = 'INCOME' WHERE id = ?", category);
    jdbc.update("UPDATE payment_methods SET status = 'ACTIVE' WHERE id = ?", method);
    mvc.perform(
            post("/api/personal-expenses")
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("12000", "2026-10-14", 0)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void excludesSharedIncomeAndVoidedRecordsAndSumsAboveSafeIntegerExactly() throws Exception {
    create(UUID.randomUUID(), body("9007199254740991", "2026-10-01", 0));
    create(UUID.randomUUID(), body("9007199254740991", "2026-10-31", 0));
    UUID shared = create(UUID.randomUUID(), body("100", "2026-10-01", 0));
    jdbc.update("UPDATE transactions SET visibility = 'SHARED' WHERE id = ?", shared);
    UUID income = create(UUID.randomUUID(), body("200", "2026-10-01", 0));
    jdbc.update("UPDATE transactions SET type = 'INCOME' WHERE id = ?", income);
    UUID voided = create(UUID.randomUUID(), body("300", "2026-10-01", 0));
    jdbc.update(
        "UPDATE transactions SET status = 'VOIDED', voided_by = ?, voided_at = now() WHERE id = ?",
        user,
        voided);
    create(UUID.randomUUID(), body("400", "2026-11-01", 0));
    mvc.perform(get("/api/personal-expenses").principal(user::toString).param("month", "2026-10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(2))
        .andExpect(jsonPath("$.totalAmount").value("18014398509481982"));
  }
}
