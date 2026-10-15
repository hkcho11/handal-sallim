package com.handalsallim.recurringexpense.api;

import com.handalsallim.recurringexpense.application.FixedExpenseService;
import com.handalsallim.recurringexpense.application.FixedExpenseView;
import com.handalsallim.recurringexpense.domain.FixedExpenseDetails;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recurring-expenses")
public class FixedExpenseController {
  private final FixedExpenseService service;

  public FixedExpenseController(FixedExpenseService service) {
    this.service = service;
  }

  @GetMapping
  public List<FixedExpenseView> list(Principal principal, HttpServletResponse response) {
    response.setHeader("Cache-Control", "no-store");
    return service.list(userId(principal));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public FixedExpenseView create(
      Principal principal,
      HttpServletResponse response,
      @RequestHeader("Idempotency-Key") String creationKey,
      @Valid @RequestBody CreateFixedExpenseRequest request) {
    response.setHeader("Cache-Control", "no-store");
    UUID key;
    try {
      key = UUID.fromString(creationKey);
    } catch (IllegalArgumentException invalid) {
      throw new IllegalArgumentException("저장 요청 키가 올바르지 않습니다.");
    }
    return service.create(
        userId(principal),
        key,
        new FixedExpenseDetails(
            request.name(),
            request.wholeWon(),
            request.supportedInterval(),
            request.firstDueDate()));
  }

  private UUID userId(Principal principal) {
    if (principal == null || principal.getName() == null) {
      throw new AuthenticationRequiredException();
    }
    try {
      return UUID.fromString(principal.getName());
    } catch (IllegalArgumentException invalid) {
      throw new AuthenticationRequiredException();
    }
  }
}
