package com.handalsallim.auth.api;

import com.handalsallim.auth.domain.AccountInput;
import java.net.URI;
import java.util.Set;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

@Configuration
@Profile("mail-smtp")
public class ExternalMailConfiguration {
  public ExternalMailConfiguration(Environment environment) {
    String host = required(environment, "spring.mail.host");
    String login = required(environment, "spring.mail.username");
    required(environment, "spring.mail.password");
    String from = required(environment, "app.auth.mail-from");
    try {
      AccountInput.email(from);
    } catch (IllegalArgumentException invalid) {
      throw invalid("AUTH_MAIL_FROM");
    }
    if (Set.of("localhost", "127.0.0.1", "::1").contains(host.toLowerCase(java.util.Locale.ROOT))
        || host.endsWith(".local")) throw invalid("SMTP_HOST");
    if (host.equalsIgnoreCase("smtp.gmail.com") && !from.equalsIgnoreCase(login))
      throw invalid("Gmail SMTP_USER / AUTH_MAIL_FROM");
    int port;
    try {
      port = Integer.parseInt(required(environment, "spring.mail.port"));
    } catch (NumberFormatException invalid) {
      throw invalid("SMTP_PORT");
    }
    if (port != 587 && port != 2525) throw invalid("SMTP_PORT (STARTTLS 587 / 2525)");
    for (String property :
        new String[] {
          "mail.smtp.auth",
          "mail.smtp.starttls.enable",
          "mail.smtp.starttls.required",
          "mail.smtp.ssl.checkserveridentity"
        })
      if (!environment.getProperty("spring.mail.properties." + property, Boolean.class, false))
        throw invalid(property);
    for (String property : new String[] {"mail.debug", "mail.debug.auth"})
      if (environment.getProperty("spring.mail.properties." + property, Boolean.class, false))
        throw invalid(property);
    boolean local = environment.acceptsProfiles(Profiles.of("local"));
    boolean prod = environment.acceptsProfiles(Profiles.of("prod"));
    if (local && prod) throw invalid("SPRING_PROFILES_ACTIVE (prod/local)");
    URI origin;
    try {
      origin = URI.create(required(environment, "app.auth.public-url"));
    } catch (IllegalArgumentException invalid) {
      throw invalid("APP_PUBLIC_URL");
    }
    boolean loopback =
        Set.of("localhost", "127.0.0.1").contains(origin.getHost() == null ? "" : origin.getHost());
    if (origin.getHost() == null
        || origin.getUserInfo() != null
        || origin.getRawQuery() != null
        || origin.getRawFragment() != null
        || (origin.getPath() != null
            && !origin.getPath().isEmpty()
            && !origin.getPath().equals("/"))
        || !("https".equals(origin.getScheme())
            || (local && loopback && "http".equals(origin.getScheme())))
        || (!local && loopback)) throw invalid("APP_PUBLIC_URL");
    if (!local && !environment.getProperty("app.auth.secure-cookies", Boolean.class, false))
      throw invalid("AUTH_SECURE_COOKIES");
  }

  private static String required(Environment environment, String name) {
    String value = environment.getProperty(name);
    if (value == null || value.isBlank()) throw invalid(name);
    return value.strip();
  }

  private static IllegalStateException invalid(String name) {
    // Never include SMTP credentials, addresses, or configured values in startup diagnostics.
    return new IllegalStateException(
        "External mail configuration requires a valid "
            + name
            + ". See docs/02-design/transactional-email.md.");
  }
}
