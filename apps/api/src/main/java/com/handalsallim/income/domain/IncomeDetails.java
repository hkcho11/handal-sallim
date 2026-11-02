package com.handalsallim.income.domain;

import java.time.YearMonth;
import java.util.UUID;

public record IncomeDetails(String name, long amount, YearMonth month, UUID ownerUserId) {
  public IncomeDetails {
    if (name == null || name.isBlank() || name.strip().length() > 120)
      throw new IllegalArgumentException();
    name = name.strip();
    if (amount < 1
        || amount > 9007199254740991L
        || month == null
        || month.getYear() < 1
        || month.getYear() > 9999) throw new IllegalArgumentException();
  }

  public IncomeDetails withOwner(UUID owner) {
    return new IncomeDetails(name, amount, month, owner);
  }

  public String fingerprint() {
    try {
      return java.util.HexFormat.of()
          .formatHex(
              java.security.MessageDigest.getInstance("SHA-256")
                  .digest(
                      (name.length() + ":" + name + ":" + amount + ":" + month + ":" + ownerUserId)
                          .getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException impossible) {
      throw new IllegalStateException("SHA-256 unavailable");
    }
  }
}
