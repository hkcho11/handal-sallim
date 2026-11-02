package com.handalsallim.auth.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AccountRepository {
  private final JdbcTemplate jdbc;

  public AccountRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public record Account(
      UUID id, String name, String email, String hash, boolean verified, long version) {}

  public Optional<Account> byEmail(String key) {
    jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", key);
    return jdbc
        .query(
            "SELECT u.id, u.display_name, c.email_address, c.password_hash, c.email_verified_at, c.version FROM password_credentials c JOIN users u ON u.id=c.user_id WHERE c.email_lookup_key=? AND u.status='ACTIVE' FOR UPDATE OF c",
            (rs, n) ->
                new Account(
                    rs.getObject(1, UUID.class),
                    rs.getString(2),
                    rs.getString(3),
                    rs.getString(4),
                    rs.getTimestamp(5) != null,
                    rs.getLong(6)),
            key)
        .stream()
        .findFirst();
  }

  public Optional<Account> byId(UUID id) {
    return jdbc
        .query(
            "SELECT u.id, u.display_name, c.email_address, c.password_hash, c.email_verified_at, c.version FROM password_credentials c JOIN users u ON u.id=c.user_id WHERE u.id=? AND u.status='ACTIVE'",
            (rs, n) ->
                new Account(
                    rs.getObject(1, UUID.class),
                    rs.getString(2),
                    rs.getString(3),
                    rs.getString(4),
                    rs.getTimestamp(5) != null,
                    rs.getLong(6)),
            id)
        .stream()
        .findFirst();
  }

  public void createPending(UUID id, String name, String email, String key, Instant now) {
    jdbc.update(
        "INSERT INTO users(id, display_name, status, created_at, updated_at) VALUES (?, ?, 'ACTIVE', ?, ?)",
        id,
        name,
        Timestamp.from(now),
        Timestamp.from(now));
    jdbc.update(
        "INSERT INTO password_credentials(user_id, email_address, email_lookup_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        id,
        email,
        key,
        Timestamp.from(now),
        Timestamp.from(now));
  }

  public void renamePending(UUID id, String name, Instant now) {
    int updated =
        jdbc.update(
            "UPDATE password_credentials SET updated_at=? WHERE user_id=? AND email_verified_at IS NULL",
            Timestamp.from(now),
            id);
    if (updated != 1) throw new IllegalStateException("Pending signup is no longer available.");
    jdbc.update(
        "UPDATE users SET display_name=?, updated_at=? WHERE id=?", name, Timestamp.from(now), id);
  }

  public void completeSignup(UUID id, String hash, Instant now) {
    int updated =
        jdbc.update(
            "UPDATE password_credentials SET password_hash=?, password_changed_at=?, email_verified_at=?, updated_at=?, version=version+1 WHERE user_id=? AND email_verified_at IS NULL",
            hash,
            Timestamp.from(now),
            Timestamp.from(now),
            Timestamp.from(now),
            id);
    if (updated != 1) throw new IllegalStateException("Signup is no longer pending.");
  }

  public void password(UUID id, String hash, Instant now) {
    jdbc.update(
        "UPDATE password_credentials SET password_hash=?, password_changed_at=?, updated_at=?, version=version+1 WHERE user_id=?",
        hash,
        Timestamp.from(now),
        Timestamp.from(now),
        id);
  }

  public record Action(UUID user, String purpose, Instant expires, boolean used) {}

  public Optional<Action> action(byte[] hash) {
    return action(hash, true);
  }

  public Optional<Action> action(byte[] hash, boolean lock) {
    return jdbc
        .query(
            "SELECT user_id, purpose, expires_at, consumed_at, revoked_at FROM auth_action_tokens WHERE token_hash=?"
                + (lock ? " FOR UPDATE" : ""),
            (rs, n) ->
                new Action(
                    rs.getObject(1, UUID.class),
                    rs.getString(2),
                    rs.getTimestamp(3).toInstant(),
                    rs.getTimestamp(4) != null || rs.getTimestamp(5) != null),
            hash)
        .stream()
        .findFirst();
  }

  public void issue(UUID user, String purpose, byte[] hash, Instant expires, Instant now) {
    revoke(user, purpose, now);
    jdbc.update(
        "INSERT INTO auth_action_tokens(id,user_id,purpose,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)",
        UUID.randomUUID(),
        user,
        purpose,
        hash,
        Timestamp.from(expires),
        Timestamp.from(now));
  }

  public void revoke(UUID user, String purpose, Instant now) {
    jdbc.update(
        "UPDATE auth_action_tokens SET revoked_at=? WHERE user_id=? AND purpose=? AND consumed_at IS NULL AND revoked_at IS NULL",
        Timestamp.from(now),
        user,
        purpose);
  }

  public void consume(byte[] hash, Instant now) {
    jdbc.update(
        "UPDATE auth_action_tokens SET consumed_at=? WHERE token_hash=?",
        Timestamp.from(now),
        hash);
  }

  public boolean hasSpace(UUID user) {
    return !jdbc.queryForList(
            "SELECT 1 FROM space_members m JOIN spaces s ON s.id=m.space_id WHERE m.user_id=? AND m.status='ACTIVE' AND s.status='ACTIVE'",
            user)
        .isEmpty();
  }

  public void connectLocalAdmin(UUID user, Instant now) {
    UUID admin = UUID.fromString("00000000-0000-0000-0000-000000000001");
    // Serialize any attempt to bind this locally seeded identity. Never move domain records.
    if (jdbc.queryForList("SELECT id FROM users WHERE id=? AND status='ACTIVE' FOR UPDATE", admin)
            .isEmpty()
        || !jdbc.queryForList("SELECT user_id FROM password_credentials WHERE user_id=?", admin)
            .isEmpty()
        || hasSpace(user)) return;
    jdbc.update("UPDATE password_credentials SET user_id=? WHERE user_id=?", admin, user);
    jdbc.update("UPDATE auth_action_tokens SET user_id=? WHERE user_id=?", admin, user);
    jdbc.update("UPDATE email_auth_codes SET user_id=? WHERE user_id=?", admin, user);
    jdbc.update(
        "UPDATE users SET display_name=(SELECT display_name FROM users WHERE id=?), updated_at=? WHERE id=?",
        user,
        Timestamp.from(now),
        admin);
    jdbc.update("DELETE FROM users WHERE id=?", user);
  }

  public void createSpace(UUID user, String name, Instant now) {
    jdbc.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", user);
    if (hasSpace(user)) return;
    UUID space = UUID.randomUUID();
    Timestamp time = Timestamp.from(now);
    jdbc.update(
        "INSERT INTO spaces(id,management_mode,name,status,created_by,created_at,updated_at) VALUES (?, 'SOLO', ?, 'ACTIVE', ?, ?, ?)",
        space,
        name,
        user,
        time,
        time);
    jdbc.update(
        "INSERT INTO space_members(space_id,user_id,role,status,joined_at,created_at,updated_at) VALUES (?,?,'OWNER','ACTIVE',?,?,?)",
        space,
        user,
        time,
        time,
        time);
    for (String category : new String[] {"주거", "교통", "통신", "공과금", "구독", "보험", "할부", "가전구독"})
      jdbc.update(
          "INSERT INTO categories(id,space_id,name,applies_to,status,created_at,updated_at) VALUES (?,?,?,'EXPENSE','ACTIVE',?,?)",
          UUID.randomUUID(),
          space,
          category,
          time,
          time);
    jdbc.update(
        "INSERT INTO payment_methods(id,space_id,name,type,status,created_at,updated_at) VALUES (?,?,'현금','CASH','ACTIVE',?,?)",
        UUID.randomUUID(),
        space,
        time,
        time);
  }

  public boolean allow(String bucket, int limit, Instant now) {
    return !jdbc.queryForList(
            "INSERT INTO auth_rate_limits(bucket,window_start,attempts) VALUES (?,?,1) ON CONFLICT(bucket) DO UPDATE SET window_start=CASE WHEN auth_rate_limits.window_start < ? THEN EXCLUDED.window_start ELSE auth_rate_limits.window_start END, attempts=CASE WHEN auth_rate_limits.window_start < ? THEN 1 ELSE auth_rate_limits.attempts+1 END WHERE auth_rate_limits.window_start < ? OR auth_rate_limits.attempts < ? RETURNING attempts",
            bucket,
            Timestamp.from(now),
            Timestamp.from(now.minusSeconds(900)),
            Timestamp.from(now.minusSeconds(900)),
            Timestamp.from(now.minusSeconds(900)),
            limit)
        .isEmpty();
  }

  public void cleanup(Instant now) {
    jdbc.update(
        "DELETE FROM email_auth_codes WHERE COALESCE(consumed_at,revoked_at,expires_at) < ?",
        Timestamp.from(now.minusSeconds(7 * 86400)));
    jdbc.update(
        "DELETE FROM auth_action_tokens WHERE COALESCE(consumed_at,revoked_at,expires_at) < ?",
        Timestamp.from(now.minusSeconds(7 * 86400)));
    jdbc.update(
        "DELETE FROM auth_rate_limits WHERE window_start < ?",
        Timestamp.from(now.minusSeconds(86400)));
  }
}
