package com.handalsallim.recurringexpense.application;

import java.time.LocalDate;
import java.util.UUID;

public record ChargeView(
    UUID id,
    UUID recurringExpenseId,
    String name,
    LocalDate dueDate,
    Long expectedAmount,
    String status,
    Long actualAmount,
    LocalDate actualPaidOn,
    UUID plannedPaymentMethodId,
    UUID actualPaymentMethodId,
    String paymentMethodName,
    long version) {}
