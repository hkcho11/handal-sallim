package com.handalsallim.recurringexpense;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.handalsallim.FixedOctoberClockConfiguration;
import com.handalsallim.TestcontainersConfiguration;
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

@Import({TestcontainersConfiguration.class, FixedOctoberClockConfiguration.class})
@SpringBootTest
class FixedExpenseApiTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;
  @Autowired com.handalsallim.recurringexpense.application.ScheduledChargeService scheduled;
  @Autowired com.handalsallim.recurringexpense.application.FixedExpenseService classifications;
  MockMvc mvc;
  UUID ownerId;
  UUID spaceId;
  UUID categoryId;
  UUID subcategoryId;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
    ownerId = UUID.randomUUID();
    spaceId = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, '나', 'ACTIVE', now(), now())",
        ownerId);
    jdbc.update(
        "INSERT INTO spaces (id, management_mode, time_zone, status, created_by, created_at, updated_at) "
            + "VALUES (?, 'SOLO', 'Asia/Seoul', 'ACTIVE', ?, now(), now())",
        spaceId,
        ownerId);
    jdbc.update(
        "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) "
            + "VALUES (?, ?, 'OWNER', 'ACTIVE', now(), now(), now())",
        spaceId,
        ownerId);
    categoryId = UUID.randomUUID();
    subcategoryId = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO categories (id, space_id, name, applies_to, status, created_at, updated_at) VALUES (?, ?, '테스트 대분류', 'EXPENSE', 'ACTIVE', now(), now())",
        categoryId,
        spaceId);
    jdbc.update(
        "INSERT INTO expense_subcategories (id, space_id, category_id, name, status, created_at) VALUES (?, ?, ?, '테스트 중분류', 'ACTIVE', now())",
        subcategoryId,
        spaceId,
        categoryId);
  }

  @Test
  void createsOneExpenseAndOneChargeWhenRequestIsRetried() throws Exception {
    UUID key = UUID.randomUUID();
    String request =
        """
        {"name":"월세","expectedAmount":650000,"intervalMonths":1,"recurringDayOfMonth":15,"firstDueDate":"2026-10-15"}
        """;
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(
              post("/api/recurring-expenses")
                  .principal(() -> ownerId.toString())
                  .header("Idempotency-Key", key.toString())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(classified(request)))
          .andExpect(status().isCreated())
          .andExpect(jsonPath("$.name").value("월세"))
          .andExpect(jsonPath("$.expectedAmount").value(650000))
          .andExpect(jsonPath("$.firstDueDate").value("2026-10-15"))
          .andExpect(jsonPath("$.firstChargeDueDate").value("2026-10-15"));
    }
    assertCount("recurring_expenses", 1);
    assertCount("recurring_expense_revisions", 1);
    assertCount("scheduled_charges", 1);
    mvc.perform(get("/api/recurring-expenses").principal(() -> ownerId.toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].name").value("월세"));
  }

  @Test
  void returnsSelectedChargeDateSeparatelyFromFirstPaymentDate() throws Exception {
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    classified(
                        "{\"name\":\"인터넷\",\"expectedAmount\":35000,\"intervalMonths\":1,\"recurringDayOfMonth\":15,\"firstDueDate\":\"2026-10-15\"}")))
        .andExpect(status().isCreated());
    scheduled.ensure(ownerId, java.time.YearMonth.of(2026, 11));
    jdbc.update(
        "UPDATE scheduled_charges SET status='CANCELLED' WHERE space_id=? AND due_date=DATE '2026-10-15'",
        spaceId);
    mvc.perform(get("/api/recurring-expenses").principal(() -> ownerId.toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].firstDueDate").value("2026-10-15"))
        .andExpect(jsonPath("$[0].firstChargeDueDate").value("2026-11-15"));
  }

  @Test
  void fillsMissingDetailsInStagesAndCreatesOnlyOneChargeOnRetry() throws Exception {
    UUID key = UUID.randomUUID();
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified("{\"name\":\"인터넷\",\"expectedAmount\":35000}")))
        .andExpect(status().isCreated());
    UUID id =
        jdbc.queryForObject(
            "SELECT id FROM recurring_expenses WHERE space_id = ? AND creation_key = ?",
            UUID.class,
            spaceId,
            key);
    mvc.perform(
            patch("/api/recurring-expenses/" + id + "/details")
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    classified("{\"name\":\"인터넷\",\"expectedAmount\":35000,\"intervalMonths\":1}")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.firstChargeId").value(nullValue()));
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(
              patch("/api/recurring-expenses/" + id + "/details")
                  .principal(() -> ownerId.toString())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(
                      classified(
                          "{\"name\":\"인터넷\",\"expectedAmount\":35000,\"intervalMonths\":1,\"recurringDayOfMonth\":15,\"firstDueDate\":\"2026-11-15\"}")))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.recurringDayOfMonth").value(15));
    }
    assertCount("scheduled_charges", 1);
    mvc.perform(
            patch("/api/recurring-expenses/" + id + "/details")
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    classified(
                        "{\"name\":\"인터넷\",\"expectedAmount\":35000,\"intervalMonths\":3,\"recurringDayOfMonth\":15,\"firstDueDate\":\"2026-11-15\"}")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intervalMonths").value(3));
  }

  @Test
  void missingDetailUpdateCannotAccessAnotherSpace() throws Exception {
    UUID otherId = UUID.randomUUID();
    UUID otherSpace = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, '다른 사용자', 'ACTIVE', now(), now())",
        otherId);
    jdbc.update(
        "INSERT INTO spaces (id, management_mode, time_zone, status, created_by, created_at, updated_at) VALUES (?, 'SOLO', 'Asia/Seoul', 'ACTIVE', ?, now(), now())",
        otherSpace,
        otherId);
    jdbc.update(
        "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) VALUES (?, ?, 'OWNER', 'ACTIVE', now(), now(), now())",
        otherSpace,
        otherId);
    UUID key = UUID.randomUUID();
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified("{\"name\":\"인터넷\",\"expectedAmount\":35000}")))
        .andExpect(status().isCreated());
    UUID id =
        jdbc.queryForObject(
            "SELECT id FROM recurring_expenses WHERE creation_key = ?", UUID.class, key);
    mvc.perform(
            patch("/api/recurring-expenses/" + id + "/details")
                .principal(() -> otherId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    classified("{\"name\":\"인터넷\",\"expectedAmount\":35000,\"intervalMonths\":1}")))
        .andExpect(status().isNotFound());
    assertCount("scheduled_charges", 0);
    mvc.perform(delete("/api/recurring-expenses/" + id).principal(() -> otherId.toString()))
        .andExpect(status().isNotFound());
    mvc.perform(delete("/api/recurring-expenses/" + id)).andExpect(status().isUnauthorized());
    assertEquals(
        "ACTIVE",
        jdbc.queryForObject(
            "SELECT status FROM recurring_expenses WHERE id = ?", String.class, id));
  }

  @Test
  void deletionCancelsPendingChargesAndPreservesCompletedRecordsOnRetry() throws Exception {
    UUID methodId = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO payment_methods (id, space_id, name, type, status, created_at, updated_at) VALUES (?, ?, '생활비 카드', 'CARD', 'ACTIVE', now(), now())",
        methodId,
        spaceId);
    UUID key = UUID.randomUUID();
    String request =
        "{\"name\":\"인터넷\",\"expectedAmount\":35000,\"intervalMonths\":1,\"recurringDayOfMonth\":15,\"firstDueDate\":\"2026-11-15\"}";
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(request)))
        .andExpect(status().isCreated());
    UUID id =
        jdbc.queryForObject(
            "SELECT id FROM recurring_expenses WHERE creation_key = ?", UUID.class, key);
    jdbc.update(
        "UPDATE scheduled_charges SET status = 'COMPLETED', actual_amount = 35000, actual_paid_on = due_date, actual_payment_method_id = ?, completed_by = ?, completed_at = now() WHERE recurring_expense_id = ?",
        methodId,
        ownerId,
        id);
    mvc.perform(
            patch("/api/recurring-expenses/" + id + "/details")
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(request.replace("35000", "42000"))))
        .andExpect(status().isOk());
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(delete("/api/recurring-expenses/" + id).principal(() -> ownerId.toString()))
          .andExpect(status().isNoContent());
    }
    mvc.perform(get("/api/recurring-expenses").principal(() -> ownerId.toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM scheduled_charges WHERE recurring_expense_id = ? AND status = 'COMPLETED'",
            Integer.class,
            id));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM scheduled_charges WHERE recurring_expense_id = ? AND status = 'CANCELLED'",
            Integer.class,
            id));
    assertEquals(
        35000L,
        jdbc.queryForObject(
            "SELECT actual_amount FROM scheduled_charges WHERE recurring_expense_id = ? AND status = 'COMPLETED'",
            Long.class,
            id));
    assertEquals(
        methodId,
        jdbc.queryForObject(
            "SELECT actual_payment_method_id FROM scheduled_charges WHERE recurring_expense_id = ? AND status = 'COMPLETED'",
            UUID.class,
            id));
    assertEquals(
        "ENDED",
        jdbc.queryForObject(
            "SELECT status FROM recurring_expenses WHERE id = ?", String.class, id));
    mvc.perform(
            patch("/api/recurring-expenses/" + id + "/details")
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(request)))
        .andExpect(status().isNotFound());
  }

  @Test
  void editsConfiguredFieldsAndCanClearAndRestoreScheduleWithoutDuplicates() throws Exception {
    UUID key = UUID.randomUUID();
    String original =
        "{\"name\":\"인터넷\",\"expectedAmount\":35000,\"intervalMonths\":1,\"recurringDayOfMonth\":15,\"firstDueDate\":\"2026-11-15\"}";
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(original)))
        .andExpect(status().isCreated());
    UUID id =
        jdbc.queryForObject(
            "SELECT id FROM recurring_expenses WHERE creation_key = ?", UUID.class, key);
    String edited =
        "{\"name\":\"통신비\",\"expectedAmount\":42000,\"intervalMonths\":3,\"recurringDayOfMonth\":25,\"firstDueDate\":\"2026-11-25\"}";
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(
              patch("/api/recurring-expenses/" + id + "/details")
                  .principal(() -> ownerId.toString())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(classified(edited)))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.name").value("통신비"))
          .andExpect(jsonPath("$.expectedAmount").value(42000))
          .andExpect(jsonPath("$.intervalMonths").value(3))
          .andExpect(jsonPath("$.recurringDayOfMonth").value(25))
          .andExpect(jsonPath("$.firstDueDate").value("2026-11-25"));
    }
    assertEquals(
        42000L,
        jdbc.queryForObject(
            "SELECT expected_amount FROM scheduled_charges WHERE recurring_expense_id = ? AND status = 'PENDING'",
            Long.class,
            id));
    assertCount("scheduled_charges", 1);
    mvc.perform(
            patch("/api/recurring-expenses/" + id + "/details")
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified("{\"name\":\"통신비\",\"expectedAmount\":42000}")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.firstChargeId").value(nullValue()));
    mvc.perform(
            patch("/api/recurring-expenses/" + id + "/details")
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(edited)))
        .andExpect(status().isOk());
    assertCount("scheduled_charges", 1);
    assertEquals(
        "PENDING",
        jdbc.queryForObject(
            "SELECT status FROM scheduled_charges WHERE recurring_expense_id = ?",
            String.class,
            id));
  }

  @Test
  void fillingPaymentMethodPreservesCompletedChargeSnapshot() throws Exception {
    UUID methodId = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO payment_methods (id, space_id, name, type, status, created_at, updated_at) VALUES (?, ?, '생활비 카드', 'CARD', 'ACTIVE', now(), now())",
        methodId,
        spaceId);
    UUID key = UUID.randomUUID();
    String schedule =
        "{\"name\":\"인터넷\",\"expectedAmount\":35000,\"intervalMonths\":1,\"recurringDayOfMonth\":15,\"firstDueDate\":\"2026-11-15\"";
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(schedule + "}")))
        .andExpect(status().isCreated());
    UUID id =
        jdbc.queryForObject(
            "SELECT id FROM recurring_expenses WHERE creation_key = ?", UUID.class, key);
    jdbc.update(
        "UPDATE scheduled_charges SET status = 'COMPLETED', actual_amount = 35000, actual_paid_on = due_date, actual_payment_method_id = ?, completed_by = ?, completed_at = now() WHERE recurring_expense_id = ?",
        methodId,
        ownerId,
        id);
    String updated =
        "{\"name\":\"통신비\",\"expectedAmount\":42000,\"intervalMonths\":1,\"recurringDayOfMonth\":31,\"firstDueDate\":\"2026-11-15\",\"paymentMethodId\":\""
            + methodId
            + "\"}";
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(
              patch("/api/recurring-expenses/" + id + "/details")
                  .principal(() -> ownerId.toString())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(classified(updated)))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.name").value("통신비"))
          .andExpect(jsonPath("$.expectedAmount").value(42000))
          .andExpect(jsonPath("$.paymentMethodId").value(methodId.toString()));
    }
    assertEquals(
        35000L,
        jdbc.queryForObject(
            "SELECT expected_amount FROM scheduled_charges WHERE recurring_expense_id = ? AND status = 'COMPLETED'",
            Long.class,
            id));
    assertEquals(
        "인터넷",
        jdbc.queryForObject(
            "SELECT name FROM recurring_expense_revisions WHERE id = (SELECT recurring_expense_revision_id FROM scheduled_charges WHERE recurring_expense_id = ? AND status = 'COMPLETED')",
            String.class,
            id));
    assertEquals(
        "2026-12-31",
        jdbc.queryForObject(
            "SELECT due_date::text FROM scheduled_charges WHERE recurring_expense_id = ? AND status = 'PENDING'",
            String.class,
            id));
    assertEquals(
        null,
        jdbc.queryForObject(
            "SELECT planned_payment_method_id FROM scheduled_charges WHERE recurring_expense_id = ? AND status = 'COMPLETED'",
            UUID.class,
            id));
    assertEquals(
        methodId,
        jdbc.queryForObject(
            "SELECT actual_payment_method_id FROM scheduled_charges WHERE recurring_expense_id = ? AND status = 'COMPLETED'",
            UUID.class,
            id));
    assertCount("scheduled_charges", 2);
  }

  @Test
  void fillingPaymentMethodUpdatesOnlyPendingChargeOnce() throws Exception {
    UUID methodId = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO payment_methods (id, space_id, name, type, status, created_at, updated_at) VALUES (?, ?, '생활비 카드', 'CARD', 'ACTIVE', now(), now())",
        methodId,
        spaceId);
    UUID key = UUID.randomUUID();
    String schedule =
        "{\"name\":\"인터넷\",\"expectedAmount\":35000,\"intervalMonths\":1,\"recurringDayOfMonth\":15,\"firstDueDate\":\"2026-11-15\"";
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(schedule + "}")))
        .andExpect(status().isCreated());
    UUID id =
        jdbc.queryForObject(
            "SELECT id FROM recurring_expenses WHERE creation_key = ?", UUID.class, key);
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(
              patch("/api/recurring-expenses/" + id + "/details")
                  .principal(() -> ownerId.toString())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(classified(schedule + ",\"paymentMethodId\":\"" + methodId + "\"}")))
          .andExpect(status().isOk());
    }
    assertEquals(
        methodId,
        jdbc.queryForObject(
            "SELECT planned_payment_method_id FROM scheduled_charges WHERE recurring_expense_id = ?",
            UUID.class,
            id));
    assertEquals(
        1L,
        jdbc.queryForObject(
            "SELECT version FROM scheduled_charges WHERE recurring_expense_id = ?",
            Long.class,
            id));
    assertCount("scheduled_charges", 1);
  }

  @Test
  void rejectsAnonymousAndUserWithoutActiveMembership() throws Exception {
    mvc.perform(get("/api/recurring-expenses"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    mvc.perform(
            post("/api/recurring-expenses")
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    classified(
                        """
                    {"name":"월세","expectedAmount":650000,"intervalMonths":1,"recurringDayOfMonth":15,"firstDueDate":"2026-10-15"}
                    """)))
        .andExpect(status().isUnauthorized());
    UUID outsider = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, '외부', 'ACTIVE', now(), now())",
        outsider);
    mvc.perform(get("/api/recurring-expenses").principal(() -> outsider.toString()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("SPACE_UNAVAILABLE"));
    assertCount("recurring_expenses", 0);
  }

  @Test
  void isolatesFixedExpensesBetweenActiveSpaces() throws Exception {
    String request =
        """
        {"name":"월세","expectedAmount":650000,"intervalMonths":1,"recurringDayOfMonth":15,"firstDueDate":"2026-10-15"}
        """;
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(request)))
        .andExpect(status().isCreated());

    UUID otherUser = UUID.randomUUID();
    UUID otherSpace = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, '다른 사용자', 'ACTIVE', now(), now())",
        otherUser);
    jdbc.update(
        "INSERT INTO spaces (id, management_mode, time_zone, status, created_by, created_at, updated_at) "
            + "VALUES (?, 'SOLO', 'Asia/Seoul', 'ACTIVE', ?, now(), now())",
        otherSpace,
        otherUser);
    jdbc.update(
        "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) "
            + "VALUES (?, ?, 'OWNER', 'ACTIVE', now(), now(), now())",
        otherSpace,
        otherUser);

    var otherOptions =
        context
            .getBean(com.handalsallim.recurringexpense.application.FixedExpenseService.class)
            .formOptions(otherUser);
    var otherSubcategory = otherOptions.subcategories().getFirst();
    String otherRequest =
        classified(request)
            .replace(categoryId.toString(), otherSubcategory.categoryId().toString())
            .replace(subcategoryId.toString(), otherSubcategory.id().toString());
    mvc.perform(get("/api/recurring-expenses").principal(() -> otherUser.toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> otherUser.toString())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(otherRequest))
        .andExpect(status().isCreated());
    assertCount("recurring_expenses", 1);
    Integer otherCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM recurring_expenses WHERE space_id = ?",
            Integer.class,
            otherSpace);
    org.junit.jupiter.api.Assertions.assertEquals(1, otherCount);
  }

  @Test
  void rejectsChangedPayloadForSameCreationKey() throws Exception {
    UUID key = UUID.randomUUID();
    String first =
        """
        {"name":"월세","expectedAmount":650000,"intervalMonths":1,"recurringDayOfMonth":15,"firstDueDate":"2026-10-15"}
        """;
    String changed =
        """
        {"name":"월세","expectedAmount":700000,"intervalMonths":1,"recurringDayOfMonth":15,"firstDueDate":"2026-10-15"}
        """;
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(first)))
        .andExpect(status().isCreated());
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(changed)))
        .andExpect(status().isConflict());
    assertCount("scheduled_charges", 1);
  }

  @Test
  void rejectsFractionalMoneyAndIntervalWithoutWriting() throws Exception {
    for (String request :
        new String[] {
          """
          {"name":"월세","expectedAmount":650000.5,"intervalMonths":1,"recurringDayOfMonth":15,"firstDueDate":"2026-10-15"}
          """,
          """
          {"name":"월세","expectedAmount":650000,"intervalMonths":1.5,"recurringDayOfMonth":15,"firstDueDate":"2026-10-15"}
          """,
          """
          {"name":"월세","expectedAmount":"650000","intervalMonths":1,"recurringDayOfMonth":15,"firstDueDate":"2026-10-15"}
          """
        }) {
      mvc.perform(
              post("/api/recurring-expenses")
                  .principal(() -> ownerId.toString())
                  .header("Idempotency-Key", UUID.randomUUID().toString())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(classified(request)))
          .andExpect(status().isBadRequest());
    }
    assertCount("recurring_expenses", 0);
    assertCount("scheduled_charges", 0);
  }

  @Test
  void storesIncompleteScheduleWithoutChargeAndCreatesOneWhenCompleted() throws Exception {
    UUID key = UUID.randomUUID();
    String request =
        """
        {"name":"인터넷","expectedAmount":35000}
        """;
    String path = "/api/recurring-expenses";
    mvc.perform(
            post(path)
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified(request)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.intervalMonths").value(nullValue()))
        .andExpect(jsonPath("$.firstChargeId").value(nullValue()))
        .andExpect(jsonPath("$.firstDueDate").value(nullValue()));
    assertCount("recurring_expenses", 1);
    assertCount("recurring_expense_revisions", 1);
    assertCount("scheduled_charges", 0);
    mvc.perform(get(path).principal(() -> ownerId.toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].intervalMonths").value(nullValue()))
        .andExpect(jsonPath("$[0].firstDueDate").value(nullValue()));

    UUID expenseId =
        jdbc.queryForObject(
            "SELECT id FROM recurring_expenses WHERE space_id = ?", UUID.class, spaceId);
    String schedule =
        """
        {"intervalMonths":1,"recurringDayOfMonth":1,"firstDueDate":"2026-11-01"}
        """;
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(
              org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                      path + "/" + expenseId + "/schedule")
                  .principal(() -> ownerId.toString())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(classified(schedule)))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.intervalMonths").value(1))
          .andExpect(jsonPath("$.firstDueDate").value("2026-11-01"))
          .andExpect(jsonPath("$.firstChargeId").isNotEmpty());
    }
    assertCount("scheduled_charges", 1);
  }

  @Test
  void exposesPayerAndActivePaymentMethodChoicesForTwoMemberSpace() throws Exception {
    UUID partnerId = UUID.randomUUID();
    UUID paymentMethodId = UUID.randomUUID();
    jdbc.update("UPDATE spaces SET management_mode = 'SHARED' WHERE id = ?", spaceId);
    jdbc.update(
        "INSERT INTO users (id, display_name, status, created_at, updated_at) "
            + "VALUES (?, '상대', 'ACTIVE', now(), now())",
        partnerId);
    jdbc.update(
        "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) "
            + "VALUES (?, ?, 'MEMBER', 'ACTIVE', now(), now(), now())",
        spaceId,
        partnerId);
    jdbc.update(
        "INSERT INTO payment_methods "
            + "(id, space_id, name, type, status, created_at, updated_at) "
            + "VALUES (?, ?, '생활비 카드', 'CARD', 'ACTIVE', now(), now())",
        paymentMethodId,
        spaceId);

    mvc.perform(get("/api/recurring-expenses/options").principal(() -> ownerId.toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.payers.length()").value(2))
        .andExpect(jsonPath("$.payers[0].label").value("나"))
        .andExpect(jsonPath("$.payers[1].label").value("상대"))
        .andExpect(jsonPath("$.paymentMethods.length()").value(1))
        .andExpect(jsonPath("$.paymentMethods[0].name").value("생활비 카드"));

    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    classified(
                        """
                    {"name":"보험","expectedAmount":100000,"intervalMonths":1,"recurringDayOfMonth":1,"firstDueDate":"2026-11-01","payer":"PARTNER","paymentMethodId":"%s"}
                    """
                            .formatted(paymentMethodId))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.payer").value("PARTNER"))
        .andExpect(jsonPath("$.paymentMethodName").value("생활비 카드"));
    UUID assignedUser =
        jdbc.queryForObject(
            "SELECT assignee_user_id FROM scheduled_charges WHERE space_id = ?",
            UUID.class,
            spaceId);
    UUID plannedMethod =
        jdbc.queryForObject(
            "SELECT planned_payment_method_id FROM scheduled_charges WHERE space_id = ?",
            UUID.class,
            spaceId);
    org.junit.jupiter.api.Assertions.assertEquals(partnerId, assignedUser);
    org.junit.jupiter.api.Assertions.assertEquals(paymentMethodId, plannedMethod);
  }

  @Test
  void savesBlankMemoAsNullAndUsesSubcategoryAsDisplayName() throws Exception {
    UUID key = UUID.randomUUID();
    String body = classified("{\"expectedAmount\":35000,\"memo\":\"   \"}");
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(
              post("/api/recurring-expenses")
                  .principal(ownerId::toString)
                  .header("Idempotency-Key", key)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isCreated())
          .andExpect(jsonPath("$.name").value("테스트 중분류"))
          .andExpect(jsonPath("$.memo").value(nullValue()))
          .andExpect(jsonPath("$.subcategoryId").value(subcategoryId.toString()));
    }
    assertCount("recurring_expenses", 1);
  }

  @Test
  void rejectsMissingArchivedAndMismatchedSubcategoriesWithoutWriting() throws Exception {
    UUID otherCategory = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO categories (id, space_id, name, applies_to, status, created_at, updated_at) VALUES (?, ?, '다른 대분류', 'EXPENSE', 'ACTIVE', now(), now())",
        otherCategory,
        spaceId);
    String valid = classified("{\"expectedAmount\":35000}");
    for (String body :
        new String[] {
          "{\"expectedAmount\":35000}",
          valid.replace(categoryId.toString(), otherCategory.toString()),
          valid.replace(subcategoryId.toString(), UUID.randomUUID().toString()),
          valid.replace("35000", "35000,\"memo\":\"" + "가".repeat(121) + "\"")
        }) {
      mvc.perform(
              post("/api/recurring-expenses")
                  .principal(ownerId::toString)
                  .header("Idempotency-Key", UUID.randomUUID())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest());
    }
    jdbc.update("UPDATE expense_subcategories SET status = 'ARCHIVED' WHERE id = ?", subcategoryId);
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(ownerId::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(valid))
        .andExpect(status().isBadRequest());
    assertCount("recurring_expenses", 0);
  }

  @Test
  void addsUserSubcategoryUnderItsParentWithoutDuplicates() throws Exception {
    String body = "{\"categoryId\":\"" + categoryId + "\",\"name\":\" 사용자 중분류 \"}";
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(
              post("/api/recurring-expenses/subcategories")
                  .principal(ownerId::toString)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.name").value("사용자 중분류"))
          .andExpect(jsonPath("$.categoryId").value(categoryId.toString()));
    }
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM expense_subcategories WHERE space_id = ? AND name = '사용자 중분류'",
            Integer.class,
            spaceId));
  }

  @Test
  void databaseRejectsMismatchedParentAndPreservesExistingRow() throws Exception {
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(ownerId::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(classified("{\"expectedAmount\":35000}")))
        .andExpect(status().isCreated());
    UUID otherCategory = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO categories (id, space_id, name, applies_to, status, created_at, updated_at) VALUES (?, ?, '잘못된 부모', 'EXPENSE', 'ACTIVE', now(), now())",
        otherCategory,
        spaceId);
    org.junit.jupiter.api.Assertions.assertThrows(
        org.springframework.dao.DataIntegrityViolationException.class,
        () ->
            jdbc.update(
                "UPDATE recurring_expense_revisions SET category_id = ? WHERE space_id = ?",
                otherCategory,
                spaceId));
    assertEquals(
        categoryId,
        jdbc.queryForObject(
            "SELECT category_id FROM recurring_expense_revisions WHERE space_id = ?",
            UUID.class,
            spaceId));
  }

  @Test
  void renamesDefaultCategoryWithoutReseedingAndRejectsDuplicatesAndStaleNames() throws Exception {
    var initial = classifications.formOptions(ownerId);
    var housing =
        initial.categories().stream()
            .filter(item -> item.name().equals("주거"))
            .findFirst()
            .orElseThrow();
    mvc.perform(
            patch("/api/recurring-expenses/categories/" + housing.id())
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"집과 생활\",\"expectedName\":\"주거\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("집과 생활"));
    var after = classifications.formOptions(ownerId);
    assertEquals(initial.categories().size(), after.categories().size());
    assertEquals(0L, after.categories().stream().filter(item -> item.name().equals("주거")).count());
    assertEquals(initial.subcategories(), after.subcategories());
    mvc.perform(
            patch("/api/recurring-expenses/categories/" + housing.id())
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"다른 이름\",\"expectedName\":\"주거\"}"))
        .andExpect(status().isConflict());
    mvc.perform(
            patch("/api/recurring-expenses/categories/" + housing.id())
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"통신\",\"expectedName\":\"집과 생활\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void savesCategoryAndSiblingOrderAndRejectsPartialOrStaleOrders() throws Exception {
    var previous =
        classifications.formOptions(ownerId).categories().stream().map(item -> item.id()).toList();
    var next = new java.util.ArrayList<>(previous);
    java.util.Collections.rotate(next, 1);
    classifications.reorderClassifications(ownerId, null, next, previous);
    assertEquals(
        next,
        classifications.formOptions(ownerId).categories().stream().map(item -> item.id()).toList());
    org.junit.jupiter.api.Assertions.assertThrows(
        org.springframework.dao.OptimisticLockingFailureException.class,
        () -> classifications.reorderClassifications(ownerId, null, previous, previous));
    org.junit.jupiter.api.Assertions.assertThrows(
        IllegalArgumentException.class,
        () ->
            classifications.reorderClassifications(
                ownerId, null, java.util.List.of(UUID.randomUUID()), next));
    var second = classifications.addSubcategory(ownerId, categoryId, "중분류 둘");
    var children =
        classifications.formOptions(ownerId).subcategories().stream()
            .filter(item -> item.categoryId().equals(categoryId))
            .map(item -> item.id())
            .toList();
    var reverse = java.util.List.of(second.id(), subcategoryId);
    classifications.reorderClassifications(ownerId, categoryId, reverse, children);
    assertEquals(
        reverse,
        classifications.formOptions(ownerId).subcategories().stream()
            .filter(item -> item.categoryId().equals(categoryId))
            .map(item -> item.id())
            .toList());
  }

  @Test
  void movingSubcategoryReclassifiesAllHistoryWithoutChangingFinancialValuesOrIds() {
    UUID method = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO payment_methods(id,space_id,name,type,status,created_at,updated_at) VALUES (?,?,'현금','CASH','ACTIVE',now(),now())",
        method,
        spaceId);
    var details =
        new com.handalsallim.recurringexpense.domain.FixedExpenseDetails(
            "내역",
            10000L,
            1,
            15,
            java.time.LocalDate.of(2025, 1, 15),
            null,
            method,
            categoryId,
            subcategoryId,
            null);
    var expense = classifications.create(ownerId, UUID.randomUUID(), details);
    var charge =
        scheduled.list(ownerId, expense.id()).stream()
            .filter(item -> item.dueDate().equals(java.time.LocalDate.of(2025, 1, 15)))
            .findFirst()
            .orElseThrow();
    scheduled.complete(
        ownerId,
        charge.id(),
        new com.handalsallim.recurringexpense.domain.PaymentCompletion(
            12345L, charge.dueDate(), method, charge.version()));
    var target = classifications.addCategory(ownerId, "이동 대상");
    assertEquals(
        subcategoryId,
        jdbc.queryForObject(
            "SELECT subcategory_id FROM transactions WHERE space_id=?", UUID.class, spaceId));
    // Simulate a payment saved by the previous implementation.
    jdbc.update("UPDATE transactions SET subcategory_id=NULL WHERE space_id=?", spaceId);
    var charges =
        jdbc.queryForList(
            "SELECT id FROM scheduled_charges WHERE space_id=? ORDER BY id", UUID.class, spaceId);
    var transactions =
        jdbc.queryForList(
            "SELECT id FROM transactions WHERE space_id=? ORDER BY id", UUID.class, spaceId);
    classifications.moveSubcategory(ownerId, subcategoryId, categoryId, target.id(), null);
    assertEquals(
        subcategoryId,
        jdbc.queryForObject(
            "SELECT subcategory_id FROM transactions WHERE space_id=?", UUID.class, spaceId));
    assertEquals(
        target.id(),
        jdbc.queryForObject(
            "SELECT category_id FROM transactions WHERE space_id=?", UUID.class, spaceId));
    for (String table :
        java.util.List.of("recurring_expense_revisions", "scheduled_charges", "transactions")) {
      assertEquals(
          0,
          jdbc.queryForObject(
              "SELECT count(*) FROM "
                  + table
                  + " WHERE space_id=? AND subcategory_id=? AND category_id<>?",
              Integer.class,
              spaceId,
              subcategoryId,
              target.id()));
    }
    assertEquals(
        charges,
        jdbc.queryForList(
            "SELECT id FROM scheduled_charges WHERE space_id=? ORDER BY id", UUID.class, spaceId));
    assertEquals(
        transactions,
        jdbc.queryForList(
            "SELECT id FROM transactions WHERE space_id=? ORDER BY id", UUID.class, spaceId));
    assertEquals(
        12345L,
        jdbc.queryForObject(
            "SELECT amount FROM transactions WHERE space_id=?", Long.class, spaceId));
    assertEquals(
        charge.dueDate(),
        jdbc.queryForObject(
            "SELECT occurred_on FROM transactions WHERE space_id=?",
            java.time.LocalDate.class,
            spaceId));
    assertEquals(
        12345L,
        jdbc.queryForObject(
            "SELECT SUM(actual_amount) FROM scheduled_charges WHERE space_id=? AND status='COMPLETED' AND category_id=?",
            Long.class,
            spaceId,
            target.id()));
    assertEquals(
        0L,
        classifications.formOptions(ownerId).subcategories().stream()
            .filter(item -> item.id().equals(subcategoryId) && item.categoryId().equals(categoryId))
            .count());
    classifications.updateSubcategory(
        ownerId, subcategoryId, "수정된 세부 분류", "테스트 중분류", categoryId, target.id());
    assertEquals(
        "수정된 세부 분류",
        jdbc.queryForObject(
            "SELECT name FROM expense_subcategories WHERE id=?", String.class, subcategoryId));
    assertEquals(
        categoryId,
        jdbc.queryForObject(
            "SELECT category_id FROM transactions WHERE space_id=?", UUID.class, spaceId));
    assertEquals(
        12345L,
        jdbc.queryForObject(
            "SELECT amount FROM transactions WHERE space_id=?", Long.class, spaceId));
  }

  @Test
  void subcategoryMoveRejectsDuplicateNameAndForeignCategoryWithoutChangingSource() {
    var target = classifications.addCategory(ownerId, "동명 대상");
    classifications.addSubcategory(ownerId, target.id(), "테스트 중분류");
    org.junit.jupiter.api.Assertions.assertThrows(
        IllegalArgumentException.class,
        () ->
            classifications.moveSubcategory(ownerId, subcategoryId, categoryId, target.id(), null));
    org.junit.jupiter.api.Assertions.assertThrows(
        IllegalArgumentException.class,
        () ->
            classifications.moveSubcategory(
                ownerId, subcategoryId, categoryId, UUID.randomUUID(), null));
    assertEquals(
        categoryId,
        jdbc.queryForObject(
            "SELECT category_id FROM expense_subcategories WHERE id=?", UUID.class, subcategoryId));
  }

  @Test
  void subcategoryEditChangesNameAndParentTogetherAndRejectsStaleOrDuplicateEdits()
      throws Exception {
    var target = classifications.addCategory(ownerId, "수정 대상");
    classifications.addSubcategory(ownerId, categoryId, "새 이름");
    String body =
        """
        {"name":"새 이름","expectedName":"테스트 중분류","categoryId":"%s","expectedCategoryId":"%s"}
        """
            .formatted(target.id(), categoryId);
    mvc.perform(
            patch("/api/recurring-expenses/subcategories/" + subcategoryId)
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isNoContent());
    assertEquals(
        "새 이름",
        jdbc.queryForObject(
            "SELECT name FROM expense_subcategories WHERE id=?", String.class, subcategoryId));
    assertEquals(
        target.id(),
        jdbc.queryForObject(
            "SELECT category_id FROM expense_subcategories WHERE id=?", UUID.class, subcategoryId));
    mvc.perform(
            patch("/api/recurring-expenses/subcategories/" + subcategoryId)
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isNoContent());
    mvc.perform(
            patch("/api/recurring-expenses/subcategories/" + subcategoryId)
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body.replace("\"name\":\"새 이름\"", "\"name\":\"오래된 요청\"")))
        .andExpect(status().isConflict());
    String duplicate =
        """
        {"name":"새 이름","expectedName":"새 이름","categoryId":"%s","expectedCategoryId":"%s"}
        """
            .formatted(categoryId, target.id());
    mvc.perform(
            patch("/api/recurring-expenses/subcategories/" + subcategoryId)
                .principal(() -> ownerId.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(duplicate))
        .andExpect(status().isBadRequest());
    assertEquals(
        target.id(),
        jdbc.queryForObject(
            "SELECT category_id FROM expense_subcategories WHERE id=?", UUID.class, subcategoryId));
  }

  private String classified(String json) {
    if (!json.contains("expectedAmount")) return json;
    String body = json.strip().replace("\"name\":", "\"memo\":");
    return body.substring(0, body.length() - 1)
        + ",\"categoryId\":\""
        + categoryId
        + "\",\"subcategoryId\":\""
        + subcategoryId
        + "\"}";
  }

  private void assertCount(String table, int expected) {
    Integer count =
        jdbc.queryForObject(
            "SELECT count(*) FROM " + table + " WHERE space_id = ?", Integer.class, spaceId);
    org.junit.jupiter.api.Assertions.assertEquals(expected, count);
  }
}
