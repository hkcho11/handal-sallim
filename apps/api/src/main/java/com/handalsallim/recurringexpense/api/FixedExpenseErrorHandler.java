package com.handalsallim.recurringexpense.api;

import com.handalsallim.recurringexpense.application.CreationKeyConflictException;
import com.handalsallim.recurringexpense.application.NoActiveSpaceException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = FixedExpenseController.class)
public class FixedExpenseErrorHandler {
  @ExceptionHandler(AuthenticationRequiredException.class)
  ResponseEntity<Map<String, String>> unauthenticated() {
    return error(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", "로그인이 필요합니다.");
  }

  @ExceptionHandler(NoActiveSpaceException.class)
  ResponseEntity<Map<String, String>> noSpace() {
    return error(HttpStatus.FORBIDDEN, "SPACE_UNAVAILABLE", "사용할 수 있는 공간이 없습니다.");
  }

  @ExceptionHandler(CreationKeyConflictException.class)
  ResponseEntity<Map<String, String>> conflict() {
    return error(HttpStatus.CONFLICT, "REQUEST_CONFLICT", "저장 요청이 이전 요청과 다릅니다.");
  }

  @ExceptionHandler({
    IllegalArgumentException.class,
    MethodArgumentNotValidException.class,
    HttpMessageNotReadableException.class,
    MissingRequestHeaderException.class
  })
  ResponseEntity<Map<String, String>> invalidInput() {
    return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "입력값을 확인해 주세요.");
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, String>> unexpectedError() {
    return error(HttpStatus.INTERNAL_SERVER_ERROR, "SERVER_ERROR", "요청을 처리하지 못했습니다. 다시 시도해 주세요.");
  }

  private ResponseEntity<Map<String, String>> error(
      HttpStatus status, String code, String message) {
    return ResponseEntity.status(status).body(Map.of("code", code, "message", message));
  }
}
