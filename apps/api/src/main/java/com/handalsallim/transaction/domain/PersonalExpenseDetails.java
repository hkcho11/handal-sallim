package com.handalsallim.transaction.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.UUID;

public record PersonalExpenseDetails(
    String name,
    long amount,
    LocalDate occurredOn,
    UUID categoryId,
    UUID paymentMethodId,
    String memo) {
  public PersonalExpenseDetails {
    if (name == null || name.isBlank() || name.strip().length() > 120)
      throw new IllegalArgumentException("지출명을 확인해 주세요.");
    name = name.strip();
    if (amount < 1 || amount > 9007199254740991L)
      throw new IllegalArgumentException("금액은 원 단위 양수로 입력해 주세요.");
    if (occurredOn == null
        || occurredOn.getYear() < 1
        || occurredOn.getYear() > 9999
        || categoryId == null
        || paymentMethodId == null) throw new IllegalArgumentException("필수 입력값을 확인해 주세요.");
    if (memo != null && memo.length() > 500)
      throw new IllegalArgumentException("메모는 500자 이내로 입력해 주세요.");
    memo = memo == null || memo.isBlank() ? null : memo.strip();
  }

  public String fingerprint() {
    String normalized =
        name.length()
            + ":"
            + name
            + ":"
            + amount
            + ":"
            + occurredOn
            + ":"
            + categoryId
            + ":"
            + paymentMethodId
            + ":"
            + (memo == null ? "" : memo);
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest(normalized.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException impossible) {
      throw new IllegalStateException("SHA-256 unavailable");
    }
  }
}
