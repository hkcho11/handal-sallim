package com.handalsallim.savings.api;

import com.handalsallim.savings.application.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/savings")
public class SavingsController {
  private final SavingsService service;

  public SavingsController(SavingsService service) {
    this.service = service;
  }

  private UUID user(Principal principal, HttpServletResponse response) {
    response.setHeader("Cache-Control", "no-store");
    try {
      if (principal != null && principal.getName() != null)
        return UUID.fromString(principal.getName());
    } catch (IllegalArgumentException ignored) {
    }
    throw new SavingsException(SavingsException.Reason.UNAUTHENTICATED);
  }

  @GetMapping
  public SavingsOverview list(Principal principal, HttpServletResponse response) {
    UUID userId = user(principal, response);
    return service.list(userId);
  }

  @GetMapping("/members")
  public com.handalsallim.shared.ownership.OwnerOptions members(
      Principal principal, HttpServletResponse response) {
    return service.members(user(principal, response));
  }

  @GetMapping("/{id}")
  public SavingsView get(Principal principal, HttpServletResponse response, @PathVariable UUID id) {
    return service.get(user(principal, response), id);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public SavingsView create(
      Principal principal,
      HttpServletResponse response,
      @RequestHeader("Idempotency-Key") String key,
      @Valid @RequestBody SavingsRequest request) {
    return service.create(user(principal, response), UUID.fromString(key), request.details());
  }

  @PutMapping("/{id}")
  public SavingsView update(
      Principal principal,
      HttpServletResponse response,
      @PathVariable UUID id,
      @Valid @RequestBody SavingsRequest request) {
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
