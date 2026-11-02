package com.handalsallim.savings.application;

import java.util.List;

public record SavingsOverview(
    String totalCurrentAmount, String monthlyDepositAmount, List<SavingsView> items) {}
