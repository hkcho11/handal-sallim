package com.handalsallim.income;

import static org.junit.jupiter.api.Assertions.*;

import com.handalsallim.AuthenticatedLocalClient;
import com.handalsallim.TestcontainersConfiguration;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("local")
@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LocalIncomeIntegrationTest {
  @LocalServerPort int port;

  @org.springframework.beans.factory.annotation.Autowired
  org.springframework.jdbc.core.JdbcTemplate jdbc;

  @Test
  void authenticatedLocalAccountWorksForCollectionAndIndividualRoutes() throws Exception {
    String base = "http://127.0.0.1:" + port + "/api/incomes";
    try (var auth = AuthenticatedLocalClient.login(jdbc, port)) {
      var client = auth.client();
      var created =
          client.send(
              auth.request(URI.create(base))
                  .header("Content-Type", "application/json")
                  .header("Idempotency-Key", UUID.randomUUID().toString())
                  .POST(
                      HttpRequest.BodyPublishers.ofString(
                          "{\"name\":\"테스트 수입\",\"amount\":1000,\"month\":\"2026-10\"}"))
                  .build(),
              HttpResponse.BodyHandlers.ofString());
      assertEquals(201, created.statusCode());
      String id = created.body().split("\"id\":\"")[1].split("\"")[0];
      var list =
          client.send(
              auth.request(URI.create(base + "?month=2026-10")).GET().build(),
              HttpResponse.BodyHandlers.ofString());
      assertEquals(200, list.statusCode());
      assertTrue(list.body().contains(id));
      var removed =
          client.send(
              auth.request(URI.create(base + "/" + id + "?version=0")).DELETE().build(),
              HttpResponse.BodyHandlers.ofString());
      assertEquals(204, removed.statusCode());
    }
  }
}
