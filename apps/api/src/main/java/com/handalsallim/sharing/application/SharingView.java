package com.handalsallim.sharing.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SharingView(
    String memberCode, Connection connection, List<Request> received, List<Request> sent) {
  public record Member(String name, String memberCode) {}

  public record Connection(
      UUID spaceId, String partnerName, Instant startedAt, DisconnectRequest disconnectRequest) {}

  public record DisconnectRequest(
      UUID id, boolean requestedByMe, Instant createdAt, Instant expiresAt) {}

  public record Request(
      UUID id,
      String name,
      String memberCode,
      String status,
      Instant createdAt,
      Instant expiresAt) {}

  public record Archive(
      UUID spaceId,
      String spaceName,
      Instant archivedAt,
      String scope,
      List<ArchiveEntry> entries) {}

  public record ArchiveEntry(
      String kind, String name, Long amount, LocalDate date, String status) {}
}
