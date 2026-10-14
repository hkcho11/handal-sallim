package com.handalsallim.recurringexpense.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecurringExpenseRevisionRepository
    extends JpaRepository<RecurringExpenseRevisionEntity, UUID> {
  RecurringExpenseRevisionEntity findFirstByRecurringExpenseIdOrderByEffectiveFromAsc(
      UUID recurringExpenseId);
}
