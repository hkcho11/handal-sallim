package com.handalsallim.dashboard.persistence;

import com.handalsallim.dashboard.application.DashboardView;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DashboardRepository {
  private final JdbcTemplate jdbc;

  public DashboardRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<UUID> spaces(UUID user) {
    return jdbc.query(
        "SELECT m.space_id FROM space_members m JOIN spaces s ON s.id=m.space_id JOIN users u ON u.id=m.user_id WHERE m.user_id=? AND m.status='ACTIVE' AND s.status='ACTIVE' AND u.status='ACTIVE'",
        (rs, row) -> rs.getObject(1, UUID.class),
        user);
  }

  public List<DashboardView.Entry> entries(UUID space, YearMonth month) {
    return jdbc.query(
        """
        SELECT t.id, COALESCE(t.name, sc.expense_name) AS name, t.occurred_on, t.amount,
          COALESCE(c.name, '미분류') AS category, p.name AS payment_method
        FROM transactions t
        LEFT JOIN scheduled_charges sc ON sc.id=t.scheduled_charge_id AND sc.space_id=t.space_id
        LEFT JOIN categories c ON c.id=t.category_id AND c.space_id=t.space_id
        JOIN payment_methods p ON p.id=t.payment_method_id AND p.space_id=t.space_id
        WHERE t.space_id=? AND t.visibility='SHARED' AND t.type='EXPENSE' AND t.status='ACTIVE'
          AND t.occurred_on>=? AND t.occurred_on<?
        ORDER BY t.occurred_on DESC, t.id
        """,
        (rs, row) ->
            new DashboardView.Entry(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getDate("occurred_on").toLocalDate(),
                rs.getLong("amount"),
                rs.getString("category"),
                "공동",
                rs.getString("payment_method")),
        space,
        month.atDay(1),
        month.plusMonths(1).atDay(1));
  }

  public List<DashboardView.Charge> charges(
      UUID space, UUID user, YearMonth month, LocalDate today) {
    return jdbc.query(
        """
        SELECT sc.*, u.display_name AS payer_name, p.name AS payment_method
        FROM scheduled_charges sc
        LEFT JOIN users u ON u.id=sc.assignee_user_id
        LEFT JOIN payment_methods p ON p.id=sc.planned_payment_method_id AND p.space_id=sc.space_id
        WHERE sc.space_id=? AND sc.status<>'CANCELLED' AND sc.due_date>=? AND sc.due_date<?
        ORDER BY sc.due_date, sc.id
        """,
        (rs, row) -> {
          LocalDate due = rs.getDate("due_date").toLocalDate();
          String status =
              "COMPLETED".equals(rs.getString("status")) ? "완료" : due.isBefore(today) ? "지연" : "예정";
          String payer =
              user.equals(rs.getObject("assignee_user_id", UUID.class))
                  ? "나"
                  : rs.getString("payer_name");
          return new DashboardView.Charge(
              rs.getObject("id", UUID.class),
              rs.getString("expense_name"),
              due,
              due.getDayOfMonth(),
              rs.getLong("expected_amount"),
              rs.getObject("actual_amount", Long.class),
              payer,
              rs.getString("payment_method"),
              status);
        },
        space,
        month.atDay(1),
        month.plusMonths(1).atDay(1));
  }
}
