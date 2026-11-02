package com.handalsallim.paymentmethod.persistence;

import com.handalsallim.paymentmethod.application.PaymentMethodView;
import com.handalsallim.paymentmethod.domain.PaymentMethodDetails;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PaymentMethodRepository {
  private final JdbcTemplate jdbc;

  public PaymentMethodRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<UUID> activeSpaces(UUID user, boolean lock) {
    return jdbc.query(
        "SELECT m.space_id FROM space_members m JOIN spaces s ON s.id = m.space_id JOIN users u ON u.id = m.user_id WHERE m.user_id = ? AND m.status = 'ACTIVE' AND s.status = 'ACTIVE' AND u.status = 'ACTIVE'"
            + (lock ? " FOR UPDATE OF s, m, u" : ""),
        (rs, row) -> rs.getObject(1, UUID.class),
        user);
  }

  public List<PaymentMethodView> list(UUID space) {
    return jdbc.query(
        "SELECT * FROM payment_methods WHERE space_id = ? ORDER BY created_at, id",
        (rs, row) ->
            new PaymentMethodView(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getString("type"),
                rs.getObject("holder_user_id", UUID.class),
                rs.getString("color"),
                rs.getString("status"),
                rs.getLong("version")),
        space);
  }

  public boolean holder(UUID space, UUID user) {
    return Boolean.TRUE.equals(
        jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM space_members WHERE space_id = ? AND user_id = ? AND status = 'ACTIVE')",
            Boolean.class,
            space,
            user));
  }

  public List<com.handalsallim.paymentmethod.application.PaymentMethodService.Member> members(
      UUID space) {
    return jdbc.query(
        "SELECT u.id, u.display_name FROM space_members m JOIN users u ON u.id = m.user_id WHERE m.space_id = ? AND m.status = 'ACTIVE' AND u.status = 'ACTIVE' ORDER BY m.joined_at, u.id",
        (rs, row) ->
            new com.handalsallim.paymentmethod.application.PaymentMethodService.Member(
                rs.getObject("id", UUID.class), rs.getString("display_name")),
        space);
  }

  public void create(UUID space, UUID id, PaymentMethodDetails d, Instant now) {
    jdbc.update(
        "INSERT INTO payment_methods (id, space_id, name, type, holder_user_id, color, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)",
        id,
        space,
        d.name(),
        d.type(),
        d.holderUserId(),
        d.color(),
        Timestamp.from(now),
        Timestamp.from(now));
  }

  public boolean update(UUID space, UUID id, long version, PaymentMethodDetails d, Instant now) {
    return jdbc.update(
            "UPDATE payment_methods SET name = ?, type = ?, holder_user_id = ?, color = ?, updated_at = ?, version = version + 1 WHERE space_id = ? AND id = ? AND version = ? AND status = 'ACTIVE'",
            d.name(),
            d.type(),
            d.holderUserId(),
            d.color(),
            Timestamp.from(now),
            space,
            id,
            version)
        == 1;
  }

  public boolean archive(UUID space, UUID id, long version, Instant now) {
    return jdbc.update(
            "UPDATE payment_methods SET status = 'ARCHIVED', archived_at = ?, updated_at = ?, version = version + 1 WHERE space_id = ? AND id = ? AND version = ? AND status = 'ACTIVE'",
            Timestamp.from(now),
            Timestamp.from(now),
            space,
            id,
            version)
        == 1;
  }
}
