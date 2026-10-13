package com.handalsallim.recurringexpense.application;

import java.time.LocalDate;
import java.util.UUID;

public record FixedExpenseView(
    UUID id,
    String name,
    long expectedAmount,
    int intervalMonths,
    LocalDate firstDueDate,
    UUID firstChargeId,
    String firstChargeStatus) {}
