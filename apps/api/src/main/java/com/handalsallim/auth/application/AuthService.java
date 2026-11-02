package com.handalsallim.auth.application;

import com.handalsallim.auth.domain.AccountInput;
import com.handalsallim.auth.persistence.AccountRepository;
import com.handalsallim.auth.persistence.AccountRepository.Account;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private final AccountRepository accounts;
  private final PasswordEncoder passwords;
  private final PasswordSafety safety;
  private final EmailCodeService codes;
  private final Clock clock;
  private final String localAdminEmail;
  private final String dummy;

  public AuthService(
      AccountRepository accounts,
      PasswordEncoder passwords,
      PasswordSafety safety,
      EmailCodeService codes,
      Clock clock,
      Environment environment,
      @Value("${app.auth.local-admin-email:}") String localAdminEmail) {
    this.accounts = accounts;
    this.passwords = passwords;
    this.safety = safety;
    this.codes = codes;
    this.clock = clock;
    this.localAdminEmail =
        environment.acceptsProfiles(Profiles.of("local")) && !localAdminEmail.isBlank()
            ? AccountInput.key(localAdminEmail)
            : "";
    this.dummy = passwords.encode(UUID.randomUUID().toString());
  }

  @Transactional
  public UUID register(String email, String name) {
    String address = AccountInput.email(email),
        key = AccountInput.key(email),
        display = AccountInput.name(name);
    var existing = accounts.byEmail(key);
    if (existing.isPresent()) {
      // Generic registration response does not reveal existing accounts.
      if (!existing.get().verified()) {
        // Public signup can never choose a credential for the mailbox owner.
        accounts.renamePending(existing.get().id(), display, clock.instant());
        return codes.issue(existing.get(), false);
      }
      return UUID.randomUUID();
    }
    UUID id = UUID.randomUUID();
    accounts.createPending(id, display, address, key, clock.instant());
    return codes.issue(accounts.byEmail(key).orElseThrow(), false);
  }

  @Transactional
  public Account login(String email, String password) {
    String key;
    try {
      key = AccountInput.key(email);
    } catch (IllegalArgumentException invalid) {
      key = "invalid";
    }
    var account = accounts.byEmail(key);
    boolean matches =
        passwords.matches(
            password == null ? "" : password,
            account.filter(Account::verified).map(Account::hash).orElse(dummy));
    if (!matches || account.isEmpty() || !account.get().verified())
      throw new AuthFailure(401, "이메일 또는 비밀번호를 확인해 주세요. 가입 이메일 확인도 필요합니다.");
    return account.get();
  }

  @Transactional
  public UUID requestLink(String email, boolean reset) {
    var account = accounts.byEmail(AccountInput.key(email));
    if (account.isPresent() && account.get().verified() == reset)
      return codes.issue(account.get(), reset);
    return UUID.randomUUID();
  }

  @Transactional
  public void complete(String token, String password, boolean reset) {
    if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalidLink();
    // All paths acquire credential before action lock, including reissue, to avoid deadlocks.
    var lookup = accounts.action(hash(token), false).orElseThrow(AuthService::invalidLink);
    Account account = accounts.byId(lookup.user()).orElseThrow(AuthService::invalidLink);
    account =
        accounts.byEmail(AccountInput.key(account.email())).orElseThrow(AuthService::invalidLink);
    var action = accounts.action(hash(token)).orElseThrow(AuthService::invalidLink);
    if (action.used()
        || !action.expires().isAfter(clock.instant())
        || !action.purpose().equals(reset ? "PASSWORD_RESET" : "EMAIL_VERIFY")) throw invalidLink();
    if (reset) {
      if (!account.verified()) throw invalidLink();
      safety.validate(password);
      accounts.password(account.id(), passwords.encode(password), clock.instant());
    } else {
      if (account.verified()) throw invalidLink();
      safety.validate(password);
      accounts.completeSignup(account.id(), passwords.encode(password), clock.instant());
    }
    accounts.consume(hash(token), clock.instant());
    if (!reset
        && !localAdminEmail.isBlank()
        && AccountInput.key(account.email()).equals(localAdminEmail))
      accounts.connectLocalAdmin(account.id(), clock.instant());
  }

  public Account current(UUID id, long version) {
    return accounts
        .byId(id)
        .filter(a -> a.verified() && a.version() == version)
        .orElseThrow(() -> new AuthFailure(401, "다시 로그인해 주세요."));
  }

  public boolean hasSpace(UUID id) {
    return accounts.hasSpace(id);
  }

  @Transactional
  public void createSpace(UUID id, String name) {
    accounts.createSpace(id, AccountInput.name(name), clock.instant());
  }

  public void limit(String operation, String value, int maximum) {
    String bucket = operation + ":" + java.util.HexFormat.of().formatHex(hash(value));
    if (!accounts.allow(bucket, maximum, clock.instant()))
      throw new AuthFailure(429, "요청이 많습니다. 15분 후 다시 시도해 주세요.");
  }

  static byte[] hash(String value) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
    } catch (java.security.NoSuchAlgorithmException impossible) {
      throw new IllegalStateException(impossible);
    }
  }

  private static AuthFailure invalidLink() {
    return new AuthFailure(400, "인증이 만료되었거나 이미 사용되었습니다. 새 인증번호를 요청해 주세요.");
  }
}
