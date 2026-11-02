package com.handalsallim.transaction.application;

public class PersonalExpenseException extends RuntimeException {
  public enum Reason {
    UNAUTHENTICATED,
    NO_SPACE,
    NOT_FOUND,
    CONFLICT
  }

  private final Reason reason;

  public PersonalExpenseException(Reason reason) {
    this.reason = reason;
  }

  public Reason reason() {
    return reason;
  }
}
