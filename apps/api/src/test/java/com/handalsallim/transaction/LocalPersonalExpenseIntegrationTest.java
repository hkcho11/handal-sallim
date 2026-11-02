package com.handalsallim.transaction;

import static org.junit.jupiter.api.Assertions.*;

import com.handalsallim.AuthenticatedLocalClient;
import com.handalsallim.TestcontainersConfiguration;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
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
  void removedPersonalExpenseApiCannotReadOrCreateRecordsEvenAfterLogin() throws Exception {
    int before = jdbc.queryForObject("SELECT count(*) FROM transactions", Integer.class);
    try (var auth = AuthenticatedLocalClient.login(jdbc, port)) {
      var client = auth.client();
      for (String path :
          new String[] {"/api/personal-expenses", "/api/personal-expenses/options"}) {
        var response =
            client.send(
                auth.request(URI.create("http://127.0.0.1:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(403, response.statusCode());
      }
      var response =
          client.send(
              auth.request(URI.create("http://127.0.0.1:" + port + "/api/personal-expenses"))
                  .header("Content-Type", "application/json")
                  .POST(HttpRequest.BodyPublishers.ofString("{}"))
                  .build(),
              HttpResponse.BodyHandlers.ofString());
      assertEquals(403, response.statusCode());
    }
    assertEquals(before, jdbc.queryForObject("SELECT count(*) FROM transactions", Integer.class));
  }
}
