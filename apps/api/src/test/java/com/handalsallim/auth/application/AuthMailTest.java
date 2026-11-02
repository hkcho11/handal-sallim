package com.handalsallim.auth.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class AuthMailTest {
  @Test
  void sendsNumericCodeWithoutNavigationLinkForBothPurposes() {
    var sender = mock(JavaMailSender.class);
    var mail = new AuthMail(sender, "https://example.test", "sender@example.test");
    mail.send("user@example.test", "001234", false);
    mail.send("user@example.test", "123456", true);
    var capture = ArgumentCaptor.forClass(SimpleMailMessage.class);
    verify(sender, times(2)).send(capture.capture());
    assertTrue(capture.getAllValues().getFirst().getText().contains("001234"));
    for (var message : capture.getAllValues()) {
      assertEquals("handalsallim_admin <sender@example.test>", message.getFrom());
      assertTrue(message.getText().contains("10분"));
      assertFalse(message.getText().contains("http"));
      assertFalse(message.getText().contains("#token="));
    }
  }
}
