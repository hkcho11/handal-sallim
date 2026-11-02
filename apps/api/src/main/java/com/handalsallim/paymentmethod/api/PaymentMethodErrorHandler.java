package com.handalsallim.paymentmethod.api;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = PaymentMethodController.class)
public class PaymentMethodErrorHandler {
  @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
  ResponseEntity<Map<String, String>> conflict() {
    return error(HttpStatus.CONFLICT);
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Map<String, String>> status(ResponseStatusException e) {
    return error(e.getStatusCode());
  }

  @ExceptionHandler({
    IllegalArgumentException.class,
    HttpMessageNotReadableException.class,
    MissingRequestHeaderException.class,
    MissingServletRequestParameterException.class,
    MethodArgumentTypeMismatchException.class
  })
  ResponseEntity<Map<String, String>> invalid() {
    return error(HttpStatus.BAD_REQUEST);
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, String>> unexpected() {
    return error(HttpStatus.INTERNAL_SERVER_ERROR);
  }

  private ResponseEntity<Map<String, String>> error(HttpStatusCode status) {
    return ResponseEntity.status(status)
        .header("Cache-Control", "no-store")
        .body(Map.of("message", "요청을 처리하지 못했습니다."));
  }
}
