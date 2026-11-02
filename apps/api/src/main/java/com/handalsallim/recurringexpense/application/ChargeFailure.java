package com.handalsallim.recurringexpense.application;

public class ChargeFailure extends RuntimeException {
  private final int status;

  public ChargeFailure(int status, String message) {
    super(message);
    this.status = status;
  }

  public int status() {
    return status;
  }
}
