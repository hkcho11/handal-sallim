package com.handalsallim.auth.application;

import java.io.PrintStream;
import java.util.Properties;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/** Standalone SMTP check: no application, database, account, or token creation. */
public final class SmtpProbe {
  private SmtpProbe() {}

  public static void main(String[] args) {
    int status;
    try {
      var sender = new JavaMailSenderImpl();
      sender.setHost(required("SMTP_HOST"));
      sender.setPort(Integer.parseInt(required("SMTP_PORT")));
      sender.setUsername(required("SMTP_USER"));
      sender.setPassword(required("SMTP_PASSWORD"));
      sender.setDefaultEncoding("UTF-8");
      var properties = new Properties();
      for (String key :
          new String[] {
            "mail.smtp.auth",
            "mail.smtp.starttls.enable",
            "mail.smtp.starttls.required",
            "mail.smtp.ssl.checkserveridentity"
          }) properties.setProperty(key, "true");
      for (String key :
          new String[] {
            "mail.smtp.connectiontimeout", "mail.smtp.timeout", "mail.smtp.writetimeout"
          }) properties.setProperty(key, "5000");
      properties.setProperty("mail.debug", "false");
      properties.setProperty("mail.debug.auth", "false");
      sender.setJavaMailProperties(properties);
      String recipient = System.getenv("SMTP_TEST_RECIPIENT");
      status = check(sender, required("AUTH_MAIL_FROM"), recipient, System.out);
    } catch (Exception invalid) {
      System.out.println(
          "SMTP_CHECK_FAILED: verify the server environment settings; no credentials were logged.");
      status = 1;
    }
    System.exit(status);
  }

  static int check(JavaMailSenderImpl sender, String from, String recipient, PrintStream output) {
    try {
      sender.testConnection();
      if (recipient != null && !recipient.isBlank()) {
        var mail = new SimpleMailMessage();
        mail.setFrom(from);
        mail.setTo(recipient);
        mail.setSubject("[한달살림] 메일 연결 확인");
        mail.setText("한달살림 인증 메일 발송 연결을 확인하는 테스트 메일입니다. 인증 토큰이나 비밀번호는 포함하지 않습니다.");
        sender.send(mail);
        output.println(
            "SMTP_ACCEPTED: test message accepted; confirm delivery in the recipient inbox.");
      } else
        output.println("SMTP_CONNECTED: authenticated TLS connection passed; no email was sent.");
      return 0;
    } catch (MailAuthenticationException invalid) {
      output.println(
          "SMTP_AUTH_FAILED: verify the SMTP login and dedicated SMTP key or app password.");
      return 1;
    } catch (Exception failed) {
      output.println(
          "SMTP_CHECK_FAILED: check connectivity, TLS, sender approval and provider quota; no credentials were logged.");
      return 1;
    }
  }

  private static String required(String name) {
    String value = System.getenv(name);
    if (value == null || value.isBlank()) throw new IllegalArgumentException(name);
    return value;
  }
}
