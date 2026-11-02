package com.handalsallim.savings.application;

import java.util.UUID;

public record SavingsView(
    UUID id,
    String name,
    String type,
    long depositAmount,
    long currentAmount,
    long version,
    UUID ownerUserId,
    String ownerName) {}
