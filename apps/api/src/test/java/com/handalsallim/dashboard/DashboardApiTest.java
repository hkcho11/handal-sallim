package com.handalsallim.dashboard;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.handalsallim.TestcontainersConfiguration;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class DashboardApiTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;
  MockMvc mvc;
  UUID user, partner, outsider, space, category, method;
  YearMonth month = YearMonth.now(ZoneId.of("Asia/Seoul"));

  @BeforeEach
  void setup() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
    user = UUID.randomUUID();
    partner = UUID.randomUUID();
    outsider = UUID.randomUUID();
    space = UUID.randomUUID();
    category = UUID.randomUUID();
    method = UUID.randomUUID();
    for (UUID id : new UUID[] {user, partner, outsider})
      jdbc.update(
          "INSERT INTO users (id,display_name,status,created_at,updated_at) VALUES (?,'테스트','ACTIVE',now(),now())",
          id);
    jdbc.update(
        "INSERT INTO spaces (id,management_mode,time_zone,status,created_by,created_at,updated_at) VALUES (?,'SHARED','Asia/Seoul','ACTIVE',?,now(),now())",
        space,
        user);
    for (UUID id : new UUID[] {user, partner})
      jdbc.update(
          "INSERT INTO space_members (space_id,user_id,role,status,joined_at,created_at,updated_at) VALUES (?,?,'MEMBER','ACTIVE',now(),now(),now())",
          space,
          id);
    jdbc.update(
        "INSERT INTO categories (id,space_id,name,applies_to,status,created_at,updated_at) VALUES (?,?,'식비','EXPENSE','ACTIVE',now(),now())",
        category,
        space);
    jdbc.update(
        "INSERT INTO payment_methods (id,space_id,name,type,status,created_at,updated_at) VALUES (?,?,'현금','CASH','ACTIVE',now(),now())",
        method,
        space);
    insertTransaction("SHARED", 50, month.atDay(1), "ACTIVE");
    insertTransaction("PRIVATE", 9999, month.atDay(1), "ACTIVE");
    insertTransaction("SHARED", 9999, month.minusMonths(1).atDay(1), "ACTIVE");
    insertTransaction("SHARED", 9999, month.atDay(1), "VOIDED");
    UUID expense = UUID.randomUUID(), revision = UUID.randomUUID(), charge = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO recurring_expenses (id,space_id,created_by,creation_key,status,created_at,updated_at) VALUES (?,?,?,?,'ACTIVE',now(),now())",
        expense,
        space,
        user,
        expense);
    jdbc.update(
        "INSERT INTO recurring_expense_revisions (id,space_id,recurring_expense_id,effective_from,name,interval_months,anchor_due_date,default_expected_amount,created_by,created_at) VALUES (?,?,?,?,'고정비',1,?,70,?,now())",
        revision,
        space,
        expense,
        month.atDay(1),
        month.atDay(1),
        user);
    jdbc.update(
        "INSERT INTO scheduled_charges (id,space_id,recurring_expense_id,recurring_expense_revision_id,due_date,expense_name,expected_amount,status,created_at,updated_at) VALUES (?,?,?,?,?,'고정비',70,'PENDING',now(),now())",
        charge,
        space,
        expense,
        revision,
        month.atDay(1));
  }

  void insertTransaction(String visibility, long amount, LocalDate date, String status) {
    UUID id = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO transactions (id,space_id,created_by,creation_key,creation_fingerprint,name,type,amount,occurred_on,category_id,payment_method_id,visibility,source,status,voided_at,voided_by,created_at,updated_at) VALUES (?,?,?,?,?,'거래','EXPENSE',?,?,?,?,?,'MANUAL',?,?,?,now(),now())",
        id,
        space,
        user,
        id,
        "0".repeat(64),
        amount,
        date,
        category,
        method,
        visibility,
        status,
        "VOIDED".equals(status) ? java.sql.Timestamp.from(java.time.Instant.now()) : null,
        "VOIDED".equals(status) ? user : null);
  }

  @Test
  void returnsOnlyActiveMonthlySharedTransactionsForBothMembers() throws Exception {
    for (UUID member : new UUID[] {user, partner})
      mvc.perform(
              get("/api/dashboard").principal(member::toString).param("month", month.toString()))
          .andExpect(status().isOk())
          .andExpect(header().string("Cache-Control", "no-store"))
          .andExpect(jsonPath("$.entries.length()").value(1))
          .andExpect(jsonPath("$.entries[0].amount").value(50))
          .andExpect(jsonPath("$.charges.length()").value(1))
          .andExpect(jsonPath("$.charges[0].expectedAmount").value(70));
  }

  @Test
  void refusesUnauthenticatedAndNonMemberAccessAndInvalidMonths() throws Exception {
    mvc.perform(get("/api/dashboard")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/dashboard").principal(outsider::toString))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/dashboard").principal(user::toString).param("month", "2026-13"))
        .andExpect(status().isBadRequest());
  }
}
