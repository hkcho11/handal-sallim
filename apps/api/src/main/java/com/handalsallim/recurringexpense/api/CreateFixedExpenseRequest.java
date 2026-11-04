package com.handalsallim.recurringexpense.api;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigInteger;
import java.time.LocalDate;
import java.util.UUID;

public record CreateFixedExpenseRequest(
    @Size(max = 120) String memo,
    Object expectedAmount,
    Object intervalMonths,
    Object recurringDayOfMonth,
    LocalDate firstDueDate,
    String payer,
    UUID paymentMethodId,
    @NotNull UUID categoryId,
    @NotNull UUID subcategoryId,
    String billingMode,
    java.time.YearMonth billingMonth) {

  public com.handalsallim.recurringexpense.domain.FixedExpenseDetails details() {
    if ("FIXED".equals(billingMode) && paymentMethodId == null)
      throw new IllegalArgumentException("자동 결제에 사용할 결제수단을 선택해 주세요.");
    return new com.handalsallim.recurringexpense.domain.FixedExpenseDetails(
        "분류 지출",
        wholeWon(),
        supportedInterval(),
        supportedRecurringDay(),
        firstDueDate,
        payerChoice(),
        paymentMethodId,
        categoryId,
        subcategoryId,
        memo,
        billingMode,
        billingMonth);
  }

  public Long wholeWon() {
    if (expectedAmount == null && "VARIABLE".equals(billingMode)) return null;
    if (expectedAmount instanceof Integer amount) return amount.longValue();
    if (expectedAmount instanceof Long amount) return amount;
    if (expectedAmount instanceof BigInteger amount && amount.bitLength() < 64) {
      return amount.longValueExact();
    }
    throw new IllegalArgumentException("금액은 원 단위 정수로 입력해 주세요.");
  }

  public Integer supportedInterval() {
    if (intervalMonths == null) return null;
    if (intervalMonths instanceof Integer interval) return interval;
    if (intervalMonths instanceof Long interval
        && interval >= Integer.MIN_VALUE
        && interval <= Integer.MAX_VALUE) {
      return interval.intValue();
    }
    throw new IllegalArgumentException("반복 주기를 선택해 주세요.");
  }

  public Integer supportedRecurringDay() {
    if (recurringDayOfMonth == null) return null;
    if (recurringDayOfMonth instanceof Integer day) return day;
    if (recurringDayOfMonth instanceof Long day
        && day >= Integer.MIN_VALUE
        && day <= Integer.MAX_VALUE) {
      return day.intValue();
    }
    throw new IllegalArgumentException("반복 결제일을 선택해 주세요.");
  }

  public com.handalsallim.recurringexpense.domain.FixedExpenseDetails.Payer payerChoice() {
    if (payer == null || payer.isBlank()) return null;
    try {
      return com.handalsallim.recurringexpense.domain.FixedExpenseDetails.Payer.valueOf(payer);
    } catch (IllegalArgumentException invalid) {
      throw new IllegalArgumentException("결제자를 확인해 주세요.");
    }
  }
}
