package com.handalsallim.recurringexpense.application;

import com.handalsallim.recurringexpense.domain.PaymentCompletion;
import com.handalsallim.recurringexpense.persistence.ScheduledChargeStore;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScheduledChargeService {
  private final ScheduledChargeStore store;
  private final Clock clock;

  public ScheduledChargeService(ScheduledChargeStore store, Clock clock) {
    this.store = store;
    this.clock = clock;
  }

  private LocalDate today() {
    return LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul")));
  }

  @Transactional
  public UUID ensure(UUID user, YearMonth month) {
    UUID space = store.lockCurrentSpace(user);
    generateSpace(
        space, month == null ? YearMonth.from(today()).atEndOfMonth() : month.atEndOfMonth());
    return space;
  }

  @Transactional
  public void generateSpace(UUID space, LocalDate through) {
    store.generate(space, through, clock.instant());
  }

  @Transactional
  public List<ChargeView> list(UUID user, UUID expense) {
    UUID space = ensure(user, null);
    return store.list(space, expense);
  }

  @Transactional
  public ChargeView complete(UUID user, UUID id, PaymentCompletion input) {
    input.validate(today());
    UUID space = store.lockCurrentSpace(user);
    var charge = store.charge(space, id);
    if (charge.status().equals("COMPLETED")) {
      if (charge.actualAmount() == input.amount()
          && charge.actualPaidOn().equals(input.paidOn())
          && charge.actualPaymentMethodId().equals(input.paymentMethodId())) return charge;
      throw new ChargeFailure(409, "이미 완료된 결제입니다. 새로고침해 주세요.");
    }
    if (!charge.status().equals("PENDING") || charge.version() != input.version())
      throw new ChargeFailure(409, "결제 내역이 변경되었습니다. 새로고침한 뒤 다시 확인해 주세요.");
    store.complete(space, user, charge, input, clock.instant());
    // Include at least the following cycle, even when it lies beyond the current month.
    var next = store.nextCycleEnd(space, charge.recurringExpenseId(), charge.dueDate());
    var current = YearMonth.from(today()).atEndOfMonth();
    generateSpace(space, next.isAfter(current) ? next : current);
    return store.charge(space, id);
  }
}
