package com.handalsallim.recurringexpense.persistence;

import com.handalsallim.recurringexpense.application.ChargeFailure;
import com.handalsallim.recurringexpense.application.ChargeView;
import com.handalsallim.recurringexpense.domain.PaymentCompletion;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ScheduledChargeStore {
  private final JdbcTemplate jdbc;

  public ScheduledChargeStore(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public UUID lockCurrentSpace(UUID user) {
    jdbc.queryForList("SELECT id FROM users WHERE id=? AND status='ACTIVE' FOR UPDATE", user);
    var spaces =
        jdbc.queryForList(
            "SELECT s.id FROM spaces s JOIN space_members m ON m.space_id=s.id JOIN users u ON u.id=m.user_id WHERE m.user_id=? AND m.status='ACTIVE' AND s.status='ACTIVE' AND u.status='ACTIVE' FOR UPDATE OF s",
            UUID.class,
            user);
    if (spaces.size() != 1) throw new ChargeFailure(403, "사용할 수 있는 공간이 없습니다.");
    return spaces.getFirst();
  }

  public void generate(UUID space, LocalDate through, Instant now) {
    // The space lock also serializes generation with edits, completion and sharing changes.
    var active =
        jdbc.queryForList(
            "SELECT id FROM spaces WHERE id=? AND status='ACTIVE' FOR UPDATE", UUID.class, space);
    if (active.isEmpty()) throw new ChargeFailure(409, "가계부가 변경되었습니다. 새로고침해 주세요.");
    generateForLockedSpace(space, through, now);
  }

  // Caller must hold this active-space lock in the same transaction; user paths validate
  // membership.
  public void generateForLockedSpace(UUID space, LocalDate through, Instant now) {
    jdbc.update(
        """
      WITH settings AS (
        SELECT r.*, ?::date horizon FROM recurring_expenses e
        JOIN LATERAL (SELECT * FROM recurring_expense_revisions v WHERE v.recurring_expense_id=e.id ORDER BY v.created_at DESC,v.id DESC LIMIT 1) r ON true
        WHERE e.space_id=? AND e.status='ACTIVE' AND r.billing_mode<>'VARIABLE' AND r.interval_months IS NOT NULL AND r.recurring_day_of_month IS NOT NULL AND r.anchor_due_date IS NOT NULL
          AND (r.billing_mode='LEGACY' OR EXISTS (SELECT 1 FROM payment_methods p WHERE p.id=r.default_payment_method_id AND p.space_id=r.space_id AND p.status='ACTIVE'))
      ), candidates AS (
        SELECT r.*, CASE WHEN n=0 THEN r.anchor_due_date ELSE
          (date_trunc('month',r.anchor_due_date) + make_interval(months => n*r.interval_months))::date
          + (LEAST(r.recurring_day_of_month,EXTRACT(day FROM date_trunc('month',r.anchor_due_date)+make_interval(months => n*r.interval_months)+interval '1 month - 1 day')::int)-1) END due
        FROM settings r CROSS JOIN LATERAL generate_series(0,GREATEST(0,((EXTRACT(year FROM r.horizon)::int-EXTRACT(year FROM r.anchor_due_date)::int)*12+EXTRACT(month FROM r.horizon)::int-EXTRACT(month FROM r.anchor_due_date)::int)/r.interval_months)) n
      )
      INSERT INTO scheduled_charges(id,space_id,recurring_expense_id,recurring_expense_revision_id,due_date,expense_name,expected_amount,assignee_user_id,planned_payment_method_id,category_id,subcategory_id,memo,status,created_at,updated_at)
      SELECT gen_random_uuid(),c.space_id,c.recurring_expense_id,c.id,c.due,c.name,
        CASE WHEN c.billing_mode='FIXED' THEN c.default_expected_amount ELSE NULL END,
        c.assignee_user_id,c.default_payment_method_id,c.category_id,c.subcategory_id,c.memo,'PENDING',?,?
      FROM candidates c WHERE c.due>=COALESCE(c.effective_from,c.anchor_due_date)
        AND (c.billing_mode='LEGACY' OR (c.due<=? AND c.due>=COALESCE(c.auto_from_date,c.anchor_due_date)))
        AND (c.billing_mode<>'LEGACY' OR NOT EXISTS (
          SELECT 1 FROM scheduled_charges old WHERE old.recurring_expense_id=c.recurring_expense_id
            AND old.due_date=c.due AND old.status='CANCELLED'))
      ON CONFLICT(recurring_expense_id,due_date) WHERE status<>'CANCELLED' DO NOTHING
      """,
        through,
        space,
        Timestamp.from(now),
        Timestamp.from(now),
        now.atZone(java.time.ZoneId.of("Asia/Seoul")).toLocalDate());
    autoComplete(space, now);
  }

  private void autoComplete(UUID space, Instant now) {
    jdbc.update(
        """
      WITH completed AS (
        UPDATE scheduled_charges c SET status='COMPLETED', actual_amount=c.expected_amount,
          actual_paid_on=c.due_date, actual_payment_method_id=c.planned_payment_method_id,
          completed_by=e.created_by,completed_at=?,updated_at=?,version=c.version+1
        FROM recurring_expenses e, recurring_expense_revisions r, payment_methods p
        WHERE c.space_id=? AND c.recurring_expense_id=e.id AND e.status='ACTIVE'
          AND r.id=c.recurring_expense_revision_id AND r.billing_mode='FIXED'
          AND c.status='PENDING' AND c.due_date<=? AND c.expected_amount IS NOT NULL
          AND p.id=c.planned_payment_method_id AND p.space_id=c.space_id AND p.status='ACTIVE'
        RETURNING c.*
      )
      INSERT INTO transactions(id,space_id,created_by,type,amount,occurred_on,category_id,subcategory_id,
        payment_method_id,memo,visibility,source,scheduled_charge_id,status,created_at,updated_at)
      SELECT gen_random_uuid(),space_id,completed_by,'EXPENSE',actual_amount,actual_paid_on,category_id,
        subcategory_id,actual_payment_method_id,memo,'SHARED','SCHEDULED_CHARGE',id,'ACTIVE',?,? FROM completed
      """,
        Timestamp.from(now),
        Timestamp.from(now),
        space,
        now.atZone(java.time.ZoneId.of("Asia/Seoul")).toLocalDate(),
        Timestamp.from(now),
        Timestamp.from(now));
  }

  private ChargeView view(ResultSet rs, int n) throws SQLException {
    return new ChargeView(
        rs.getObject("id", UUID.class),
        rs.getObject("recurring_expense_id", UUID.class),
        rs.getString("expense_name"),
        rs.getObject("due_date", LocalDate.class),
        (Long) rs.getObject("expected_amount"),
        rs.getString("status"),
        (Long) rs.getObject("actual_amount"),
        rs.getObject("actual_paid_on", LocalDate.class),
        rs.getObject("planned_payment_method_id", UUID.class),
        rs.getObject("actual_payment_method_id", UUID.class),
        rs.getString("payment_name"),
        rs.getLong("version"),
        java.time.YearMonth.from(
            rs.getObject("billing_month", LocalDate.class) == null
                ? rs.getObject("due_date", LocalDate.class)
                : rs.getObject("billing_month", LocalDate.class)));
  }

  private static final String SELECT =
      "SELECT c.*,p.name payment_name FROM scheduled_charges c LEFT JOIN payment_methods p ON p.id=COALESCE(c.actual_payment_method_id,c.planned_payment_method_id) AND p.space_id=c.space_id ";

  public List<ChargeView> list(UUID space, UUID expense) {
    if (jdbc.queryForList(
            "SELECT id FROM recurring_expenses WHERE id=? AND space_id=?", expense, space)
        .isEmpty()) throw new ChargeFailure(404, "고정비를 찾지 못했습니다.");
    return jdbc.query(
        SELECT
            + "WHERE c.space_id=? AND c.recurring_expense_id=? AND c.status<>'CANCELLED' ORDER BY c.due_date DESC,c.id DESC",
        this::view,
        space,
        expense);
  }

  public ChargeView charge(UUID space, UUID id) {
    return jdbc
        .query(SELECT + "WHERE c.space_id=? AND c.id=? FOR UPDATE OF c", this::view, space, id)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ChargeFailure(404, "결제 내역을 찾지 못했습니다."));
  }

  public void complete(
      UUID space, UUID user, ChargeView charge, PaymentCompletion input, Instant now) {
    if (jdbc.queryForList(
            "SELECT id FROM payment_methods WHERE id=? AND space_id=? AND status='ACTIVE' FOR SHARE",
            input.paymentMethodId(),
            space)
        .isEmpty()) throw new ChargeFailure(400, "사용할 수 있는 결제수단을 선택해 주세요.");
    var time = Timestamp.from(now);
    jdbc.update(
        "UPDATE scheduled_charges SET status='COMPLETED',actual_amount=?,actual_paid_on=?,actual_payment_method_id=?,completed_by=?,completed_at=?,updated_at=?,version=version+1 WHERE id=? AND space_id=?",
        input.amount(),
        input.paidOn(),
        input.paymentMethodId(),
        user,
        time,
        time,
        charge.id(),
        space);
    jdbc.update(
        """
      INSERT INTO transactions(id,space_id,created_by,type,amount,occurred_on,category_id,subcategory_id,payment_method_id,memo,visibility,source,scheduled_charge_id,status,created_at,updated_at)
      SELECT ?,space_id,?,'EXPENSE',actual_amount,actual_paid_on,category_id,subcategory_id,actual_payment_method_id,memo,'SHARED','SCHEDULED_CHARGE',id,'ACTIVE',?,?
      FROM scheduled_charges WHERE id=? AND space_id=?
      """,
        UUID.randomUUID(),
        user,
        time,
        time,
        charge.id(),
        space);
  }

  public LocalDate nextCycleEnd(UUID space, UUID expense, LocalDate due) {
    Integer interval =
        jdbc.queryForObject(
            "SELECT COALESCE(interval_months,1) FROM recurring_expense_revisions WHERE space_id=? AND recurring_expense_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
            Integer.class,
            space,
            expense);
    return java.time.YearMonth.from(due).plusMonths(interval).atEndOfMonth();
  }

  public List<UUID> fixedSpaces() {
    return jdbc.queryForList(
        "SELECT DISTINCT e.space_id FROM recurring_expenses e JOIN spaces s ON s.id=e.space_id JOIN recurring_expense_revisions r ON r.recurring_expense_id=e.id WHERE e.status='ACTIVE' AND s.status='ACTIVE' AND r.billing_mode='FIXED'",
        UUID.class);
  }

  public ChargeView saveManual(
      UUID space,
      UUID user,
      UUID expense,
      UUID key,
      java.time.YearMonth month,
      PaymentCompletion input,
      Instant now) {
    var settings =
        jdbc.queryForList(
            "SELECT r.*,e.status expense_status FROM recurring_expenses e JOIN LATERAL (SELECT * FROM recurring_expense_revisions v WHERE v.recurring_expense_id=e.id ORDER BY v.created_at DESC,v.id DESC LIMIT 1) r ON true WHERE e.id=? AND e.space_id=?",
            expense,
            space);
    if (settings.isEmpty() || !"ACTIVE".equals(settings.getFirst().get("expense_status")))
      throw new ChargeFailure(404, "고정비를 찾지 못했습니다.");
    var r = settings.getFirst();
    if (!"VARIABLE".equals(r.get("billing_mode")))
      throw new ChargeFailure(400, "변동 고정비에만 수동 내역을 추가할 수 있습니다.");
    var existing = jdbc.query(SELECT + "WHERE c.space_id=? AND c.id=?", this::view, space, key);
    if (!existing.isEmpty()) {
      var c = existing.getFirst();
      if ("COMPLETED".equals(c.status())
          && c.recurringExpenseId().equals(expense)
          && c.billingMonth().equals(month)
          && c.actualAmount().equals(input.amount())
          && c.actualPaidOn().equals(input.paidOn())
          && c.actualPaymentMethodId().equals(input.paymentMethodId())) return c;
      throw new ChargeFailure(409, "다른 내용으로 저장된 요청입니다.");
    }
    if (!jdbc.queryForList(
            "SELECT id FROM scheduled_charges WHERE recurring_expense_id=? AND status<>'CANCELLED' AND COALESCE(billing_month,date_trunc('month',due_date)::date)=?",
            UUID.class,
            expense,
            month.atDay(1))
        .isEmpty()) throw new ChargeFailure(409, "해당 월의 결제 내역이 이미 있습니다. 기존 내역을 수정해 주세요.");
    jdbc.update(
        """
      INSERT INTO scheduled_charges(id,space_id,recurring_expense_id,recurring_expense_revision_id,due_date,
        billing_month,expense_name,assignee_user_id,planned_payment_method_id,category_id,subcategory_id,memo,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'PENDING',?,?)
      """,
        key,
        space,
        expense,
        r.get("id"),
        month.atDay(1),
        month.atDay(1),
        r.get("name"),
        r.get("assignee_user_id"),
        input.paymentMethodId(),
        r.get("category_id"),
        r.get("subcategory_id"),
        r.get("memo"),
        Timestamp.from(now),
        Timestamp.from(now));
    var pending = charge(space, key);
    complete(space, user, pending, input, now);
    return charge(space, key);
  }

  public ChargeView editCompleted(
      UUID space,
      UUID user,
      UUID id,
      java.time.YearMonth month,
      PaymentCompletion input,
      Instant now) {
    var current = charge(space, id);
    if (jdbc.queryForList(
            "SELECT id FROM recurring_expenses WHERE id=? AND space_id=? AND status='ACTIVE'",
            UUID.class,
            current.recurringExpenseId(),
            space)
        .isEmpty()) throw new ChargeFailure(404, "고정비를 찾지 못했습니다.");
    if (!"COMPLETED".equals(current.status())) throw new ChargeFailure(400, "완료된 내역을 선택해 주세요.");
    if (current.version() != input.version())
      throw new ChargeFailure(409, "결제 내역이 변경되었습니다. 다시 불러와 주세요.");
    if (month == null) month = current.billingMonth();
    if (!jdbc.queryForList(
            "SELECT id FROM scheduled_charges WHERE recurring_expense_id=? AND status<>'CANCELLED' AND id<>? AND COALESCE(billing_month,date_trunc('month',due_date)::date)=?",
            UUID.class,
            current.recurringExpenseId(),
            id,
            month.atDay(1))
        .isEmpty()) throw new ChargeFailure(409, "해당 월의 결제 내역이 이미 있습니다.");
    if (jdbc.queryForList(
            "SELECT id FROM payment_methods WHERE id=? AND space_id=? AND status='ACTIVE' FOR SHARE",
            input.paymentMethodId(),
            space)
        .isEmpty()) throw new ChargeFailure(400, "사용 중인 결제수단을 선택해 주세요.");
    var time = Timestamp.from(now);
    jdbc.update(
        "UPDATE scheduled_charges SET billing_month=?,actual_amount=?,actual_paid_on=?,actual_payment_method_id=?,updated_at=?,version=version+1 WHERE id=? AND space_id=?",
        month.atDay(1),
        input.amount(),
        input.paidOn(),
        input.paymentMethodId(),
        time,
        id,
        space);
    int changed =
        jdbc.update(
            "UPDATE transactions SET amount=?,occurred_on=?,payment_method_id=?,updated_at=?,version=version+1 WHERE scheduled_charge_id=? AND space_id=? AND status='ACTIVE'",
            input.amount(),
            input.paidOn(),
            input.paymentMethodId(),
            time,
            id,
            space);
    if (changed != 1) throw new ChargeFailure(409, "연결된 지출을 확인할 수 없습니다.");
    return charge(space, id);
  }
}
