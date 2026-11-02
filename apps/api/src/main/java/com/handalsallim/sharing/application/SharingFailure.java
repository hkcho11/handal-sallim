package com.handalsallim.sharing.application;

public class SharingFailure extends RuntimeException {
  private final int status;

  public SharingFailure(int status, String message) {
    super(message);
    this.status = status;
  }

  public int status() {
    return status;
  }
}
