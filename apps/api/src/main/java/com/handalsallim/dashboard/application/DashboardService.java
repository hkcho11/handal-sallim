package com.handalsallim.dashboard.application;

import com.handalsallim.dashboard.persistence.DashboardRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {
  private final DashboardRepository repository;
  private final Clock clock;
  private final com.handalsallim.recurringexpense.application.ScheduledChargeService scheduled;

  public DashboardService(
      DashboardRepository repository,
      Clock clock,
      com.handalsallim.recurringexpense.application.ScheduledChargeService scheduled) {
    this.repository = repository;
    this.clock = clock;
    this.scheduled = scheduled;
  }

  @Transactional
  public DashboardView read(UUID user, YearMonth requestedMonth) {
    LocalDate today = LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul")));
    YearMonth month = requestedMonth == null ? YearMonth.from(today) : requestedMonth;
    if (month.getYear() < 1 || month.getYear() > 9998) throw new IllegalArgumentException();
    UUID space = scheduled.ensure(user, month);
    return new DashboardView(
        month.toString(),
        today,
        repository.entries(space, month),
        repository.charges(space, user, month, today));
  }

  @Transactional
  public FixedCostDashboardView readFixedCosts(UUID user, YearMonth requestedMonth) {
    LocalDate today = LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul")));
    YearMonth month = requestedMonth == null ? YearMonth.from(today) : requestedMonth;
    if (month.getYear() < 2 || month.getYear() > 9998) throw new IllegalArgumentException();
    UUID space = scheduled.ensure(user, month);
    var months =
        java.util.stream.IntStream.rangeClosed(0, 5)
            .mapToObj(index -> month.minusMonths(5 - index).toString())
            .toList();
    return new FixedCostDashboardView(
        month.toString(),
        today,
        months,
        repository.charges(space, user, month.minusMonths(5), month, today),
        repository.classifications(space),
        repository.unscheduled(space, month));
  }
}
