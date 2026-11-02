package com.handalsallim.savings.api;

import com.handalsallim.savings.domain.SavingsDetails;
import java.math.BigDecimal;
import java.util.UUID;

public record SavingsRequest(
    String name,
    String type,
    BigDecimal depositAmount,
    BigDecimal currentAmount,
    BigDecimal version,
    UUID ownerUserId) {
  public SavingsDetails details() {
    return new SavingsDetails(
        name, type, integer(depositAmount), integer(currentAmount), ownerUserId);
  }

  public long revision() {
    long result = integer(version);
    if (result < 0) throw new IllegalArgumentException();
    return result;
  }

  private static long integer(BigDecimal value) {
    if (value == null) throw new IllegalArgumentException();
    try {
      return value.longValueExact();
    } catch (ArithmeticException invalid) {
      throw new IllegalArgumentException();
    }
  }
}
