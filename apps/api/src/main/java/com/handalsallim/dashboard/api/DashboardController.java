package com.handalsallim.dashboard.api;

import com.handalsallim.dashboard.application.DashboardService;
import com.handalsallim.dashboard.application.DashboardView;
import com.handalsallim.dashboard.application.FixedCostDashboardView;
import com.handalsallim.recurringexpense.api.AuthenticationRequiredException;
import jakarta.servlet.http.HttpServletResponse;
import java.security.Principal;
import java.time.YearMonth;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
  private final DashboardService service;

  public DashboardController(DashboardService service) {
    this.service = service;
  }

  @GetMapping
  public DashboardView read(
      Principal principal,
      HttpServletResponse response,
      @RequestParam(required = false) String month) {
    response.setHeader("Cache-Control", "no-store");
    UUID user;
    try {
      user = UUID.fromString(principal.getName());
    } catch (IllegalArgumentException | NullPointerException exception) {
      throw new AuthenticationRequiredException();
    }
    if (month != null && !month.matches("[0-9]{4}-[0-9]{2}")) throw new IllegalArgumentException();
    return service.read(user, month == null ? null : YearMonth.parse(month));
  }

  @GetMapping("/fixed-costs")
  public FixedCostDashboardView fixedCosts(
      Principal principal,
      HttpServletResponse response,
      @RequestParam(required = false) String month) {
    response.setHeader("Cache-Control", "no-store");
    UUID user;
    try {
      user = UUID.fromString(principal.getName());
    } catch (IllegalArgumentException | NullPointerException exception) {
      throw new AuthenticationRequiredException();
    }
    if (month != null && !month.matches("[0-9]{4}-[0-9]{2}")) throw new IllegalArgumentException();
    return service.readFixedCosts(user, month == null ? null : YearMonth.parse(month));
  }
}
