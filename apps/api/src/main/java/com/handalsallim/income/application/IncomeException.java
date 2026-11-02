package com.handalsallim.income.application;

public class IncomeException extends RuntimeException {
  public enum Reason {
    UNAUTHENTICATED,
    NO_SPACE,
    NOT_FOUND,
    CONFLICT
  }

  private final Reason reason;

  public IncomeException(Reason reason) {
    this.reason = reason;
  }

  public Reason reason() {
    return reason;
  }
}
