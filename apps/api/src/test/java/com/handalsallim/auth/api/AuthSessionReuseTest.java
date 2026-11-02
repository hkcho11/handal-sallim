package com.handalsallim.auth.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.handalsallim.auth.application.AuthService;
import com.handalsallim.auth.application.EmailCodeService;
import com.handalsallim.auth.persistence.AccountRepository.Account;
import java.time.Clock;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthSessionReuseTest {
  @Test
  void reusesOnlyTheAccountVerifiedInTheSameRequest() {
    var service = mock(AuthService.class);
    var controller = new AuthController(service, Clock.systemUTC(), mock(EmailCodeService.class));
    UUID id = UUID.randomUUID();
    var request = new MockHttpServletRequest();
    request.setAttribute(
        AuthConfiguration.AUTHENTICATED_ACCOUNT, new AuthConfiguration.RequestAccount(id, "살림이"));
    when(service.hasSpace(id)).thenReturn(true);
    var view = controller.session(id::toString, request);
    assertEquals("살림이", view.name());
    verify(service, never()).current(any(), anyLong());
    verify(service).hasSpace(id);
  }

  @Test
  void doesNotTrustARequestAccountForAnotherPrincipal() {
    var service = mock(AuthService.class);
    var controller = new AuthController(service, Clock.systemUTC(), mock(EmailCodeService.class));
    UUID id = UUID.randomUUID();
    var request = new MockHttpServletRequest();
    request.getSession().setAttribute("accountVersion", 2L);
    request.setAttribute(
        AuthConfiguration.AUTHENTICATED_ACCOUNT,
        new AuthConfiguration.RequestAccount(UUID.randomUUID(), "다른 사용자"));
    when(service.current(id, 2L))
        .thenReturn(new Account(id, "본인", "fixture@example.test", "fixture-hash", true, 2L));
    assertEquals("본인", controller.session(id::toString, request).name());
    verify(service).current(id, 2L);
  }
}
