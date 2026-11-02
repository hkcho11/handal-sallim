package com.handalsallim.recurringexpense.domain;

import java.time.LocalDate;
import java.util.UUID;

public record FixedExpenseDetails(
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
    if (name == null || name.isBlank() || name.strip().length() > 120) {
      throw new IllegalArgumentException("비용명은 1~120자로 입력해 주세요.");
    }
    name = name.strip();
    memo = memo == null || memo.isBlank() ? null : memo.strip();
    if (memo != null && memo.length() > 120)
      throw new IllegalArgumentException("메모는 120자 이내로 입력해 주세요.");
    if (expectedAmount <= 0 || expectedAmount > 9_007_199_254_740_991L) {
      throw new IllegalArgumentException("예상 금액이 허용 범위를 벗어났습니다.");
    }
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
