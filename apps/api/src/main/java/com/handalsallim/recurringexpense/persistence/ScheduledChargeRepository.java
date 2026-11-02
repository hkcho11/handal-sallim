package com.handalsallim.recurringexpense.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduledChargeRepository extends JpaRepository<ScheduledChargeEntity, UUID> {
  ScheduledChargeEntity findFirstByRecurringExpenseIdOrderByDueDateAsc(UUID recurringExpenseId);

  List<ScheduledChargeEntity> findByRecurringExpenseIdOrderByDueDateAsc(UUID recurringExpenseId);
}
