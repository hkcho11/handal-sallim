package com.handalsallim.dashboard.api;

import com.handalsallim.recurringexpense.api.AuthenticationRequiredException;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice(assignableTypes = DashboardController.class)
public class DashboardErrorHandler {
  @ExceptionHandler(com.handalsallim.recurringexpense.application.ChargeFailure.class)
  ResponseEntity<?> charge(com.handalsallim.recurringexpense.application.ChargeFailure failure) {
    return error(failure.status(), failure.getMessage());
  }

  @ExceptionHandler(org.springframework.dao.ConcurrencyFailureException.class)
  ResponseEntity<?> concurrent() {
    return error(409, "다른 변경이 진행 중입니다. 새로고침한 뒤 다시 시도해 주세요.");
  }

  @ExceptionHandler(AuthenticationRequiredException.class)
  ResponseEntity<?> unauthorized() {
    return error(401, "로그인이 필요합니다.");
  }

  @ExceptionHandler(java.time.DateTimeException.class)
  ResponseEntity<?> invalidDate() {
    return error(400, "조회 월을 확인해 주세요.");
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<?> invalid() {
    return error(400, "조회 월을 확인해 주세요.");
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> unexpected() {
    return error(500, "조회하지 못했습니다. 다시 시도해 주세요.");
  }

  private ResponseEntity<?> error(int status, String message) {
    return ResponseEntity.status(status).body(Map.of("message", message));
  }
}
