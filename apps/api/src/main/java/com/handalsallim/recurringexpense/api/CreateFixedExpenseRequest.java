package com.handalsallim.recurringexpense.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigInteger;
import java.time.LocalDate;

public record CreateFixedExpenseRequest(
    @NotBlank @Size(max = 120) String name,
    @NotNull Object expectedAmount,
    @NotNull Object intervalMonths,
    @NotNull LocalDate firstDueDate) {

  public long wholeWon() {
    if (expectedAmount instanceof Integer amount) return amount.longValue();
    if (expectedAmount instanceof Long amount) return amount;
    if (expectedAmount instanceof BigInteger amount && amount.bitLength() < 64) {
      return amount.longValueExact();
    }
    throw new IllegalArgumentException("금액은 원 단위 정수로 입력해 주세요.");
  }

  public int supportedInterval() {
    if (intervalMonths instanceof Integer interval) return interval;
    if (intervalMonths instanceof Long interval
        && interval >= Integer.MIN_VALUE
        && interval <= Integer.MAX_VALUE) {
      return interval.intValue();
    }
    throw new IllegalArgumentException("반복 주기를 선택해 주세요.");
  }
}
