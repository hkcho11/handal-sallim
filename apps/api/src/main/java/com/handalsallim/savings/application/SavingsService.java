package com.handalsallim.savings.application;

import static com.handalsallim.savings.application.SavingsException.Reason.*;

import com.handalsallim.savings.domain.SavingsDetails;
import com.handalsallim.savings.persistence.SavingsRepository;
import com.handalsallim.shared.ownership.OwnerMemberRepository;
import com.handalsallim.shared.ownership.OwnerOptions;
import java.math.BigInteger;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SavingsService {
  private final SavingsRepository repository;

  private final OwnerMemberRepository owners;

  public SavingsService(SavingsRepository repository, OwnerMemberRepository owners) {
    this.owners = owners;
    this.repository = repository;
  }

  private UUID space(UUID user, boolean lock) {
    var spaces = repository.activeSpaces(user, lock);
    if (spaces.size() != 1) throw new SavingsException(NO_SPACE);
    return spaces.getFirst();
  }

  @Transactional(readOnly = true)
  public OwnerOptions members(UUID user) {
    return new OwnerOptions(user, owners.members(space(user, false)));
  }

  @Transactional(readOnly = true)
  public SavingsOverview list(UUID user) {
    var items = repository.list(space(user, false));
    var total =
        items.stream()
            .map(i -> BigInteger.valueOf(i.currentAmount()))
            .reduce(BigInteger.ZERO, BigInteger::add);
    var monthly =
        items.stream()
            .filter(i -> "INSTALLMENT".equals(i.type()))
            .map(i -> BigInteger.valueOf(i.depositAmount()))
            .reduce(BigInteger.ZERO, BigInteger::add);
    return new SavingsOverview(total.toString(), monthly.toString(), items);
  }

  @Transactional(readOnly = true)
  public SavingsView get(UUID user, UUID id) {
    return owned(space(user, false), id);
  }

  @Transactional
  public SavingsView create(UUID user, UUID key, SavingsDetails d) {
    UUID space = space(user, true);
    d = d.withOwner(d.ownerUserId() == null ? user : d.ownerUserId());
    var existing = repository.creation(space, user, key);
    if (existing != null) {
      if (!existing.fingerprint().equals(d.fingerprint())) throw new SavingsException(CONFLICT);
      return owned(space, existing.id());
    }
    if (!owners.isActive(space, d.ownerUserId())) throw new IllegalArgumentException();
    UUID id = UUID.randomUUID();
    repository.insert(id, space, user, key, d);
    return owned(space, id);
  }

  @Transactional
  public SavingsView update(UUID user, UUID id, long version, SavingsDetails d) {
    UUID space = space(user, true);
    var current = owned(space, id);
    d = d.withOwner(d.ownerUserId() == null ? current.ownerUserId() : d.ownerUserId());
    if (!d.ownerUserId().equals(current.ownerUserId()))
      if (!owners.isActive(space, d.ownerUserId())) throw new IllegalArgumentException();
    if (!repository.update(space, id, version, d)) throw new SavingsException(CONFLICT);
    return owned(space, id);
  }

  @Transactional
  public void delete(UUID user, UUID id, long version) {
    UUID space = space(user, true);
    owned(space, id);
    if (!repository.delete(space, user, id, version)) throw new SavingsException(CONFLICT);
  }

  private SavingsView owned(UUID space, UUID id) {
    var item = repository.find(space, id);
    if (item == null) throw new SavingsException(NOT_FOUND);
    return item;
  }
}
