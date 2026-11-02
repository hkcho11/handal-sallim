package com.handalsallim.income.application;

import java.util.UUID;

public record IncomeView(
    UUID id,
    String name,
    long amount,
    String month,
    long version,
    UUID ownerUserId,
    String ownerName) {}
