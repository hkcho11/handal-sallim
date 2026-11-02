package com.handalsallim.auth;

import static org.junit.jupiter.api.Assertions.*;

import com.handalsallim.auth.api.ExternalMailConfiguration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ExternalMailConfigurationTest {
  private MockEnvironment settings(String... profiles) {
    var environment = new MockEnvironment();
    environment.setActiveProfiles(profiles);
    Map.ofEntries(
            Map.entry("spring.mail.host", "smtp.gmail.com"),
            Map.entry("spring.mail.port", "587"),
            Map.entry("spring.mail.username", "smtp-fixture@gmail.com"),
            Map.entry("spring.mail.password", "fixture-key-not-a-secret"),
            Map.entry("spring.mail.properties.mail.smtp.auth", "true"),
            Map.entry("spring.mail.properties.mail.smtp.starttls.enable", "true"),
            Map.entry("spring.mail.properties.mail.smtp.starttls.required", "true"),
            Map.entry("spring.mail.properties.mail.smtp.ssl.checkserveridentity", "true"),
            Map.entry("app.auth.mail-from", "smtp-fixture@gmail.com"),
            Map.entry("app.auth.public-url", "https://app.example.test"),
            Map.entry("app.auth.secure-cookies", "true"))
        .forEach(environment::setProperty);
    return environment;
  }

  @Test
  void authenticatedTlsSmtpSupportsLocalAndProductionWithoutLeakingSettings() {
    assertDoesNotThrow(() -> new ExternalMailConfiguration(settings("prod", "mail-smtp")));
    var local =
        settings("local", "mail-smtp")
            .withProperty("app.auth.public-url", "http://localhost:3000")
            .withProperty("app.auth.secure-cookies", "false");
    assertDoesNotThrow(() -> new ExternalMailConfiguration(local));
  }

  @Test
  void productionRejectsHttpLoopbackMissingCredentialsAndMixedLocalProfile() {
    for (String origin :
        new String[] {
          "http://app.example.test",
          "https://localhost:3000",
          "https://app.example.test/#secret",
          "https://app.example.test/auth"
        }) {
      assertThrows(
          IllegalStateException.class,
          () ->
              new ExternalMailConfiguration(
                  settings("prod", "mail-smtp").withProperty("app.auth.public-url", origin)));
    }
    assertThrows(
        IllegalStateException.class,
        () -> new ExternalMailConfiguration(settings("prod", "local", "mail-smtp")));
    var missing = settings("prod", "mail-smtp").withProperty("spring.mail.password", "");
    var error =
        assertThrows(IllegalStateException.class, () -> new ExternalMailConfiguration(missing));
    assertFalse(error.getMessage().contains("smtp-fixture"));
    assertFalse(error.getMessage().contains("fixture-key"));
  }

  @Test
  void cannotDisableEncryptionIdentityChecksOrEnableSensitiveMailDebugging() {
    for (String property :
        new String[] {
          "mail.smtp.auth",
          "mail.smtp.starttls.enable",
          "mail.smtp.starttls.required",
          "mail.smtp.ssl.checkserveridentity"
        })
      assertThrows(
          IllegalStateException.class,
          () ->
              new ExternalMailConfiguration(
                  settings("prod", "mail-smtp")
                      .withProperty("spring.mail.properties." + property, "false")));
    for (String property : new String[] {"mail.debug", "mail.debug.auth"})
      assertThrows(
          IllegalStateException.class,
          () ->
              new ExternalMailConfiguration(
                  settings("prod", "mail-smtp")
                      .withProperty("spring.mail.properties." + property, "true")));
    assertThrows(
        IllegalStateException.class,
        () ->
            new ExternalMailConfiguration(
                settings("prod", "mail-smtp").withProperty("spring.mail.port", "25")));
    assertThrows(
        IllegalStateException.class,
        () ->
            new ExternalMailConfiguration(
                settings("prod", "mail-smtp").withProperty("app.auth.secure-cookies", "false")));
  }

  @Test
  void gmailCannotUseAnUnrelatedSenderAndBrevoUsesItsOwnSmtpLogin() {
    assertThrows(
        IllegalStateException.class,
        () ->
            new ExternalMailConfiguration(
                settings("mail-smtp")
                    .withProperty("app.auth.mail-from", "different@example.test")));
    assertDoesNotThrow(
        () ->
            new ExternalMailConfiguration(
                settings("prod", "mail-smtp")
                    .withProperty("spring.mail.host", "smtp-relay.brevo.com")
                    .withProperty("spring.mail.username", "fixture@smtp-brevo.com")
                    .withProperty("app.auth.mail-from", "noreply@example.test")));
  }
}
