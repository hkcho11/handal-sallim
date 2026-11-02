package com.handalsallim.recurringexpense.domain;

import java.time.LocalDate;
import java.util.UUID;

public record PaymentCompletion(long amount, LocalDate paidOn, UUID paymentMethodId, long version) {
  public void validate(LocalDate today) {
    if (amount < 1
        || amount > 9_007_199_254_740_991L
        || paidOn == null
        || paidOn.getYear() < 1
        || paidOn.getYear() > 9998
        || paymentMethodId == null
        || version < 0) throw new IllegalArgumentException("실제 금액·결제일·결제수단을 확인해 주세요.");
    if (paidOn.isAfter(today)) throw new IllegalArgumentException("실제 결제일은 오늘 이후로 지정할 수 없습니다.");
  }
}
