package com.handalsallim.transaction.application;

import java.util.List;
import java.util.UUID;

public record PersonalExpenseOptions(
    boolean sharedSpace, List<Option> categories, List<Option> paymentMethods) {
  public record Option(UUID id, String name) {}
}
