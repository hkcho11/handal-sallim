package com.handalsallim.recurringexpense.application;

import com.handalsallim.recurringexpense.persistence.ScheduledChargeStore;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class FixedPaymentScheduler {
  private static final org.slf4j.Logger log =
      org.slf4j.LoggerFactory.getLogger(FixedPaymentScheduler.class);
  private final ScheduledChargeStore store;
  private final ScheduledChargeService service;
  private final Clock clock;

  public FixedPaymentScheduler(
      ScheduledChargeStore store, ScheduledChargeService service, Clock clock) {
    this.store = store;
    this.service = service;
    this.clock = clock;
  }

  @Scheduled(fixedDelay = 60000, initialDelay = 60000)
  public void recordDuePayments() {
    var today = LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul")));
    for (var space : store.fixedSpaces()) {
      try {
        service.generateSpace(space, today);
      } catch (RuntimeException failure) {
        log.warn("Automatic payment recording failed; it will be retried.");
      }
    }
  }
}
