package com.handalsallim.sharing.persistence;

import com.handalsallim.sharing.application.SharingFailure;
import com.handalsallim.sharing.application.SharingView;
import com.handalsallim.sharing.domain.MemberCode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SharingRepository {
  private final JdbcTemplate jdbc;

  public SharingRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public void lockUsers(UUID a, UUID b) {
    var ids =
        jdbc.queryForList(
            "SELECT u.id FROM users u JOIN password_credentials c ON c.user_id=u.id WHERE u.id IN (?,?) AND u.status='ACTIVE' AND c.email_verified_at IS NOT NULL ORDER BY u.id FOR UPDATE OF u",
            UUID.class,
            a,
            b);
    if (ids.size() != (a.equals(b) ? 1 : 2))
      throw new SharingFailure(404, "연결할 수 있는 사용자를 찾지 못했습니다.");
  }

  public String code(UUID user, Instant now) {
    var existing =
        jdbc.queryForList(
            "SELECT code FROM member_codes WHERE user_id=? AND revoked_at IS NULL",
            String.class,
            user);
    if (!existing.isEmpty()) return existing.getFirst();
    for (int i = 0; i < 20; i++) {
      String generated = MemberCode.generate();
      if (jdbc.update(
              "INSERT INTO member_codes(code,user_id,created_at) VALUES (?,?,?) ON CONFLICT DO NOTHING",
              generated,
              user,
              Timestamp.from(now))
          == 1) return generated;
    }
    throw new SharingFailure(503, "회원코드를 만들지 못했습니다. 다시 시도해 주세요.");
  }

  public void rotate(UUID user, Instant now) {
    jdbc.update(
        "UPDATE member_codes SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
        Timestamp.from(now),
        user);
    jdbc.update(
        "UPDATE sharing_requests SET status='CANCELLED',decided_at=? WHERE recipient_id=? AND status='PENDING'",
        Timestamp.from(now),
        user);
  }

  public UUID lookup(String code) {
    return jdbc
        .query(
            "SELECT u.id FROM member_codes m JOIN users u ON u.id=m.user_id JOIN password_credentials c ON c.user_id=u.id WHERE m.code=? AND m.revoked_at IS NULL AND u.status='ACTIVE' AND c.email_verified_at IS NOT NULL",
            (rs, n) -> rs.getObject(1, UUID.class),
            code)
        .stream()
        .findFirst()
        .orElseThrow(() -> new SharingFailure(404, "해당 회원코드를 찾지 못했습니다."));
  }

  public String name(UUID user) {
    return jdbc.queryForObject("SELECT display_name FROM users WHERE id=?", String.class, user);
  }

  public boolean connected(UUID user) {
    return !jdbc.queryForList(
            "SELECT space_id FROM sharing_connections WHERE ended_at IS NULL AND (first_user_id=? OR second_user_id=?)",
            user,
            user)
        .isEmpty();
  }

  public SharingView.Connection connection(UUID user) {
    return jdbc
        .query(
            "SELECT c.space_id,u.display_name,c.started_at FROM sharing_connections c JOIN users u ON u.id=CASE WHEN c.first_user_id=? THEN c.second_user_id ELSE c.first_user_id END WHERE c.ended_at IS NULL AND (c.first_user_id=? OR c.second_user_id=?)",
            (rs, n) ->
                new SharingView.Connection(
                    rs.getObject(1, UUID.class),
                    rs.getString(2),
                    rs.getTimestamp(3).toInstant(),
                    pendingDisconnect(rs.getObject(1, UUID.class), user)),
            user,
            user,
            user)
        .stream()
        .findFirst()
        .orElse(null);
  }

  public void expire(Instant now) {
    jdbc.update(
        "UPDATE sharing_disconnect_requests SET status='EXPIRED',decided_at=? WHERE status='PENDING' AND expires_at<=?",
        Timestamp.from(now),
        Timestamp.from(now));
    jdbc.update(
        "UPDATE sharing_requests SET status='EXPIRED',decided_at=? WHERE status='PENDING' AND expires_at<=?",
        Timestamp.from(now),
        Timestamp.from(now));
  }

  public List<SharingView.Request> requests(UUID user, boolean received) {
    String mine = received ? "recipient_id" : "requester_id",
        other = received ? "requester_id" : "recipient_id";
    return jdbc.query(
        "SELECT r.id,u.display_name,c.code,r.status,r.created_at,r.expires_at FROM sharing_requests r JOIN users u ON u.id=r."
            + other
            + " JOIN member_codes c ON c.user_id=u.id AND c.revoked_at IS NULL WHERE r."
            + mine
            + "=? ORDER BY r.created_at DESC,r.id LIMIT 30",
        (rs, n) ->
            new SharingView.Request(
                rs.getObject(1, UUID.class),
                rs.getString(2),
                MemberCode.display(rs.getString(3)),
                rs.getString(4),
                rs.getTimestamp(5).toInstant(),
                rs.getTimestamp(6).toInstant()),
        user);
  }

  public void request(UUID from, UUID to, Instant now) {
    if (!jdbc.queryForList(
            "SELECT id FROM sharing_requests WHERE requester_id=? AND recipient_id=? AND status='PENDING'",
            to,
            from)
        .isEmpty()) throw new SharingFailure(409, "상대가 이미 요청을 보냈습니다. 새로고침한 뒤 받은 요청을 확인해 주세요.");
    jdbc.update(
        "INSERT INTO sharing_requests(id,requester_id,recipient_id,status,created_at,expires_at) VALUES (?,?,?,'PENDING',?,?) ON CONFLICT DO NOTHING",
        UUID.randomUUID(),
        from,
        to,
        Timestamp.from(now),
        Timestamp.from(now.plusSeconds(86400)));
  }

  public record RequestRow(
      UUID id, UUID requester, UUID recipient, String status, Instant expires, UUID sharedSpace) {}

  public RequestRow request(UUID id, boolean lock) {
    return jdbc
        .query(
            "SELECT id,requester_id,recipient_id,status,expires_at,shared_space_id FROM sharing_requests WHERE id=?"
                + (lock ? " FOR UPDATE" : ""),
            (rs, n) ->
                new RequestRow(
                    rs.getObject(1, UUID.class),
                    rs.getObject(2, UUID.class),
                    rs.getObject(3, UUID.class),
                    rs.getString(4),
                    rs.getTimestamp(5).toInstant(),
                    rs.getObject(6, UUID.class)),
            id)
        .stream()
        .findFirst()
        .orElseThrow(() -> new SharingFailure(404, "연결 요청을 찾지 못했습니다."));
  }

  public void decide(UUID id, String status, UUID space, Instant now) {
    jdbc.update(
        "UPDATE sharing_requests SET status=?,shared_space_id=?,decided_at=? WHERE id=?",
        status,
        space,
        Timestamp.from(now),
        id);
  }

  public void cancelOtherRequests(UUID a, UUID b, Instant now) {
    jdbc.update(
        "UPDATE sharing_requests SET status='CANCELLED',decided_at=? WHERE status='PENDING' AND (requester_id IN (?,?) OR recipient_id IN (?,?))",
        Timestamp.from(now),
        a,
        b,
        a,
        b);
  }

  public List<UUID> soloSpaces(UUID user) {
    var spaces =
        jdbc.query(
            "SELECT s.id,s.management_mode,(SELECT count(*) FROM space_members x WHERE x.space_id=s.id AND x.status='ACTIVE') members FROM spaces s JOIN space_members m ON m.space_id=s.id WHERE m.user_id=? AND m.status='ACTIVE' AND s.status='ACTIVE' ORDER BY s.id FOR UPDATE OF s,m",
            (rs, n) -> {
              if (!"SOLO".equals(rs.getString(2)) || rs.getInt(3) != 1)
                throw new SharingFailure(409, "이미 함께 쓰는 공간이 있는 사용자는 연결할 수 없습니다.");
              return rs.getObject(1, UUID.class);
            },
            user);
    if (spaces.size() > 1) throw new SharingFailure(409, "현재 공간을 확인한 뒤 다시 요청해 주세요.");
    return spaces;
  }

  public UUID createShared(UUID recipient, UUID requester, Instant now) {
    UUID space = UUID.randomUUID();
    var time = Timestamp.from(now);
    jdbc.update(
        "INSERT INTO spaces(id,management_mode,name,status,created_by,created_at,updated_at) VALUES (?,'SHARED','함께 쓰는 살림','ACTIVE',?,?,?)",
        space,
        recipient,
        time,
        time);
    for (UUID user : new UUID[] {recipient, requester})
      jdbc.update(
          "INSERT INTO space_members(space_id,user_id,role,status,joined_at,created_at,updated_at) VALUES (?,?,?,'ACTIVE',?,?,?)",
          space,
          user,
          user.equals(recipient) ? "OWNER" : "MEMBER",
          time,
          time,
          time);
    jdbc.update(
        "INSERT INTO sharing_connections(space_id,first_user_id,second_user_id,started_at) VALUES (?,?,?,?)",
        space,
        recipient,
        requester,
        time);
    jdbc.update(
        "INSERT INTO payment_methods(id,space_id,name,type,status,created_at,updated_at) VALUES (?,?,'현금','CASH','ACTIVE',?,?)",
        UUID.randomUUID(),
        space,
        time,
        time);
    return space;
  }

  public void archive(UUID space, UUID user, UUID shared, Instant now) {
    var time = Timestamp.from(now);
    jdbc.update(
        "INSERT INTO private_space_archives(space_id,user_id,archived_at,shared_space_id) VALUES (?,?,?,?)",
        space,
        user,
        time,
        shared);
  }

  public void closeSolo(UUID space, UUID user, Instant now) {
    var time = Timestamp.from(now);
    jdbc.update(
        "UPDATE space_members SET status='LEFT',ended_at=?,updated_at=? WHERE space_id=? AND user_id=? AND status='ACTIVE'",
        time,
        time,
        space,
        user);
    jdbc.update(
        "UPDATE spaces SET status='ARCHIVED',updated_at=?,version=version+1 WHERE id=?",
        time,
        space);
  }

  public List<SharingView.Archive> archives(UUID user) {
    return jdbc.query(
        "SELECT s.id,COALESCE(s.name,'이전 살림'),a.archived_at,a.scope FROM (SELECT space_id,archived_at,'PRIVATE' scope FROM private_space_archives WHERE user_id=? UNION ALL SELECT space_id,archived_at,'SHARED' scope FROM shared_space_archives WHERE user_id=?) a JOIN spaces s ON s.id=a.space_id ORDER BY a.archived_at DESC,s.id",
        (rs, n) ->
            new SharingView.Archive(
                rs.getObject(1, UUID.class),
                rs.getString(2),
                rs.getTimestamp(3).toInstant(),
                rs.getString(4),
                archiveEntries(rs.getObject(1, UUID.class), user)),
        user,
        user);
  }

  public record ConnectionRow(UUID space, UUID first, UUID second, Instant endedAt) {}

  public ConnectionRow connectionRow(UUID space) {
    return jdbc
        .query(
            "SELECT space_id,first_user_id,second_user_id,ended_at FROM sharing_connections WHERE space_id=?",
            (rs, n) ->
                new ConnectionRow(
                    rs.getObject(1, UUID.class),
                    rs.getObject(2, UUID.class),
                    rs.getObject(3, UUID.class),
                    rs.getTimestamp(4) == null ? null : rs.getTimestamp(4).toInstant()),
            space)
        .stream()
        .findFirst()
        .orElseThrow(() -> new SharingFailure(404, "공유 연결을 찾지 못했습니다."));
  }

  public record DisconnectRow(
      UUID id, UUID space, UUID requester, UUID recipient, String status, Instant expires) {}

  public DisconnectRow disconnectRow(UUID id) {
    return jdbc
        .query(
            "SELECT id,space_id,requester_id,recipient_id,status,expires_at FROM sharing_disconnect_requests WHERE id=?",
            (rs, n) ->
                new DisconnectRow(
                    rs.getObject(1, UUID.class),
                    rs.getObject(2, UUID.class),
                    rs.getObject(3, UUID.class),
                    rs.getObject(4, UUID.class),
                    rs.getString(5),
                    rs.getTimestamp(6).toInstant()),
            id)
        .stream()
        .findFirst()
        .orElseThrow(() -> new SharingFailure(404, "해제 요청을 찾지 못했습니다."));
  }

  private SharingView.DisconnectRequest pendingDisconnect(UUID space, UUID user) {
    return jdbc
        .query(
            "SELECT id,requester_id,created_at,expires_at FROM sharing_disconnect_requests WHERE space_id=? AND status='PENDING'",
            (rs, n) ->
                new SharingView.DisconnectRequest(
                    rs.getObject(1, UUID.class),
                    user.equals(rs.getObject(2, UUID.class)),
                    rs.getTimestamp(3).toInstant(),
                    rs.getTimestamp(4).toInstant()),
            space)
        .stream()
        .findFirst()
        .orElse(null);
  }

  public void requestDisconnect(UUID space, UUID requester, UUID recipient, Instant now) {
    // A repeated click or an opposite request never counts as the other member's consent.
    jdbc.update(
        "INSERT INTO sharing_disconnect_requests(id,space_id,requester_id,recipient_id,status,created_at,expires_at) VALUES (?,?,?,?,'PENDING',?,?) ON CONFLICT DO NOTHING",
        UUID.randomUUID(),
        space,
        requester,
        recipient,
        Timestamp.from(now),
        Timestamp.from(now.plusSeconds(86400)));
  }

  public void decideDisconnect(UUID id, String status, Instant now) {
    jdbc.update(
        "UPDATE sharing_disconnect_requests SET status=?,decided_at=? WHERE id=?",
        status,
        Timestamp.from(now),
        id);
  }

  public void closeShared(ConnectionRow connection, Instant now) {
    var time = Timestamp.from(now);
    // Serialize with in-flight financial writes before ending memberships and freezing history.
    jdbc.queryForList(
        "SELECT id FROM spaces WHERE id=? AND status='ACTIVE' FOR UPDATE", connection.space());
    jdbc.update(
        "UPDATE space_members SET status='LEFT',ended_at=?,updated_at=? WHERE space_id=? AND status='ACTIVE'",
        time,
        time,
        connection.space());
    jdbc.update(
        "UPDATE spaces SET status='ARCHIVED',updated_at=?,version=version+1 WHERE id=?",
        time,
        connection.space());
    jdbc.update(
        "UPDATE sharing_connections SET ended_at=? WHERE space_id=? AND ended_at IS NULL",
        time,
        connection.space());
    for (UUID user : new UUID[] {connection.first(), connection.second()})
      jdbc.update(
          "INSERT INTO shared_space_archives(space_id,user_id,archived_at) VALUES (?,?,?)",
          connection.space(),
          user,
          time);
  }

  private List<SharingView.ArchiveEntry> archiveEntries(UUID space, UUID user) {
    return jdbc.query(
        """
    SELECT 'INCOME' kind,name,amount,income_month date,'PRESERVED' state FROM incomes WHERE space_id=? AND deleted_at IS NULL
    UNION ALL SELECT 'SAVINGS',name,current_amount,NULL::date,'PRESERVED' FROM savings WHERE space_id=? AND deleted_at IS NULL
    UNION ALL SELECT 'CHARGE',expense_name,COALESCE(actual_amount,expected_amount),due_date,status FROM scheduled_charges WHERE space_id=?
    UNION ALL SELECT 'FIXED_SETTING',r.name,r.default_expected_amount,r.anchor_due_date,e.status FROM recurring_expenses e JOIN LATERAL (SELECT * FROM recurring_expense_revisions v WHERE v.recurring_expense_id=e.id ORDER BY v.created_at DESC,v.id DESC LIMIT 1) r ON true WHERE e.space_id=?
    UNION ALL SELECT 'TRANSACTION',COALESCE(name,'지출 기록'),amount,occurred_on,status FROM transactions WHERE space_id=? AND created_by=? AND source='MANUAL'
    ORDER BY date DESC NULLS LAST,name
    """,
        (rs, n) ->
            new SharingView.ArchiveEntry(
                rs.getString(1),
                rs.getString(2),
                (Long) rs.getObject(3),
                rs.getObject(4, java.time.LocalDate.class),
                rs.getString(5)),
        space,
        space,
        space,
        space,
        space,
        user);
  }
}
