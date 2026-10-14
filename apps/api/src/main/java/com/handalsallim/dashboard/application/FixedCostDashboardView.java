package com.handalsallim.dashboard.application;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record FixedCostDashboardView(
    String month,
    LocalDate asOf,
    List<String> months,
    List<DashboardView.Charge> charges,
    List<Classification> classifications,
    List<Unscheduled> unscheduled) {
  public record Classification(
      UUID categoryId, String categoryName, UUID subcategoryId, String subcategoryName) {}

  public record Unscheduled(UUID id, String name, long expectedAmount) {}
}
