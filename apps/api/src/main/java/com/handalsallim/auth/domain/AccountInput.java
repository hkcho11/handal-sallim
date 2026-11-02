package com.handalsallim.auth.domain;

import java.util.Locale;

public final class AccountInput {
  private AccountInput() {}

  public static String email(String value) {
    if (value == null) throw new IllegalArgumentException("이메일을 확인해 주세요.");
    String email = value.strip();
    if (email.length() > 254
        || !email.matches(
            "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+"))
      throw new IllegalArgumentException("영문 이메일 주소를 입력해 주세요.");
    if (email.substring(0, email.indexOf('@')).length() > 64)
      throw new IllegalArgumentException("이메일을 확인해 주세요.");
    return email;
  }

  public static String key(String email) {
    return email(email).toLowerCase(Locale.ROOT);
  }

  public static String name(String name) {
    if (name == null || name.isBlank() || name.strip().length() > 100)
      throw new IllegalArgumentException("표시 이름은 1~100자로 입력해 주세요.");
    return name.strip();
  }

  public static void password(String value) {
    if (value == null
        || value.codePointCount(0, value.length()) < 8
        || value.length() > 128
        || !value.codePoints().anyMatch(Character::isLetter)
        || !value.codePoints().anyMatch(Character::isDigit))
      throw new IllegalArgumentException("비밀번호는 문자와 숫자를 포함해 8~128자로 입력해 주세요.");
  }
}
