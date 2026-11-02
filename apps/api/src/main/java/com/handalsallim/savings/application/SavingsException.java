package com.handalsallim.savings.application;

public class SavingsException extends RuntimeException {
  public enum Reason {
    UNAUTHENTICATED,
    NO_SPACE,
    NOT_FOUND,
    CONFLICT
  }

  private final Reason reason;

  public SavingsException(Reason reason) {
    this.reason = reason;
  }

  public Reason reason() {
    return reason;
  }
}
