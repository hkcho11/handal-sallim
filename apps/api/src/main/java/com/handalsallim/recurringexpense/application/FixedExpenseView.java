package com.handalsallim.recurringexpense.application;

import java.time.LocalDate;
import java.util.UUID;

public record FixedExpenseView(
    UUID id,
    String name,
    long expectedAmount,
    Integer intervalMonths,
    Integer recurringDayOfMonth,
    LocalDate firstDueDate,
    UUID firstChargeId,
    String firstChargeStatus,
    String payer,
    UUID paymentMethodId,
    String paymentMethodName,
    UUID categoryId,
    String categoryName,
    UUID subcategoryId,
    String subcategoryName,
    String memo,
    LocalDate firstChargeDueDate) {}
