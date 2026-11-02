package com.handalsallim.paymentmethod.api;

import com.handalsallim.paymentmethod.application.PaymentMethodService;
import com.handalsallim.paymentmethod.application.PaymentMethodView;
import com.handalsallim.paymentmethod.domain.PaymentMethodDetails;
import jakarta.servlet.http.HttpServletResponse;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/payment-methods")
public class PaymentMethodController {
  private final PaymentMethodService service;

  public PaymentMethodController(PaymentMethodService service) {
    this.service = service;
  }

  private UUID user(Principal principal, HttpServletResponse response) {
    response.setHeader("Cache-Control", "no-store");
    if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    try {
      return UUID.fromString(principal.getName());
    } catch (IllegalArgumentException e) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
  }

  public record Request(String name, String type, UUID holderUserId, String color, Long version) {
    PaymentMethodDetails details() {
      return new PaymentMethodDetails(name, type, holderUserId, color);
    }
  }

  @GetMapping
  public List<PaymentMethodView> list(Principal principal, HttpServletResponse response) {
    return service.list(user(principal, response));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PaymentMethodView create(
      Principal principal,
      HttpServletResponse response,
      @RequestHeader("Idempotency-Key") UUID key,
      @RequestBody Request request) {
    return service.create(user(principal, response), key, request.details());
  }

  @GetMapping("/members")
  public List<PaymentMethodService.Member> members(
      Principal principal, HttpServletResponse response) {
    return service.members(user(principal, response));
  }

  @PutMapping("/{id}")
  public PaymentMethodView update(
      Principal principal,
      HttpServletResponse response,
      @PathVariable UUID id,
      @RequestBody Request request) {
    UUID user = user(principal, response);
    if (request.version() == null || request.version() < 0) throw new IllegalArgumentException();
    return service.update(user, id, request.version(), request.details());
  }

  @PostMapping("/{id}/archive")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void archive(
      Principal principal,
      HttpServletResponse response,
      @PathVariable UUID id,
      @RequestParam long version) {
    service.archive(user(principal, response), id, version);
  }
}
