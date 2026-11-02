package com.handalsallim.sharing.application;

import com.handalsallim.auth.persistence.AccountRepository;
import com.handalsallim.sharing.domain.MemberCode;
import com.handalsallim.sharing.persistence.RecurringSharingTransfer;
import com.handalsallim.sharing.persistence.SharingRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SharingService {
  private final SharingRepository repository;
  private final RecurringSharingTransfer recurring;
  private final Clock clock;
  private final AccountRepository accounts;

  public SharingService(
      SharingRepository repository,
      RecurringSharingTransfer recurring,
      Clock clock,
      AccountRepository accounts) {
    this.repository = repository;
    this.recurring = recurring;
    this.clock = clock;
    this.accounts = accounts;
  }

  @Transactional
  public SharingView view(UUID user) {
    repository.lockUsers(user, user);
    repository.expire(clock.instant());
    return snapshot(user);
  }

  private SharingView snapshot(UUID user) {
    return new SharingView(
        MemberCode.display(repository.code(user, clock.instant())),
        repository.connection(user),
        repository.requests(user, true),
        repository.requests(user, false));
  }

  @Transactional
  public SharingView.Member lookup(UUID user, String input) {
    UUID target = repository.lookup(MemberCode.normalize(input));
    if (target.equals(user)) throw new SharingFailure(400, "본인에게 연결을 요청할 수 없습니다.");
    if (repository.connected(user) || repository.connected(target))
      throw new SharingFailure(409, "이미 함께 쓰는 상대가 있는 사용자는 연결할 수 없습니다.");
    return new SharingView.Member(
        repository.name(target), MemberCode.display(MemberCode.normalize(input)));
  }

  @Transactional
  public SharingView send(UUID user, String input) {
    String code = MemberCode.normalize(input);
    UUID target = repository.lookup(code);
    if (target.equals(user)) throw new SharingFailure(400, "본인에게 연결을 요청할 수 없습니다.");
    repository.lockUsers(user, target);
    if (!repository.lookup(code).equals(target)) throw new SharingFailure(409, "회원코드가 변경되었습니다.");
    available(user, target);
    repository.soloSpaces(user);
    repository.soloSpaces(target);
    repository.expire(clock.instant());
    repository.code(user, clock.instant());
    repository.code(target, clock.instant());
    repository.request(user, target, clock.instant());
    return snapshot(user);
  }

  @Transactional
  public SharingView rotate(UUID user) {
    repository.lockUsers(user, user);
    repository.rotate(user, clock.instant());
    return snapshot(user);
  }

  @Transactional
  public SharingView decide(UUID user, UUID id, String action) {
    var initial = repository.request(id, false);
    if (!initial.requester().equals(user) && !initial.recipient().equals(user))
      throw new SharingFailure(404, "연결 요청을 찾지 못했습니다.");
    if ((action.equals("ACCEPT") || action.equals("REJECT")) && !initial.recipient().equals(user))
      throw new SharingFailure(403, "받은 요청만 수락하거나 거절할 수 있습니다.");
    if (action.equals("CANCEL") && !initial.requester().equals(user))
      throw new SharingFailure(403, "보낸 요청만 취소할 수 있습니다.");
    repository.lockUsers(initial.requester(), initial.recipient());
    var request = repository.request(id, true);
    if ("ACCEPTED".equals(request.status()) && action.equals("ACCEPT")) return snapshot(user);
    if (!"PENDING".equals(request.status()) || !request.expires().isAfter(clock.instant()))
      throw new SharingFailure(409, "만료되었거나 이미 처리된 요청입니다. 새로고침해 주세요.");
    if (!action.equals("ACCEPT")) {
      repository.decide(
          id, action.equals("REJECT") ? "REJECTED" : "CANCELLED", null, clock.instant());
      return snapshot(user);
    }
    available(request.requester(), request.recipient());
    var requesterSpaces = repository.soloSpaces(request.requester());
    var recipientSpaces = repository.soloSpaces(request.recipient());
    var now = clock.instant();
    var today = LocalDate.ofInstant(now, ZoneId.of("Asia/Seoul"));
    for (UUID old : requesterSpaces) repository.closeSolo(old, request.requester(), now);
    for (UUID old : recipientSpaces) repository.closeSolo(old, request.recipient(), now);
    UUID shared = repository.createShared(request.recipient(), request.requester(), now);
    recurring.seed(shared, now);
    for (UUID old : requesterSpaces) {
      repository.archive(old, request.requester(), shared, now);
      recurring.carry(old, shared, request.requester(), today, now);
    }
    for (UUID old : recipientSpaces) {
      repository.archive(old, request.recipient(), shared, now);
      recurring.carry(old, shared, request.recipient(), today, now);
    }
    repository.decide(id, "ACCEPTED", shared, now);
    repository.cancelOtherRequests(request.requester(), request.recipient(), now);
    return snapshot(user);
  }

  private void available(UUID a, UUID b) {
    if (repository.connected(a) || repository.connected(b))
      throw new SharingFailure(409, "이미 함께 쓰는 상대가 있는 사용자는 연결할 수 없습니다.");
  }

  @Transactional
  public SharingView requestDisconnect(UUID user, UUID space) {
    var connection = lockConnection(user, space);
    if (connection.endedAt() != null) throw new SharingFailure(409, "이미 해제된 연결입니다. 새로고침해 주세요.");
    repository.expire(clock.instant());
    UUID other = user.equals(connection.first()) ? connection.second() : connection.first();
    repository.requestDisconnect(space, user, other, clock.instant());
    return snapshot(user);
  }

  @Transactional
  public SharingView decideDisconnect(UUID user, UUID id, String action) {
    var initial = repository.disconnectRow(id);
    if (!user.equals(initial.requester()) && !user.equals(initial.recipient()))
      throw new SharingFailure(404, "해제 요청을 찾지 못했습니다.");
    if ((action.equals("ACCEPT") || action.equals("REJECT")) && !user.equals(initial.recipient()))
      throw new SharingFailure(403, "상대가 보낸 해제 요청만 수락하거나 거절할 수 있습니다.");
    if (action.equals("CANCEL") && !user.equals(initial.requester()))
      throw new SharingFailure(403, "본인이 보낸 해제 요청만 취소할 수 있습니다.");
    var connection = lockConnection(user, initial.space());
    var request = repository.disconnectRow(id);
    // Retrying a successful acceptance cannot disconnect a later, different connection.
    if (action.equals("ACCEPT") && request.status().equals("ACCEPTED")) return snapshot(user);
    if (connection.endedAt() != null
        || !request.status().equals("PENDING")
        || !request.expires().isAfter(clock.instant()))
      throw new SharingFailure(409, "만료되었거나 이미 처리된 해제 요청입니다. 새로고침해 주세요.");
    var now = clock.instant();
    if (action.equals("ACCEPT")) {
      repository.closeShared(connection, now);
      accounts.createSpace(connection.first(), "내 살림", now);
      accounts.createSpace(connection.second(), "내 살림", now);
    }
    repository.decideDisconnect(
        id,
        switch (action) {
          case "ACCEPT" -> "ACCEPTED";
          case "REJECT" -> "REJECTED";
          case "CANCEL" -> "CANCELLED";
          default -> throw new IllegalArgumentException("Unknown decision");
        },
        now);
    return snapshot(user);
  }

  private SharingRepository.ConnectionRow lockConnection(UUID user, UUID space) {
    var initial = repository.connectionRow(space);
    if (!user.equals(initial.first()) && !user.equals(initial.second()))
      throw new SharingFailure(404, "공유 연결을 찾지 못했습니다.");
    repository.lockUsers(initial.first(), initial.second());
    return repository.connectionRow(space);
  }

  @Transactional(readOnly = true)
  public List<SharingView.Archive> archives(UUID user) {
    return repository.archives(user);
  }
}
