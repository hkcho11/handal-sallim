package com.handalsallim.recurringexpense.api;

import com.handalsallim.recurringexpense.application.ChargeView;
import com.handalsallim.recurringexpense.application.ScheduledChargeService;
import com.handalsallim.recurringexpense.domain.PaymentCompletion;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.security.Principal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ScheduledChargeController {
  private final ScheduledChargeService service;

  public ScheduledChargeController(ScheduledChargeService service) {
    this.service = service;
  }

  public record Completion(
      @NotNull @Positive @jakarta.validation.constraints.Digits(integer = 16, fraction = 0)
          java.math.BigDecimal amount,
      @NotNull LocalDate paidOn,
      @NotNull UUID paymentMethodId,
      @NotNull @PositiveOrZero Long version) {}

  @GetMapping("/recurring-expenses/{expense}/charges")
  public List<ChargeView> list(Principal user, @PathVariable UUID expense) {
    return service.list(UUID.fromString(user.getName()), expense);
  }

  @PostMapping("/scheduled-charges/{id}/complete")
  public ChargeView complete(
      Principal user, @PathVariable UUID id, @Valid @RequestBody Completion input) {
    return service.complete(
        UUID.fromString(user.getName()),
        id,
        new PaymentCompletion(
            input.amount().longValueExact(),
            input.paidOn(),
            input.paymentMethodId(),
            input.version()));
  }
}
