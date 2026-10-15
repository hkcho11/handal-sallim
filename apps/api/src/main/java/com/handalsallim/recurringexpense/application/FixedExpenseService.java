package com.handalsallim.recurringexpense.application;

import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import com.handalsallim.recurringexpense.persistence.RecurringExpenseEntity;
import com.handalsallim.recurringexpense.persistence.RecurringExpenseRepository;
import com.handalsallim.recurringexpense.persistence.RecurringExpenseRevisionEntity;
import com.handalsallim.recurringexpense.persistence.RecurringExpenseRevisionRepository;
import com.handalsallim.recurringexpense.persistence.ScheduledChargeEntity;
import com.handalsallim.recurringexpense.persistence.ScheduledChargeRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FixedExpenseService {
  private final JdbcTemplate jdbc;
  private final RecurringExpenseRepository expenses;
  private final RecurringExpenseRevisionRepository revisions;
  private final ScheduledChargeRepository charges;
  private final Clock clock;

  public FixedExpenseService(
      JdbcTemplate jdbc,
      RecurringExpenseRepository expenses,
      RecurringExpenseRevisionRepository revisions,
      ScheduledChargeRepository charges,
      Clock clock) {
    this.jdbc = jdbc;
    this.expenses = expenses;
    this.revisions = revisions;
    this.charges = charges;
    this.clock = clock;
  }

  @Transactional
  public FixedExpenseView create(UUID userId, UUID creationKey, FixedExpenseDetails details) {
    UUID spaceId = activeSpaceOf(userId);
    jdbc.queryForObject("SELECT id FROM spaces WHERE id = ? FOR UPDATE", UUID.class, spaceId);
    var existing = expenses.findBySpaceIdAndCreationKey(spaceId, creationKey);
    if (existing.isPresent()) {
      var revision =
          revisions.findFirstByRecurringExpenseIdOrderByEffectiveFromAsc(existing.get().getId());
      if (!revision.getName().equals(details.name())
          || revision.getDefaultExpectedAmount() != details.expectedAmount()
          || revision.getIntervalMonths() != details.intervalMonths()
          || !revision.getAnchorDueDate().equals(details.firstDueDate())) {
        throw new CreationKeyConflictException();
      }
      return view(existing.get());
    }

    Instant now = clock.instant();
    UUID expenseId = UUID.randomUUID();
    UUID revisionId = UUID.randomUUID();
    var expense = new RecurringExpenseEntity(expenseId, spaceId, userId, creationKey, now);
    var revision =
        new RecurringExpenseRevisionEntity(revisionId, spaceId, expenseId, userId, details, now);
    var charge =
        new ScheduledChargeEntity(UUID.randomUUID(), spaceId, expenseId, revisionId, details, now);
    expenses.save(expense);
    revisions.save(revision);
    charges.save(charge);
    return toView(expense, revision, charge);
  }

  @Transactional(readOnly = true)
  public List<FixedExpenseView> list(UUID userId) {
    UUID spaceId = activeSpaceOf(userId);
    return expenses.findBySpaceIdOrderByCreatedAtDesc(spaceId).stream().map(this::view).toList();
  }

  private UUID activeSpaceOf(UUID userId) {
    List<UUID> spaces =
        jdbc.query(
            "SELECT m.space_id FROM space_members m JOIN spaces s ON s.id = m.space_id "
                + "JOIN users u ON u.id = m.user_id "
                + "WHERE m.user_id = ? AND m.status = 'ACTIVE' AND s.status = 'ACTIVE' AND u.status = 'ACTIVE'",
            (rs, rowNum) -> rs.getObject(1, UUID.class),
            userId);
    if (spaces.size() != 1) {
      throw new NoActiveSpaceException();
    }
    return spaces.getFirst();
  }

  private FixedExpenseView view(RecurringExpenseEntity expense) {
    var revision = revisions.findFirstByRecurringExpenseIdOrderByEffectiveFromAsc(expense.getId());
    var charge = charges.findFirstByRecurringExpenseIdOrderByDueDateAsc(expense.getId());
    return toView(expense, revision, charge);
  }

  private FixedExpenseView toView(
      RecurringExpenseEntity expense,
      RecurringExpenseRevisionEntity revision,
      ScheduledChargeEntity charge) {
    String status =
        charge.getStatus().equals("PENDING") && charge.getDueDate().isBefore(LocalDate.now(clock))
            ? "OVERDUE"
            : charge.getStatus();
    return new FixedExpenseView(
        expense.getId(),
        revision.getName(),
        revision.getDefaultExpectedAmount(),
        revision.getIntervalMonths(),
        charge.getDueDate(),
        charge.getId(),
        status);
  }
}
