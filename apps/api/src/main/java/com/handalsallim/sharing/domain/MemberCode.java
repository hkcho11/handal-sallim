package com.handalsallim.sharing.domain;

import java.security.SecureRandom;
import java.util.Locale;

public final class MemberCode {
  private static final String ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  private static final SecureRandom RANDOM = new SecureRandom();

  private MemberCode() {}

  public static String generate() {
    var value = new StringBuilder();
    for (int i = 0; i < 8; i++) value.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
    return value.toString();
  }

  public static String normalize(String value) {
    if (value == null) throw new IllegalArgumentException("회원코드를 입력해 주세요.");
    String result = value.strip().replace("-", "").replace(" ", "").toUpperCase(Locale.ROOT);
    if (!result.matches("[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}"))
      throw new IllegalArgumentException("8자리 회원코드를 확인해 주세요.");
    return result;
  }

  public static String display(String value) {
    return value.substring(0, 4) + "-" + value.substring(4);
  }
}
