package com.handalsallim.income.api;

import com.handalsallim.income.application.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/incomes")
public class IncomeController {
  private final IncomeService service;

  public IncomeController(IncomeService service) {
    this.service = service;
  }

  private UUID user(Principal principal, HttpServletResponse response) {
    response.setHeader("Cache-Control", "no-store");
    try {
      if (principal != null && principal.getName() != null)
        return UUID.fromString(principal.getName());
    } catch (IllegalArgumentException ignored) {
    }
    throw new IncomeException(IncomeException.Reason.UNAUTHENTICATED);
  }

  @GetMapping
  public IncomeMonth list(
      Principal principal, HttpServletResponse response, @RequestParam String month) {
    UUID userId = user(principal, response);
    return service.list(userId, IncomeRequest.parseMonth(month));
  }

  @GetMapping("/members")
  public com.handalsallim.shared.ownership.OwnerOptions members(
      Principal principal, HttpServletResponse response) {
    return service.members(user(principal, response));
  }

  @GetMapping("/{id}")
  public IncomeView get(Principal principal, HttpServletResponse response, @PathVariable UUID id) {
    return service.get(user(principal, response), id);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public IncomeView create(
      Principal principal,
      HttpServletResponse response,
      @RequestHeader("Idempotency-Key") String key,
      @Valid @RequestBody IncomeRequest request) {
    return service.create(user(principal, response), UUID.fromString(key), request.details());
  }

  @PutMapping("/{id}")
  public IncomeView update(
      Principal principal,
      HttpServletResponse response,
      @PathVariable UUID id,
      @Valid @RequestBody IncomeRequest request) {
    return service.update(user(principal, response), id, request.revision(), request.details());
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(
      Principal principal,
      HttpServletResponse response,
      @PathVariable UUID id,
      @RequestParam long version) {
    if (version < 0) throw new IllegalArgumentException();
    service.delete(user(principal, response), id, version);
  }
}
