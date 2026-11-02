package com.handalsallim.auth.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;

class SmtpProbeTest {
  @Test
  void connectionCheckDoesNotSendAnyMessageUnlessARecipientIsExplicitlySet() throws Exception {
    var sender = mock(JavaMailSenderImpl.class);
    var output = new ByteArrayOutputStream();
    assertEquals(0, SmtpProbe.check(sender, "sender@example.test", null, new PrintStream(output)));
    verify(sender).testConnection();
    verify(sender, never()).send(any(SimpleMailMessage.class));
    assertTrue(output.toString().contains("no email was sent"));
  }

  @Test
  void requestedTestMailFollowsSuccessfulAuthenticationAndContainsNoTokens() throws Exception {
    var sender = mock(JavaMailSenderImpl.class);
    var output = new ByteArrayOutputStream();
    assertEquals(
        0,
        SmtpProbe.check(
            sender, "sender@example.test", "self@example.test", new PrintStream(output)));
    var message = ArgumentCaptor.forClass(SimpleMailMessage.class);
    var order = inOrder(sender);
    order.verify(sender).testConnection();
    order.verify(sender).send(message.capture());
    assertArrayEquals(new String[] {"self@example.test"}, message.getValue().getTo());
    assertFalse(message.getValue().getText().contains("#token="));
  }

  @Test
  void failedConnectionNeverSendsAndNeverPrintsRawProviderErrors() throws Exception {
    var sender = mock(JavaMailSenderImpl.class);
    var output = new ByteArrayOutputStream();
    doThrow(new jakarta.mail.MessagingException("fixture-private-key-and-address"))
        .when(sender)
        .testConnection();
    assertEquals(
        1,
        SmtpProbe.check(
            sender, "sender@example.test", "self@example.test", new PrintStream(output)));
    verify(sender, never()).send(any(SimpleMailMessage.class));
    assertFalse(output.toString().contains("fixture-private"));
    assertFalse(output.toString().contains("@example.test"));
  }
}
