package com.handalsallim.recurringexpense.application;

import java.util.List;
import java.util.UUID;

public record FixedExpenseFormOptions(
    List<PayerOption> payers,
    List<PaymentMethodOption> paymentMethods,
    List<CategoryOption> categories,
    List<SubcategoryOption> subcategories) {
  public record CategoryOption(UUID id, String name) {}

  public record SubcategoryOption(UUID id, UUID categoryId, String name) {}

  public record PayerOption(String value, String label) {}

  public record PaymentMethodOption(UUID id, String name, String type) {}
}
