package com.handalsallim.shared.ownership;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OwnerMemberRepository {
  private final JdbcTemplate jdbc;

  public OwnerMemberRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<OwnerOptions.Member> members(UUID space) {
    return jdbc.query(
        "SELECT u.id, u.display_name FROM space_members m JOIN users u ON u.id = m.user_id WHERE m.space_id = ? AND m.status = 'ACTIVE' AND u.status = 'ACTIVE' ORDER BY m.joined_at, u.id",
        (rs, row) -> new OwnerOptions.Member(rs.getObject(1, UUID.class), rs.getString(2)),
        space);
  }

  public boolean isActive(UUID space, UUID owner) {
    var ids =
        jdbc.query(
            "SELECT u.id FROM space_members m JOIN users u ON u.id = m.user_id WHERE m.space_id = ? AND m.user_id = ? AND m.status = 'ACTIVE' AND u.status = 'ACTIVE' FOR SHARE OF m, u",
            (rs, row) -> rs.getObject(1, UUID.class),
            space,
            owner);
    return ids.size() == 1;
  }
}
