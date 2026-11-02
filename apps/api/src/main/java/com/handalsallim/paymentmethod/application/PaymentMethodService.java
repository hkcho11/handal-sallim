package com.handalsallim.paymentmethod.application;

import com.handalsallim.paymentmethod.domain.PaymentMethodDetails;
import com.handalsallim.paymentmethod.persistence.PaymentMethodRepository;
import com.handalsallim.recurringexpense.application.FixedExpenseService;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PaymentMethodService {
  private final PaymentMethodRepository repository;
  private final FixedExpenseService expenses;
  private final Clock clock;

  public PaymentMethodService(
      PaymentMethodRepository repository, FixedExpenseService expenses, Clock clock) {
    this.repository = repository;
    this.expenses = expenses;
    this.clock = clock;
  }

  private UUID space(UUID user, boolean lock) {
    var ids = repository.activeSpaces(user, lock);
    if (ids.size() != 1) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    return ids.getFirst();
  }

  public record Member(UUID id, String name) {}

  @Transactional(readOnly = true)
  public List<PaymentMethodView> list(UUID user) {
    return repository.list(space(user, false));
  }

  @Transactional(readOnly = true)
  public List<Member> members(UUID user) {
    return repository.members(space(user, false));
  }

  private PaymentMethodView find(UUID space, UUID id) {
    return repository.list(space).stream()
        .filter(item -> item.id().equals(id))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  }

  private void validate(UUID space, PaymentMethodDetails d) {
    if (d.holderUserId() != null && !repository.holder(space, d.holderUserId()))
      throw new IllegalArgumentException();
  }

  @Transactional
  public PaymentMethodView create(UUID user, UUID id, PaymentMethodDetails d) {
    UUID space = space(user, true);
    validate(space, d);
    var existing = repository.list(space).stream().filter(item -> item.id().equals(id)).findFirst();
    if (existing.isPresent()) {
      var item = existing.get();
      if (item.name().equals(d.name())
          && item.type().equals(d.type())
          && java.util.Objects.equals(item.holderUserId(), d.holderUserId())
          && java.util.Objects.equals(item.color(), d.color())
          && item.status().equals("ACTIVE")) return item;
      throw new ResponseStatusException(HttpStatus.CONFLICT);
    }
    repository.create(space, id, d, clock.instant());
    return find(space, id);
  }

  @Transactional
  public PaymentMethodView update(UUID user, UUID id, long version, PaymentMethodDetails d) {
    UUID space = space(user, true);
    find(space, id);
    validate(space, d);
    if (!repository.update(space, id, version, d, clock.instant()))
      throw new ResponseStatusException(HttpStatus.CONFLICT);
    return find(space, id);
  }

  @Transactional
  public void archive(UUID user, UUID id, long version) {
    UUID space = space(user, true);
    var item = find(space, id);
    if (item.status().equals("ARCHIVED")) return;
    if (!repository.archive(space, id, version, clock.instant()))
      throw new ResponseStatusException(HttpStatus.CONFLICT);
    expenses.clearPaymentMethod(user, id);
  }
}
