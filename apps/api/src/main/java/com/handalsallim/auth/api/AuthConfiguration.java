package com.handalsallim.auth.api;

import com.handalsallim.auth.application.AuthFailure;
import com.handalsallim.auth.application.AuthService;
import com.handalsallim.auth.persistence.AccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.context.NullSecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.session.web.http.DefaultCookieSerializer;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
@EnableScheduling
public class AuthConfiguration {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new org.springframework.security.crypto.password.DelegatingPasswordEncoder(
        "pbkdf2@SpringSecurity_v5_8",
        java.util.Map.of(
            "pbkdf2@SpringSecurity_v5_8", Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8()));
  }

  @Bean
  org.springframework.security.core.userdetails.UserDetailsService noDefaultUsers() {
    return username -> {
      throw new org.springframework.security.core.userdetails.UsernameNotFoundException(
          "이메일 로그인만 지원합니다.");
    };
  }

  @Bean
  DefaultCookieSerializer sessionCookie(@Value("${app.auth.secure-cookies:true}") boolean secure) {
    var cookie = new DefaultCookieSerializer();
    cookie.setCookieName("HS_SESSION");
    cookie.setCookiePath("/");
    cookie.setUseHttpOnlyCookie(true);
    cookie.setUseSecureCookie(secure);
    cookie.setSameSite("Lax");
    cookie.setCookieMaxAge(30 * 86400);
    return cookie;
  }

  @Bean
  SecurityFilterChain security(
      HttpSecurity http,
      AuthService service,
      Clock clock,
      @Value("${app.auth.secure-cookies:true}") boolean secure)
      throws Exception {
    var csrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
    csrf.setCookiePath("/");
    csrf.setCookieCustomizer(cookie -> cookie.secure(secure).sameSite("Lax"));
    http.securityContext(
            context -> context.securityContextRepository(new NullSecurityContextRepository()))
        .csrf(
            config ->
                config
                    .csrfTokenRepository(csrf)
                    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
        .requestCache(cache -> cache.disable())
        .formLogin(form -> form.disable())
        .httpBasic(basic -> basic.disable())
        .logout(logout -> logout.disable())
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(
                        "/api/auth/csrf",
                        "/api/auth/register",
                        "/api/auth/login",
                        "/api/auth/verify",
                        "/api/auth/verify-code",
                        "/api/auth/resend",
                        "/api/auth/forgot",
                        "/api/auth/reset",
                        "/api/auth/health")
                    .permitAll()
                    .requestMatchers("/api/personal-expenses", "/api/personal-expenses/**")
                    .denyAll()
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            errors ->
                errors
                    .authenticationEntryPoint(
                        (request, response, error) -> error(response, 401, "로그인이 필요합니다."))
                    .accessDeniedHandler(
                        (request, response, error) ->
                            error(response, 403, "요청을 확인해 주세요. 화면을 새로고침한 뒤 다시 시도해 주세요.")))
        .addFilterBefore(
            new OncePerRequestFilter() {
              @Override
              protected void doFilterInternal(
                  HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                  throws ServletException, IOException {
                response.setHeader("Cache-Control", "no-store");
                var session = request.getSession(false);
                if (session != null && session.getAttribute("accountId") instanceof String id) {
                  try {
                    if (!(session.getAttribute("signedInAt") instanceof Long time)
                        || !(session.getAttribute("accountVersion") instanceof Long)
                        || clock.millis() - time >= Duration.ofDays(30).toMillis())
                      throw new AuthFailure(401, "다시 로그인해 주세요.");
                    var account =
                        service.current(
                            UUID.fromString(id), (Long) session.getAttribute("accountVersion"));
                    SecurityContextHolder.getContext()
                        .setAuthentication(
                            new UsernamePasswordAuthenticationToken(
                                account.id().toString(), null, List.of()));
                  } catch (AuthFailure | IllegalArgumentException invalid) {
                    session.invalidate();
                    SecurityContextHolder.clearContext();
                  }
                }
                chain.doFilter(request, response);
              }
            },
            AnonymousAuthenticationFilter.class);
    return http.build();
  }

  private static void error(HttpServletResponse response, int status, String message)
      throws IOException {
    response.setStatus(status);
    response.setContentType("application/json;charset=UTF-8");
    response.getWriter().write("{\"message\":\"" + message + "\"}");
  }

  @Bean
  TokenCleanup tokenCleanup(AccountRepository accounts, Clock clock) {
    return new TokenCleanup(accounts, clock);
  }

  public record TokenCleanup(AccountRepository accounts, Clock clock) {
    @Scheduled(fixedDelay = 3600000)
    public void cleanup() {
      accounts.cleanup(clock.instant());
    }
  }
}
