package com.handalsallim.auth.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class EmailCodeRepository {
  private final JdbcTemplate jdbc;

  public EmailCodeRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public record Code(
      UUID user, String purpose, String hash, int failures, Instant expires, boolean used) {}

  public Optional<Code> find(UUID id, boolean lock) {
    return jdbc
        .query(
            "SELECT user_id,purpose,code_hash,failed_attempts,expires_at,consumed_at,revoked_at FROM email_auth_codes WHERE id=?"
                + (lock ? " FOR UPDATE" : ""),
            (rs, n) ->
                new Code(
                    rs.getObject(1, UUID.class),
                    rs.getString(2),
                    rs.getString(3),
                    rs.getInt(4),
                    rs.getTimestamp(5).toInstant(),
                    rs.getTimestamp(6) != null || rs.getTimestamp(7) != null),
            id)
        .stream()
        .findFirst();
  }

  public void issue(UUID id, UUID user, String purpose, String hash, Instant now) {
    jdbc.update(
        "UPDATE email_auth_codes SET revoked_at=? WHERE user_id=? AND purpose=? AND consumed_at IS NULL AND revoked_at IS NULL",
        Timestamp.from(now),
        user,
        purpose);
    jdbc.update(
        "INSERT INTO email_auth_codes(id,user_id,purpose,code_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)",
        id,
        user,
        purpose,
        hash,
        Timestamp.from(now.plusSeconds(600)),
        Timestamp.from(now));
  }

  public void fail(UUID id) {
    jdbc.update(
        "UPDATE email_auth_codes SET failed_attempts=failed_attempts+1 WHERE id=? AND failed_attempts<5",
        id);
  }

  public void consume(UUID id, Instant now) {
    jdbc.update("UPDATE email_auth_codes SET consumed_at=? WHERE id=?", Timestamp.from(now), id);
  }
}
