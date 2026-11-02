package com.handalsallim.income.application;

import static com.handalsallim.income.application.IncomeException.Reason.*;

import com.handalsallim.income.domain.IncomeDetails;
import com.handalsallim.income.persistence.IncomeRepository;
import com.handalsallim.shared.ownership.OwnerMemberRepository;
import com.handalsallim.shared.ownership.OwnerOptions;
import java.math.BigInteger;
import java.time.YearMonth;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IncomeService {
  private final IncomeRepository repository;

  private final OwnerMemberRepository owners;

  public IncomeService(IncomeRepository repository, OwnerMemberRepository owners) {
    this.owners = owners;
    this.repository = repository;
  }

  private UUID space(UUID user, boolean lock) {
    var spaces = repository.activeSpaces(user, lock);
    if (spaces.size() != 1) throw new IncomeException(NO_SPACE);
    return spaces.getFirst();
  }

  @Transactional(readOnly = true)
  public OwnerOptions members(UUID user) {
    return new OwnerOptions(user, owners.members(space(user, false)));
  }

  @Transactional(readOnly = true)
  public IncomeMonth list(UUID user, YearMonth month) {
    var items = repository.list(space(user, false), month);
    var total =
        items.stream()
            .map(i -> BigInteger.valueOf(i.amount()))
            .reduce(BigInteger.ZERO, BigInteger::add);
    return new IncomeMonth(month.toString(), total.toString(), items);
  }

  @Transactional(readOnly = true)
  public IncomeView get(UUID user, UUID id) {
    return owned(space(user, false), id);
  }

  @Transactional
  public IncomeView create(UUID user, UUID key, IncomeDetails d) {
    UUID space = space(user, true);
    d = d.withOwner(d.ownerUserId() == null ? user : d.ownerUserId());
    var existing = repository.creation(space, user, key);
    if (existing != null) {
      if (!existing.fingerprint().equals(d.fingerprint())) throw new IncomeException(CONFLICT);
      return owned(space, existing.id());
    }
    if (!owners.isActive(space, d.ownerUserId())) throw new IllegalArgumentException();
    UUID id = UUID.randomUUID();
    repository.insert(id, space, user, key, d);
    return owned(space, id);
  }

  @Transactional
  public IncomeView update(UUID user, UUID id, long version, IncomeDetails d) {
    UUID space = space(user, true);
    var current = owned(space, id);
    d = d.withOwner(d.ownerUserId() == null ? current.ownerUserId() : d.ownerUserId());
    if (!d.ownerUserId().equals(current.ownerUserId()))
      if (!owners.isActive(space, d.ownerUserId())) throw new IllegalArgumentException();
    if (!repository.update(space, id, version, d)) throw new IncomeException(CONFLICT);
    return owned(space, id);
  }

  @Transactional
  public void delete(UUID user, UUID id, long version) {
    UUID space = space(user, true);
    owned(space, id);
    if (!repository.delete(space, user, id, version)) throw new IncomeException(CONFLICT);
  }

  private IncomeView owned(UUID space, UUID id) {
    var item = repository.find(space, id);
    if (item == null) throw new IncomeException(NOT_FOUND);
    return item;
  }
}
