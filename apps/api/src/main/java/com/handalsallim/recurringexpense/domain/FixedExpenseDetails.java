package com.handalsallim.recurringexpense.domain;

import java.time.LocalDate;
import java.util.UUID;

public record FixedExpenseDetails(
    String name,
    Long expectedAmount,
    Integer intervalMonths,
    Integer recurringDayOfMonth,
    LocalDate firstDueDate,
    Payer payer,
    UUID paymentMethodId,
    UUID categoryId,
    UUID subcategoryId,
    String memo,
    String billingMode,
    java.time.YearMonth billingMonth) {

  public FixedExpenseDetails(
      String name,
      long expectedAmount,
      Integer intervalMonths,
      Integer recurringDayOfMonth,
      LocalDate firstDueDate,
      Payer payer,
      UUID paymentMethodId,
      UUID categoryId,
      UUID subcategoryId,
      String memo) {
    this(
        name,
        expectedAmount,
        intervalMonths,
        recurringDayOfMonth,
        firstDueDate,
        payer,
        paymentMethodId,
        categoryId,
        subcategoryId,
        memo,
        "LEGACY",
        null);
  }

  public FixedExpenseDetails(
      String name,
      long expectedAmount,
      Integer intervalMonths,
      Integer recurringDayOfMonth,
      LocalDate firstDueDate,
      Payer payer,
      UUID paymentMethodId,
      UUID categoryId) {
    this(
        name,
        expectedAmount,
        intervalMonths,
        recurringDayOfMonth,
        firstDueDate,
        payer,
        paymentMethodId,
        categoryId,
        null,
        null);
  }

  public FixedExpenseDetails(
      String name,
      long expectedAmount,
      Integer intervalMonths,
      Integer recurringDayOfMonth,
      LocalDate firstDueDate,
      Payer payer,
      UUID paymentMethodId) {
    this(
        name,
        expectedAmount,
        intervalMonths,
        recurringDayOfMonth,
        firstDueDate,
        payer,
        paymentMethodId,
        null);
  }

  public enum Payer {
    ME,
    PARTNER
  }

  public FixedExpenseDetails {
    billingMode = billingMode == null ? "LEGACY" : billingMode;
    if (!"VARIABLE".equals(billingMode) && billingMonth != null)
      throw new IllegalArgumentException("금액이 일정한 고정비는 첫 결제일을 입력해 주세요.");
    if (firstDueDate != null && (firstDueDate.getYear() < 1 || firstDueDate.getYear() > 9998))
      throw new IllegalArgumentException("첫 결제일을 확인해 주세요.");
    if (!java.util.Set.of("LEGACY", "FIXED", "VARIABLE").contains(billingMode))
      throw new IllegalArgumentException("금액 변동 여부를 선택해 주세요.");
    if (name == null || name.isBlank() || name.strip().length() > 120) {
      throw new IllegalArgumentException("비용명은 1~120자로 입력해 주세요.");
    }
    name = name.strip();
    memo = memo == null || memo.isBlank() ? null : memo.strip();
    if (memo != null && memo.length() > 120)
      throw new IllegalArgumentException("메모는 120자 이내로 입력해 주세요.");
    if ("VARIABLE".equals(billingMode)) {
      if (billingMonth == null
          || billingMonth.getYear() < 1
          || billingMonth.getYear() > 9998
          || expectedAmount != null
          || firstDueDate != null)
        throw new IllegalArgumentException("변동 고정비는 금액·첫 결제일 대신 해당 월을 입력해 주세요.");
    } else if (expectedAmount == null
        || expectedAmount <= 0
        || expectedAmount > 9_007_199_254_740_991L) {
      throw new IllegalArgumentException("예상 금액이 허용 범위를 벗어났습니다.");
    }
    if ("FIXED".equals(billingMode)
        && (intervalMonths == null || recurringDayOfMonth == null || firstDueDate == null))
      throw new IllegalArgumentException("자동 결제를 위한 금액·반복 일정·결제수단을 입력해 주세요.");
    if (intervalMonths != null
        && intervalMonths != 1
        && intervalMonths != 2
        && intervalMonths != 3
        && intervalMonths != 12) {
      throw new IllegalArgumentException("반복 주기를 선택해 주세요.");
    }
    if (recurringDayOfMonth != null && (recurringDayOfMonth < 1 || recurringDayOfMonth > 31)) {
      throw new IllegalArgumentException("반복 결제일은 1일부터 31일 사이로 선택해 주세요.");
    }
  }

  public boolean hasSchedule() {
    return intervalMonths != null && recurringDayOfMonth != null && firstDueDate != null;
  }
}
