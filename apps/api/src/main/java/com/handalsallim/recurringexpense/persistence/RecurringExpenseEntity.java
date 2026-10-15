package com.handalsallim.recurringexpense.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "recurring_expenses")
public class RecurringExpenseEntity {
  @Id private UUID id;
  private UUID spaceId;
  private UUID createdBy;
  private UUID creationKey;
  private String status;
  private Instant createdAt;
  private Instant updatedAt;
  @Version private long version;

  protected RecurringExpenseEntity() {}

  public RecurringExpenseEntity(
      UUID id, UUID spaceId, UUID createdBy, UUID creationKey, Instant now) {
    this.id = id;
    this.spaceId = spaceId;
    this.createdBy = createdBy;
    this.creationKey = creationKey;
    this.status = "ACTIVE";
    this.createdAt = now;
    this.updatedAt = now;
  }

  public UUID getId() {
    return id;
  }

  public UUID getSpaceId() {
    return spaceId;
  }

  public UUID getCreationKey() {
    return creationKey;
  }
}
