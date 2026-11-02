package com.handalsallim.auth.application;

import com.handalsallim.auth.domain.AccountInput;
import com.handalsallim.auth.persistence.AccountRepository;
import com.handalsallim.auth.persistence.EmailCodeRepository;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailCodeService {
  private final AccountRepository accounts;
  private final EmailCodeRepository codes;
  private final PasswordEncoder encoder;
  private final AuthMail mail;
  private final Clock clock;
  private final SecureRandom random = new SecureRandom();

  public EmailCodeService(
      AccountRepository accounts,
      EmailCodeRepository codes,
      PasswordEncoder encoder,
      AuthMail mail,
      Clock clock) {
    this.accounts = accounts;
    this.codes = codes;
    this.encoder = encoder;
    this.mail = mail;
    this.clock = clock;
  }

  @Transactional
  public UUID issue(AccountRepository.Account account, boolean reset) {
    UUID id = UUID.randomUUID();
    String purpose = reset ? "PASSWORD_RESET" : "EMAIL_VERIFY";
    String code = String.format(Locale.ROOT, "%08d", random.nextInt(100_000_000));
    accounts.revoke(account.id(), purpose, clock.instant());
    codes.issue(
        id,
        account.id(),
        purpose,
        encoder.encode(id + ":" + purpose + ":" + code),
        clock.instant());
    try {
      mail.send(account.email(), code, reset);
    } catch (org.springframework.mail.MailException failed) {
      throw new AuthFailure(503, "인증번호 메일을 보내지 못했습니다. 잠시 후 다시 요청해 주세요.");
    }
    return id;
  }

  // Incorrect attempts must commit even though the API returns an error.
  @Transactional(noRollbackFor = IncorrectCode.class)
  public String check(UUID id, String input, boolean reset) {
    var lookup = codes.find(id, false).orElseThrow(EmailCodeService::invalid);
    var owner = accounts.byId(lookup.user()).orElseThrow(EmailCodeService::invalid);
    var account =
        accounts.byEmail(AccountInput.key(owner.email())).orElseThrow(EmailCodeService::invalid);
    var code = codes.find(id, true).orElseThrow(EmailCodeService::invalid);
    String purpose = reset ? "PASSWORD_RESET" : "EMAIL_VERIFY";
    if (code.used()
        || code.failures() >= 5
        || !code.expires().isAfter(clock.instant())
        || !purpose.equals(code.purpose())
        || account.verified() != reset) throw invalid();
    if (input == null
        || !input.matches("[0-9]{8}")
        || !encoder.matches(id + ":" + purpose + ":" + input, code.hash())) {
      codes.fail(id);
      throw invalid();
    }
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    accounts.issue(
        account.id(),
        purpose,
        AuthService.hash(token),
        clock.instant().plusSeconds(600),
        clock.instant());
    codes.consume(id, clock.instant());
    return token;
  }

  private static IncorrectCode invalid() {
    return new IncorrectCode();
  }

  private static final class IncorrectCode extends AuthFailure {
    IncorrectCode() {
      super(400, "인증번호가 올바르지 않거나 만료되었습니다. 5회 틀린 경우 새 번호를 요청해 주세요.");
    }
  }
}
