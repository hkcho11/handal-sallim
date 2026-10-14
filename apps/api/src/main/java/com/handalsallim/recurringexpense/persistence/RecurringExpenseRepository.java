package com.handalsallim.recurringexpense.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecurringExpenseRepository extends JpaRepository<RecurringExpenseEntity, UUID> {
  Optional<RecurringExpenseEntity> findBySpaceIdAndCreationKey(UUID spaceId, UUID creationKey);

  List<RecurringExpenseEntity> findBySpaceIdOrderByCreatedAtDesc(UUID spaceId);
}
