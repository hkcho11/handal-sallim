package com.handalsallim.recurringexpense.api;

import jakarta.validation.constraints.NotNull;

public record CompleteScheduleRequest(
    @NotNull Object intervalMonths,
    @NotNull Object recurringDayOfMonth,
    @NotNull java.time.LocalDate firstDueDate) {
  public int supportedInterval() {
    if (intervalMonths instanceof Integer interval) return interval;
    if (intervalMonths instanceof Long interval
        && interval >= Integer.MIN_VALUE
        && interval <= Integer.MAX_VALUE) {
      return interval.intValue();
    }
    throw new IllegalArgumentException("반복 주기를 선택해 주세요.");
  }

  public int supportedRecurringDay() {
    if (recurringDayOfMonth instanceof Integer day) return day;
    if (recurringDayOfMonth instanceof Long day
        && day >= Integer.MIN_VALUE
        && day <= Integer.MAX_VALUE) {
      return day.intValue();
    }
    throw new IllegalArgumentException("반복 결제일을 선택해 주세요.");
  }
}
