package com.handalsallim.transaction.api;

import com.handalsallim.transaction.domain.PersonalExpenseDetails;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigInteger;
import java.time.LocalDate;
import java.util.UUID;

public record PersonalExpenseRequest(
    @NotBlank @Size(max = 120) String name,
    @NotNull Object amount,
    @NotNull LocalDate occurredOn,
    @NotNull UUID categoryId,
    @NotNull UUID paymentMethodId,
    @Size(max = 500) String memo,
    Boolean privateConfirmed,
    Object version) {
  private long integer(Object input) {
    if (input instanceof Integer value) return value.longValue();
    if (input instanceof Long value) return value;
    if (input instanceof BigInteger value && value.bitLength() < 64) return value.longValueExact();
    throw new IllegalArgumentException();
  }

  public PersonalExpenseDetails details() {
    return new PersonalExpenseDetails(
        name, integer(amount), occurredOn, categoryId, paymentMethodId, memo);
  }

  public long revision() {
    long value = integer(version);
    if (value < 0 || value > 9007199254740991L) throw new IllegalArgumentException();
    return value;
  }
}
