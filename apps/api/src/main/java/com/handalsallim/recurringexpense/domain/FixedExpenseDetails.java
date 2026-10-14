package com.handalsallim.recurringexpense.domain;

import java.time.LocalDate;

public record FixedExpenseDetails(
    String name, long expectedAmount, int intervalMonths, LocalDate firstDueDate) {

  public FixedExpenseDetails {
    if (name == null || name.isBlank() || name.strip().length() > 120) {
      throw new IllegalArgumentException("비용명은 1~120자로 입력해 주세요.");
    }
    name = name.strip();
    if (expectedAmount <= 0 || expectedAmount > 9_007_199_254_740_991L) {
      throw new IllegalArgumentException("예상 금액이 허용 범위를 벗어났습니다.");
    }
    if (intervalMonths != 1 && intervalMonths != 2 && intervalMonths != 3 && intervalMonths != 12) {
      throw new IllegalArgumentException("반복 주기를 선택해 주세요.");
    }
    if (firstDueDate == null) {
      throw new IllegalArgumentException("첫 예정일을 입력해 주세요.");
    }
  }
}
