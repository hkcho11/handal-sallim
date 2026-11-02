package com.handalsallim.income.persistence;

import com.handalsallim.income.application.IncomeView;
import com.handalsallim.income.domain.IncomeDetails;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class IncomeRepository {
  private final JdbcTemplate jdbc;

  public IncomeRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<UUID> activeSpaces(UUID user, boolean lock) {
    return jdbc.query(
        "SELECT s.id FROM spaces s JOIN space_members m ON m.space_id = s.id"
            + " JOIN users u ON u.id = m.user_id WHERE m.user_id = ? AND m.status = 'ACTIVE'"
            + " AND s.status = 'ACTIVE' AND u.status = 'ACTIVE'"
            + (lock ? " FOR UPDATE OF s, m, u" : ""),
        (rs, row) -> rs.getObject(1, UUID.class),
        user);
  }

  public List<IncomeView> list(UUID space, YearMonth month) {
    return jdbc.query(
        "SELECT t.*, u.display_name AS owner_name FROM incomes t LEFT JOIN users u ON u.id = t.owner_user_id WHERE t.space_id = ? AND income_month = ? AND deleted_at IS NULL ORDER BY t.created_at DESC, t.id",
        (rs, row) ->
            new IncomeView(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getLong("amount"),
                rs.getDate("income_month").toLocalDate().toString().substring(0, 7),
                rs.getLong("version"),
                rs.getObject("owner_user_id", UUID.class),
                rs.getString("owner_name")),
        space,
        month.atDay(1));
  }

  public IncomeView find(UUID space, UUID id) {
    return jdbc
        .query(
            "SELECT t.*, u.display_name AS owner_name FROM incomes t LEFT JOIN users u ON u.id = t.owner_user_id WHERE t.space_id = ? AND t.id = ? AND deleted_at IS NULL",
            (rs, row) ->
                new IncomeView(
                    rs.getObject("id", UUID.class),
                    rs.getString("name"),
                    rs.getLong("amount"),
                    rs.getDate("income_month").toLocalDate().toString().substring(0, 7),
                    rs.getLong("version"),
                    rs.getObject("owner_user_id", UUID.class),
                    rs.getString("owner_name")),
            space,
            id)
        .stream()
        .findFirst()
        .orElse(null);
  }

  public record Creation(UUID id, String fingerprint) {}

  public Creation creation(UUID space, UUID user, UUID key) {
    return jdbc
        .query(
            "SELECT id, creation_fingerprint FROM incomes WHERE space_id = ? AND created_by = ? AND creation_key = ?",
            (rs, row) -> new Creation(rs.getObject(1, UUID.class), rs.getString(2)),
            space,
            user,
            key)
        .stream()
        .findFirst()
        .orElse(null);
  }

  public void insert(UUID id, UUID space, UUID user, UUID key, IncomeDetails d) {
    jdbc.update(
        "INSERT INTO incomes (id, space_id, created_by, creation_key, creation_fingerprint, name, amount, income_month, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id,
        space,
        user,
        key,
        d.fingerprint(),
        d.name(),
        d.amount(),
        d.month().atDay(1),
        d.ownerUserId());
  }

  public boolean update(UUID space, UUID id, long version, IncomeDetails d) {
    return jdbc.update(
            "UPDATE incomes SET name = ?, amount = ?, income_month = ?, owner_user_id = ?, version = version + 1, updated_at = now() WHERE space_id = ? AND id = ? AND version = ? AND deleted_at IS NULL",
            d.name(),
            d.amount(),
            d.month().atDay(1),
            d.ownerUserId(),
            space,
            id,
            version)
        == 1;
  }

  public boolean delete(UUID space, UUID user, UUID id, long version) {
    return jdbc.update(
            "UPDATE incomes SET deleted_at = now(), deleted_by = ?, updated_at = now(), version = version + 1 WHERE space_id = ? AND id = ? AND version = ? AND deleted_at IS NULL",
            user,
            space,
            id,
            version)
        == 1;
  }
}
