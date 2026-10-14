package com.handalsallim.transaction;

import static org.junit.jupiter.api.Assertions.*;

import com.handalsallim.TestcontainersConfiguration;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("local")
@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LocalPersonalExpenseIntegrationTest {
  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;

  @Test
  void localProfileSeedsOptionsAndServesRealHttpCrudWithLocalPrincipal() throws Exception {
    UUID space = UUID.fromString("00000000-0000-0000-0000-000000000002");
    UUID category =
        jdbc.queryForObject(
            "SELECT id FROM categories WHERE space_id = ? AND name = '식비' AND status = 'ACTIVE'",
            UUID.class,
            space);
    UUID method =
        jdbc.queryForObject(
            "SELECT id FROM payment_methods WHERE space_id = ? AND type = 'CASH' AND status = 'ACTIVE'",
            UUID.class,
            space);
    UUID key = UUID.randomUUID();
    try (var client = HttpClient.newHttpClient()) {
      var options =
          client.send(
              HttpRequest.newBuilder(
                      URI.create("http://127.0.0.1:" + port + "/api/personal-expenses/options"))
                  .GET()
                  .build(),
              HttpResponse.BodyHandlers.ofString());
      assertEquals(200, options.statusCode());
      assertTrue(options.body().contains("식비"));
      String body =
          """
          {"name":"로컬 테스트 지출","amount":1000,"occurredOn":"2026-10-14","categoryId":"%s","paymentMethodId":"%s"}
          """
              .formatted(category, method);
      var created =
          client.send(
              HttpRequest.newBuilder(
                      URI.create("http://127.0.0.1:" + port + "/api/personal-expenses"))
                  .header("Content-Type", "application/json")
                  .header("Idempotency-Key", key.toString())
                  .POST(HttpRequest.BodyPublishers.ofString(body))
                  .build(),
              HttpResponse.BodyHandlers.ofString());
      assertEquals(201, created.statusCode());
      assertEquals("no-store", created.headers().firstValue("Cache-Control").orElse(""));
      UUID id =
          jdbc.queryForObject(
              "SELECT id FROM transactions WHERE creation_key = ?", UUID.class, key);
      var listed =
          client.send(
              HttpRequest.newBuilder(
                      URI.create(
                          "http://127.0.0.1:" + port + "/api/personal-expenses?month=2026-10"))
                  .GET()
                  .build(),
              HttpResponse.BodyHandlers.ofString());
      assertEquals(200, listed.statusCode());
      assertTrue(listed.body().contains(id.toString()));
      var updated =
          client.send(
              HttpRequest.newBuilder(
                      URI.create("http://127.0.0.1:" + port + "/api/personal-expenses/" + id))
                  .header("Content-Type", "application/json")
                  .PUT(
                      HttpRequest.BodyPublishers.ofString(
                          body.replace("\"amount\":1000", "\"amount\":1500")
                              .replace("}", ",\"version\":0}")))
                  .build(),
              HttpResponse.BodyHandlers.ofString());
      assertEquals(200, updated.statusCode());
      var deleted =
          client.send(
              HttpRequest.newBuilder(
                      URI.create(
                          "http://127.0.0.1:"
                              + port
                              + "/api/personal-expenses/"
                              + id
                              + "?version=1"))
                  .DELETE()
                  .build(),
              HttpResponse.BodyHandlers.ofString());
      assertEquals(204, deleted.statusCode());
      assertEquals(
          0,
          jdbc.queryForObject("SELECT count(*) FROM transactions WHERE id = ?", Integer.class, id));
    }
  }
}
