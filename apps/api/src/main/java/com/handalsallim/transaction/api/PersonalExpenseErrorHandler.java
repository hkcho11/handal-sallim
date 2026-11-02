package com.handalsallim.transaction.api;

import com.handalsallim.transaction.application.PersonalExpenseException;
import java.time.DateTimeException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = PersonalExpenseController.class)
public class PersonalExpenseErrorHandler {
  @ExceptionHandler(PersonalExpenseException.class)
  ResponseEntity<Map<String, String>> business(PersonalExpenseException exception) {
    return switch (exception.reason()) {
      case UNAUTHENTICATED -> error(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
      case NO_SPACE -> error(HttpStatus.FORBIDDEN, "사용할 수 있는 공간이 없습니다.");
      case NOT_FOUND -> error(HttpStatus.NOT_FOUND, "지출을 찾을 수 없습니다.");
      case CONFLICT -> error(HttpStatus.CONFLICT, "내역이 변경되었거나 저장 요청이 이전 요청과 다릅니다.");
    };
  }

  @ExceptionHandler({
    IllegalArgumentException.class,
    DateTimeException.class,
    MethodArgumentNotValidException.class,
    HttpMessageNotReadableException.class,
    MissingRequestHeaderException.class,
    MissingServletRequestParameterException.class,
    MethodArgumentTypeMismatchException.class
  })
  ResponseEntity<Map<String, String>> invalid() {
    return error(HttpStatus.BAD_REQUEST, "입력값을 확인해 주세요.");
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, String>> unexpected() {
    return error(HttpStatus.INTERNAL_SERVER_ERROR, "요청을 처리하지 못했습니다.");
  }

  private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
    return ResponseEntity.status(status)
        .header("Cache-Control", "no-store")
        .body(Map.of("message", message));
  }
}
