package com.handalsallim.sharing.api;

import com.handalsallim.sharing.application.SharingService;
import com.handalsallim.sharing.application.SharingView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sharing")
public class SharingController {
  private final SharingService service;
  private final com.handalsallim.auth.application.AuthService auth;

  public SharingController(
      SharingService service, com.handalsallim.auth.application.AuthService auth) {
    this.service = service;
    this.auth = auth;
  }

  public record Code(@NotBlank @Size(max = 20) String memberCode) {}

  public record Decision(@NotBlank @Pattern(regexp = "ACCEPT|REJECT|CANCEL") String action) {}

  @GetMapping
  public SharingView view(Principal user) {
    return service.view(UUID.fromString(user.getName()));
  }

  @PostMapping("/lookup")
  public SharingView.Member lookup(Principal user, @Valid @RequestBody Code code) {
    auth.limit("sharing-lookup", user.getName(), 30);
    return service.lookup(UUID.fromString(user.getName()), code.memberCode());
  }

  @PostMapping("/requests")
  public SharingView request(Principal user, @Valid @RequestBody Code code) {
    auth.limit("sharing-send", user.getName(), 10);
    return service.send(UUID.fromString(user.getName()), code.memberCode());
  }

  @PostMapping("/requests/{id}")
  public SharingView decide(
      Principal user, @PathVariable UUID id, @Valid @RequestBody Decision decision) {
    return service.decide(UUID.fromString(user.getName()), id, decision.action());
  }

  @PostMapping("/member-code")
  public SharingView rotate(Principal user) {
    auth.limit("sharing-code", user.getName(), 5);
    return service.rotate(UUID.fromString(user.getName()));
  }

  @GetMapping("/archives")
  public List<SharingView.Archive> archives(Principal user) {
    return service.archives(UUID.fromString(user.getName()));
  }

  @PostMapping("/connections/{space}/disconnect-requests")
  public SharingView requestDisconnect(Principal user, @PathVariable UUID space) {
    auth.limit("sharing-disconnect", user.getName(), 10);
    return service.requestDisconnect(UUID.fromString(user.getName()), space);
  }

  @PostMapping("/disconnect-requests/{id}")
  public SharingView decideDisconnect(
      Principal user, @PathVariable UUID id, @Valid @RequestBody Decision decision) {
    return service.decideDisconnect(UUID.fromString(user.getName()), id, decision.action());
  }
}
