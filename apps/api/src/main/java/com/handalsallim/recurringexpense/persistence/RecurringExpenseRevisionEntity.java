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
  private Short intervalMonths;
  private Short recurringDayOfMonth;
  private LocalDate anchorDueDate;
  private long defaultExpectedAmount;
  private UUID assigneeUserId;
  private UUID defaultPaymentMethodId;
  private UUID categoryId;
  private UUID subcategoryId;
  private String memo;
  private UUID createdBy;
  private Instant createdAt;

  protected RecurringExpenseRevisionEntity() {}

  public RecurringExpenseRevisionEntity(
      UUID id,
      UUID spaceId,
      UUID expenseId,
      UUID createdBy,
      FixedExpenseDetails details,
      UUID assigneeUserId,
      Instant now) {
    this.id = id;
    this.spaceId = spaceId;
    this.recurringExpenseId = expenseId;
    this.effectiveFrom = details.firstDueDate();
    this.name = details.name();
    this.intervalMonths =
        details.intervalMonths() == null ? null : details.intervalMonths().shortValue();
    this.recurringDayOfMonth =
        details.recurringDayOfMonth() == null ? null : details.recurringDayOfMonth().shortValue();
    this.anchorDueDate = details.firstDueDate();
    this.defaultExpectedAmount = details.expectedAmount();
    this.assigneeUserId = assigneeUserId;
    this.defaultPaymentMethodId = details.paymentMethodId();
    this.categoryId = details.categoryId();
    this.subcategoryId = details.subcategoryId();
    this.memo = details.memo();
    this.createdBy = createdBy;
    this.createdAt = now;
  }

  public UUID getId() {
    return id;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public UUID getRecurringExpenseId() {
    return recurringExpenseId;
  }

  public String getName() {
    return name;
  }

  public Integer getIntervalMonths() {
    return intervalMonths == null ? null : intervalMonths.intValue();
  }

  public LocalDate getAnchorDueDate() {
    return anchorDueDate;
  }

  public Integer getRecurringDayOfMonth() {
    return recurringDayOfMonth == null ? null : recurringDayOfMonth.intValue();
  }

  public long getDefaultExpectedAmount() {
    return defaultExpectedAmount;
  }

  public UUID getAssigneeUserId() {
    return assigneeUserId;
  }

  public UUID getSubcategoryId() {
    return subcategoryId;
  }

  public String getMemo() {
    return memo;
  }

  public UUID getCategoryId() {
    return categoryId;
  }

  public UUID getDefaultPaymentMethodId() {
    return defaultPaymentMethodId;
  }

  public void completeSchedule(
      int intervalMonths, int recurringDayOfMonth, LocalDate firstDueDate) {
    this.effectiveFrom = firstDueDate;
    this.intervalMonths = (short) intervalMonths;
    this.recurringDayOfMonth = (short) recurringDayOfMonth;
    this.anchorDueDate = firstDueDate;
  }

  public void updateDetails(FixedExpenseDetails details, UUID assigneeId) {
    name = details.name();
    defaultExpectedAmount = details.expectedAmount();
    intervalMonths =
        details.intervalMonths() == null ? null : details.intervalMonths().shortValue();
    recurringDayOfMonth =
        details.recurringDayOfMonth() == null ? null : details.recurringDayOfMonth().shortValue();
    anchorDueDate = details.firstDueDate();
    if (effectiveFrom == null) effectiveFrom = details.firstDueDate();
    assigneeUserId = assigneeId;
    defaultPaymentMethodId = details.paymentMethodId();
    categoryId = details.categoryId();
    subcategoryId = details.subcategoryId();
    memo = details.memo();
  }

  public void setEffectiveFrom(LocalDate effectiveFrom) {
    this.effectiveFrom = effectiveFrom;
  }
}
