package com.handalsallim.auth.api;

import com.handalsallim.auth.application.AuthFailure;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthErrorHandler {
  @ExceptionHandler(AuthFailure.class)
  ResponseEntity<Map<String, String>> failure(AuthFailure error) {
    return ResponseEntity.status(error.status()).body(Map.of("message", error.getMessage()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<Map<String, String>> invalid(IllegalArgumentException error) {
    return ResponseEntity.badRequest().body(Map.of("message", error.getMessage()));
  }

  @ExceptionHandler({
    org.springframework.web.bind.MethodArgumentNotValidException.class,
    org.springframework.http.converter.HttpMessageNotReadableException.class
  })
  ResponseEntity<Map<String, String>> malformed() {
    return ResponseEntity.badRequest().body(Map.of("message", "입력값을 확인해 주세요."));
  }

  @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
  ResponseEntity<Map<String, String>> conflict() {
    return ResponseEntity.ok(Map.of("message", "요청을 처리했습니다. 메일함을 확인하거나 다시 로그인해 주세요."));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, String>> unexpected() {
    return ResponseEntity.internalServerError()
        .body(Map.of("message", "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."));
  }
}
