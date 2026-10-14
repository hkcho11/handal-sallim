package com.handalsallim.dashboard.persistence;

import com.handalsallim.dashboard.application.DashboardView;
import com.handalsallim.dashboard.application.FixedCostDashboardView;
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
    return charges(space, user, month, month, today);
  }

  public List<DashboardView.Charge> charges(
      UUID space, UUID user, YearMonth firstMonth, YearMonth lastMonth, LocalDate today) {
    return jdbc.query(
        """
        SELECT sc.*, u.display_name AS payer_name, p.name AS payment_method,
          c.name AS category_name, sub.name AS subcategory_name, actual.name AS actual_payment_method
        FROM scheduled_charges sc
        LEFT JOIN users u ON u.id=sc.assignee_user_id
        LEFT JOIN payment_methods p ON p.id=sc.planned_payment_method_id AND p.space_id=sc.space_id
        LEFT JOIN categories c ON c.id=sc.category_id AND c.space_id=sc.space_id
        LEFT JOIN expense_subcategories sub ON sub.id=sc.subcategory_id AND sub.category_id=sc.category_id AND sub.space_id=sc.space_id
        LEFT JOIN payment_methods actual ON actual.id=sc.actual_payment_method_id AND actual.space_id=sc.space_id
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
              status,
              rs.getObject("category_id", UUID.class),
              rs.getString("category_name"),
              rs.getObject("subcategory_id", UUID.class),
              rs.getString("subcategory_name"),
              rs.getObject("planned_payment_method_id", UUID.class),
              rs.getObject("actual_payment_method_id", UUID.class),
              rs.getString("actual_payment_method"),
              rs.getDate("actual_paid_on") == null
                  ? null
                  : rs.getDate("actual_paid_on").toLocalDate(),
              rs.getObject("recurring_expense_id", UUID.class));
        },
        space,
        firstMonth.atDay(1),
        lastMonth.plusMonths(1).atDay(1));
  }

  public List<FixedCostDashboardView.Classification> classifications(UUID space) {
    return jdbc.query(
        """
      SELECT c.id AS category_id, c.name AS category_name, sub.id AS subcategory_id, sub.name AS subcategory_name
      FROM expense_subcategories sub JOIN categories c ON c.id=sub.category_id AND c.space_id=sub.space_id
      WHERE sub.space_id=? ORDER BY c.created_at, c.id, sub.created_at, sub.id
      """,
        (rs, row) ->
            new FixedCostDashboardView.Classification(
                rs.getObject("category_id", UUID.class),
                rs.getString("category_name"),
                rs.getObject("subcategory_id", UUID.class),
                rs.getString("subcategory_name")),
        space);
  }

  public List<FixedCostDashboardView.Unscheduled> unscheduled(UUID space, YearMonth month) {
    return jdbc.query(
        """
      SELECT e.id, r.name, r.default_expected_amount
      FROM recurring_expenses e JOIN LATERAL (
        SELECT r.* FROM recurring_expense_revisions r WHERE r.recurring_expense_id=e.id AND r.space_id=e.space_id
          AND (r.effective_from IS NULL OR r.effective_from<=?)
          AND (r.created_at AT TIME ZONE 'Asia/Seoul')::date<=?
        ORDER BY r.effective_from DESC NULLS FIRST, r.created_at DESC LIMIT 1
      ) r ON true
      WHERE e.space_id=? AND e.status='ACTIVE'
        AND (r.anchor_due_date IS NULL OR r.interval_months IS NULL OR r.recurring_day_of_month IS NULL)
      ORDER BY e.created_at, e.id
      """,
        (rs, row) ->
            new FixedCostDashboardView.Unscheduled(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getLong("default_expected_amount")),
        month.atEndOfMonth(),
        month.atEndOfMonth(),
        space);
  }
}
