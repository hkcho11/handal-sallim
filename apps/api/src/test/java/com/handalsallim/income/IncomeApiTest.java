package com.handalsallim.income;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class IncomeApiTest {
  @Autowired WebApplicationContext context;
  @Autowired JdbcTemplate jdbc;
  MockMvc mvc;
  UUID user;
  UUID partner;
  UUID outsider;
  UUID space;

  @BeforeEach
  void setup() {
    mvc = MockMvcBuilders.webAppContextSetup(context).build();
    user = UUID.randomUUID();
    partner = UUID.randomUUID();
    outsider = UUID.randomUUID();
    space = UUID.randomUUID();
    for (UUID id : new UUID[] {user, partner, outsider}) {
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
          "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) VALUES (?, ?, ?, 'ACTIVE', now(), now(), now())",
          space,
          id,
          id.equals(user) ? "OWNER" : "MEMBER");
    }
  }

  String body(String name, long amount, String month, long version) {
    return """
      {"name":"%s","amount":%d,"month":"%s","version":%d}
      """
        .formatted(name, amount, month, version);
  }

  UUID create(UUID key, String body) throws Exception {
    String json =
        mvc.perform(
                post("/api/incomes")
                    .principal(user::toString)
                    .header("Idempotency-Key", key)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return UUID.fromString(json.split("\"id\":\"")[1].split("\"")[0]);
  }

  @Test
  void monthlyCrudSharesWithMembersPreservesDeletedRowsAndRejectsStaleWrites() throws Exception {
    UUID key = UUID.randomUUID();
    String input = body("월급", 3000000, "2026-10", 0);
    UUID id = create(key, input);
    assertEquals(id, create(key, input));
    create(UUID.randomUUID(), body("부수입", 500000, "2026-10", 0));
    create(UUID.randomUUID(), body("지난달 월급", 2500000, "2026-09", 0));
    mvc.perform(get("/api/incomes").principal(partner::toString).param("month", "2026-10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalAmount").value("3500000"))
        .andExpect(jsonPath("$.items.length()").value(2));
    mvc.perform(get("/api/incomes/" + id).principal(partner::toString)).andExpect(status().isOk());
    mvc.perform(
            post("/api/incomes")
                .principal(user::toString)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("변경", 1, "2026-10", 0)))
        .andExpect(status().isConflict());
    mvc.perform(
            put("/api/incomes/" + id)
                .principal(partner::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("성과급", 4000000, "2026-11", 0)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value(1));
    mvc.perform(
            put("/api/incomes/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(input))
        .andExpect(status().isConflict());
    mvc.perform(delete("/api/incomes/" + id).principal(user::toString).param("version", "0"))
        .andExpect(status().isConflict());
    mvc.perform(delete("/api/incomes/" + id).principal(user::toString).param("version", "1"))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/incomes/" + id).principal(partner::toString))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/incomes").principal(user::toString).param("month", "2026-11"))
        .andExpect(jsonPath("$.totalAmount").value("0"));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM incomes WHERE id = ? AND deleted_at IS NOT NULL",
            Integer.class,
            id));
    mvc.perform(
            post("/api/incomes")
                .principal(user::toString)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(input))
        .andExpect(status().isNotFound());
  }

  @Test
  void validatesInputAndEnforcesAuthenticationSpaceAndMembership() throws Exception {
    UUID id = create(UUID.randomUUID(), body("월급", 1, "2026-10", 0));
    mvc.perform(get("/api/incomes").param("month", "2026-10")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/incomes").principal(outsider::toString).param("month", "2026-10"))
        .andExpect(status().isForbidden());
    UUID foreignSpace = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO spaces (id, management_mode, time_zone, status, created_by, created_at, updated_at) VALUES (?, 'SOLO', 'Asia/Seoul', 'ACTIVE', ?, now(), now())",
        foreignSpace,
        outsider);
    jdbc.update(
        "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) VALUES (?, ?, 'OWNER', 'ACTIVE', now(), now(), now())",
        foreignSpace,
        outsider);
    mvc.perform(get("/api/incomes/" + id).principal(outsider::toString))
        .andExpect(status().isNotFound());
    mvc.perform(
            put("/api/incomes/" + id)
                .principal(outsider::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("다른 공간", 1, "2026-10", 0)))
        .andExpect(status().isNotFound());
    mvc.perform(delete("/api/incomes/" + id).principal(outsider::toString).param("version", "0"))
        .andExpect(status().isNotFound());
    for (String month : new String[] {"0000-01", "2026-13", "2026-1", "invalid"})
      mvc.perform(get("/api/incomes").principal(user::toString).param("month", month))
          .andExpect(status().isBadRequest());
    for (String input :
        new String[] {
          body(" ", 1, "2026-10", 0),
          body("급여", 0, "2026-10", 0),
          body("급여", 9007199254740992L, "2026-10", 0),
          body("급여", 1, "2026-13", 0),
          "{}"
        })
      mvc.perform(
              post("/api/incomes")
                  .principal(user::toString)
                  .header("Idempotency-Key", UUID.randomUUID())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(input))
          .andExpect(status().isBadRequest());
    jdbc.update(
        "UPDATE space_members SET status = 'LEFT', ended_at = now() WHERE space_id = ? AND user_id = ?",
        space,
        partner);
    mvc.perform(get("/api/incomes/" + id).principal(partner::toString))
        .andExpect(status().isForbidden());
  }

  @Test
  void rejectsFractionalAmountsAndVersions() throws Exception {
    UUID id = create(UUID.randomUUID(), body("월급", 100, "2026-10", 0));
    mvc.perform(
            post("/api/incomes")
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"수입\",\"amount\":1.5,\"month\":\"2026-10\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            put("/api/incomes/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"수입\",\"amount\":100,\"month\":\"2026-10\",\"version\":0.5}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void totalsRemainExactBeyondJavascriptSafeInteger() throws Exception {
    create(UUID.randomUUID(), body("수입 1", 9007199254740991L, "9999-12", 0));
    create(UUID.randomUUID(), body("수입 2", 9007199254740991L, "9999-12", 0));
    mvc.perform(get("/api/incomes").principal(user::toString).param("month", "9999-12"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalAmount").value("18014398509481982"));
  }

  String ownerBody(String input, UUID owner) {
    String value = input.strip();
    return value.substring(0, value.length() - 1) + ",\"ownerUserId\":\"" + owner + "\"}";
  }

  @Test
  void defaultsOwnerToCreatorAndAllowsAnActivePartnerWithoutChangingSharing() throws Exception {
    jdbc.update("UPDATE users SET display_name = '함께하는 사람' WHERE id = ?", partner);
    String input = body("수입", 100, "2026-10", 0);
    UUID id = create(UUID.randomUUID(), input);
    mvc.perform(get("/api/incomes/" + id).principal(partner::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(user.toString()));
    mvc.perform(get("/api/incomes/members").principal(user::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.currentUserId").value(user.toString()))
        .andExpect(jsonPath("$.members.length()").value(2));
    mvc.perform(get("/api/incomes/members")).andExpect(status().isUnauthorized());
    UUID key = UUID.randomUUID();
    UUID partnerItem = create(key, ownerBody(input, partner));
    mvc.perform(get("/api/incomes/" + partnerItem).principal(user::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(partner.toString()))
        .andExpect(jsonPath("$.ownerName").value("함께하는 사람"));
    mvc.perform(
            post("/api/incomes")
                .principal(user::toString)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(ownerBody(input, user)))
        .andExpect(status().isConflict());
    mvc.perform(
            put("/api/incomes/" + id)
                .principal(partner::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(input))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(user.toString()));
    mvc.perform(
            put("/api/incomes/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(ownerBody(body("수정", 100, "2026-10", 1), partner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(partner.toString()));
    mvc.perform(
            post("/api/incomes")
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(ownerBody(input, outsider)))
        .andExpect(status().isBadRequest());
    UUID own = create(UUID.randomUUID(), input);
    jdbc.update(
        "UPDATE space_members SET status = 'LEFT', ended_at = now() WHERE space_id = ? AND user_id = ?",
        space,
        partner);
    mvc.perform(
            post("/api/incomes")
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(ownerBody(input, partner)))
        .andExpect(status().isBadRequest());
    mvc.perform(
            put("/api/incomes/" + own)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(ownerBody(input, partner)))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/incomes/" + partnerItem).principal(user::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerName").value("함께하는 사람"));
  }
}
