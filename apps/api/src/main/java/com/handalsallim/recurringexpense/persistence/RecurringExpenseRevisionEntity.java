package com.handalsallim.recurringexpense.persistence;

import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "recurring_expense_revisions")
public class RecurringExpenseRevisionEntity {
  @Id private UUID id;
  private UUID spaceId;
  private UUID recurringExpenseId;
  private LocalDate effectiveFrom;
  private String name;
  private short intervalMonths;
  private LocalDate anchorDueDate;
  private long defaultExpectedAmount;
  private UUID createdBy;
  private Instant createdAt;

  protected RecurringExpenseRevisionEntity() {}

  public RecurringExpenseRevisionEntity(
      UUID id,
      UUID spaceId,
      UUID expenseId,
      UUID createdBy,
      FixedExpenseDetails details,
      Instant now) {
    this.id = id;
    this.spaceId = spaceId;
    this.recurringExpenseId = expenseId;
    this.effectiveFrom = details.firstDueDate();
    this.name = details.name();
    this.intervalMonths = (short) details.intervalMonths();
    this.anchorDueDate = details.firstDueDate();
    this.defaultExpectedAmount = details.expectedAmount();
    this.createdBy = createdBy;
    this.createdAt = now;
  }

  public UUID getId() {
    return id;
  }

  public UUID getRecurringExpenseId() {
    return recurringExpenseId;
  }

  public String getName() {
    return name;
  }

  public int getIntervalMonths() {
    return intervalMonths;
  }

  public LocalDate getAnchorDueDate() {
    return anchorDueDate;
  }

  public long getDefaultExpectedAmount() {
    return defaultExpectedAmount;
  }
}
