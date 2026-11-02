package com.handalsallim.sharing;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.handalsallim.TestcontainersConfiguration;
import com.handalsallim.auth.application.AuthService;
import com.handalsallim.recurringexpense.application.FixedExpenseService;
import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import com.handalsallim.sharing.application.SharingService;
import com.handalsallim.sharing.domain.MemberCode;
import jakarta.servlet.Filter;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = {"app.auth.secure-cookies=false", "app.auth.check-breaches=false"})
@Import(TestcontainersConfiguration.class)
class SharingApiTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;
  @Autowired PasswordEncoder encoder;
  @Autowired AuthService auth;
  @Autowired SharingService sharing;
  @Autowired FixedExpenseService fixed;

  @Autowired
  @Qualifier("springSessionRepositoryFilter")
  Filter sessions;

  @Autowired
  @Qualifier("springSecurityFilterChain")
  Filter security;

  MockMvc mvc;
  User a, b, c;
  Cookie csrf = new Cookie("XSRF-TOKEN", "sharing-fixture");

  record User(UUID id, UUID space, Cookie session, String code) {}

  @BeforeEach
  void setup() throws Exception {
    mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(sessions, security).build();
    a = user("첫 사용자", true);
    b = user("둘째 사용자", true);
    c = user("다른 사용자", true);
  }

  User user(String name, boolean withSpace) throws Exception {
    UUID id = UUID.randomUUID();
    String email = "sharing-" + id + "@example.test";
    jdbc.update(
        "INSERT INTO users(id,display_name,status,created_at,updated_at) VALUES (?,?,'ACTIVE',now(),now())",
        id,
        name);
    jdbc.update(
        "INSERT INTO password_credentials(user_id,email_address,email_lookup_key,password_hash,email_verified_at,password_changed_at,created_at,updated_at) VALUES (?,?,?,?,now(),now(),now(),now())",
        id,
        email,
        email,
        encoder.encode("SharingFixture82!"));
    if (withSpace) auth.createSpace(id, name + "의 이전 살림");
    var result =
        mvc.perform(
                post("/api/auth/login")
                    .cookie(csrf)
                    .header("X-XSRF-TOKEN", csrf.getValue())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"SharingFixture82!\"}"))
            .andExpect(status().isOk())
            .andReturn();
    UUID space =
        withSpace
            ? jdbc.queryForObject(
                "SELECT space_id FROM space_members WHERE user_id=? AND status='ACTIVE'",
                UUID.class,
                id)
            : null;
    return new User(
        id, space, result.getResponse().getCookie("HS_SESSION"), sharing.view(id).memberCode());
  }

  MockHttpServletRequestBuilder write(User user, String path, String body) {
    return post(path)
        .cookie(csrf, user.session())
        .header("X-XSRF-TOKEN", csrf.getValue())
        .contentType(MediaType.APPLICATION_JSON)
        .content(body);
  }

  UUID send(User from, User to) throws Exception {
    mvc.perform(write(from, "/api/sharing/requests", "{\"memberCode\":\"" + to.code() + "\"}"))
        .andExpect(status().isOk());
    return sharing.view(to.id()).received().stream()
        .filter(r -> r.status().equals("PENDING") && r.memberCode().equals(from.code()))
        .findFirst()
        .orElseThrow()
        .id();
  }

  MockHttpServletRequestBuilder decide(User user, UUID request, String action) {
    return write(user, "/api/sharing/requests/" + request, "{\"action\":\"" + action + "\"}");
  }

  void income(User user, String name) throws Exception {
    mvc.perform(
            write(
                    user,
                    "/api/incomes",
                    "{\"name\":\"" + name + "\",\"amount\":12000,\"month\":\"2026-10\"}")
                .header("Idempotency-Key", UUID.randomUUID()))
        .andExpect(status().isCreated());
  }

  UUID disconnect(User from) throws Exception {
    UUID space = sharing.view(from.id()).connection().spaceId();
    mvc.perform(write(from, "/api/sharing/connections/" + space + "/disconnect-requests", "{}"))
        .andExpect(status().isOk());
    return sharing.view(from.id()).connection().disconnectRequest().id();
  }

  MockHttpServletRequestBuilder disconnectDecision(User user, UUID id, String action) {
    return write(user, "/api/sharing/disconnect-requests/" + id, "{\"action\":\"" + action + "\"}");
  }

  @Test
  void mutualDisconnectPreservesHistoryAndStartsEmptyIsolatedPersonalSpaces() throws Exception {
    income(a, "연결 전 개인 수입");
    mvc.perform(decide(b, send(a, b), "ACCEPT")).andExpect(status().isOk());
    UUID shared = sharing.view(a.id()).connection().spaceId();
    income(a, "보존할 공유 수입");
    savings(b, "보존할 공유 저축");
    UUID sharedIncome =
        jdbc.queryForObject("SELECT id FROM incomes WHERE space_id=?", UUID.class, shared);
    UUID id = disconnect(a);
    assertTrue(sharing.view(a.id()).connection().disconnectRequest().requestedByMe());
    assertFalse(sharing.view(b.id()).connection().disconnectRequest().requestedByMe());
    assertEquals(shared, sharing.view(b.id()).connection().spaceId());
    income(b, "요청 중 수입");
    mvc.perform(disconnectDecision(a, id, "ACCEPT")).andExpect(status().isForbidden());
    mvc.perform(disconnectDecision(c, id, "ACCEPT")).andExpect(status().isNotFound());
    mvc.perform(disconnectDecision(b, id, "CANCEL")).andExpect(status().isForbidden());
    mvc.perform(disconnectDecision(b, id, "ACCEPT")).andExpect(status().isOk());
    assertNull(sharing.view(a.id()).connection());
    assertNull(sharing.view(b.id()).connection());
    for (User user : new User[] {a, b}) {
      mvc.perform(get("/api/incomes?month=2026-10").cookie(user.session()))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.items.length()").value(0));
      mvc.perform(get("/api/savings").cookie(user.session()))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.items.length()").value(0));
      mvc.perform(get("/api/recurring-expenses").cookie(user.session()))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.length()").value(0));
      mvc.perform(get("/api/incomes/" + sharedIncome).cookie(user.session()))
          .andExpect(status().isNotFound());
      var archive =
          sharing.archives(user.id()).stream()
              .filter(x -> x.scope().equals("SHARED"))
              .findFirst()
              .orElseThrow();
      assertEquals(shared, archive.spaceId());
      assertTrue(archive.entries().stream().anyMatch(x -> x.name().equals("요청 중 수입")));
      assertTrue(archive.entries().stream().anyMatch(x -> x.name().equals("보존할 공유 저축")));
    }
    assertEquals(
        1,
        sharing.archives(a.id()).stream()
            .filter(
                x ->
                    x.scope().equals("PRIVATE")
                        && x.entries().stream().anyMatch(e -> e.name().equals("연결 전 개인 수입")))
            .count());
    assertFalse(
        sharing.archives(b.id()).stream()
            .anyMatch(x -> x.entries().stream().anyMatch(e -> e.name().equals("연결 전 개인 수입"))));
    assertFalse(sharing.archives(c.id()).stream().anyMatch(x -> x.spaceId().equals(shared)));
    assertThrows(
        org.springframework.dao.DataAccessException.class,
        () -> jdbc.update("UPDATE incomes SET amount=999 WHERE id=?", sharedIncome));
    income(a, "해제 후 개인 수입");
    mvc.perform(get("/api/incomes?month=2026-10").cookie(b.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(0));
    mvc.perform(disconnectDecision(b, id, "ACCEPT")).andExpect(status().isOk());
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM space_members WHERE user_id=? AND status='ACTIVE'",
            Integer.class,
            a.id()));
    // Reconnecting is a new space; neither an old request nor an old connection can end it.
    mvc.perform(decide(b, send(a, b), "ACCEPT")).andExpect(status().isOk());
    UUID next = sharing.view(a.id()).connection().spaceId();
    assertNotEquals(shared, next);
    mvc.perform(disconnectDecision(b, id, "ACCEPT")).andExpect(status().isOk());
    mvc.perform(write(a, "/api/sharing/connections/" + shared + "/disconnect-requests", "{}"))
        .andExpect(status().isConflict());
    assertEquals(next, sharing.view(a.id()).connection().spaceId());
    mvc.perform(get("/api/incomes?month=2026-10").cookie(a.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(0));
  }

  @Test
  void disconnectRejectionCancellationExpiryAndOppositeRequestsRequireFreshConsent()
      throws Exception {
    mvc.perform(decide(b, send(a, b), "ACCEPT")).andExpect(status().isOk());
    UUID shared = sharing.view(a.id()).connection().spaceId();
    mvc.perform(write(c, "/api/sharing/connections/" + shared + "/disconnect-requests", "{}"))
        .andExpect(status().isNotFound());
    UUID rejected = disconnect(a);
    assertEquals(rejected, disconnect(a));
    assertEquals(rejected, disconnect(b));
    assertNotNull(sharing.view(a.id()).connection());
    mvc.perform(disconnectDecision(b, rejected, "REJECT")).andExpect(status().isOk());
    mvc.perform(disconnectDecision(b, rejected, "ACCEPT")).andExpect(status().isConflict());
    UUID cancelled = disconnect(a);
    mvc.perform(disconnectDecision(a, cancelled, "CANCEL")).andExpect(status().isOk());
    mvc.perform(disconnectDecision(b, cancelled, "ACCEPT")).andExpect(status().isConflict());
    UUID expired = disconnect(a);
    jdbc.update(
        "UPDATE sharing_disconnect_requests SET expires_at=now()-interval '1 second' WHERE id=?",
        expired);
    mvc.perform(disconnectDecision(b, expired, "ACCEPT")).andExpect(status().isConflict());
    assertNull(sharing.view(a.id()).connection().disconnectRequest());
    UUID next = disconnect(b);
    assertNotEquals(expired, next);
    mvc.perform(disconnectDecision(a, next, "ACCEPT")).andExpect(status().isOk());
    assertNull(sharing.view(b.id()).connection());
  }

  @Test
  void concurrentDisconnectAcceptancesCreateExactlyOnePersonalSpacePerMember() throws Exception {
    mvc.perform(decide(b, send(a, b), "ACCEPT")).andExpect(status().isOk());
    UUID shared = sharing.view(a.id()).connection().spaceId();
    UUID id = disconnect(a);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var first =
          pool.submit(
              () ->
                  mvc.perform(disconnectDecision(b, id, "ACCEPT"))
                      .andReturn()
                      .getResponse()
                      .getStatus());
      var second =
          pool.submit(
              () ->
                  mvc.perform(disconnectDecision(b, id, "ACCEPT"))
                      .andReturn()
                      .getResponse()
                      .getStatus());
      assertEquals(200, first.get(15, java.util.concurrent.TimeUnit.SECONDS));
      assertEquals(200, second.get(15, java.util.concurrent.TimeUnit.SECONDS));
    }
    assertEquals(
        2,
        jdbc.queryForObject(
            "SELECT count(*) FROM shared_space_archives WHERE space_id=?", Integer.class, shared));
    for (User user : new User[] {a, b})
      assertEquals(
          1,
          jdbc.queryForObject(
              "SELECT count(*) FROM space_members WHERE user_id=? AND status='ACTIVE'",
              Integer.class,
              user.id()));
  }

  @Test
  void failedPersonalSpaceCreationRollsBackBothMembershipsAndArchive() throws Exception {
    mvc.perform(decide(b, send(a, b), "ACCEPT")).andExpect(status().isOk());
    UUID shared = sharing.view(a.id()).connection().spaceId();
    UUID id = disconnect(a);
    String constraint = "reject_solo_" + UUID.randomUUID().toString().replace("-", "");
    // Deliberately fail late in the transaction, after the archive/membership updates.
    jdbc.execute(
        "ALTER TABLE spaces ADD CONSTRAINT "
            + constraint
            + " CHECK (management_mode <> 'SOLO' OR created_by <> '"
            + b.id()
            + "') NOT VALID");
    try {
      mvc.perform(disconnectDecision(b, id, "ACCEPT")).andExpect(status().isInternalServerError());
      assertEquals(shared, sharing.view(a.id()).connection().spaceId());
      assertEquals(shared, sharing.view(b.id()).connection().spaceId());
      assertEquals(
          0,
          jdbc.queryForObject(
              "SELECT count(*) FROM shared_space_archives WHERE space_id=?",
              Integer.class,
              shared));
    } finally {
      jdbc.execute("ALTER TABLE spaces DROP CONSTRAINT " + constraint);
    }
    mvc.perform(disconnectDecision(b, id, "ACCEPT")).andExpect(status().isOk());
  }

  void savings(User user, String name) throws Exception {
    mvc.perform(
            write(
                    user,
                    "/api/savings",
                    "{\"name\":\""
                        + name
                        + "\",\"type\":\"INSTALLMENT\",\"depositAmount\":1000,\"currentAmount\":5000}")
                .header("Idempotency-Key", UUID.randomUUID()))
        .andExpect(status().isCreated());
  }

  UUID fixed(User user) {
    UUID category =
        jdbc.queryForObject(
            "SELECT id FROM categories WHERE space_id=? AND name='통신'", UUID.class, user.space());
    UUID sub = fixed.addSubcategory(user.id(), category, "이전 통신비").id();
    UUID cash =
        jdbc.queryForObject(
            "SELECT id FROM payment_methods WHERE space_id=? AND type='CASH'",
            UUID.class,
            user.space());
    return fixed
        .create(
            user.id(),
            UUID.randomUUID(),
            new FixedExpenseDetails(
                "통신비",
                35000L,
                1,
                15,
                LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).minusMonths(2),
                null,
                cash,
                category,
                sub,
                "다음 회차 설정"))
        .id();
  }

  @Test
  void acceptancePreservesBothPrivateHistoriesAndSharesOnlyNewRecordsAndFutureCharges()
      throws Exception {
    income(a, "첫 비공개 수입");
    income(b, "둘째 비공개 수입");
    savings(a, "첫 이전 저축");
    savings(b, "둘째 이전 저축");
    UUID original = fixed(a);
    UUID request = send(b, a);
    assertNull(sharing.view(a.id()).connection());
    mvc.perform(decide(a, request, "ACCEPT"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.connection.partnerName").value("둘째 사용자"));
    UUID shared = sharing.view(a.id()).connection().spaceId();
    assertEquals(shared, sharing.view(b.id()).connection().spaceId());
    for (User user : new User[] {a, b}) {
      mvc.perform(get("/api/incomes?month=2026-10").cookie(user.session()))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.items.length()").value(0));
      mvc.perform(get("/api/savings").cookie(user.session()))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.items.length()").value(0));
    }
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM recurring_expenses WHERE space_id=?", Integer.class, shared));
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM scheduled_charges WHERE space_id=? AND due_date<=CURRENT_DATE",
            Integer.class,
            shared));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM recurring_expenses WHERE id=? AND space_id=?",
            Integer.class,
            original,
            a.space()));
    assertThrows(
        org.springframework.dao.DataAccessException.class,
        () -> jdbc.update("UPDATE incomes SET amount=999 WHERE space_id=?", a.space()));
    String first =
        mvc.perform(get("/api/sharing/archives").cookie(a.session()))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
    assertTrue(first.contains("첫 비공개 수입"));
    assertTrue(first.contains("첫 이전 저축"));
    assertFalse(first.contains("둘째 비공개 수입"));
    String second =
        mvc.perform(get("/api/sharing/archives").cookie(b.session()))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
    assertTrue(second.contains("둘째 비공개 수입"));
    assertFalse(second.contains("첫 비공개 수입"));
    mvc.perform(write(a, "/api/personal-expenses", "{}")).andExpect(status().isForbidden());
    income(a, "새 공동 수입");
    savings(b, "새 공동 저축");
    mvc.perform(get("/api/incomes?month=2026-10").cookie(b.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].name").value("새 공동 수입"));
    mvc.perform(get("/api/savings").cookie(a.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].name").value("새 공동 저축"));
    mvc.perform(decide(a, request, "ACCEPT")).andExpect(status().isOk());
    assertEquals(shared, sharing.view(a.id()).connection().spaceId());
    mvc.perform(write(c, "/api/sharing/requests", "{\"memberCode\":\"" + a.code() + "\"}"))
        .andExpect(status().isConflict());
  }

  @Test
  void verifiedSessionCsrfAndRecipientConsentAreRequiredAndDuplicateRequestsDoNotDuplicate()
      throws Exception {
    mvc.perform(get("/api/sharing")).andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/sharing/requests")
                .cookie(a.session())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isForbidden());
    mvc.perform(write(a, "/api/sharing/requests", "{\"memberCode\":\"" + a.code() + "\"}"))
        .andExpect(status().isBadRequest());
    UUID request = send(a, b);
    send(a, b);
    mvc.perform(write(b, "/api/sharing/requests", "{\"memberCode\":\"" + a.code() + "\"}"))
        .andExpect(status().isConflict());
    assertEquals(
        1,
        sharing.view(b.id()).received().stream().filter(r -> r.status().equals("PENDING")).count());
    mvc.perform(decide(a, request, "ACCEPT")).andExpect(status().isForbidden());
    mvc.perform(decide(c, request, "ACCEPT")).andExpect(status().isNotFound());
    assertNull(sharing.view(a.id()).connection());
    jdbc.update("UPDATE password_credentials SET email_verified_at=NULL WHERE user_id=?", a.id());
    mvc.perform(get("/api/sharing").cookie(a.session())).andExpect(status().isUnauthorized());
  }

  @Test
  void rejectCancelExpiryAndCodeRotationCannotBeReplayed() throws Exception {
    UUID rejected = send(a, b);
    mvc.perform(decide(b, rejected, "REJECT")).andExpect(status().isOk());
    mvc.perform(decide(b, rejected, "ACCEPT")).andExpect(status().isConflict());
    UUID cancelled = send(a, b);
    mvc.perform(decide(a, cancelled, "CANCEL")).andExpect(status().isOk());
    mvc.perform(decide(b, cancelled, "ACCEPT")).andExpect(status().isConflict());
    UUID expired = send(a, b);
    jdbc.update(
        "UPDATE sharing_requests SET expires_at=now()-interval '1 second' WHERE id=?", expired);
    mvc.perform(decide(b, expired, "ACCEPT")).andExpect(status().isConflict());
    assertTrue(
        sharing.view(b.id()).received().stream()
            .anyMatch(r -> r.id().equals(expired) && r.status().equals("EXPIRED")));
    UUID pending = send(a, b);
    mvc.perform(write(b, "/api/sharing/member-code", "{}")).andExpect(status().isOk());
    String next = sharing.view(b.id()).memberCode();
    assertNotEquals(b.code(), next);
    mvc.perform(write(a, "/api/sharing/lookup", "{\"memberCode\":\"" + b.code() + "\"}"))
        .andExpect(status().isNotFound());
    mvc.perform(decide(b, pending, "ACCEPT")).andExpect(status().isConflict());
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM member_codes WHERE code=? AND revoked_at IS NOT NULL",
            Integer.class,
            MemberCode.normalize(b.code())));
  }

  @Test
  void unknownCodeAttemptsAreRateLimitedEvenWhenTheyFail() throws Exception {
    for (int i = 0; i < 30; i++)
      mvc.perform(write(a, "/api/sharing/lookup", "{\"memberCode\":\"2222-2222\"}"))
          .andExpect(status().isNotFound());
    mvc.perform(write(a, "/api/sharing/lookup", "{\"memberCode\":\"2222-2222\"}"))
        .andExpect(status().isTooManyRequests());
  }

  @Test
  void competingAcceptancesCreateOnlyOneConnection() throws Exception {
    UUID first = send(a, b), second = send(c, b);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var one =
          pool.submit(
              () -> mvc.perform(decide(b, first, "ACCEPT")).andReturn().getResponse().getStatus());
      var two =
          pool.submit(
              () -> mvc.perform(decide(b, second, "ACCEPT")).andReturn().getResponse().getStatus());
      var result =
          java.util.List.of(
              one.get(15, java.util.concurrent.TimeUnit.SECONDS),
              two.get(15, java.util.concurrent.TimeUnit.SECONDS));
      assertEquals(1, result.stream().filter(status -> status == 200).count());
      assertEquals(1, result.stream().filter(status -> status == 409).count());
    }
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM sharing_connections WHERE first_user_id=? OR second_user_id=?",
            Integer.class,
            b.id(),
            b.id()));
    UUID shared = sharing.view(b.id()).connection().spaceId();
    assertEquals(
        2,
        jdbc.queryForObject(
            "SELECT count(*) FROM space_members WHERE space_id=? AND status='ACTIVE'",
            Integer.class,
            shared));
  }

  @Test
  void usersWithoutPersonalSpacesCanConnectAndCodesAreNormalized() throws Exception {
    User fresh = user("공간 없는 사용자", false);
    assertEquals(MemberCode.normalize(a.code()), MemberCode.normalize(a.code().toLowerCase()));
    UUID request = send(fresh, a);
    mvc.perform(decide(a, request, "ACCEPT")).andExpect(status().isOk());
    assertTrue(auth.hasSpace(fresh.id()));
    assertEquals(0, sharing.archives(fresh.id()).size());
  }

  @Test
  void prepaidFutureChargeIsNotRecreatedAsAnUnpaidSharedCharge() throws Exception {
    UUID expense = fixed(a);
    LocalDate paidDue = LocalDate.now(java.time.ZoneId.of("Asia/Seoul")).plusDays(1);
    UUID method =
        jdbc.queryForObject(
            "SELECT id FROM payment_methods WHERE space_id=? AND type='CASH'",
            UUID.class,
            a.space());
    jdbc.update(
        "UPDATE scheduled_charges SET due_date=?,status='COMPLETED',actual_amount=35000,actual_paid_on=CURRENT_DATE,actual_payment_method_id=?,completed_by=?,completed_at=now() WHERE id=(SELECT id FROM scheduled_charges WHERE recurring_expense_id=? ORDER BY due_date LIMIT 1)",
        paidDue,
        method,
        a.id(),
        expense);
    jdbc.update(
        "INSERT INTO transactions(id,space_id,created_by,type,amount,occurred_on,payment_method_id,visibility,source,scheduled_charge_id,status,created_at,updated_at) SELECT ?,space_id,?,'EXPENSE',actual_amount,actual_paid_on,actual_payment_method_id,'SHARED','SCHEDULED_CHARGE',id,'ACTIVE',now(),now() FROM scheduled_charges WHERE recurring_expense_id=? AND status='COMPLETED'",
        UUID.randomUUID(),
        a.id(),
        expense);
    UUID request = send(a, b);
    mvc.perform(decide(b, request, "ACCEPT")).andExpect(status().isOk());
    UUID shared = sharing.view(a.id()).connection().spaceId();
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM scheduled_charges WHERE space_id=? AND due_date<=?",
            Integer.class,
            shared,
            paidDue));
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id=?", Integer.class, shared));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM transactions WHERE space_id=?", Integer.class, a.space()));
  }

  MockHttpServletRequestBuilder edit(User user, String path, String body) {
    return put(path)
        .cookie(csrf, user.session())
        .header("X-XSRF-TOKEN", csrf.getValue())
        .contentType(MediaType.APPLICATION_JSON)
        .content(body);
  }

  UUID created(org.springframework.test.web.servlet.MvcResult result) throws Exception {
    return UUID.fromString(
        result.getResponse().getContentAsString().split("\"id\":\"")[1].split("\"")[0]);
  }

  @Test
  void actualConnectedMembersCanEditAndDeleteEachOthersIncomeAndSavings() throws Exception {
    UUID request = send(a, b);
    mvc.perform(decide(b, request, "ACCEPT")).andExpect(status().isOk());
    for (User user : new User[] {a, b}) {
      mvc.perform(get("/api/incomes/members").cookie(user.session()))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.currentUserId").value(user.id().toString()))
          .andExpect(jsonPath("$.members.length()").value(2));
      mvc.perform(get("/api/savings/members").cookie(user.session()))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.members.length()").value(2));
    }
    UUID income =
        created(
            mvc.perform(
                    write(
                            a,
                            "/api/incomes",
                            "{\"name\":\"공동 수입\",\"amount\":12000,\"month\":\"2026-10\",\"ownerUserId\":\""
                                + b.id()
                                + "\"}")
                        .header("Idempotency-Key", UUID.randomUUID()))
                .andExpect(status().isCreated())
                .andReturn());
    mvc.perform(
            edit(
                b,
                "/api/incomes/" + income,
                "{\"name\":\"상대가 수정한 수입\",\"amount\":15000,\"month\":\"2026-10\",\"version\":0}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(b.id().toString()));
    mvc.perform(get("/api/incomes/" + income).cookie(a.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.amount").value(15000));
    mvc.perform(get("/api/incomes/" + income).cookie(c.session())).andExpect(status().isNotFound());
    mvc.perform(
            delete("/api/incomes/" + income + "?version=1")
                .cookie(csrf, b.session())
                .header("X-XSRF-TOKEN", csrf.getValue()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/incomes?month=2026-10").cookie(a.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalAmount").value("0"));
    UUID saving =
        created(
            mvc.perform(
                    write(
                            a,
                            "/api/savings",
                            "{\"name\":\"공동 저축\",\"type\":\"INSTALLMENT\",\"depositAmount\":1000,\"currentAmount\":5000}")
                        .header("Idempotency-Key", UUID.randomUUID()))
                .andExpect(status().isCreated())
                .andReturn());
    mvc.perform(
            edit(
                b,
                "/api/savings/" + saving,
                "{\"name\":\"상대가 수정한 저축\",\"type\":\"INSTALLMENT\",\"depositAmount\":2000,\"currentAmount\":7000,\"version\":0}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(a.id().toString()));
    mvc.perform(get("/api/savings/" + saving).cookie(a.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.currentAmount").value(7000));
    mvc.perform(get("/api/savings/" + saving).cookie(c.session())).andExpect(status().isNotFound());
    mvc.perform(
            delete("/api/savings/" + saving + "?version=1")
                .cookie(csrf, b.session())
                .header("X-XSRF-TOKEN", csrf.getValue()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/savings").cookie(a.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalCurrentAmount").value("0"));
  }

  @Test
  void actualConnectedMembersShareClassificationsPaymentMethodsFixedCostsAndDashboard()
      throws Exception {
    UUID request = send(a, b);
    mvc.perform(decide(b, request, "ACCEPT")).andExpect(status().isOk());
    UUID category =
        created(
            mvc.perform(
                    write(a, "/api/recurring-expenses/categories", "{\"name\":\"함께 쓰기 검증 분류\"}"))
                .andExpect(status().isOk())
                .andReturn());
    UUID subcategory =
        created(
            mvc.perform(
                    write(
                        b,
                        "/api/recurring-expenses/subcategories",
                        "{\"categoryId\":\"" + category + "\",\"name\":\"공동 비용\"}"))
                .andExpect(status().isOk())
                .andReturn());
    for (User user : new User[] {a, b})
      mvc.perform(get("/api/recurring-expenses/options").cookie(user.session()))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.payers.length()").value(2))
          .andExpect(
              jsonPath("$.categories[*].id")
                  .value(org.hamcrest.Matchers.hasItem(category.toString())))
          .andExpect(
              jsonPath("$.subcategories[*].id")
                  .value(org.hamcrest.Matchers.hasItem(subcategory.toString())));
    UUID card =
        created(
            mvc.perform(
                    write(
                            a,
                            "/api/payment-methods",
                            "{\"name\":\"공동 카드\",\"type\":\"CARD\",\"holderUserId\":\""
                                + a.id()
                                + "\"}")
                        .header("Idempotency-Key", UUID.randomUUID()))
                .andExpect(status().isCreated())
                .andReturn());
    mvc.perform(get("/api/payment-methods/members").cookie(b.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2));
    mvc.perform(
            edit(
                b,
                "/api/payment-methods/" + card,
                "{\"name\":\"수정한 공동 카드\",\"type\":\"CARD\",\"holderUserId\":\""
                    + b.id()
                    + "\",\"version\":0}"))
        .andExpect(status().isOk());
    mvc.perform(
            edit(
                c,
                "/api/payment-methods/" + card,
                "{\"name\":\"차단 대상\",\"type\":\"CARD\",\"version\":1}"))
        .andExpect(status().isNotFound());
    LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Seoul"));
    String body =
        "{\"expectedAmount\":15000,\"intervalMonths\":1,\"recurringDayOfMonth\":"
            + today.getDayOfMonth()
            + ",\"firstDueDate\":\""
            + today
            + "\",\"payer\":\"PARTNER\",\"paymentMethodId\":\""
            + card
            + "\",\"categoryId\":\""
            + category
            + "\",\"subcategoryId\":\""
            + subcategory
            + "\"}";
    UUID expense =
        created(
            mvc.perform(
                    write(a, "/api/recurring-expenses", body)
                        .header("Idempotency-Key", UUID.randomUUID()))
                .andExpect(status().isCreated())
                .andReturn());
    mvc.perform(get("/api/recurring-expenses").cookie(b.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].payer").value("ME"));
    mvc.perform(
            patch("/api/recurring-expenses/" + expense + "/details")
                .cookie(csrf, b.session())
                .header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body.replace("15000", "18000").replace("PARTNER", "ME")))
        .andExpect(status().isOk());
    mvc.perform(get("/api/recurring-expenses").cookie(a.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].expectedAmount").value(18000))
        .andExpect(jsonPath("$[0].payer").value("PARTNER"));
    String month = java.time.YearMonth.from(today).toString();
    for (User user : new User[] {a, b})
      mvc.perform(get("/api/dashboard/fixed-costs?month=" + month).cookie(user.session()))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.charges[0].expectedAmount").value(18000))
          .andExpect(jsonPath("$.charges[0].paymentMethod").value("수정한 공동 카드"));
    mvc.perform(get("/api/dashboard/fixed-costs?month=" + month).cookie(c.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.charges.length()").value(0));
    mvc.perform(
            delete("/api/recurring-expenses/" + expense)
                .cookie(csrf, c.session())
                .header("X-XSRF-TOKEN", csrf.getValue()))
        .andExpect(status().isNotFound());
    mvc.perform(write(b, "/api/payment-methods/" + card + "/archive?version=1", "{}"))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/recurring-expenses").cookie(a.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].paymentMethodId").value(org.hamcrest.Matchers.nullValue()));
    mvc.perform(
            delete("/api/recurring-expenses/" + expense)
                .cookie(csrf, b.session())
                .header("X-XSRF-TOKEN", csrf.getValue()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/recurring-expenses").cookie(a.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
    mvc.perform(get("/api/dashboard/fixed-costs?month=" + month).cookie(a.session()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.charges.length()").value(0));
  }
}
