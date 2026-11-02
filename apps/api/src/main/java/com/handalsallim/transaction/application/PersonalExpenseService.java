package com.handalsallim.transaction.application;

import static com.handalsallim.transaction.application.PersonalExpenseException.Reason.*;

import com.handalsallim.transaction.domain.PersonalExpenseDetails;
import com.handalsallim.transaction.persistence.PersonalExpenseRepository;
import java.math.BigInteger;
import java.time.Clock;
import java.time.YearMonth;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PersonalExpenseService {
  private final PersonalExpenseRepository repository;
  private final Clock clock;

  public PersonalExpenseService(PersonalExpenseRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  private UUID space(UUID userId, boolean lock) {
    var spaces = repository.activeSpaces(userId, lock);
    if (spaces.size() != 1) throw new PersonalExpenseException(NO_SPACE);
    return spaces.getFirst();
  }

  @Transactional(readOnly = true)
  public PersonalExpenseMonth list(UUID userId, YearMonth month) {
    if (month.getYear() < 1 || month.getYear() > 9999) throw new IllegalArgumentException();
    var items = repository.list(space(userId, false), userId, month);
    String total =
        items.stream()
            .map(item -> BigInteger.valueOf(item.amount()))
            .reduce(BigInteger.ZERO, BigInteger::add)
            .toString();
    return new PersonalExpenseMonth(month.toString(), total, items);
  }

  @Transactional(readOnly = true)
  public PersonalExpenseView get(UUID userId, UUID id) {
    return owned(space(userId, false), userId, id);
  }

  @Transactional(readOnly = true)
  public PersonalExpenseOptions options(UUID userId) {
    return repository.options(space(userId, false));
  }

  @Transactional
  public PersonalExpenseView create(
      UUID userId, UUID key, PersonalExpenseDetails details, boolean privateConfirmed) {
    UUID spaceId = space(userId, true);
    if (repository.options(spaceId).sharedSpace() && !privateConfirmed)
      throw new IllegalArgumentException();
    var existing = repository.creation(spaceId, userId, key);
    if (existing != null) {
      if (!existing.fingerprint().equals(details.fingerprint()))
        throw new PersonalExpenseException(CONFLICT);
      return owned(spaceId, userId, existing.id());
    }
    validateOptions(spaceId, details, null);
    UUID id = UUID.randomUUID();
    repository.insert(id, spaceId, userId, key, details, clock.instant());
    return owned(spaceId, userId, id);
  }

  @Transactional
  public PersonalExpenseView update(
      UUID userId, UUID id, long version, PersonalExpenseDetails details) {
    UUID spaceId = space(userId, true);
    var existing = owned(spaceId, userId, id);
    validateOptions(spaceId, details, existing);
    if (!repository.update(spaceId, userId, id, version, details, clock.instant()))
      throw new PersonalExpenseException(CONFLICT);
    return owned(spaceId, userId, id);
  }

  @Transactional
  public void delete(UUID userId, UUID id, long version) {
    UUID spaceId = space(userId, true);
    owned(spaceId, userId, id);
    if (!repository.delete(spaceId, userId, id, version))
      throw new PersonalExpenseException(CONFLICT);
  }

  private PersonalExpenseView owned(UUID spaceId, UUID userId, UUID id) {
    var result = repository.find(spaceId, userId, id);
    if (result == null) throw new PersonalExpenseException(NOT_FOUND);
    return result;
  }

  private void validateOptions(
      UUID spaceId, PersonalExpenseDetails d, PersonalExpenseView current) {
    if ((current == null || !current.categoryId().equals(d.categoryId()))
        && !repository.usableCategory(spaceId, d.categoryId()))
      throw new IllegalArgumentException();
    if ((current == null || !current.paymentMethodId().equals(d.paymentMethodId()))
        && !repository.usableMethod(spaceId, d.paymentMethodId()))
      throw new IllegalArgumentException();
  }
}
