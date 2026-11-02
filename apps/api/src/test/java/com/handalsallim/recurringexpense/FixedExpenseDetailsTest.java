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
    assertEquals("월세", new FixedExpenseDetails(" 월세 ", 650_000, 1, 15, date, null, null).name());
    for (int interval : new int[] {1, 2, 3, 12}) {
      assertEquals(
          interval,
          new FixedExpenseDetails("보험", 1, interval, 15, date, null, null).intervalMonths());
    }
    assertThrows(
        IllegalArgumentException.class,
        () -> new FixedExpenseDetails("보험", 0, 1, 15, date, null, null));
    assertThrows(
        IllegalArgumentException.class,
        () -> new FixedExpenseDetails("보험", 9_007_199_254_740_992L, 1, 15, date, null, null));
    assertThrows(
        IllegalArgumentException.class,
        () -> new FixedExpenseDetails("보험", 1, 4, 15, date, null, null));
  }

  @Test
  void allowsMissingScheduleAndRequiresBothValuesForACharge() {
    var details = new FixedExpenseDetails("인터넷", 35_000, null, null, null, null, null);
    assertEquals(false, details.hasSchedule());
    assertEquals(false, new FixedExpenseDetails("보험", 1, 1, 15, null, null, null).hasSchedule());
    assertEquals(
        false,
        new FixedExpenseDetails("보험", 1, null, null, LocalDate.now(), null, null).hasSchedule());
    assertEquals(
        true,
        new FixedExpenseDetails(
                "보험", 1, 1, LocalDate.now().getDayOfMonth(), LocalDate.now(), null, null)
            .hasSchedule());
  }
}
