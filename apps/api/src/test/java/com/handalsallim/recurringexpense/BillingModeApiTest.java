package com.handalsallim.recurringexpense;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.handalsallim.FixedOctoberClockConfiguration;
import com.handalsallim.TestcontainersConfiguration;
import com.handalsallim.dashboard.application.DashboardService;
import com.handalsallim.recurringexpense.application.FixedExpenseService;
import com.handalsallim.recurringexpense.application.ScheduledChargeService;
import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import com.handalsallim.recurringexpense.domain.PaymentCompletion;
import java.time.*;
import java.util.UUID;
import org.junit.jupiter.api.*;
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
class BillingModeApiTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;
  @Autowired FixedExpenseService fixed;
  @Autowired ScheduledChargeService payments;
  @Autowired DashboardService dashboard;
  @Autowired com.handalsallim.recurringexpense.persistence.ScheduledChargeStore store;
  @Autowired org.springframework.transaction.PlatformTransactionManager transactionManager;
  MockMvc mvc;
  UUID user, space, category, sub, payment;

  @BeforeEach
  void setup() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
    user = UUID.randomUUID();
    space = UUID.randomUUID();
    category = UUID.randomUUID();
    sub = UUID.randomUUID();
    payment = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO users(id,display_name,status,created_at,updated_at) VALUES (?,'테스트','ACTIVE',now(),now())",
        user);
    jdbc.update(
        "INSERT INTO spaces(id,management_mode,time_zone,status,created_by,created_at,updated_at) VALUES (?,'SOLO','Asia/Seoul','ACTIVE',?,now(),now())",
        space,
        user);
    jdbc.update(
        "INSERT INTO space_members(space_id,user_id,role,status,joined_at,created_at,updated_at) VALUES (?,?,'OWNER','ACTIVE',now(),now(),now())",
        space,
        user);
    jdbc.update(
        "INSERT INTO categories(id,space_id,name,applies_to,status,created_at,updated_at) VALUES (?,?,'공과금','EXPENSE','ACTIVE',now(),now())",
        category,
        space);
    jdbc.update(
        "INSERT INTO expense_subcategories(id,space_id,category_id,name,status,created_at) VALUES (?,?,?,'전기','ACTIVE',now())",
        sub,
        space,
        category);
    jdbc.update(
        "INSERT INTO payment_methods(id,space_id,name,type,status,created_at,updated_at) VALUES (?,?,'현금','CASH','ACTIVE',now(),now())",
        payment,
        space);
  }

  FixedExpenseDetails details(String mode) {
    return new FixedExpenseDetails(
        "전기",
        mode.equals("VARIABLE") ? null : 30000L,
        mode.equals("VARIABLE") ? null : 1,
        mode.equals("VARIABLE") ? null : 10,
        mode.equals("VARIABLE") ? null : LocalDate.of(2026, 10, 10),
        null,
        mode.equals("VARIABLE") ? null : payment,
        category,
        sub,
        null,
        mode,
        mode.equals("VARIABLE") ? YearMonth.of(2026, 10) : null);
  }

  @Test
  void variableRecordsOnlyOnInputUsesBillingMonthAndEditsOneTransaction() {
    var expense = fixed.create(user, UUID.randomUUID(), details("VARIABLE"));
    assertNull(expense.expectedAmount());
    assertTrue(payments.list(user, expense.id()).isEmpty());
    var key = UUID.randomUUID();
    var input = new PaymentCompletion(50000, LocalDate.of(2026, 11, 10), payment, 0);
    var recorded = payments.record(user, expense.id(), key, YearMonth.of(2026, 10), input);
    assertEquals("COMPLETED", recorded.status());
    assertEquals(
        recorded.id(),
        payments.record(user, expense.id(), key, YearMonth.of(2026, 10), input).id());
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id=?", Integer.class, space));
    assertEquals(
        50000L, dashboard.read(user, YearMonth.of(2026, 10)).entries().getFirst().amount());
    assertTrue(dashboard.read(user, YearMonth.of(2026, 11)).entries().isEmpty());
    assertEquals(1, dashboard.readFixedCosts(user, YearMonth.of(2026, 10)).charges().size());
    assertTrue(
        dashboard.readFixedCosts(user, YearMonth.of(2026, 11)).charges().stream()
            .noneMatch(c -> c.dueDate().getMonthValue() == 11));
    var edited =
        payments.edit(
            user,
            recorded.id(),
            YearMonth.of(2026, 9),
            new PaymentCompletion(52000, LocalDate.of(2026, 11, 11), payment, recorded.version()));
    assertEquals(52000L, edited.actualAmount());
    assertEquals(52000L, dashboard.read(user, YearMonth.of(2026, 9)).entries().getFirst().amount());
    assertTrue(dashboard.read(user, YearMonth.of(2026, 10)).entries().isEmpty());
    assertThrows(
        RuntimeException.class,
        () -> payments.edit(user, recorded.id(), YearMonth.of(2026, 10), input));
    assertThrows(
        RuntimeException.class,
        () ->
            payments.record(
                UUID.randomUUID(), expense.id(), UUID.randomUUID(), YearMonth.of(2026, 10), input));
  }

  @Test
  void fixedCompletesOnDueDateNeverGeneratesFutureAndKeepsEdits() {
    var expense = fixed.create(user, UUID.randomUUID(), details("FIXED"));
    var list = payments.list(user, expense.id());
    assertEquals(1, list.size());
    assertEquals("COMPLETED", list.getFirst().status());
    payments.ensure(user, YearMonth.of(2027, 1));
    assertEquals(1, payments.list(user, expense.id()).size());
    var c = list.getFirst();
    payments.edit(
        user,
        c.id(),
        YearMonth.of(2026, 10),
        new PaymentCompletion(35000, LocalDate.of(2026, 10, 11), payment, c.version()));
    assertEquals(35000L, payments.list(user, expense.id()).getFirst().actualAmount());
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id=?", Integer.class, space));
  }

  @Test
  void convertingLegacyDoesNotAutoCompletePastPendingCharges() {
    var expense = fixed.create(user, UUID.randomUUID(), details("LEGACY"));
    assertEquals("PENDING", payments.list(user, expense.id()).getFirst().status());
    fixed.updateDetails(user, expense.id(), details("FIXED"));
    assertTrue(payments.list(user, expense.id()).isEmpty());
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id=?", Integer.class, space));
  }

  @Test
  void schedulerCatchesUpOnDueDateWithoutBrowserAndClampsMonthEnd() {
    var d =
        new FixedExpenseDetails(
            "전기",
            30000L,
            1,
            31,
            LocalDate.of(2026, 10, 31),
            null,
            payment,
            category,
            sub,
            null,
            "FIXED",
            null);
    var expense = fixed.create(user, UUID.randomUUID(), d);
    assertTrue(payments.list(user, expense.id()).isEmpty());
    var laterClock = Clock.fixed(Instant.parse("2026-11-30T03:00:00Z"), ZoneId.of("Asia/Seoul"));
    new org.springframework.transaction.support.TransactionTemplate(transactionManager)
        .execute(
            status -> {
              var later = new ScheduledChargeService(store, laterClock);
              later.generateSpace(space, LocalDate.of(2026, 11, 30));
              later.generateSpace(space, LocalDate.of(2026, 11, 30));
              return null;
            });
    var charges = payments.list(user, expense.id());
    assertEquals(2, charges.size());
    assertEquals(LocalDate.of(2026, 11, 30), charges.getFirst().actualPaidOn());
    assertTrue(charges.stream().allMatch(c -> c.status().equals("COMPLETED")));
    assertEquals(
        2,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id=?", Integer.class, space));
  }

  @Test
  void convertingToVariablePreservesCompletedHistory() {
    var expense = fixed.create(user, UUID.randomUUID(), details("LEGACY"));
    var charge = payments.list(user, expense.id()).getFirst();
    payments.complete(
        user,
        charge.id(),
        new PaymentCompletion(25000, LocalDate.of(2026, 10, 10), payment, charge.version()));
    fixed.updateDetails(user, expense.id(), details("VARIABLE"));
    var saved = payments.list(user, expense.id());
    assertEquals(1, saved.size());
    assertEquals(25000L, saved.getFirst().actualAmount());
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id=?", Integer.class, space));
  }

  @Test
  void manualRecordingPreservesCancelledLegacyChargeOnTheFirstOfTheMonth() {
    var legacy =
        new FixedExpenseDetails(
            "전기",
            30000L,
            1,
            1,
            LocalDate.of(2026, 10, 1),
            null,
            payment,
            category,
            sub,
            null,
            "LEGACY",
            null);
    var expense = fixed.create(user, UUID.randomUUID(), legacy);
    fixed.updateDetails(user, expense.id(), details("VARIABLE"));
    var recorded =
        payments.record(
            user,
            expense.id(),
            UUID.randomUUID(),
            YearMonth.of(2026, 10),
            new PaymentCompletion(50000, LocalDate.of(2026, 11, 10), payment, 0));
    assertEquals("COMPLETED", recorded.status());
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM scheduled_charges WHERE recurring_expense_id=? AND status='CANCELLED'",
            Integer.class,
            expense.id()));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id=?", Integer.class, space));
  }

  @Test
  void validatesHttpInputAndDuplicateMonths() throws Exception {
    var expense = fixed.create(user, UUID.randomUUID(), details("VARIABLE"));
    String body =
        "{\"billingMonth\":\"2026-10\",\"amount\":50000,\"paidOn\":\"2026-11-10\",\"paymentMethodId\":\"%s\",\"version\":0}"
            .formatted(payment);
    String path = "/api/recurring-expenses/" + expense.id() + "/payments";
    mvc.perform(
            post(path)
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.billingMonth").value("2026-10"));
    mvc.perform(
            post(path)
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isConflict());
    mvc.perform(
            post(path)
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body.replace("50000", "1.5")))
        .andExpect(status().isBadRequest());
  }
}
