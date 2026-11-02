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
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
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
  private final ScheduledChargeService scheduled;
  private final jakarta.persistence.EntityManager entityManager;

  public FixedExpenseService(
      JdbcTemplate jdbc,
      RecurringExpenseRepository expenses,
      RecurringExpenseRevisionRepository revisions,
      ScheduledChargeRepository charges,
      Clock clock,
      ScheduledChargeService scheduled,
      jakarta.persistence.EntityManager entityManager) {
    this.jdbc = jdbc;
    this.expenses = expenses;
    this.revisions = revisions;
    this.charges = charges;
    this.clock = clock;
    this.scheduled = scheduled;
    this.entityManager = entityManager;
  }

  @Transactional
  public FixedExpenseView create(UUID userId, UUID creationKey, FixedExpenseDetails details) {
    UUID spaceId = activeSpaceOf(userId);
    lockSpace(spaceId);
    UUID assigneeId = resolveAssignee(spaceId, userId, details.payer());
    validatePaymentMethod(spaceId, details.paymentMethodId());
    details = classifyDetails(spaceId, details);
    var existing = expenses.findBySpaceIdAndCreationKey(spaceId, creationKey);
    if (existing.isPresent()) {
      var revision =
          revisions.findFirstByRecurringExpenseIdOrderByEffectiveFromAsc(existing.get().getId());
      if (!sameRequest(revision, details, assigneeId)) {
        throw new CreationKeyConflictException();
      }
      return view(existing.get(), userId);
    }

    Instant now = clock.instant();
    UUID expenseId = UUID.randomUUID();
    UUID revisionId = UUID.randomUUID();
    var expense = new RecurringExpenseEntity(expenseId, spaceId, userId, creationKey, now);
    var revision =
        new RecurringExpenseRevisionEntity(
            revisionId, spaceId, expenseId, userId, details, assigneeId, now);
    expenses.save(expense);
    revisions.save(revision);
    ScheduledChargeEntity charge = null;
    if (details.hasSchedule()) {
      charge =
          new ScheduledChargeEntity(
              UUID.randomUUID(), spaceId, expenseId, revisionId, details, assigneeId, now);
      charges.save(charge);
    }
    generateCurrent(spaceId);
    return view(expense, userId);
  }

  @Transactional
  public FixedExpenseView completeSchedule(
      UUID userId,
      UUID expenseId,
      int intervalMonths,
      int recurringDayOfMonth,
      LocalDate firstDueDate) {
    if (intervalMonths != 1 && intervalMonths != 2 && intervalMonths != 3 && intervalMonths != 12) {
      throw new IllegalArgumentException("반복 주기를 선택해 주세요.");
    }
    if (recurringDayOfMonth < 1 || recurringDayOfMonth > 31) {
      throw new IllegalArgumentException("반복 결제일은 1일부터 31일 사이로 선택해 주세요.");
    }
    UUID spaceId = activeSpaceOf(userId);
    lockSpace(spaceId);
    var owned =
        jdbc.query(
            "SELECT id FROM recurring_expenses WHERE id = ? AND space_id = ? FOR UPDATE",
            (rs, rowNum) -> rs.getObject(1, UUID.class),
            expenseId,
            spaceId);
    if (owned.isEmpty()) throw new FixedExpenseNotFoundException();

    var expense = expenses.findById(expenseId).orElseThrow(FixedExpenseNotFoundException::new);
    if (expense.isEnded()) throw new FixedExpenseNotFoundException();
    var revision = revisions.findFirstByRecurringExpenseIdOrderByEffectiveFromAsc(expenseId);
    var existingCharge = charges.findFirstByRecurringExpenseIdOrderByDueDateAsc(expenseId);
    if (existingCharge != null) {
      if (Objects.equals(revision.getIntervalMonths(), intervalMonths)
          && Objects.equals(revision.getRecurringDayOfMonth(), recurringDayOfMonth)
          && Objects.equals(revision.getAnchorDueDate(), firstDueDate)) {
        return toView(expense, revision, existingCharge, userId);
      }
      throw new CreationKeyConflictException();
    }

    revision.completeSchedule(intervalMonths, recurringDayOfMonth, firstDueDate);
    revisions.save(revision);
    var charge =
        new ScheduledChargeEntity(
            UUID.randomUUID(),
            spaceId,
            expenseId,
            revision.getId(),
            revision.getName(),
            revision.getDefaultExpectedAmount(),
            firstDueDate,
            revision.getAssigneeUserId(),
            revision.getDefaultPaymentMethodId(),
            clock.instant());
    charge.setPlannedClassification(
        revision.getCategoryId(), revision.getSubcategoryId(), revision.getMemo());
    charges.save(charge);
    generateCurrent(spaceId);
    return view(expense, userId);
  }

  @Transactional
  public List<FixedExpenseView> list(UUID userId) {
    UUID spaceId = scheduled.ensure(userId, null);
    return expenses.findBySpaceIdOrderByCreatedAtDesc(spaceId).stream()
        .filter(expense -> !expense.isEnded())
        .map(expense -> view(expense, userId))
        .toList();
  }

  @Transactional
  public FixedExpenseView updateDetails(UUID userId, UUID expenseId, FixedExpenseDetails details) {
    UUID spaceId = activeSpaceOf(userId);
    lockSpace(spaceId);
    var expense = expenses.findById(expenseId).orElseThrow(FixedExpenseNotFoundException::new);
    if (!spaceId.equals(expense.getSpaceId()) || expense.isEnded())
      throw new FixedExpenseNotFoundException();
    var revision = revisions.findFirstByRecurringExpenseIdOrderByCreatedAtDescIdDesc(expenseId);
    UUID assigneeId = resolveAssignee(spaceId, userId, details.payer());
    validatePaymentMethod(spaceId, details.paymentMethodId());
    details = classifyDetails(spaceId, details);
    if (sameRequest(revision, details, assigneeId)) return view(expense, userId);
    var history = charges.findByRecurringExpenseIdOrderByDueDateAsc(expenseId);
    LocalDate lastCompleted =
        history.stream()
            .filter(item -> "COMPLETED".equals(item.getStatus()))
            .map(ScheduledChargeEntity::getDueDate)
            .max(LocalDate::compareTo)
            .orElse(null);
    LocalDate nextDue = nextDueDate(details, lastCompleted);
    Instant now = clock.instant();
    UUID currentRevisionId = revision.getId();
    boolean preserveRevision =
        history.stream()
            .anyMatch(
                item ->
                    "COMPLETED".equals(item.getStatus())
                        && currentRevisionId.equals(item.getRecurringExpenseRevisionId()));
    if (preserveRevision) {
      revision =
          new RecurringExpenseRevisionEntity(
              UUID.randomUUID(), spaceId, expenseId, userId, details, assigneeId, now);
      revision.setEffectiveFrom(nextDue);
    } else {
      revision.updateDetails(details, assigneeId);
      revision.setEffectiveFrom(nextDue);
    }
    revisions.save(revision);
    ScheduledChargeEntity target = null;
    if (nextDue != null) {
      target =
          history.stream()
              .filter(
                  item ->
                      !"COMPLETED".equals(item.getStatus()) && nextDue.equals(item.getDueDate()))
              .findFirst()
              .orElse(null);
      if (target == null)
        target =
            history.stream()
                .filter(item -> "PENDING".equals(item.getStatus()))
                .findFirst()
                .orElse(null);
    }
    for (var item : history) {
      if (item != target) item.cancel(now);
    }
    if (nextDue != null) {
      if (target == null) {
        target =
            new ScheduledChargeEntity(
                UUID.randomUUID(),
                spaceId,
                expenseId,
                revision.getId(),
                details.name(),
                details.expectedAmount(),
                nextDue,
                assigneeId,
                details.paymentMethodId(),
                now);
      } else {
        target.updatePlannedDetails(revision.getId(), details, assigneeId, nextDue, now);
      }
      target.setPlannedClassification(
          details.categoryId(), details.subcategoryId(), details.memo());
      charges.save(target);
    }
    generateCurrent(spaceId);
    return toView(
        expense,
        revision,
        target != null
            ? target
            : history.stream()
                .filter(item -> "COMPLETED".equals(item.getStatus()))
                .findFirst()
                .orElse(null),
        userId);
  }

  private LocalDate nextDueDate(FixedExpenseDetails details, LocalDate lastCompleted) {
    if (!details.hasSchedule()) return null;
    if (lastCompleted == null || details.firstDueDate().isAfter(lastCompleted))
      return details.firstDueDate();
    var anchorMonth = java.time.YearMonth.from(details.firstDueDate());
    long months =
        java.time.temporal.ChronoUnit.MONTHS.between(
            anchorMonth, java.time.YearMonth.from(lastCompleted));
    long cycles = months / details.intervalMonths() + 1;
    var candidateMonth = anchorMonth.plusMonths(cycles * details.intervalMonths());
    var candidate =
        candidateMonth.atDay(
            Math.min(details.recurringDayOfMonth(), candidateMonth.lengthOfMonth()));
    if (!candidate.isAfter(lastCompleted)) {
      candidateMonth = candidateMonth.plusMonths(details.intervalMonths());
      candidate =
          candidateMonth.atDay(
              Math.min(details.recurringDayOfMonth(), candidateMonth.lengthOfMonth()));
    }
    return candidate;
  }

  private void generateCurrent(UUID space) {
    entityManager.flush();
    scheduled.generateSpace(
        space,
        java.time.YearMonth.from(LocalDate.now(clock.withZone(java.time.ZoneId.of("Asia/Seoul"))))
            .atEndOfMonth());
  }

  @Transactional
  public void delete(UUID userId, UUID expenseId) {
    UUID spaceId = activeSpaceOf(userId);
    lockSpace(spaceId);
    var expense = expenses.findById(expenseId).orElseThrow(FixedExpenseNotFoundException::new);
    if (!spaceId.equals(expense.getSpaceId())) throw new FixedExpenseNotFoundException();
    if (expense.isEnded()) return;
    var history = charges.findByRecurringExpenseIdOrderByDueDateAsc(expenseId);
    LocalDate fromDueDate =
        history.stream()
            .filter(item -> "PENDING".equals(item.getStatus()))
            .map(ScheduledChargeEntity::getDueDate)
            .findFirst()
            .orElse(LocalDate.now(clock));
    Instant now = clock.instant();
    for (var charge : history) charge.cancel(now);
    expense.end(fromDueDate, now);
  }

  @Transactional
  public FixedExpenseFormOptions formOptions(UUID userId) {
    UUID spaceId = activeSpaceOf(userId);
    String mode =
        jdbc.queryForObject(
            "SELECT management_mode FROM spaces WHERE id = ?", String.class, spaceId);
    Integer activeMemberCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM space_members WHERE space_id = ? AND status = 'ACTIVE'",
            Integer.class,
            spaceId);

    List<FixedExpenseFormOptions.PayerOption> payers = new ArrayList<>();
    if ("SHARED".equals(mode) && activeMemberCount != null && activeMemberCount == 2) {
      payers.add(new FixedExpenseFormOptions.PayerOption("ME", "나"));
      payers.add(new FixedExpenseFormOptions.PayerOption("PARTNER", "상대"));
    }
    var paymentMethods =
        jdbc.query(
            "SELECT id, name, type FROM payment_methods "
                + "WHERE space_id = ? AND status = 'ACTIVE' ORDER BY created_at, id",
            (rs, rowNum) ->
                new FixedExpenseFormOptions.PaymentMethodOption(
                    rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("type")),
            spaceId);
    ensureClassificationDefaults(spaceId);
    return new FixedExpenseFormOptions(
        payers,
        paymentMethods,
        jdbc.query(
            "SELECT id, name FROM categories WHERE space_id = ? AND status = 'ACTIVE' AND applies_to IN ('EXPENSE', 'BOTH') ORDER BY sort_order, created_at, name, id",
            (rs, rowNum) ->
                new FixedExpenseFormOptions.CategoryOption(
                    rs.getObject("id", UUID.class), rs.getString("name")),
            spaceId),
        jdbc.query(
            "SELECT id, category_id, name FROM expense_subcategories WHERE space_id = ? AND status = 'ACTIVE' ORDER BY sort_order, created_at, name, id",
            (rs, rowNum) ->
                new FixedExpenseFormOptions.SubcategoryOption(
                    rs.getObject("id", UUID.class),
                    rs.getObject("category_id", UUID.class),
                    rs.getString("name")),
            spaceId));
  }

  @Transactional
  public void clearPaymentMethod(UUID userId, UUID paymentMethodId) {
    UUID spaceId = activeSpaceOf(userId);
    lockSpace(spaceId);
    for (var expense : expenses.findBySpaceIdOrderByCreatedAtDesc(spaceId)) {
      if (expense.isEnded()) continue;
      var revision =
          revisions.findFirstByRecurringExpenseIdOrderByCreatedAtDescIdDesc(expense.getId());
      var history = charges.findByRecurringExpenseIdOrderByDueDateAsc(expense.getId());
      UUID oldRevisionId = revision.getId();
      if (paymentMethodId.equals(revision.getDefaultPaymentMethodId())) {
        var details =
            new FixedExpenseDetails(
                revision.getName(),
                revision.getDefaultExpectedAmount(),
                revision.getIntervalMonths(),
                revision.getRecurringDayOfMonth(),
                revision.getAnchorDueDate(),
                null,
                null,
                revision.getCategoryId(),
                revision.getSubcategoryId(),
                revision.getMemo());
        boolean hasCompleted =
            history.stream()
                .anyMatch(
                    item ->
                        "COMPLETED".equals(item.getStatus())
                            && oldRevisionId.equals(item.getRecurringExpenseRevisionId()));
        if (hasCompleted) {
          var next =
              history.stream()
                  .filter(item -> "PENDING".equals(item.getStatus()))
                  .map(ScheduledChargeEntity::getDueDate)
                  .findFirst()
                  .orElseGet(
                      () ->
                          history.stream()
                              .filter(item -> "COMPLETED".equals(item.getStatus()))
                              .map(ScheduledChargeEntity::getDueDate)
                              .max(LocalDate::compareTo)
                              .orElse(LocalDate.now(clock))
                              .plusDays(1));
          revision =
              new RecurringExpenseRevisionEntity(
                  UUID.randomUUID(),
                  spaceId,
                  expense.getId(),
                  userId,
                  details,
                  revision.getAssigneeUserId(),
                  clock.instant());
          revision.setEffectiveFrom(next);
        } else {
          revision.updateDetails(details, revision.getAssigneeUserId());
        }
        revisions.saveAndFlush(revision);
        jdbc.update(
            "UPDATE scheduled_charges SET recurring_expense_revision_id = ? WHERE recurring_expense_id = ? AND space_id = ? AND recurring_expense_revision_id = ? AND status = 'PENDING'",
            revision.getId(),
            expense.getId(),
            spaceId,
            oldRevisionId);
      }
      jdbc.update(
          "UPDATE scheduled_charges SET planned_payment_method_id = NULL, updated_at = ?, version = version + 1 WHERE recurring_expense_id = ? AND space_id = ? AND planned_payment_method_id = ? AND status = 'PENDING'",
          java.sql.Timestamp.from(clock.instant()),
          expense.getId(),
          spaceId,
          paymentMethodId);
    }
  }

  private void ensureClassificationDefaults(UUID spaceId) {
    lockSpace(spaceId);
    if (Boolean.TRUE.equals(
        jdbc.queryForObject(
            "SELECT classification_initialized FROM spaces WHERE id=?", Boolean.class, spaceId)))
      return;
    ensureDefaultCategories(spaceId);
    ensureDefaultSubcategories(spaceId);
    jdbc.update("UPDATE spaces SET classification_initialized=true WHERE id=?", spaceId);
  }

  private void ensureDefaultCategories(UUID spaceId) {
    lockSpace(spaceId);
    for (String name : List.of("주거", "교통", "통신", "공과금", "구독", "보험", "할부", "가전구독")) {
      jdbc.update(
          "INSERT INTO categories (id, space_id, name, applies_to, status, created_at, updated_at, sort_order) VALUES (?, ?, ?, 'EXPENSE', 'ACTIVE', ?, ?, (SELECT COALESCE(MAX(sort_order),-1)+1 FROM categories WHERE space_id=?)) ON CONFLICT (space_id, name) WHERE status = 'ACTIVE' DO NOTHING",
          UUID.randomUUID(),
          spaceId,
          name,
          java.sql.Timestamp.from(clock.instant()),
          java.sql.Timestamp.from(clock.instant()),
          spaceId);
    }
  }

  @Transactional
  public FixedExpenseFormOptions.CategoryOption addCategory(UUID userId, String rawName) {
    if (rawName == null || rawName.isBlank() || rawName.strip().length() > 80)
      throw new IllegalArgumentException("카테고리는 1~80자로 입력해 주세요.");
    UUID spaceId = activeSpaceOf(userId);
    lockSpace(spaceId);
    ensureClassificationDefaults(spaceId);
    String name = rawName.strip();
    var existing =
        jdbc.query(
            "SELECT id, name, applies_to FROM categories WHERE space_id = ? AND name = ? AND status = 'ACTIVE'",
            (rs, rowNum) -> {
              if ("INCOME".equals(rs.getString("applies_to")))
                throw new IllegalArgumentException("수입 카테고리와 다른 이름을 입력해 주세요.");
              return new FixedExpenseFormOptions.CategoryOption(
                  rs.getObject("id", UUID.class), rs.getString("name"));
            },
            spaceId,
            name);
    if (!existing.isEmpty()) return existing.getFirst();
    UUID id = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO categories (id, space_id, name, applies_to, status, created_at, updated_at, sort_order) VALUES (?, ?, ?, 'EXPENSE', 'ACTIVE', ?, ?, (SELECT COALESCE(MAX(sort_order),-1)+1 FROM categories WHERE space_id=?))",
        id,
        spaceId,
        name,
        java.sql.Timestamp.from(clock.instant()),
        java.sql.Timestamp.from(clock.instant()),
        spaceId);
    return new FixedExpenseFormOptions.CategoryOption(id, name);
  }

  @Transactional
  public FixedExpenseFormOptions.CategoryOption renameCategory(
      UUID userId, UUID id, String rawName, String expectedName) {
    UUID space = activeSpaceOf(userId);
    lockSpace(space);
    ensureClassificationDefaults(space);
    validateCategory(space, id);
    String name = rawName == null ? "" : rawName.strip();
    if (name.isEmpty() || name.length() > 80)
      throw new IllegalArgumentException("상위 분류 이름은 1~80자로 입력해 주세요.");
    String current =
        jdbc.queryForObject(
            "SELECT name FROM categories WHERE id=? AND space_id=?", String.class, id, space);
    if (name.equals(current)) return new FixedExpenseFormOptions.CategoryOption(id, name);
    if (!java.util.Objects.equals(current, expectedName))
      throw new org.springframework.dao.OptimisticLockingFailureException("Classification changed");
    if (!jdbc.queryForList(
            "SELECT id FROM categories WHERE space_id=? AND status='ACTIVE' AND name=? AND id<>?",
            UUID.class,
            space,
            name,
            id)
        .isEmpty()) throw new ClassificationValidationException("이미 사용 중인 상위 분류 이름입니다.");
    jdbc.update(
        "UPDATE categories SET name=?,updated_at=? WHERE id=? AND space_id=?",
        name,
        java.sql.Timestamp.from(clock.instant()),
        id,
        space);
    return new FixedExpenseFormOptions.CategoryOption(id, name);
  }

  @Transactional
  public void reorderClassifications(
      UUID userId, UUID parent, List<UUID> ids, List<UUID> previous) {
    UUID space = activeSpaceOf(userId);
    lockSpace(space);
    ensureClassificationDefaults(space);
    String table = parent == null ? "categories" : "expense_subcategories";
    if (parent != null) validateCategory(space, parent);
    String scope = parent == null ? " AND applies_to IN ('EXPENSE','BOTH')" : " AND category_id=?";
    Object[] args = parent == null ? new Object[] {space} : new Object[] {space, parent};
    var current =
        jdbc.queryForList(
            "SELECT id FROM "
                + table
                + " WHERE space_id=? AND status='ACTIVE'"
                + scope
                + " ORDER BY sort_order,created_at,name,id",
            UUID.class,
            args);
    if (ids == null
        || ids.size() != current.size()
        || new java.util.HashSet<>(ids).size() != ids.size()
        || !new java.util.HashSet<>(ids).equals(new java.util.HashSet<>(current)))
      throw new IllegalArgumentException("현재 분류 목록을 확인해 주세요.");
    if (ids.equals(current)) return;
    if (!current.equals(previous))
      throw new org.springframework.dao.OptimisticLockingFailureException(
          "Classification order changed");
    for (int i = 0; i < ids.size(); i++)
      jdbc.update(
          "UPDATE " + table + " SET sort_order=? WHERE id=? AND space_id=?", i, ids.get(i), space);
  }

  @Transactional
  public void moveSubcategory(UUID userId, UUID id, UUID from, UUID to, UUID beforeId) {
    UUID space = activeSpaceOf(userId);
    lockSpace(space);
    ensureClassificationDefaults(space);
    validateCategory(space, to);
    var rows =
        jdbc.queryForList(
            "SELECT category_id,name FROM expense_subcategories WHERE id=? AND space_id=? AND status='ACTIVE'",
            id,
            space);
    if (rows.size() != 1) throw new IllegalArgumentException("사용할 수 있는 세부 분류가 아닙니다.");
    UUID current = (UUID) rows.getFirst().get("category_id");
    if (current.equals(to)) {
      syncLinkedTransactionClassification(space, id);
      return;
    }
    if (!current.equals(from))
      throw new org.springframework.dao.OptimisticLockingFailureException("Classification moved");
    syncLinkedTransactionClassification(space, id);
    if (!jdbc.queryForList(
            "SELECT id FROM expense_subcategories WHERE space_id=? AND category_id=? AND status='ACTIVE' AND name=? AND id<>?",
            UUID.class,
            space,
            to,
            rows.getFirst().get("name"),
            id)
        .isEmpty()) throw new ClassificationValidationException("옮길 상위 분류에 같은 이름의 세부 분류가 있습니다.");
    var target =
        new ArrayList<>(
            jdbc.queryForList(
                "SELECT id FROM expense_subcategories WHERE space_id=? AND category_id=? AND status='ACTIVE' ORDER BY sort_order,created_at,name,id",
                UUID.class,
                space,
                to));
    int position = beforeId == null ? target.size() : target.indexOf(beforeId);
    if (position < 0)
      throw new org.springframework.dao.OptimisticLockingFailureException(
          "Target classification changed");
    jdbc.update(
        "UPDATE expense_subcategories SET category_id=? WHERE id=? AND space_id=?", to, id, space);
    target.add(position, id);
    for (int i = 0; i < target.size(); i++)
      jdbc.update(
          "UPDATE expense_subcategories SET sort_order=? WHERE id=? AND space_id=?",
          i,
          target.get(i),
          space);
  }

  @Transactional
  public void updateSubcategory(
      UUID userId,
      UUID id,
      String name,
      String expectedName,
      UUID categoryId,
      UUID expectedCategoryId) {
    UUID space = activeSpaceOf(userId);
    lockSpace(space);
    ensureClassificationDefaults(space);
    validateCategory(space, categoryId);
    String trimmed = name == null ? "" : name.strip();
    if (trimmed.isBlank() || trimmed.length() > 80)
      throw new ClassificationValidationException("분류 이름은 1~80자로 입력해 주세요.");
    var rows =
        jdbc.queryForList(
            "SELECT name,category_id FROM expense_subcategories WHERE id=? AND space_id=? AND status='ACTIVE'",
            id,
            space);
    if (rows.size() != 1) throw new ClassificationValidationException("사용할 수 없는 세부 분류입니다.");
    UUID current = (UUID) rows.getFirst().get("category_id");
    String currentName = (String) rows.getFirst().get("name");
    if (current.equals(categoryId) && currentName.equals(trimmed)) return;
    if (!current.equals(expectedCategoryId) || !currentName.equals(expectedName))
      throw new org.springframework.dao.OptimisticLockingFailureException("Classification changed");
    if (!jdbc.queryForList(
            "SELECT id FROM expense_subcategories WHERE space_id=? AND category_id=? AND name=? AND status='ACTIVE' AND id<>?",
            UUID.class,
            space,
            categoryId,
            trimmed,
            id)
        .isEmpty()) throw new ClassificationValidationException("같은 상위 분류에 동일한 이름의 세부 분류가 있습니다.");
    if (!current.equals(categoryId)) syncLinkedTransactionClassification(space, id);
    Long order =
        current.equals(categoryId)
            ? jdbc.queryForObject(
                "SELECT sort_order FROM expense_subcategories WHERE id=? AND space_id=?",
                Long.class,
                id,
                space)
            : jdbc.queryForObject(
                "SELECT COALESCE(MAX(sort_order),-1)+1 FROM expense_subcategories WHERE space_id=? AND category_id=?",
                Long.class,
                space,
                categoryId);
    jdbc.update(
        "UPDATE expense_subcategories SET name=?,category_id=?,sort_order=? WHERE id=? AND space_id=?",
        trimmed,
        categoryId,
        order,
        id,
        space);
  }

  private void syncLinkedTransactionClassification(UUID space, UUID subcategory) {
    // Older payments omitted subcategory_id. Restore only the linked charge's
    // classification before this user's explicit reclassification is cascaded.
    jdbc.update(
        """
        UPDATE transactions t SET category_id=sc.category_id,subcategory_id=sc.subcategory_id
        FROM scheduled_charges sc
        WHERE t.scheduled_charge_id=sc.id AND t.space_id=? AND sc.space_id=t.space_id
          AND sc.subcategory_id=? AND t.source='SCHEDULED_CHARGE'
          AND (t.subcategory_id IS DISTINCT FROM sc.subcategory_id OR t.category_id IS DISTINCT FROM sc.category_id)
        """,
        space,
        subcategory);
  }

  private void ensureDefaultSubcategories(UUID spaceId) {
    for (var group : DEFAULT_SUBCATEGORIES) {
      var categoryIds =
          jdbc.query(
              "SELECT id FROM categories WHERE space_id = ? AND name = ? AND status = 'ACTIVE' AND applies_to IN ('EXPENSE', 'BOTH')",
              (rs, row) -> rs.getObject(1, UUID.class),
              spaceId,
              group.getFirst());
      if (categoryIds.isEmpty()) continue;
      for (String name : group.subList(1, group.size())) {
        jdbc.update(
            "INSERT INTO expense_subcategories (id, space_id, category_id, name, status, created_at, sort_order) VALUES (?, ?, ?, ?, 'ACTIVE', ?, (SELECT COALESCE(MAX(sort_order),-1)+1 FROM expense_subcategories WHERE space_id=? AND category_id=?)) ON CONFLICT (space_id, category_id, name) WHERE status = 'ACTIVE' DO NOTHING",
            UUID.randomUUID(),
            spaceId,
            categoryIds.getFirst(),
            name,
            java.sql.Timestamp.from(clock.instant()),
            spaceId,
            categoryIds.getFirst());
      }
    }
  }

  private static final List<List<String>> DEFAULT_SUBCATEGORIES =
      List.of(
          List.of("주거", "월세", "주택 대출이자", "기타 주거"),
          List.of("교통", "대중교통비", "주차비", "차량 유지비"),
          List.of("통신", "휴대폰 요금", "인터넷", "TV·결합요금"),
          List.of("공과금", "전기", "가스", "수도", "관리비"),
          List.of("구독", "영상·OTT", "음악", "쇼핑 멤버십", "배달 멤버십", "소프트웨어", "기타 구독"),
          List.of("보험", "건강·질병보험", "자동차보험", "생명보험", "기타 보험"),
          List.of("할부", "차량 할부", "가전 할부", "기타 할부"),
          List.of("가전구독", "정수기", "공기청정기", "기타 가전구독"));

  @Transactional
  public FixedExpenseFormOptions.SubcategoryOption addSubcategory(
      UUID userId, UUID categoryId, String rawName) {
    UUID spaceId = activeSpaceOf(userId);
    lockSpace(spaceId);
    ensureClassificationDefaults(spaceId);
    validateCategory(spaceId, categoryId);
    if (rawName == null || rawName.isBlank() || rawName.strip().length() > 80)
      throw new IllegalArgumentException("중분류는 1~80자로 입력해 주세요.");
    String name = rawName.strip();
    jdbc.update(
        "INSERT INTO expense_subcategories (id, space_id, category_id, name, status, created_at, sort_order) VALUES (?, ?, ?, ?, 'ACTIVE', ?, (SELECT COALESCE(MAX(sort_order),-1)+1 FROM expense_subcategories WHERE space_id=? AND category_id=?)) ON CONFLICT (space_id, category_id, name) WHERE status = 'ACTIVE' DO NOTHING",
        UUID.randomUUID(),
        spaceId,
        categoryId,
        name,
        java.sql.Timestamp.from(clock.instant()),
        spaceId,
        categoryId);
    return jdbc.queryForObject(
        "SELECT id FROM expense_subcategories WHERE space_id = ? AND category_id = ? AND name = ? AND status = 'ACTIVE'",
        (rs, row) ->
            new FixedExpenseFormOptions.SubcategoryOption(
                rs.getObject(1, UUID.class), categoryId, name),
        spaceId,
        categoryId,
        name);
  }

  private FixedExpenseDetails classifyDetails(UUID spaceId, FixedExpenseDetails details) {
    validateCategory(spaceId, details.categoryId());
    if (details.subcategoryId() == null) throw new IllegalArgumentException("중분류를 선택해 주세요.");
    var names =
        jdbc.query(
            "SELECT name FROM expense_subcategories WHERE id = ? AND category_id = ? AND space_id = ? AND status = 'ACTIVE'",
            (rs, row) -> rs.getString(1),
            details.subcategoryId(),
            details.categoryId(),
            spaceId);
    if (names.isEmpty()) throw new IllegalArgumentException("선택한 대분류에 속한 중분류를 선택해 주세요.");
    return new FixedExpenseDetails(
        details.memo() == null ? names.getFirst() : details.memo(),
        details.expectedAmount(),
        details.intervalMonths(),
        details.recurringDayOfMonth(),
        details.firstDueDate(),
        details.payer(),
        details.paymentMethodId(),
        details.categoryId(),
        details.subcategoryId(),
        details.memo());
  }

  private void validateCategory(UUID spaceId, UUID categoryId) {
    if (categoryId == null) throw new IllegalArgumentException("카테고리를 선택해 주세요.");
    Integer count =
        jdbc.queryForObject(
            "SELECT count(*) FROM categories WHERE id = ? AND space_id = ? AND status = 'ACTIVE' AND applies_to IN ('EXPENSE', 'BOTH')",
            Integer.class,
            categoryId,
            spaceId);
    if (count == null || count != 1) throw new IllegalArgumentException("사용할 수 있는 카테고리를 선택해 주세요.");
  }

  private UUID activeSpaceOf(UUID userId) {
    List<UUID> spaces =
        jdbc.query(
            "SELECT m.space_id FROM space_members m JOIN spaces s ON s.id = m.space_id "
                + "JOIN users u ON u.id = m.user_id "
                + "WHERE m.user_id = ? AND m.status = 'ACTIVE' AND s.status = 'ACTIVE' AND u.status = 'ACTIVE'",
            (rs, rowNum) -> rs.getObject(1, UUID.class),
            userId);
    if (spaces.size() != 1) throw new NoActiveSpaceException();
    return spaces.getFirst();
  }

  private void lockSpace(UUID spaceId) {
    jdbc.queryForObject("SELECT id FROM spaces WHERE id = ? FOR UPDATE", UUID.class, spaceId);
  }

  private UUID resolveAssignee(UUID spaceId, UUID userId, FixedExpenseDetails.Payer payer) {
    if (payer == null) return null;
    String mode =
        jdbc.queryForObject(
            "SELECT management_mode FROM spaces WHERE id = ?", String.class, spaceId);
    Integer activeMemberCount =
        jdbc.queryForObject(
            "SELECT count(*) FROM space_members WHERE space_id = ? AND status = 'ACTIVE'",
            Integer.class,
            spaceId);
    if (!"SHARED".equals(mode) || activeMemberCount == null || activeMemberCount != 2) {
      throw new IllegalArgumentException("함께 관리 중인 두 멤버가 있을 때 결제자를 지정할 수 있습니다.");
    }
    if (payer == FixedExpenseDetails.Payer.ME) return userId;
    return jdbc.queryForObject(
        "SELECT user_id FROM space_members "
            + "WHERE space_id = ? AND status = 'ACTIVE' AND user_id <> ?",
        UUID.class,
        spaceId,
        userId);
  }

  private void validatePaymentMethod(UUID spaceId, UUID paymentMethodId) {
    if (paymentMethodId == null) return;
    Integer count =
        jdbc.queryForObject(
            "SELECT count(*) FROM payment_methods "
                + "WHERE id = ? AND space_id = ? AND status = 'ACTIVE'",
            Integer.class,
            paymentMethodId,
            spaceId);
    if (count == null || count != 1) {
      throw new IllegalArgumentException("사용할 수 있는 결제수단을 선택해 주세요.");
    }
  }

  private boolean sameRequest(
      RecurringExpenseRevisionEntity revision, FixedExpenseDetails details, UUID assigneeId) {
    return revision.getName().equals(details.name())
        && revision.getDefaultExpectedAmount() == details.expectedAmount()
        && Objects.equals(revision.getIntervalMonths(), details.intervalMonths())
        && Objects.equals(revision.getRecurringDayOfMonth(), details.recurringDayOfMonth())
        && Objects.equals(revision.getAnchorDueDate(), details.firstDueDate())
        && Objects.equals(revision.getAssigneeUserId(), assigneeId)
        && Objects.equals(revision.getDefaultPaymentMethodId(), details.paymentMethodId())
        && Objects.equals(revision.getCategoryId(), details.categoryId())
        && Objects.equals(revision.getSubcategoryId(), details.subcategoryId())
        && Objects.equals(revision.getMemo(), details.memo());
  }

  private FixedExpenseView view(RecurringExpenseEntity expense, UUID userId) {
    var revision =
        revisions.findFirstByRecurringExpenseIdOrderByCreatedAtDescIdDesc(expense.getId());
    var history = charges.findByRecurringExpenseIdOrderByDueDateAsc(expense.getId());
    var charge =
        history.stream()
            .filter(item -> "PENDING".equals(item.getStatus()))
            .findFirst()
            .orElseGet(
                () ->
                    history.stream()
                        .filter(item -> "COMPLETED".equals(item.getStatus()))
                        .findFirst()
                        .orElse(null));
    return toView(expense, revision, charge, userId);
  }

  private FixedExpenseView toView(
      RecurringExpenseEntity expense,
      RecurringExpenseRevisionEntity revision,
      ScheduledChargeEntity charge,
      UUID userId) {
    String status = null;
    if (charge != null) {
      status = charge.getStatus();
      if ("PENDING".equals(status) && charge.getDueDate().isBefore(LocalDate.now(clock))) {
        status = "OVERDUE";
      }
    }
    UUID paymentMethodId = revision.getDefaultPaymentMethodId();
    String paymentMethodName =
        paymentMethodId == null
            ? null
            : jdbc.query(
                "SELECT name FROM payment_methods WHERE id = ? AND space_id = ?",
                rs -> rs.next() ? rs.getString(1) : null,
                paymentMethodId,
                expense.getSpaceId());
    UUID assigneeId = revision.getAssigneeUserId();
    String payer = assigneeId == null ? null : (assigneeId.equals(userId) ? "ME" : "PARTNER");
    return new FixedExpenseView(
        expense.getId(),
        revision.getName(),
        revision.getDefaultExpectedAmount(),
        revision.getIntervalMonths(),
        revision.getRecurringDayOfMonth(),
        revision.getAnchorDueDate(),
        charge == null ? null : charge.getId(),
        status,
        payer,
        paymentMethodId,
        paymentMethodName,
        revision.getCategoryId(),
        revision.getCategoryId() == null
            ? null
            : jdbc.query(
                "SELECT name FROM categories WHERE id = ? AND space_id = ?",
                rs -> rs.next() ? rs.getString(1) : null,
                revision.getCategoryId(),
                expense.getSpaceId()),
        revision.getSubcategoryId(),
        revision.getSubcategoryId() == null
            ? null
            : jdbc.query(
                "SELECT name FROM expense_subcategories WHERE id = ? AND space_id = ?",
                rs -> rs.next() ? rs.getString(1) : null,
                revision.getSubcategoryId(),
                expense.getSpaceId()),
        revision.getMemo(),
        charge == null ? null : charge.getDueDate());
  }
}
