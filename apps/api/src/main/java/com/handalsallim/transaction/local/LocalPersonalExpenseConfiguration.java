package com.handalsallim.transaction.local;

import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import java.security.Principal;
import java.util.UUID;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@Profile("local")
public class LocalPersonalExpenseConfiguration {
  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID SPACE_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");

  @Bean
  ApplicationRunner personalExpenseLocalOptions(JdbcTemplate jdbc) {
    return args -> {
      jdbc.update(
          "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES (?, 'admin', 'ACTIVE', now(), now()) ON CONFLICT DO NOTHING",
          USER_ID);
      jdbc.update(
          "INSERT INTO spaces (id, management_mode, name, time_zone, status, created_by, created_at, updated_at) VALUES (?, 'SOLO', 'admin 개인 공간', 'Asia/Seoul', 'ACTIVE', ?, now(), now()) ON CONFLICT DO NOTHING",
          SPACE_ID,
          USER_ID);
      jdbc.update(
          "INSERT INTO space_members (space_id, user_id, role, status, joined_at, created_at, updated_at) VALUES (?, ?, 'OWNER', 'ACTIVE', now(), now(), now()) ON CONFLICT DO NOTHING",
          SPACE_ID,
          USER_ID);
      for (String name : new String[] {"식비", "교통", "생활", "쇼핑", "의료", "기타"}) {
        jdbc.update(
            "INSERT INTO categories (id, space_id, name, applies_to, status, created_at, updated_at)"
                + " VALUES (?, ?, ?, 'EXPENSE', 'ACTIVE', now(), now()) ON CONFLICT DO NOTHING",
            UUID.randomUUID(),
            SPACE_ID,
            name);
      }
      jdbc.update(
          "INSERT INTO payment_methods (id, space_id, name, type, status, created_at, updated_at)"
              + " SELECT ?, ?, '현금', 'CASH', 'ACTIVE', now(), now() WHERE NOT EXISTS"
              + " (SELECT 1 FROM payment_methods WHERE space_id = ? AND type = 'CASH' AND status = 'ACTIVE')",
          UUID.randomUUID(),
          SPACE_ID,
          SPACE_ID);
    };
  }

  @Bean
  FilterRegistrationBean<Filter> personalExpenseLocalPrincipal() {
    Filter filter =
        (request, response, chain) ->
            chain.doFilter(
                new HttpServletRequestWrapper((HttpServletRequest) request) {
                  @Override
                  public Principal getUserPrincipal() {
                    return USER_ID::toString;
                  }
                },
                response);
    var registration = new FilterRegistrationBean<>(filter);
    registration.addUrlPatterns("/api/personal-expenses/*");
    registration.setName("personalExpenseLocalPrincipal");
    return registration;
  }
}
