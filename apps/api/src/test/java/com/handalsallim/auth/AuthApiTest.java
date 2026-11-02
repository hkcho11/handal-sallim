package com.handalsallim.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.handalsallim.TestcontainersConfiguration;
import com.handalsallim.auth.application.AuthMail;
import com.handalsallim.auth.domain.AccountInput;
import jakarta.servlet.Filter;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = {"app.auth.check-breaches=false", "app.auth.secure-cookies=false"})
@Import({TestcontainersConfiguration.class, AuthApiTest.TimeConfiguration.class})
class AuthApiTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;

  @Autowired
  @Qualifier("springSessionRepositoryFilter")
  Filter sessions;

  @Autowired
  @Qualifier("springSecurityFilterChain")
  Filter security;

  @Autowired TestClock clock;
  @MockitoBean AuthMail mail;
  MockMvc mvc;
  String email;
  java.util.Map<String, String> grants = new java.util.HashMap<>();
  String password = "NovelRiver72!Quartz";
  Cookie csrf = new Cookie("XSRF-TOKEN", "test-csrf");

  @BeforeEach
  void setup() {
    mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(sessions, security).build();
    clock.now.set(Instant.parse("2026-10-26T00:00:00Z"));
    jdbc.update("DELETE FROM auth_rate_limits");
    email = "test-" + UUID.randomUUID() + "@example.test";
    grants.clear();
  }

  MockHttpServletRequestBuilder write(String path, String body) {
    return post("/api/auth/" + path)
        .cookie(csrf)
        .header("X-XSRF-TOKEN", csrf.getValue())
        .contentType(MediaType.APPLICATION_JSON)
        .content(body);
  }

  String credentials() {
    return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\",\"name\":\"테스트\"}";
  }

  void register() throws Exception {
    mvc.perform(write("register", credentials())).andExpect(status().isOk());
  }

  String token(boolean reset) {
    var capture = ArgumentCaptor.forClass(String.class);
    verify(mail, atLeastOnce()).send(eq(email), capture.capture(), eq(reset));
    String code = capture.getValue();
    return grants.computeIfAbsent(
        code + reset,
        ignored -> {
          UUID requestId =
              jdbc.queryForObject(
                  "SELECT e.id FROM email_auth_codes e JOIN password_credentials c ON c.user_id=e.user_id WHERE c.email_lookup_key=? AND e.purpose=? AND e.revoked_at IS NULL AND e.consumed_at IS NULL",
                  UUID.class,
                  email,
                  reset ? "PASSWORD_RESET" : "EMAIL_VERIFY");
          return context
              .getBean(com.handalsallim.auth.application.EmailCodeService.class)
              .check(requestId, code, reset);
        });
  }

  void verifyEmail() throws Exception {
    mvc.perform(write("verify", verification(token(false)))).andExpect(status().isOk());
  }

  String verification(String value) {
    return "{\"token\":\"" + value + "\",\"password\":\"" + password + "\"}";
  }

  Cookie login() throws Exception {
    var result =
        mvc.perform(write("login", credentials()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("테스트"))
            .andReturn();
    Cookie cookie = result.getResponse().getCookie("HS_SESSION");
    assertNotNull(cookie);
    return cookie;
  }

  @Test
  void registrationVerificationLoginSpaceAndLogoutUseDurableSecureSession() throws Exception {
    register();
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM space_members m JOIN password_credentials c ON c.user_id=m.user_id WHERE c.email_lookup_key=?",
            Integer.class,
            email));
    var hash =
        jdbc.queryForObject(
            "SELECT password_hash FROM password_credentials WHERE email_lookup_key=?",
            String.class,
            email);
    assertNull(hash);
    mvc.perform(write("login", credentials())).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/incomes")).andExpect(status().isUnauthorized());
    verifyEmail();
    assertNotEquals(
        password,
        jdbc.queryForObject(
            "SELECT password_hash FROM password_credentials WHERE email_lookup_key=?",
            String.class,
            email));
    mvc.perform(write("verify", verification(token(false)))).andExpect(status().isBadRequest());
    Cookie login = login();
    assertTrue(login.isHttpOnly());
    assertEquals("Lax", login.getAttribute("SameSite"));
    assertTrue(login.getMaxAge() > 0);
    mvc.perform(get("/api/auth/session").cookie(login))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.hasSpace").value(false));
    // New MockMvc instance reads the same JDBC-backed session rather than an in-memory mock
    // session.
    var rebuilt =
        MockMvcBuilders.webAppContextSetup(context).addFilters(sessions, security).build();
    rebuilt.perform(get("/api/auth/session").cookie(login)).andExpect(status().isOk());
    mvc.perform(write("space", "{\"name\":\"내 공간\"}").cookie(login))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.hasSpace").value(true));
    mvc.perform(get("/api/recurring-expenses").cookie(login))
        .andExpect(status().isOk())
        .andExpect(content().json("[]"));
    mvc.perform(write("logout", "{}").cookie(login)).andExpect(status().isOk());
    mvc.perform(get("/api/auth/session").cookie(login)).andExpect(status().isUnauthorized());
  }

  @Test
  void resetsInvalidateAllOldSessionsAndPreviousPasswords() throws Exception {
    register();
    verifyEmail();
    Cookie first = login();
    Cookie second = login();
    mvc.perform(write("forgot", "{\"email\":\"" + email + "\"}")).andExpect(status().isOk());
    String reset = token(true);
    String newPassword = "CometGarden81!New";
    mvc.perform(
            write("reset", "{\"token\":\"" + reset + "\",\"password\":\"" + newPassword + "\"}"))
        .andExpect(status().isOk());
    mvc.perform(get("/api/auth/session").cookie(first)).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/auth/session").cookie(second)).andExpect(status().isUnauthorized());
    mvc.perform(write("login", credentials())).andExpect(status().isUnauthorized());
    password = newPassword;
    login();
    mvc.perform(write("reset", "{\"token\":\"" + reset + "\",\"password\":\"" + password + "\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void csrfForgeryExpiryReissueAndRateLimitsAreRejected() throws Exception {
    mvc.perform(
            post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(credentials()))
        .andExpect(status().isForbidden());
    register();
    String original = token(false);
    mvc.perform(write("resend", "{\"email\":\"" + email + "\"}")).andExpect(status().isOk());
    mvc.perform(write("verify", verification(original))).andExpect(status().isBadRequest());
    String updated = token(false);
    clock.now.set(clock.instant().plusSeconds(86401));
    mvc.perform(write("verify", verification(updated))).andExpect(status().isBadRequest());
    for (int n = 0; n < 10; n++)
      mvc.perform(write("login", credentials())).andExpect(status().isUnauthorized());
    mvc.perform(write("login", credentials())).andExpect(status().isTooManyRequests());
  }

  @Test
  void absoluteSessionExpiryAndDisabledAccountsCannotAccessData() throws Exception {
    register();
    verifyEmail();
    Cookie cookie = login();
    for (int day = 1; day <= 29; day++) {
      clock.now.set(Instant.parse("2026-10-26T00:00:00Z").plusSeconds(day * 86400L));
      mvc.perform(get("/api/auth/session").cookie(cookie)).andExpect(status().isOk());
    }
    clock.now.set(Instant.parse("2026-10-26T00:00:00Z").plusSeconds(30 * 86400L));
    mvc.perform(get("/api/auth/session").cookie(cookie)).andExpect(status().isUnauthorized());
    clock.now.set(Instant.parse("2026-10-26T00:00:00Z"));
    cookie = login();
    jdbc.update(
        "UPDATE users SET status='DEACTIVATED' WHERE id=(SELECT user_id FROM password_credentials WHERE email_lookup_key=?)",
        email);
    mvc.perform(get("/api/auth/session").cookie(cookie)).andExpect(status().isUnauthorized());
  }

  @Test
  void emailAndPasswordRulesPreserveAliasesAndRejectUnsupportedAddresses() {
    assertEquals("a.b+tag@example.test", AccountInput.key(" A.B+tag@Example.Test "));
    assertNotEquals(AccountInput.key("a.b@example.test"), AccountInput.key("ab@example.test"));
    assertThrows(IllegalArgumentException.class, () -> AccountInput.key("한글@example.test"));
    assertThrows(IllegalArgumentException.class, () -> AccountInput.key("a..b@example.test"));
    assertThrows(IllegalArgumentException.class, () -> AccountInput.password("12345678"));
    assertThrows(IllegalArgumentException.class, () -> AccountInput.password("abcdefgh"));
    assertThrows(IllegalArgumentException.class, () -> AccountInput.password("a123456"));
    assertDoesNotThrow(() -> AccountInput.password("한글글자12345"));
  }

  @Test
  void idleExpiredJdbcSessionCannotBeReused() throws Exception {
    register();
    verifyEmail();
    Cookie cookie = login();
    jdbc.update("UPDATE spring_session SET last_access_time=0, expiry_time=0");
    mvc.perform(get("/api/auth/session").cookie(cookie)).andExpect(status().isUnauthorized());
  }

  @Test
  void simultaneousConfirmationConsumesLinkExactlyOnce() throws Exception {
    register();
    String value = token(false);
    try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var ready = new java.util.concurrent.CountDownLatch(2);
      var start = new java.util.concurrent.CountDownLatch(1);
      java.util.concurrent.Callable<Integer> consume =
          () -> {
            ready.countDown();
            start.await();
            return mvc.perform(write("verify", verification(value)))
                .andReturn()
                .getResponse()
                .getStatus();
          };
      var first = executor.submit(consume);
      var second = executor.submit(consume);
      assertTrue(ready.await(5, java.util.concurrent.TimeUnit.SECONDS));
      start.countDown();
      assertEquals(
          java.util.Set.of(200, 400),
          java.util.Set.of(
              first.get(10, java.util.concurrent.TimeUnit.SECONDS),
              second.get(10, java.util.concurrent.TimeUnit.SECONDS)));
    }
  }

  @Test
  void concurrentRegistrationCreatesOnlyOneUserAndCredentialPair() throws Exception {
    int before = jdbc.queryForObject("SELECT count(*) FROM users", Integer.class);
    try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var first =
          executor.submit(
              () ->
                  mvc.perform(write("register", credentials()))
                      .andReturn()
                      .getResponse()
                      .getStatus());
      var second =
          executor.submit(
              () ->
                  mvc.perform(write("register", credentials()))
                      .andReturn()
                      .getResponse()
                      .getStatus());
      assertEquals(200, first.get(10, java.util.concurrent.TimeUnit.SECONDS));
      assertEquals(200, second.get(10, java.util.concurrent.TimeUnit.SECONDS));
    }
    assertEquals(before + 1, jdbc.queryForObject("SELECT count(*) FROM users", Integer.class));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM password_credentials WHERE email_lookup_key=?",
            Integer.class,
            email));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM email_auth_codes t JOIN password_credentials c ON c.user_id=t.user_id WHERE c.email_lookup_key=? AND t.consumed_at IS NULL AND t.revoked_at IS NULL",
            Integer.class,
            email));
  }

  @Test
  void failedMailDeliveryRollsBackSignupAndCanBeRetried() throws Exception {
    doThrow(new org.springframework.mail.MailSendException("fixture delivery failure"))
        .when(mail)
        .send(anyString(), anyString(), eq(false));
    mvc.perform(write("register", credentials())).andExpect(status().isServiceUnavailable());
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM password_credentials WHERE email_lookup_key=?",
            Integer.class,
            email));
    reset(mail);
    register();
    verifyEmail();
    login();
  }

  @Test
  void tokenCleanupKeepsUnexpiredActionsAndDeletesOldConsumedRecords() throws Exception {
    register();
    verifyEmail();
    jdbc.update(
        "UPDATE auth_action_tokens SET consumed_at=? WHERE user_id=(SELECT user_id FROM password_credentials WHERE email_lookup_key=?)",
        java.sql.Timestamp.from(clock.instant().minusSeconds(8 * 86400)),
        email);
    var repository = context.getBean(com.handalsallim.auth.persistence.AccountRepository.class);
    repository.cleanup(clock.instant());
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM auth_action_tokens WHERE user_id=(SELECT user_id FROM password_credentials WHERE email_lookup_key=?)",
            Integer.class,
            email));
    mvc.perform(write("forgot", "{\"email\":\"" + email + "\"}")).andExpect(status().isOk());
    token(true);
    repository.cleanup(clock.instant());
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM auth_action_tokens WHERE user_id=(SELECT user_id FROM password_credentials WHERE email_lookup_key=?)",
            Integer.class,
            email));
  }

  @Test
  void pendingSignupCannotChoosePasswordAndMailboxOwnerSetsItWithoutChangingVerifiedAccounts()
      throws Exception {
    register();
    String oldToken = token(false);
    String oldPassword = password;
    password = "RetryRiver97!Quartz";
    mvc.perform(write("register", credentials().replace("테스트", "최신 이름")))
        .andExpect(status().isOk());
    mvc.perform(write("verify", verification(oldToken))).andExpect(status().isBadRequest());
    // Neither public signup request can set the owner's password.
    assertNull(
        jdbc.queryForObject(
            "SELECT password_hash FROM password_credentials WHERE email_lookup_key=?",
            String.class,
            email));
    String injectedPassword = password;
    password = "MailboxOwner61!Quartz";
    verifyEmail();
    mvc.perform(write("login", credentials()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("최신 이름"));
    String latestPassword = password;
    password = injectedPassword;
    mvc.perform(write("login", credentials())).andExpect(status().isUnauthorized());
    password = oldPassword;
    mvc.perform(write("login", credentials())).andExpect(status().isUnauthorized());
    password = "OverwriteRiver72!Quartz";
    mvc.perform(write("register", credentials())).andExpect(status().isOk());
    mvc.perform(write("login", credentials())).andExpect(status().isUnauthorized());
    password = latestPassword;
    mvc.perform(write("login", credentials()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("최신 이름"));
  }

  @Test
  void signupNeedsNoPasswordAndInvalidCompletionKeepsTokenUsable() throws Exception {
    mvc.perform(write("register", "{\"email\":\"" + email + "\",\"name\":\"테스트\"}"))
        .andExpect(status().isOk());
    String value = token(false);
    mvc.perform(write("verify", "{\"token\":\"" + value + "\"}"))
        .andExpect(status().isBadRequest());
    password = "password1";
    mvc.perform(write("verify", verification(value))).andExpect(status().isBadRequest());
    mvc.perform(write("login", credentials())).andExpect(status().isUnauthorized());
    password = "OwnerChosen93!Quartz";
    verifyEmail();
    login();
  }

  @Test
  void legacyPendingPasswordIsReplacedOnlyWhenMailboxOwnerCompletesSignup() throws Exception {
    register();
    String legacyPassword = password;
    var encoder =
        context.getBean(org.springframework.security.crypto.password.PasswordEncoder.class);
    jdbc.update(
        "UPDATE password_credentials SET password_hash=?, password_changed_at=now() WHERE email_lookup_key=?",
        encoder.encode(legacyPassword),
        email);
    mvc.perform(write("login", credentials())).andExpect(status().isUnauthorized());
    password = "VerifiedOwner28!Quartz";
    verifyEmail();
    login();
    password = legacyPassword;
    mvc.perform(write("login", credentials())).andExpect(status().isUnauthorized());
  }

  String mailCode(boolean reset) {
    var capture = ArgumentCaptor.forClass(String.class);
    verify(mail, atLeastOnce()).send(eq(email), capture.capture(), eq(reset));
    return capture.getValue();
  }

  UUID codeRequest(boolean reset) {
    return jdbc.queryForObject(
        "SELECT e.id FROM email_auth_codes e JOIN password_credentials c ON c.user_id=e.user_id WHERE c.email_lookup_key=? AND e.purpose=? AND e.revoked_at IS NULL AND e.consumed_at IS NULL",
        UUID.class,
        email,
        reset ? "PASSWORD_RESET" : "EMAIL_VERIFY");
  }

  MockHttpServletRequestBuilder checkCode(UUID id, String code, boolean reset) {
    return write(
        "verify-code",
        "{\"requestId\":\"" + id + "\",\"code\":\"" + code + "\",\"reset\":" + reset + "}");
  }

  @Test
  void emailCodeFailuresCommitAndFiveIncorrectAttemptsBlockEvenTheCorrectCode() throws Exception {
    register();
    UUID id = codeRequest(false);
    String code = mailCode(false);
    assertTrue(code.matches("[0-9]{8}"));
    assertNotEquals(
        code,
        jdbc.queryForObject("SELECT code_hash FROM email_auth_codes WHERE id=?", String.class, id));
    String wrong = code.equals("00000000") ? "11111111" : "00000000";
    for (int n = 0; n < 5; n++)
      mvc.perform(checkCode(id, wrong, false)).andExpect(status().isBadRequest());
    assertEquals(
        5,
        jdbc.queryForObject(
            "SELECT failed_attempts FROM email_auth_codes WHERE id=?", Integer.class, id));
    mvc.perform(checkCode(id, code, false)).andExpect(status().isBadRequest());
    assertNull(
        jdbc.queryForObject(
            "SELECT email_verified_at FROM password_credentials WHERE email_lookup_key=?",
            java.sql.Timestamp.class,
            email));
  }

  @Test
  void correctCodeAfterFourFailuresWorksOnlyForItsRequestAndPurposeAndOnlyOnce() throws Exception {
    register();
    UUID id = codeRequest(false);
    String code = mailCode(false);
    mvc.perform(checkCode(UUID.randomUUID(), code, false)).andExpect(status().isBadRequest());
    mvc.perform(checkCode(id, code, true)).andExpect(status().isBadRequest());
    String wrong = code.equals("00000000") ? "11111111" : "00000000";
    for (int n = 0; n < 4; n++)
      mvc.perform(checkCode(id, wrong, false)).andExpect(status().isBadRequest());
    mvc.perform(checkCode(id, code, false))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isString())
        .andExpect(jsonPath("$.code").doesNotExist());
    mvc.perform(checkCode(id, code, false)).andExpect(status().isBadRequest());
  }

  @Test
  void emailCodeExpiresInTenMinutesAndResendingRevokesCodesAndCompletionGrants() throws Exception {
    register();
    UUID old = codeRequest(false);
    String oldCode = mailCode(false);
    clock.now.set(clock.instant().plusSeconds(600));
    mvc.perform(checkCode(old, oldCode, false)).andExpect(status().isBadRequest());
    mvc.perform(write("resend", "{\"email\":\"" + email + "\"}")).andExpect(status().isOk());
    String grant = token(false);
    mvc.perform(write("resend", "{\"email\":\"" + email + "\"}")).andExpect(status().isOk());
    mvc.perform(write("verify", verification(grant))).andExpect(status().isBadRequest());
    mvc.perform(checkCode(old, oldCode, false)).andExpect(status().isBadRequest());
    verifyEmail();
    login();
  }

  @Test
  void failedResendPreservesThePreviouslyDeliveredCode() throws Exception {
    register();
    UUID id = codeRequest(false);
    String code = mailCode(false);
    doThrow(new org.springframework.mail.MailSendException("fixture outage"))
        .when(mail)
        .send(anyString(), anyString(), eq(false));
    mvc.perform(write("resend", "{\"email\":\"" + email + "\"}"))
        .andExpect(status().isServiceUnavailable());
    mvc.perform(checkCode(id, code, false)).andExpect(status().isOk());
  }

  @Test
  void concurrentCodeChecksIssueOnlyOneCompletionGrant() throws Exception {
    register();
    UUID id = codeRequest(false);
    String code = mailCode(false);
    try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
      var ready = new java.util.concurrent.CountDownLatch(2);
      var start = new java.util.concurrent.CountDownLatch(1);
      java.util.concurrent.Callable<Integer> check =
          () -> {
            ready.countDown();
            start.await();
            return mvc.perform(checkCode(id, code, false)).andReturn().getResponse().getStatus();
          };
      var first = executor.submit(check);
      var second = executor.submit(check);
      assertTrue(ready.await(5, java.util.concurrent.TimeUnit.SECONDS));
      start.countDown();
      assertEquals(
          java.util.Set.of(200, 400),
          java.util.Set.of(
              first.get(10, java.util.concurrent.TimeUnit.SECONDS),
              second.get(10, java.util.concurrent.TimeUnit.SECONDS)));
    }
  }

  @Test
  void codeRequestForUnknownAccountIsGenericAndCheckRequiresCsrf() throws Exception {
    mvc.perform(write("forgot", "{\"email\":\"" + email + "\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.requestId").isString())
        .andExpect(jsonPath("$.expiresInSeconds").value(600));
    verify(mail, never()).send(anyString(), anyString(), anyBoolean());
    mvc.perform(post("/api/auth/verify-code").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isForbidden());
    mvc.perform(checkCode(UUID.randomUUID(), "00000000", true)).andExpect(status().isBadRequest());
  }

  @Test
  void completionGrantExpiresWithoutActivatingAccount() throws Exception {
    register();
    String grant = token(false);
    clock.now.set(clock.instant().plusSeconds(600));
    mvc.perform(write("verify", verification(grant))).andExpect(status().isBadRequest());
    mvc.perform(write("login", credentials())).andExpect(status().isUnauthorized());
  }

  @TestConfiguration
  static class TimeConfiguration {
    @Bean
    @Primary
    TestClock testClock() {
      return new TestClock();
    }
  }

  static class TestClock extends Clock {
    AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-26T00:00:00Z"));

    @Override
    public ZoneId getZone() {
      return ZoneId.of("Asia/Seoul");
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now.get();
    }
  }
}
