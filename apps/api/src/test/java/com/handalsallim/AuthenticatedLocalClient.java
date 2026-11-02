package com.handalsallim;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;

public record AuthenticatedLocalClient(HttpClient client, String token) implements AutoCloseable {
  public static AuthenticatedLocalClient login(JdbcTemplate jdbc, int port) throws Exception {
    String email = "local-fixture@example.test";
    String password = "LocalFixture728!";
    String hash =
        "{pbkdf2@SpringSecurity_v5_8}"
            + Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8().encode(password);
    jdbc.update(
        "INSERT INTO password_credentials(user_id,email_address,email_lookup_key,password_hash,email_verified_at,password_changed_at,created_at,updated_at) VALUES (?,?,?, ?,now(),now(),now(),now()) ON CONFLICT(user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash",
        UUID.fromString("00000000-0000-0000-0000-000000000001"),
        email,
        email,
        hash);
    var cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
    var client = HttpClient.newBuilder().cookieHandler(cookies).build();
    String base = "http://127.0.0.1:" + port + "/api/auth/";
    var csrf =
        client.send(
            HttpRequest.newBuilder(URI.create(base + "csrf")).GET().build(),
            HttpResponse.BodyHandlers.ofString());
    String token = csrf.body().split("\"token\":\"")[1].split("\"")[0];
    var loggedIn =
        client.send(
            HttpRequest.newBuilder(URI.create(base + "login"))
                .header("Content-Type", "application/json")
                .header("X-XSRF-TOKEN", token)
                .POST(
                    HttpRequest.BodyPublishers.ofString(
                        "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .build(),
            HttpResponse.BodyHandlers.ofString());
    if (loggedIn.statusCode() != 200) {
      client.close();
      throw new AssertionError("Fixture login failed: " + loggedIn.statusCode());
    }
    return new AuthenticatedLocalClient(client, token);
  }

  public HttpRequest.Builder request(URI uri) {
    return HttpRequest.newBuilder(uri).header("X-XSRF-TOKEN", token);
  }

  @Override
  public void close() {
    client.close();
  }
}
