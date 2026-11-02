package com.handalsallim.auth.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class AuthMail {
  private final JavaMailSender sender;
  private final String base;
  private final String from;

  public AuthMail(
      JavaMailSender sender,
      @Value("${app.auth.public-url}") String base,
      @Value("${app.auth.mail-from}") String from) {
    this.sender = sender;
    this.base = base.replaceAll("/+$", "");
    this.from = from;
    var uri = java.net.URI.create(this.base);
    if (!"https".equals(uri.getScheme())
        && !("http".equals(uri.getScheme())
            && java.util.Set.of("localhost", "127.0.0.1").contains(uri.getHost())))
      throw new IllegalArgumentException("인증 링크 도메인에는 HTTPS가 필요합니다.");
    if (uri.getRawQuery() != null || uri.getRawFragment() != null || uri.getUserInfo() != null)
      throw new IllegalArgumentException("인증 링크 도메인을 확인해 주세요.");
  }

  public void send(String email, String code, boolean reset) {
    var mail = new SimpleMailMessage();
    mail.setFrom("handalsallim_admin <" + from + ">");
    mail.setTo(email);
    mail.setSubject(reset ? "[한달살림] 비밀번호 재설정" : "[한달살림] 이메일 확인");
    mail.setText(
        (reset ? "비밀번호 재설정" : "가입 이메일 확인")
            + " 인증번호입니다.\n\n인증번호: "
            + code
            + "\n\n10분 안에 한달살림의 원래 화면으로 돌아가 입력해 주세요."
            + "\n홈 화면에 추가한 한달살림을 사용 중이라면 해당 아이콘을 다시 열어 주세요."
            + "\n인증번호는 다른 사람에게 알려주지 마세요."
            + "\n\n본인이 요청하지 않았다면 이 메일을 무시해 주세요.");
    sender.send(mail);
  }
}
