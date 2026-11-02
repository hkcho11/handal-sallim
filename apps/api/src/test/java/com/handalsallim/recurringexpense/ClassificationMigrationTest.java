package com.handalsallim.recurringexpense;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

class ClassificationMigrationTest {
  @Test
  void migrationKeepsArchivedClassificationsReadOnlyAndUnchanged() {
    try (var database = new PostgreSQLContainer(DockerImageName.parse("postgres:18.6"))) {
      database.start();
      var source =
          new DriverManagerDataSource(
              database.getJdbcUrl(), database.getUsername(), database.getPassword());
      Flyway.configure().dataSource(source).target("14").load().migrate();
      var jdbc = new JdbcTemplate(source);
      UUID user = UUID.randomUUID(),
          space = UUID.randomUUID(),
          category = UUID.randomUUID(),
          sub = UUID.randomUUID();
      jdbc.update(
          "INSERT INTO users(id,display_name,status,created_at,updated_at) VALUES (?,'보존 사용자','ACTIVE',now(),now())",
          user);
      jdbc.update(
          "INSERT INTO spaces(id,management_mode,status,created_by,created_at,updated_at) VALUES (?,'SOLO','ACTIVE',?,now(),now())",
          space,
          user);
      jdbc.update(
          "INSERT INTO categories(id,space_id,name,applies_to,status,created_at,updated_at) VALUES (?,?,'보존 분류','EXPENSE','ACTIVE',now(),now())",
          category,
          space);
      jdbc.update(
          "INSERT INTO expense_subcategories(id,space_id,category_id,name,status,created_at) VALUES (?,?,?,'보존 중분류','ACTIVE',now())",
          sub,
          space,
          category);
      jdbc.update("UPDATE spaces SET status='ARCHIVED' WHERE id=?", space);
      Flyway.configure().dataSource(source).load().migrate();
      assertEquals(
          "보존 분류",
          jdbc.queryForObject("SELECT name FROM categories WHERE id=?", String.class, category));
      assertEquals(
          category,
          jdbc.queryForObject(
              "SELECT category_id FROM expense_subcategories WHERE id=?", UUID.class, sub));
      assertThrows(
          org.springframework.dao.DataAccessException.class,
          () -> jdbc.update("UPDATE categories SET name='변경 시도' WHERE id=?", category));
    }
  }
}
