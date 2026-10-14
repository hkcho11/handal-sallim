package com.handalsallim.dashboard.application;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record DashboardView(
    String month, LocalDate asOf, List<Entry> entries, List<Charge> charges) {
  public record Entry(
      UUID id,
      String name,
      LocalDate date,
      long amount,
      String category,
      String scope,
      String paymentMethod) {}

  public record Charge(
      UUID id,
      String name,
      LocalDate dueDate,
      int dueDay,
      long expectedAmount,
      Long actualAmount,
      String payer,
      String paymentMethod,
      String status) {}
}
