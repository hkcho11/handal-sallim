package com.handalsallim.recurringexpense;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class FixedExpenseDetailsTest {
  @Test
  void acceptsOnlyPositiveWholeWonAndSupportedIntervals() {
    var date = LocalDate.of(2026, 10, 31);
    assertEquals("월세", new FixedExpenseDetails(" 월세 ", 650_000, 1, date).name());
    for (int interval : new int[] {1, 2, 3, 12}) {
      assertEquals(interval, new FixedExpenseDetails("보험", 1, interval, date).intervalMonths());
    }
    assertThrows(IllegalArgumentException.class, () -> new FixedExpenseDetails("보험", 0, 1, date));
    assertThrows(
        IllegalArgumentException.class,
        () -> new FixedExpenseDetails("보험", 9_007_199_254_740_992L, 1, date));
    assertThrows(IllegalArgumentException.class, () -> new FixedExpenseDetails("보험", 1, 4, date));
  }
}
