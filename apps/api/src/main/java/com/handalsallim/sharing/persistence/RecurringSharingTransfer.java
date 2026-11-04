package com.handalsallim.sharing.persistence;

import com.handalsallim.recurringexpense.application.FixedExpenseService;
import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class RecurringSharingTransfer {
  private final JdbcTemplate jdbc;
  private final FixedExpenseService fixed;

  public RecurringSharingTransfer(JdbcTemplate jdbc, FixedExpenseService fixed) {
    this.jdbc = jdbc;
    this.fixed = fixed;
  }

  record Template(
      String name,
      Long amount,
      Integer interval,
      Integer day,
      LocalDate anchor,
      UUID category,
      UUID subcategory,
      UUID payment,
      String memo,
      LocalDate lastCompleted,
      String billingMode,
      LocalDate billingMonth) {}

  public void carry(UUID old, UUID shared, UUID user, LocalDate today, Instant now) {
    List<Template> templates =
        jdbc.query(
            """
      SELECT r.name,r.default_expected_amount,r.interval_months,r.recurring_day_of_month,r.anchor_due_date,r.category_id,r.subcategory_id,r.default_payment_method_id,r.memo,(SELECT max(due_date) FROM scheduled_charges c WHERE c.recurring_expense_id=e.id AND c.status='COMPLETED'),r.billing_mode,r.billing_month
      FROM recurring_expenses e JOIN LATERAL (SELECT * FROM recurring_expense_revisions x WHERE x.recurring_expense_id=e.id ORDER BY x.created_at DESC,x.id DESC LIMIT 1) r ON true
      WHERE e.space_id=? AND e.status='ACTIVE' ORDER BY e.created_at,e.id
      """,
            (rs, n) ->
                new Template(
                    rs.getString(1),
                    rs.getObject(2, Long.class),
                    rs.getObject(3, Integer.class),
                    rs.getObject(4, Integer.class),
                    rs.getObject(5, LocalDate.class),
                    rs.getObject(6, UUID.class),
                    rs.getObject(7, UUID.class),
                    rs.getObject(8, UUID.class),
                    rs.getString(9),
                    rs.getObject(10, LocalDate.class),
                    rs.getString(11),
                    rs.getObject(12, LocalDate.class)),
            old);
    for (Template template : templates) {
      UUID category = category(shared, template.category(), now);
      UUID subcategory = subcategory(shared, category, template.subcategory(), now);
      UUID payment = payment(shared, template.payment(), user, now);
      LocalDate due = next(template, today);
      fixed.create(
          user,
          UUID.randomUUID(),
          new FixedExpenseDetails(
              template.name(),
              template.amount(),
              template.interval(),
              template.day(),
              due,
              null,
              payment,
              category,
              subcategory,
              template.memo(),
              template.billingMode(),
              template.billingMonth() == null ? null : YearMonth.from(template.billingMonth())));
    }
  }

  private LocalDate next(Template template, LocalDate today) {
    if (template.lastCompleted() != null && template.lastCompleted().isAfter(today))
      today = template.lastCompleted();
    if (template.anchor() == null || template.interval() == null || template.day() == null)
      return template.anchor() != null && template.anchor().isAfter(today)
          ? template.anchor()
          : null;
    LocalDate next = template.anchor();
    YearMonth month = YearMonth.from(next);
    while (!next.isAfter(today)) {
      month = month.plusMonths(template.interval());
      next = month.atDay(Math.min(template.day(), month.lengthOfMonth()));
    }
    return next;
  }

  private UUID category(UUID shared, UUID old, Instant now) {
    String name =
        old == null
            ? "기타"
            : jdbc.queryForObject("SELECT name FROM categories WHERE id=?", String.class, old);
    var existing =
        jdbc.queryForList(
            "SELECT id FROM categories WHERE space_id=? AND name=? AND status='ACTIVE'",
            UUID.class,
            shared,
            name);
    if (!existing.isEmpty()) return existing.getFirst();
    UUID id = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO categories(id,space_id,name,applies_to,status,created_at,updated_at) VALUES (?,?,?,'EXPENSE','ACTIVE',?,?)",
        id,
        shared,
        name,
        Timestamp.from(now),
        Timestamp.from(now));
    return id;
  }

  private UUID subcategory(UUID shared, UUID category, UUID old, Instant now) {
    if (old == null) return null;
    String name =
        jdbc.queryForObject("SELECT name FROM expense_subcategories WHERE id=?", String.class, old);
    var existing =
        jdbc.queryForList(
            "SELECT id FROM expense_subcategories WHERE space_id=? AND category_id=? AND name=? AND status='ACTIVE'",
            UUID.class,
            shared,
            category,
            name);
    if (!existing.isEmpty()) return existing.getFirst();
    UUID id = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO expense_subcategories(id,space_id,category_id,name,status,created_at) VALUES (?,?,?,?,'ACTIVE',?)",
        id,
        shared,
        category,
        name,
        Timestamp.from(now));
    return id;
  }

  private UUID payment(UUID shared, UUID old, UUID user, Instant now) {
    if (old == null) return null;
    var rows =
        jdbc.queryForList(
            "SELECT name,type,color FROM payment_methods WHERE id=? AND status='ACTIVE'", old);
    if (rows.isEmpty()) return null;
    var data = rows.getFirst();
    if ("CASH".equals(data.get("type")))
      return jdbc.queryForObject(
          "SELECT id FROM payment_methods WHERE space_id=? AND type='CASH' AND status='ACTIVE' LIMIT 1",
          UUID.class,
          shared);
    var existing =
        jdbc.queryForList(
            "SELECT id FROM payment_methods WHERE space_id=? AND holder_user_id=? AND name=? AND type=? AND status='ACTIVE'",
            UUID.class,
            shared,
            user,
            data.get("name"),
            data.get("type"));
    if (!existing.isEmpty()) return existing.getFirst();
    UUID id = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO payment_methods(id,space_id,holder_user_id,name,type,color,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'ACTIVE',?,?)",
        id,
        shared,
        user,
        data.get("name"),
        data.get("type"),
        data.get("color"),
        Timestamp.from(now),
        Timestamp.from(now));
    return id;
  }

  public void seed(UUID shared, Instant now) {
    for (String name : new String[] {"주거", "교통", "통신", "공과금", "구독", "보험", "할부", "가전구독", "기타"}) {
      UUID id = UUID.randomUUID();
      jdbc.update(
          "INSERT INTO categories(id,space_id,name,applies_to,status,created_at,updated_at) VALUES (?,?,?,'EXPENSE','ACTIVE',?,?)",
          id,
          shared,
          name,
          Timestamp.from(now),
          Timestamp.from(now));
    }
  }
}
