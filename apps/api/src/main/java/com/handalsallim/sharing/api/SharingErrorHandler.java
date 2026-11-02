package com.handalsallim.sharing.api;

import com.handalsallim.sharing.application.SharingFailure;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = SharingController.class)
public class SharingErrorHandler {
  @ExceptionHandler(com.handalsallim.auth.application.AuthFailure.class)
  ResponseEntity<Map<String, String>> throttled(
      com.handalsallim.auth.application.AuthFailure failure) {
    return ResponseEntity.status(failure.status()).body(Map.of("message", failure.getMessage()));
  }

  @ExceptionHandler(SharingFailure.class)
  ResponseEntity<Map<String, String>> failure(SharingFailure failure) {
    return ResponseEntity.status(failure.status()).body(Map.of("message", failure.getMessage()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<Map<String, String>> invalid(IllegalArgumentException failure) {
    return ResponseEntity.badRequest().body(Map.of("message", "회원코드와 요청 내용을 확인해 주세요."));
  }

  @ExceptionHandler({
    org.springframework.web.bind.MethodArgumentNotValidException.class,
    org.springframework.http.converter.HttpMessageNotReadableException.class
  })
  ResponseEntity<Map<String, String>> malformed() {
    return ResponseEntity.badRequest().body(Map.of("message", "요청 내용을 확인해 주세요."));
  }

  @ExceptionHandler(org.springframework.dao.ConcurrencyFailureException.class)
  ResponseEntity<Map<String, String>> concurrent() {
    return ResponseEntity.status(409)
        .body(Map.of("message", "다른 변경이 진행 중입니다. 새로고침한 뒤 다시 시도해 주세요."));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, String>> unexpected() {
    return ResponseEntity.internalServerError()
        .body(Map.of("message", "연결을 처리하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요."));
  }
}
