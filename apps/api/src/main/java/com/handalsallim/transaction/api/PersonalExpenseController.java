package com.handalsallim.transaction.api;

import com.handalsallim.transaction.application.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.security.Principal;
import java.time.YearMonth;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/personal-expenses")
public class PersonalExpenseController {
  private final PersonalExpenseService service;

  public PersonalExpenseController(PersonalExpenseService service) {
    this.service = service;
  }

  private UUID user(Principal principal, HttpServletResponse response) {
    response.setHeader("Cache-Control", "no-store");
    try {
      if (principal != null && principal.getName() != null)
        return UUID.fromString(principal.getName());
    } catch (IllegalArgumentException ignored) {
    }
    throw new PersonalExpenseException(PersonalExpenseException.Reason.UNAUTHENTICATED);
  }

  @GetMapping
  public PersonalExpenseMonth list(
      Principal principal, HttpServletResponse response, @RequestParam String month) {
    UUID userId = user(principal, response);
    if (!month.matches("[0-9]{4}-[0-9]{2}")) throw new IllegalArgumentException();
    return service.list(userId, YearMonth.parse(month));
  }

  @GetMapping("/options")
  public PersonalExpenseOptions options(Principal principal, HttpServletResponse response) {
    return service.options(user(principal, response));
  }

  @GetMapping("/{id}")
  public PersonalExpenseView get(
      Principal principal, HttpServletResponse response, @PathVariable UUID id) {
    return service.get(user(principal, response), id);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PersonalExpenseView create(
      Principal principal,
      HttpServletResponse response,
      @RequestHeader("Idempotency-Key") String key,
      @Valid @RequestBody PersonalExpenseRequest request) {
    return service.create(
        user(principal, response),
        UUID.fromString(key),
        request.details(),
        Boolean.TRUE.equals(request.privateConfirmed()));
  }

  @PutMapping("/{id}")
  public PersonalExpenseView update(
      Principal principal,
      HttpServletResponse response,
      @PathVariable UUID id,
      @Valid @RequestBody PersonalExpenseRequest request) {
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
