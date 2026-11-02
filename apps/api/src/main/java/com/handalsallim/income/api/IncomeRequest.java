package com.handalsallim.income.api;

import com.handalsallim.income.domain.IncomeDetails;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.UUID;

public record IncomeRequest(
    String name, BigDecimal amount, String month, BigDecimal version, UUID ownerUserId) {
  public IncomeDetails details() {
    if (amount == null) throw new IllegalArgumentException();
    return new IncomeDetails(name, integer(amount), parseMonth(month), ownerUserId);
  }

  public long revision() {
    if (version == null || integer(version) < 0) throw new IllegalArgumentException();
    return integer(version);
  }

  private static long integer(BigDecimal value) {
    try {
      return value.longValueExact();
    } catch (ArithmeticException invalid) {
      throw new IllegalArgumentException();
    }
  }

  public static YearMonth parseMonth(String month) {
    if (month == null || !month.matches("[0-9]{4}-[0-9]{2}")) throw new IllegalArgumentException();
    YearMonth result = YearMonth.parse(month);
    if (result.getYear() < 1 || result.getYear() > 9999) throw new IllegalArgumentException();
    return result;
  }
}
