package com.handalsallim.dashboard.api;

import com.handalsallim.dashboard.application.DashboardService.NoDashboardSpaceException;
import com.handalsallim.recurringexpense.api.AuthenticationRequiredException;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice(assignableTypes = DashboardController.class)
public class DashboardErrorHandler {
  @ExceptionHandler(AuthenticationRequiredException.class)
  ResponseEntity<?> unauthorized() {
    return error(401, "로그인이 필요합니다.");
  }

  @ExceptionHandler(NoDashboardSpaceException.class)
  ResponseEntity<?> forbidden() {
    return error(403, "사용할 수 있는 공간이 없습니다.");
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
