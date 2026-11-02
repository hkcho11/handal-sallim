package com.handalsallim.auth.api;

import com.handalsallim.auth.application.AuthService;
import com.handalsallim.auth.application.EmailCodeService;
import com.handalsallim.auth.domain.AccountInput;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.time.Clock;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService service;
  private final Clock clock;
  private final EmailCodeService codes;

  public AuthController(AuthService service, Clock clock, EmailCodeService codes) {
    this.service = service;
    this.clock = clock;
    this.codes = codes;
  }

  // Never use request records: their generated toString would contain credentials.
  public static final class Credentials {
    @NotBlank
    @Size(max = 254)
    public String email;

    @NotBlank
    @Size(max = 128)
    public String password;

    @Size(max = 100)
    public String name;
  }

  public static final class Email {
    @NotBlank
    @Size(max = 254)
    public String email;
  }

  public static final class Registration {
    @NotBlank
    @Size(max = 254)
    public String email;

    @NotBlank
    @Size(max = 100)
    public String name;
  }

  public static final class Action {
    @NotBlank
    @Size(max = 100)
    public String token;

    @Size(max = 128)
    public String password;
  }

  public record Space(@NotBlank @Size(max = 100) String name) {}

  public record SessionView(String userId, String name, boolean hasSpace) {}

  public static final class CodeInput {
    @jakarta.validation.constraints.NotNull public UUID requestId;

    @NotBlank
    @Size(max = 32)
    public String code;

    @jakarta.validation.constraints.NotNull public Boolean reset;
  }

  public record CodeRequestView(String requestId, String message, int expiresInSeconds) {}

  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "UP");
  }

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken());
  }

  @PostMapping("/register")
  public CodeRequestView register(
      @Valid @RequestBody Registration input, HttpServletRequest request) {
    limit(request, input.email, "register", 5);
    return sent(service.register(input.email, input.name));
  }

  @PostMapping("/login")
  public SessionView login(@Valid @RequestBody Credentials input, HttpServletRequest request) {
    limit(request, input.email, "login", 10);
    var account = service.login(input.email, input.password);
    var old = request.getSession(false);
    if (old != null) old.invalidate();
    var session = request.getSession(true);
    session.setAttribute("accountId", account.id().toString());
    session.setAttribute("accountVersion", account.version());
    session.setAttribute("signedInAt", clock.millis());
    session.setMaxInactiveInterval(7 * 86400);
    return new SessionView(account.id().toString(), account.name(), service.hasSpace(account.id()));
  }

  @GetMapping("/session")
  public SessionView session(Principal principal, HttpServletRequest request) {
    UUID id = UUID.fromString(principal.getName());
    var account =
        service.current(id, (Long) request.getSession(false).getAttribute("accountVersion"));
    return new SessionView(id.toString(), account.name(), service.hasSpace(id));
  }

  @PostMapping("/logout")
  public Map<String, String> logout(HttpServletRequest request, HttpServletResponse response) {
    var session = request.getSession(false);
    if (session != null) session.invalidate();
    return Map.of("message", "로그아웃했습니다.");
  }

  @PostMapping("/resend")
  public CodeRequestView resend(@Valid @RequestBody Email input, HttpServletRequest request) {
    limit(request, input.email, "mail", 3);
    return sent(service.requestLink(input.email, false));
  }

  @PostMapping("/forgot")
  public CodeRequestView forgot(@Valid @RequestBody Email input, HttpServletRequest request) {
    limit(request, input.email, "mail", 3);
    return sent(service.requestLink(input.email, true));
  }

  @PostMapping("/verify-code")
  public Map<String, String> verifyCode(
      @Valid @RequestBody CodeInput input, HttpServletRequest request) {
    service.limit("code-ip", request.getRemoteAddr(), 300);
    return Map.of("token", codes.check(input.requestId, input.code, input.reset));
  }

  @PostMapping("/verify")
  public Map<String, String> verify(@Valid @RequestBody Action input, HttpServletRequest request) {
    service.limit("action-ip", request.getRemoteAddr(), 30);
    service.complete(input.token, input.password, false);
    return Map.of("message", "이메일 확인과 비밀번호 설정이 완료되었습니다. 로그인해 주세요.");
  }

  @PostMapping("/reset")
  public Map<String, String> reset(@Valid @RequestBody Action input, HttpServletRequest request) {
    service.limit("action-ip", request.getRemoteAddr(), 30);
    service.complete(input.token, input.password, true);
    return Map.of("message", "비밀번호를 변경했습니다. 다시 로그인해 주세요.");
  }

  @PostMapping("/space")
  public SessionView space(
      @Valid @RequestBody Space input, Principal principal, HttpServletRequest request) {
    service.createSpace(UUID.fromString(principal.getName()), input.name());
    return session(principal, request);
  }

  private CodeRequestView sent(UUID requestId) {
    return new CodeRequestView(
        requestId.toString(), "요청하신 주소가 사용 가능하면 인증번호를 보냈습니다. 메일함을 확인한 뒤 이 화면에 입력해 주세요.", 600);
  }

  private void limit(HttpServletRequest request, String email, String operation, int count) {
    service.limit(operation + "-ip", request.getRemoteAddr(), 300);
    service.limit(operation + "-email", AccountInput.key(email), count);
  }
}
