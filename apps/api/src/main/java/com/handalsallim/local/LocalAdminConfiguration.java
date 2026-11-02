package com.handalsallim.local;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.UUID;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@Profile("local")
public class LocalAdminConfiguration {
  private static final UUID ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID ADMIN_SPACE_ID =
      UUID.fromString("00000000-0000-0000-0000-000000000002");

  @Bean
  ApplicationRunner createLocalAdmin(JdbcTemplate jdbc, Clock clock) {
    return args -> {
      Timestamp now = Timestamp.from(clock.instant());
      jdbc.update(
          "INSERT INTO users (id, display_name, status, created_at, updated_at) "
              + "VALUES (?, 'admin', 'ACTIVE', ?, ?) ON CONFLICT (id) DO NOTHING",
          ADMIN_ID,
          now,
          now);
      jdbc.update(
          "INSERT INTO spaces (id, management_mode, name, time_zone, status, created_by, created_at, updated_at) "
              + "VALUES (?, 'SOLO', 'admin 개인 공간', 'Asia/Seoul', 'ACTIVE', ?, ?, ?) "
              + "ON CONFLICT (id) DO NOTHING",
          ADMIN_SPACE_ID,
          ADMIN_ID,
          now,
          now);
      jdbc.update(
          "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) "
              + "VALUES (?, ?, 'OWNER', 'ACTIVE', ?, ?, ?) ON CONFLICT (space_id, user_id) DO NOTHING",
          ADMIN_SPACE_ID,
          ADMIN_ID,
          now,
          now,
          now);
    };
  }
}
