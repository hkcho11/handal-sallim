package com.handalsallim.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.handalsallim.TestcontainersConfiguration;
import com.handalsallim.auth.application.AuthMail;
import jakarta.servlet.Filter;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@ActiveProfiles("local")
@SpringBootTest(
    properties = {"app.auth.check-breaches=false", "app.auth.local-admin-email=owner@example.test"})
@Import(TestcontainersConfiguration.class)
class LocalAccountLinkTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;

  @Autowired
  @Qualifier("springSessionRepositoryFilter")
  Filter sessions;

  @Autowired
  @Qualifier("springSecurityFilterChain")
  Filter security;

  @MockitoBean AuthMail mail;

  @Test
  void onlyConfiguredVerifiedEmailCanClaimAdminWithoutChangingRecordOwnership() throws Exception {
    var mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(sessions, security).build();
    String admin = "00000000-0000-0000-0000-000000000001";
    String space = "00000000-0000-0000-0000-000000000002";
    Cookie csrf = new Cookie("XSRF-TOKEN", "test-csrf");
    UUID record = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO incomes(id,space_id,created_by,creation_key,creation_fingerprint,name,amount,income_month,owner_user_id,created_at,updated_at) VALUES (?,?::uuid,?::uuid,?,'fixture','기존 수입',1000,'2026-10-01',?::uuid,now(),now())",
        record,
        space,
        admin,
        UUID.randomUUID(),
        admin);
    for (String email : new String[] {"other@example.test", "owner@example.test"}) {
      String body =
          "{\"email\":\"" + email + "\",\"password\":\"SafeFixture82!River\",\"name\":\"연결 테스트\"}";
      mvc.perform(
              post("/api/auth/register")
                  .cookie(csrf)
                  .header("X-XSRF-TOKEN", csrf.getValue())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isOk());
      var token = ArgumentCaptor.forClass(String.class);
      verify(mail).send(eq(email), token.capture(), eq(false));
      UUID requestId =
          jdbc.queryForObject(
              "SELECT id FROM email_auth_codes WHERE user_id=(SELECT user_id FROM password_credentials WHERE email_lookup_key=?) AND revoked_at IS NULL",
              UUID.class,
              email);
      String grant =
          context
              .getBean(com.handalsallim.auth.application.EmailCodeService.class)
              .check(requestId, token.getValue(), false);
      // Merely registering cannot take the seeded account.
      assertNotEquals(
          admin,
          jdbc.queryForObject(
              "SELECT user_id::text FROM password_credentials WHERE email_lookup_key=?",
              String.class,
              email));
      mvc.perform(
              post("/api/auth/verify")
                  .cookie(csrf)
                  .header("X-XSRF-TOKEN", csrf.getValue())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"token\":\"" + grant + "\",\"password\":\"SafeFixture82!River\"}"))
          .andExpect(status().isOk());
      var loggedIn =
          mvc.perform(
                  post("/api/auth/login")
                      .cookie(csrf)
                      .header("X-XSRF-TOKEN", csrf.getValue())
                      .contentType(MediaType.APPLICATION_JSON)
                      .content(body))
              .andExpect(status().isOk())
              .andReturn();
      if (email.startsWith("owner")) {
        assertEquals(
            admin,
            jdbc.queryForObject(
                "SELECT user_id::text FROM password_credentials WHERE email_lookup_key=?",
                String.class,
                email));
        mvc.perform(
                get("/api/incomes?month=2026-10")
                    .cookie(loggedIn.getResponse().getCookie("HS_SESSION")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].name").value("기존 수입"));
      } else
        assertNotEquals(
            admin,
            jdbc.queryForObject(
                "SELECT user_id::text FROM password_credentials WHERE email_lookup_key=?",
                String.class,
                email));
    }
    assertEquals(
        admin,
        jdbc.queryForObject(
            "SELECT created_by::text FROM incomes WHERE id=?", String.class, record));
    assertEquals(
        space,
        jdbc.queryForObject("SELECT space_id::text FROM incomes WHERE id=?", String.class, record));
  }
}
