package com.handalsallim.recurringexpense.persistence;

import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
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
  private long expectedAmount;
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
      Instant now) {
    this.id = id;
    this.spaceId = spaceId;
    this.recurringExpenseId = expenseId;
    this.recurringExpenseRevisionId = revisionId;
    this.dueDate = details.firstDueDate();
    this.expenseName = details.name();
    this.expectedAmount = details.expectedAmount();
    this.status = "PENDING";
    this.createdAt = now;
    this.updatedAt = now;
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

  public long getExpectedAmount() {
    return expectedAmount;
  }

  public String getStatus() {
    return status;
  }
}
