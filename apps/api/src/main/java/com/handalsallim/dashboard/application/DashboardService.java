package com.handalsallim.dashboard.application;

import com.handalsallim.dashboard.persistence.DashboardRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {
  private final DashboardRepository repository;
  private final Clock clock;

  public DashboardService(DashboardRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public DashboardView read(UUID user, YearMonth requestedMonth) {
    var spaces = repository.spaces(user);
    if (spaces.size() != 1) throw new NoDashboardSpaceException();
    LocalDate today = LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul")));
    YearMonth month = requestedMonth == null ? YearMonth.from(today) : requestedMonth;
    if (month.getYear() < 1 || month.getYear() > 9998) throw new IllegalArgumentException();
    UUID space = spaces.getFirst();
    return new DashboardView(
        month.toString(),
        today,
        repository.entries(space, month),
        repository.charges(space, user, month, today));
  }

  public static class NoDashboardSpaceException extends RuntimeException {}
}
