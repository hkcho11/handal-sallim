package com.handalsallim.auth.application;

import com.handalsallim.auth.domain.AccountInput;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PasswordSafety {
  private final boolean checkBreaches;
  private final HttpClient client =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

  public PasswordSafety(@Value("${app.auth.check-breaches:true}") boolean checkBreaches) {
    this.checkBreaches = checkBreaches;
  }

  public void validate(String password) {
    AccountInput.password(password);
    if (java.util.Set.of(
            "password1",
            "password123",
            "qwerty123",
            "abcd1234",
            "12345678a",
            "admin1234",
            "test1234")
        .contains(password.toLowerCase(Locale.ROOT)))
      throw new IllegalArgumentException("흔히 사용하는 비밀번호입니다. 다른 비밀번호를 입력해 주세요.");
    if (!checkBreaches) return;
    try {
      String hash =
          HexFormat.of()
              .withUpperCase()
              .formatHex(
                  MessageDigest.getInstance("SHA-1")
                      .digest(password.getBytes(StandardCharsets.UTF_8)));
      var request =
          HttpRequest.newBuilder(
                  URI.create("https://api.pwnedpasswords.com/range/" + hash.substring(0, 5)))
              .timeout(Duration.ofSeconds(5))
              .header("Add-Padding", "true")
              .GET()
              .build();
      var response = client.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200)
        throw new AuthFailure(503, "비밀번호 안전성을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      if (response.body().lines().anyMatch(line -> line.startsWith(hash.substring(5) + ":")))
        throw new IllegalArgumentException("유출된 적이 있는 비밀번호입니다. 다른 비밀번호를 입력해 주세요.");
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new AuthFailure(503, "잠시 후 다시 시도해 주세요.");
    } catch (java.io.IOException | java.security.NoSuchAlgorithmException unavailable) {
      throw new AuthFailure(503, "비밀번호 안전성을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }
}
