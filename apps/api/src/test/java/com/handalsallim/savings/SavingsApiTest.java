package com.handalsallim.savings;

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
class SavingsApiTest {
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

  String body(String name, String type, long deposit, long current, long version) {
    return """
      {"name":"%s","type":"%s","depositAmount":%d,"currentAmount":%d,"version":%d}
      """
        .formatted(name, type, deposit, current, version);
  }

  UUID create(UUID key, String body) throws Exception {
    String json =
        mvc.perform(
                post("/api/savings")
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
  void existingBalancesAndMonthlyAmountsStayIndependentDuringSharedCrud() throws Exception {
    UUID key = UUID.randomUUID();
    String input = body("기존 적금", "INSTALLMENT", 300000, 2400000, 0);
    UUID id = create(key, input);
    assertEquals(id, create(key, input));
    create(UUID.randomUUID(), body("목돈 예금", "DEPOSIT", 5000000, 5050000, 0));
    mvc.perform(get("/api/savings").principal(partner::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalCurrentAmount").value("7450000"))
        .andExpect(jsonPath("$.monthlyDepositAmount").value("300000"))
        .andExpect(jsonPath("$.items.length()").value(2));
    mvc.perform(
            put("/api/savings/" + id)
                .principal(partner::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("수정 적금", "INSTALLMENT", 400000, 2500000, 0)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.currentAmount").value(2500000))
        .andExpect(jsonPath("$.version").value(1));
    mvc.perform(
            put("/api/savings/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(input))
        .andExpect(status().isConflict());
    mvc.perform(delete("/api/savings/" + id).principal(user::toString).param("version", "0"))
        .andExpect(status().isConflict());
    mvc.perform(
            post("/api/savings")
                .principal(user::toString)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("다른 요청", "DEPOSIT", 1, 0, 0)))
        .andExpect(status().isConflict());
    mvc.perform(delete("/api/savings/" + id).principal(partner::toString).param("version", "1"))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/savings/" + id).principal(user::toString))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/savings").principal(user::toString))
        .andExpect(jsonPath("$.totalCurrentAmount").value("5050000"))
        .andExpect(jsonPath("$.monthlyDepositAmount").value("0"));
    assertEquals(
        1,
        jdbc.queryForObject(
            "SELECT count(*) FROM savings WHERE id = ? AND deleted_at IS NOT NULL AND deleted_by = ?",
            Integer.class,
            id,
            partner));
    mvc.perform(
            post("/api/savings")
                .principal(user::toString)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(input))
        .andExpect(status().isNotFound());
  }

  @Test
  void validatesAmountsAndSupportsZeroStartingBalance() throws Exception {
    create(UUID.randomUUID(), body("새 적금", "INSTALLMENT", 10000, 0, 0));
    for (String input :
        new String[] {
          body(" ", "DEPOSIT", 1, 0, 0),
          body("저축", "INVALID", 1, 0, 0),
          body("저축", "DEPOSIT", 0, 0, 0),
          body("저축", "DEPOSIT", 1, -1, 0),
          body("저축", "DEPOSIT", 1, 9007199254740992L, 0),
          "{}",
          "{\"name\":\"저축\",\"type\":\"DEPOSIT\",\"depositAmount\":1.5,\"currentAmount\":0}",
          "{\"name\":\"저축\",\"type\":\"DEPOSIT\",\"depositAmount\":1,\"currentAmount\":0.5}"
        }) {
      mvc.perform(
              post("/api/savings")
                  .principal(user::toString)
                  .header("Idempotency-Key", UUID.randomUUID())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(input))
          .andExpect(status().isBadRequest());
    }
  }

  @Test
  void blocksOtherSpacesAndInactiveMembers() throws Exception {
    UUID id = create(UUID.randomUUID(), body("적금", "INSTALLMENT", 100, 1000, 0));
    mvc.perform(get("/api/savings")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/savings").principal(outsider::toString))
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
    mvc.perform(get("/api/savings/" + id).principal(outsider::toString))
        .andExpect(status().isNotFound());
    mvc.perform(
            put("/api/savings/" + id)
                .principal(outsider::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("접근", "DEPOSIT", 1, 0, 0)))
        .andExpect(status().isNotFound());
    mvc.perform(delete("/api/savings/" + id).principal(outsider::toString).param("version", "0"))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/savings").principal(outsider::toString))
        .andExpect(jsonPath("$.items").isEmpty());
    jdbc.update(
        "UPDATE space_members SET status = 'LEFT', ended_at = now() WHERE space_id = ? AND user_id = ?",
        space,
        partner);
    mvc.perform(get("/api/savings/" + id).principal(partner::toString))
        .andExpect(status().isForbidden());
    mvc.perform(delete("/api/savings/" + id).principal(partner::toString).param("version", "0"))
        .andExpect(status().isForbidden());
  }

  @Test
  void totalsStayExactBeyondJavascriptSafeInteger() throws Exception {
    for (int i = 0; i < 2; i++)
      create(UUID.randomUUID(), body("적금", "INSTALLMENT", 9007199254740991L, 9007199254740991L, 0));
    mvc.perform(get("/api/savings").principal(user::toString))
        .andExpect(jsonPath("$.totalCurrentAmount").value("18014398509481982"))
        .andExpect(jsonPath("$.monthlyDepositAmount").value("18014398509481982"));
  }

  String ownerBody(String input, UUID owner) {
    String value = input.strip();
    return value.substring(0, value.length() - 1) + ",\"ownerUserId\":\"" + owner + "\"}";
  }

  @Test
  void defaultsOwnerToCreatorAndAllowsAnActivePartnerWithoutChangingSharing() throws Exception {
    jdbc.update("UPDATE users SET display_name = '함께하는 사람' WHERE id = ?", partner);
    String input = body("저축", "INSTALLMENT", 100, 1000, 0);
    UUID id = create(UUID.randomUUID(), input);
    mvc.perform(get("/api/savings/" + id).principal(partner::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(user.toString()));
    mvc.perform(get("/api/savings/members").principal(user::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.currentUserId").value(user.toString()))
        .andExpect(jsonPath("$.members.length()").value(2));
    mvc.perform(get("/api/savings/members")).andExpect(status().isUnauthorized());
    UUID key = UUID.randomUUID();
    UUID partnerItem = create(key, ownerBody(input, partner));
    mvc.perform(get("/api/savings/" + partnerItem).principal(user::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(partner.toString()))
        .andExpect(jsonPath("$.ownerName").value("함께하는 사람"));
    mvc.perform(
            post("/api/savings")
                .principal(user::toString)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(ownerBody(input, user)))
        .andExpect(status().isConflict());
    mvc.perform(
            put("/api/savings/" + id)
                .principal(partner::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(input))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(user.toString()));
    mvc.perform(
            put("/api/savings/" + id)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(ownerBody(body("수정", "INSTALLMENT", 100, 1000, 1), partner)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(partner.toString()));
    mvc.perform(
            post("/api/savings")
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
            post("/api/savings")
                .principal(user::toString)
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(ownerBody(input, partner)))
        .andExpect(status().isBadRequest());
    mvc.perform(
            put("/api/savings/" + own)
                .principal(user::toString)
                .contentType(MediaType.APPLICATION_JSON)
                .content(ownerBody(input, partner)))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/savings/" + partnerItem).principal(user::toString))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerName").value("함께하는 사람"));
  }
}
