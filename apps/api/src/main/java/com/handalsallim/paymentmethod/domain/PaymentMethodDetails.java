package com.handalsallim.paymentmethod.domain;

import java.util.Set;
import java.util.UUID;

public record PaymentMethodDetails(String name, String type, UUID holderUserId, String color) {
  public PaymentMethodDetails {
    if (name == null
        || name.isBlank()
        || name.strip().length() > 100
        || type == null
        || !Set.of("CARD", "ACCOUNT", "CASH").contains(type)
        || (color != null && !color.matches("#[0-9a-fA-F]{6}")))
      throw new IllegalArgumentException();
    name = name.strip();
  }
}
