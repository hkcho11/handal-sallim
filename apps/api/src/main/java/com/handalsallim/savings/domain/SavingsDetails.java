package com.handalsallim.savings.domain;

import java.util.UUID;

public record SavingsDetails(
    String name, String type, long depositAmount, long currentAmount, UUID ownerUserId) {
  public SavingsDetails {
    if (name == null || name.isBlank() || name.strip().length() > 120)
      throw new IllegalArgumentException();
    name = name.strip();
    if (!("DEPOSIT".equals(type) || "INSTALLMENT".equals(type))
        || depositAmount < 1
        || depositAmount > 9007199254740991L
        || currentAmount < 0
        || currentAmount > 9007199254740991L) throw new IllegalArgumentException();
  }

  public SavingsDetails withOwner(UUID owner) {
    return new SavingsDetails(name, type, depositAmount, currentAmount, owner);
  }

  public String fingerprint() {
    try {
      return java.util.HexFormat.of()
          .formatHex(
              java.security.MessageDigest.getInstance("SHA-256")
                  .digest(
                      (name.length()
                              + ":"
                              + name
                              + ":"
                              + type
                              + ":"
                              + depositAmount
                              + ":"
                              + currentAmount
                              + ":"
                              + ownerUserId)
                          .getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException impossible) {
      throw new IllegalStateException("SHA-256 unavailable");
    }
  }
}
