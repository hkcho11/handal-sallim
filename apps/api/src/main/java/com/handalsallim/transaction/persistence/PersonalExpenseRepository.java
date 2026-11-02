package com.handalsallim.transaction.persistence;

import com.handalsallim.transaction.application.PersonalExpenseOptions;
import com.handalsallim.transaction.application.PersonalExpenseView;
import com.handalsallim.transaction.domain.PersonalExpenseDetails;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PersonalExpenseRepository {
  private final JdbcTemplate jdbc;
  private static final String OWNED =
      " t.space_id = ? AND t.created_by = ? AND t.visibility = 'PRIVATE'"
          + " AND t.type = 'EXPENSE' AND t.source = 'MANUAL' AND t.status = 'ACTIVE'";
  private static final String VIEW =
      "SELECT t.*, c.name AS category_name, p.name AS payment_method_name"
          + " FROM transactions t JOIN categories c ON c.id = t.category_id AND c.space_id = t.space_id"
          + " JOIN payment_methods p ON p.id = t.payment_method_id AND p.space_id = t.space_id WHERE";

  public PersonalExpenseRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<UUID> activeSpaces(UUID userId, boolean lock) {
    return jdbc.query(
        "SELECT m.space_id FROM space_members m JOIN spaces s ON s.id = m.space_id"
            + " JOIN users u ON u.id = m.user_id WHERE m.user_id = ? AND m.status = 'ACTIVE'"
            + " AND s.status = 'ACTIVE' AND u.status = 'ACTIVE'"
            + (lock ? " FOR UPDATE OF s, m, u" : ""),
        (rs, row) -> rs.getObject(1, UUID.class),
        userId);
  }

  public PersonalExpenseOptions options(UUID spaceId) {
    String mode =
        jdbc.queryForObject(
            "SELECT management_mode FROM spaces WHERE id = ?", String.class, spaceId);
    var categories =
        jdbc.query(
            "SELECT id, name FROM categories WHERE space_id = ? AND status = 'ACTIVE'"
                + " AND applies_to IN ('EXPENSE', 'BOTH') ORDER BY name, id",
            (rs, row) -> option(rs),
            spaceId);
    var methods =
        jdbc.query(
            "SELECT id, name FROM payment_methods WHERE space_id = ? AND status = 'ACTIVE'"
                + " ORDER BY name, id",
            (rs, row) -> option(rs),
            spaceId);
    return new PersonalExpenseOptions(!"SOLO".equals(mode), categories, methods);
  }

  private PersonalExpenseOptions.Option option(ResultSet rs) throws SQLException {
    return new PersonalExpenseOptions.Option(rs.getObject("id", UUID.class), rs.getString("name"));
  }

  public boolean usableCategory(UUID spaceId, UUID id) {
    return Boolean.TRUE.equals(
        jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?"
                + " AND space_id = ? AND status = 'ACTIVE' AND applies_to IN ('EXPENSE', 'BOTH'))",
            Boolean.class,
            id,
            spaceId));
  }

  public boolean usableMethod(UUID spaceId, UUID id) {
    return Boolean.TRUE.equals(
        jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM payment_methods WHERE id = ?"
                + " AND space_id = ? AND status = 'ACTIVE')",
            Boolean.class,
            id,
            spaceId));
  }

  public List<PersonalExpenseView> list(UUID spaceId, UUID userId, YearMonth month) {
    return jdbc.query(
        VIEW
            + OWNED
            + " AND t.occurred_on >= ? AND t.occurred_on < ? ORDER BY t.occurred_on DESC, t.created_at DESC, t.id",
        (rs, row) -> view(rs),
        spaceId,
        userId,
        month.atDay(1),
        month.plusMonths(1).atDay(1));
  }

  public PersonalExpenseView find(UUID spaceId, UUID userId, UUID id) {
    return jdbc
        .query(VIEW + OWNED + " AND t.id = ?", (rs, row) -> view(rs), spaceId, userId, id)
        .stream()
        .findFirst()
        .orElse(null);
  }

  public record Creation(UUID id, String fingerprint) {}

  public Creation creation(UUID spaceId, UUID userId, UUID key) {
    return jdbc
        .query(
            "SELECT id, creation_fingerprint FROM transactions WHERE space_id = ? AND created_by = ?"
                + " AND creation_key = ? AND visibility = 'PRIVATE' AND type = 'EXPENSE' AND source = 'MANUAL'",
            (rs, row) ->
                new Creation(rs.getObject("id", UUID.class), rs.getString("creation_fingerprint")),
            spaceId,
            userId,
            key)
        .stream()
        .findFirst()
        .orElse(null);
  }

  public void insert(
      UUID id, UUID spaceId, UUID userId, UUID key, PersonalExpenseDetails d, Instant now) {
    jdbc.update(
        "INSERT INTO transactions (id, space_id, created_by, creation_key, creation_fingerprint, name, type, amount,"
            + " occurred_on, category_id, payment_method_id, memo, visibility, source, status, created_at, updated_at)"
            + " VALUES (?, ?, ?, ?, ?, ?, 'EXPENSE', ?, ?, ?, ?, ?, 'PRIVATE', 'MANUAL', 'ACTIVE', ?, ?)",
        id,
        spaceId,
        userId,
        key,
        d.fingerprint(),
        d.name(),
        d.amount(),
        d.occurredOn(),
        d.categoryId(),
        d.paymentMethodId(),
        d.memo(),
        Timestamp.from(now),
        Timestamp.from(now));
  }

  public boolean update(
      UUID spaceId, UUID userId, UUID id, long version, PersonalExpenseDetails d, Instant now) {
    return jdbc.update(
            "UPDATE transactions t SET name = ?, amount = ?, occurred_on = ?, category_id = ?,"
                + " payment_method_id = ?, memo = ?, updated_at = ?, version = version + 1 WHERE"
                + OWNED
                + " AND t.id = ? AND t.version = ?",
            d.name(),
            d.amount(),
            d.occurredOn(),
            d.categoryId(),
            d.paymentMethodId(),
            d.memo(),
            Timestamp.from(now),
            spaceId,
            userId,
            id,
            version)
        == 1;
  }

  public boolean delete(UUID spaceId, UUID userId, UUID id, long version) {
    return jdbc.update(
            "DELETE FROM transactions t WHERE" + OWNED + " AND t.id = ? AND t.version = ?",
            spaceId,
            userId,
            id,
            version)
        == 1;
  }

  private PersonalExpenseView view(ResultSet rs) throws SQLException {
    return new PersonalExpenseView(
        rs.getObject("id", UUID.class),
        rs.getString("name"),
        rs.getLong("amount"),
        rs.getDate("occurred_on").toLocalDate(),
        rs.getObject("category_id", UUID.class),
        rs.getString("category_name"),
        rs.getObject("payment_method_id", UUID.class),
        rs.getString("payment_method_name"),
        rs.getString("memo"),
        rs.getLong("version"));
  }
}
