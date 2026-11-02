package com.handalsallim.shared.ownership;

import java.util.List;
import java.util.UUID;

public record OwnerOptions(UUID currentUserId, List<Member> members) {
  public record Member(UUID id, String name) {}
}
