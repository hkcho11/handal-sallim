package com.handalsallim.recurringexpense.persistence;

import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "scheduled_charges")
public class ScheduledChargeEntity {
  @Id private UUID id;
  private UUID spaceId;
  private UUID recurringExpenseId;
  private UUID recurringExpenseRevisionId;
  private LocalDate dueDate;
  private String expenseName;
  private Long expectedAmount;
  private UUID assigneeUserId;
  private UUID plannedPaymentMethodId;
  private UUID categoryId;
  private UUID subcategoryId;
  private String memo;
  private String status;
  private Instant createdAt;
  private Instant updatedAt;
  @Version private long version;

  protected ScheduledChargeEntity() {}

  public ScheduledChargeEntity(
      UUID id,
      UUID spaceId,
      UUID expenseId,
      UUID revisionId,
      FixedExpenseDetails details,
      UUID assigneeUserId,
      Instant now) {
    this.id = id;
    this.spaceId = spaceId;
    this.recurringExpenseId = expenseId;
    this.recurringExpenseRevisionId = revisionId;
    this.dueDate = details.firstDueDate();
    this.expenseName = details.name();
    this.expectedAmount = details.expectedAmount();
    this.assigneeUserId = assigneeUserId;
    this.plannedPaymentMethodId = details.paymentMethodId();
    this.categoryId = details.categoryId();
    this.subcategoryId = details.subcategoryId();
    this.memo = details.memo();
    this.status = "PENDING";
    this.createdAt = now;
    this.updatedAt = now;
  }

  public ScheduledChargeEntity(
      UUID id,
      UUID spaceId,
      UUID expenseId,
      UUID revisionId,
      String name,
      long expectedAmount,
      LocalDate firstDueDate,
      UUID assigneeUserId,
      UUID paymentMethodId,
      Instant now) {
    this.id = id;
    this.spaceId = spaceId;
    this.recurringExpenseId = expenseId;
    this.recurringExpenseRevisionId = revisionId;
    this.dueDate = firstDueDate;
    this.expenseName = name;
    this.expectedAmount = expectedAmount;
    this.assigneeUserId = assigneeUserId;
    this.plannedPaymentMethodId = paymentMethodId;
    this.status = "PENDING";
    this.createdAt = now;
    this.updatedAt = now;
  }

  public void setPlannedCategory(UUID categoryId) {
    if ("COMPLETED".equals(status)) throw new IllegalStateException("완료 기록은 수정할 수 없습니다.");
    this.categoryId = categoryId;
  }

  public void setPlannedClassification(UUID categoryId, UUID subcategoryId, String memo) {
    setPlannedCategory(categoryId);
    this.subcategoryId = subcategoryId;
    this.memo = memo;
  }

  public UUID getId() {
    return id;
  }

  public UUID getRecurringExpenseId() {
    return recurringExpenseId;
  }

  public LocalDate getDueDate() {
    return dueDate;
  }

  public Long getExpectedAmount() {
    return expectedAmount;
  }

  public String getStatus() {
    return status;
  }

  public UUID getRecurringExpenseRevisionId() {
    return recurringExpenseRevisionId;
  }

  public void cancel(Instant now) {
    if (!"PENDING".equals(status)) return;
    status = "CANCELLED";
    updatedAt = now;
  }

  public void updatePlannedDetails(
      UUID revisionId, FixedExpenseDetails details, UUID assigneeId, LocalDate date, Instant now) {
    if ("COMPLETED".equals(status)) throw new IllegalStateException("완료 기록은 수정할 수 없습니다.");
    if ("PENDING".equals(status)
        && Objects.equals(recurringExpenseRevisionId, revisionId)
        && expenseName.equals(details.name())
        && Objects.equals(expectedAmount, details.expectedAmount())
        && Objects.equals(dueDate, date)
        && Objects.equals(assigneeUserId, assigneeId)
        && Objects.equals(plannedPaymentMethodId, details.paymentMethodId())
        && Objects.equals(categoryId, details.categoryId())
        && Objects.equals(subcategoryId, details.subcategoryId())
        && Objects.equals(memo, details.memo())) return;
    recurringExpenseRevisionId = revisionId;
    expenseName = details.name();
    expectedAmount = details.expectedAmount();
    dueDate = date;
    assigneeUserId = assigneeId;
    plannedPaymentMethodId = details.paymentMethodId();
    categoryId = details.categoryId();
    subcategoryId = details.subcategoryId();
    memo = details.memo();
    status = "PENDING";
    updatedAt = now;
  }
}
