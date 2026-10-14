package com.handalsallim.transaction.application;

import java.time.LocalDate;
import java.util.UUID;

public record PersonalExpenseView(
    UUID id,
    String name,
    long amount,
    LocalDate occurredOn,
    UUID categoryId,
    String categoryName,
    UUID paymentMethodId,
    String paymentMethodName,
    String memo,
    long version) {}
