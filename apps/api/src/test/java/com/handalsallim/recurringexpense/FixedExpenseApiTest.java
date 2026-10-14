package com.handalsallim.recurringexpense;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class FixedExpenseApiTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;
  MockMvc mvc;
  UUID ownerId;
  UUID spaceId;

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
  }

  @Test
  void createsOneExpenseAndOneChargeWhenRequestIsRetried() throws Exception {
    UUID key = UUID.randomUUID();
    String request =
        """
        {"name":"월세","expectedAmount":650000,"intervalMonths":1,"firstDueDate":"2026-10-15"}
        """;
    for (int attempt = 0; attempt < 2; attempt++) {
      mvc.perform(
              post("/api/recurring-expenses")
                  .principal(() -> ownerId.toString())
                  .header("Idempotency-Key", key.toString())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(request))
          .andExpect(status().isCreated())
          .andExpect(jsonPath("$.name").value("월세"))
          .andExpect(jsonPath("$.expectedAmount").value(650000))
          .andExpect(jsonPath("$.firstDueDate").value("2026-10-15"));
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
  void rejectsAnonymousAndUserWithoutActiveMembership() throws Exception {
    mvc.perform(get("/api/recurring-expenses"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    mvc.perform(
            post("/api/recurring-expenses")
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"월세","expectedAmount":650000,"intervalMonths":1,"firstDueDate":"2026-10-15"}
                    """))
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
        {"name":"월세","expectedAmount":650000,"intervalMonths":1,"firstDueDate":"2026-10-15"}
        """;
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(request))
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

    mvc.perform(get("/api/recurring-expenses").principal(() -> otherUser.toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> otherUser.toString())
                .header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(request))
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
        {"name":"월세","expectedAmount":650000,"intervalMonths":1,"firstDueDate":"2026-10-15"}
        """;
    String changed =
        """
        {"name":"월세","expectedAmount":700000,"intervalMonths":1,"firstDueDate":"2026-10-15"}
        """;
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(first))
        .andExpect(status().isCreated());
    mvc.perform(
            post("/api/recurring-expenses")
                .principal(() -> ownerId.toString())
                .header("Idempotency-Key", key.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(changed))
        .andExpect(status().isConflict());
    assertCount("scheduled_charges", 1);
  }

  @Test
  void rejectsFractionalMoneyAndIntervalWithoutWriting() throws Exception {
    for (String request :
        new String[] {
          """
          {"name":"월세","expectedAmount":650000.5,"intervalMonths":1,"firstDueDate":"2026-10-15"}
          """,
          """
          {"name":"월세","expectedAmount":650000,"intervalMonths":1.5,"firstDueDate":"2026-10-15"}
          """,
          """
          {"name":"월세","expectedAmount":"650000","intervalMonths":1,"firstDueDate":"2026-10-15"}
          """
        }) {
      mvc.perform(
              post("/api/recurring-expenses")
                  .principal(() -> ownerId.toString())
                  .header("Idempotency-Key", UUID.randomUUID().toString())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(request))
          .andExpect(status().isBadRequest());
    }
    assertCount("recurring_expenses", 0);
    assertCount("scheduled_charges", 0);
  }

  private void assertCount(String table, int expected) {
    Integer count =
        jdbc.queryForObject(
            "SELECT count(*) FROM " + table + " WHERE space_id = ?", Integer.class, spaceId);
    org.junit.jupiter.api.Assertions.assertEquals(expected, count);
  }
}
