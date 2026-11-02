package com.handalsallim.recurringexpense.api;

import com.handalsallim.recurringexpense.application.FixedExpenseFormOptions;
import com.handalsallim.recurringexpense.application.FixedExpenseService;
import com.handalsallim.recurringexpense.application.FixedExpenseView;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    return service.create(userId(principal), key, request.details());
  }

  public record CategoryRequest(@NotBlank @Size(max = 80) String name) {}

  @PostMapping("/categories")
  public FixedExpenseFormOptions.CategoryOption addCategory(
      Principal principal,
      HttpServletResponse response,
      @Valid @RequestBody CategoryRequest request) {
    response.setHeader("Cache-Control", "no-store");
    return service.addCategory(userId(principal), request.name());
  }

  public record SubcategoryRequest(
      @jakarta.validation.constraints.NotNull UUID categoryId,
      @NotBlank @Size(max = 80) String name) {}

  public record RenameCategoryRequest(
      @NotBlank @Size(max = 80) String name, @NotBlank @Size(max = 80) String expectedName) {}

  public record MoveSubcategoryRequest(
      @jakarta.validation.constraints.NotNull UUID expectedCategoryId,
      @jakarta.validation.constraints.NotNull UUID categoryId,
      UUID beforeId) {}

  public record UpdateSubcategoryRequest(
      @NotBlank @Size(max = 80) String name,
      @NotBlank @Size(max = 80) String expectedName,
      @jakarta.validation.constraints.NotNull UUID categoryId,
      @jakarta.validation.constraints.NotNull UUID expectedCategoryId) {}

  @org.springframework.web.bind.annotation.PatchMapping("/subcategories/{subcategoryId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void updateSubcategory(
      Principal principal,
      @PathVariable UUID subcategoryId,
      @Valid @RequestBody UpdateSubcategoryRequest input) {
    service.updateSubcategory(
        userId(principal),
        subcategoryId,
        input.name(),
        input.expectedName(),
        input.categoryId(),
        input.expectedCategoryId());
  }

  @org.springframework.web.bind.annotation.PatchMapping("/subcategories/{subcategoryId}/parent")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void moveSubcategory(
      Principal principal,
      @PathVariable UUID subcategoryId,
      @Valid @RequestBody MoveSubcategoryRequest input) {
    service.moveSubcategory(
        userId(principal),
        subcategoryId,
        input.expectedCategoryId(),
        input.categoryId(),
        input.beforeId());
  }

  public record ClassificationOrderRequest(
      @jakarta.validation.constraints.NotNull @Size(max = 1000)
          List<@jakarta.validation.constraints.NotNull UUID> ids,
      @jakarta.validation.constraints.NotNull @Size(max = 1000)
          List<@jakarta.validation.constraints.NotNull UUID> previousIds) {}

  @org.springframework.web.bind.annotation.PatchMapping("/categories/{categoryId}")
  public FixedExpenseFormOptions.CategoryOption renameCategory(
      Principal principal,
      @PathVariable UUID categoryId,
      @Valid @RequestBody RenameCategoryRequest input) {
    return service.renameCategory(
        userId(principal), categoryId, input.name(), input.expectedName());
  }

  @org.springframework.web.bind.annotation.PutMapping("/categories/order")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void categoryOrder(
      Principal principal, @Valid @RequestBody ClassificationOrderRequest input) {
    service.reorderClassifications(userId(principal), null, input.ids(), input.previousIds());
  }

  @org.springframework.web.bind.annotation.PutMapping(
      "/categories/{categoryId}/subcategories/order")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void subcategoryOrder(
      Principal principal,
      @PathVariable UUID categoryId,
      @Valid @RequestBody ClassificationOrderRequest input) {
    service.reorderClassifications(userId(principal), categoryId, input.ids(), input.previousIds());
  }

  @PostMapping("/subcategories")
  public FixedExpenseFormOptions.SubcategoryOption addSubcategory(
      Principal principal,
      HttpServletResponse response,
      @Valid @RequestBody SubcategoryRequest request) {
    response.setHeader("Cache-Control", "no-store");
    return service.addSubcategory(userId(principal), request.categoryId(), request.name());
  }

  @GetMapping("/options")
  public FixedExpenseFormOptions options(Principal principal, HttpServletResponse response) {
    response.setHeader("Cache-Control", "no-store");
    return service.formOptions(userId(principal));
  }

  @PatchMapping("/{expenseId}/schedule")
  public FixedExpenseView completeSchedule(
      Principal principal,
      @PathVariable UUID expenseId,
      @Valid @RequestBody CompleteScheduleRequest request) {
    return service.completeSchedule(
        userId(principal),
        expenseId,
        request.supportedInterval(),
        request.supportedRecurringDay(),
        request.firstDueDate());
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

  @DeleteMapping("/{expenseId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(
      Principal principal, HttpServletResponse response, @PathVariable UUID expenseId) {
    response.setHeader("Cache-Control", "no-store");
    service.delete(userId(principal), expenseId);
  }

  @PatchMapping("/{expenseId}/details")
  public FixedExpenseView updateDetails(
      Principal principal,
      HttpServletResponse response,
      @PathVariable UUID expenseId,
      @Valid @RequestBody CreateFixedExpenseRequest request) {
    response.setHeader("Cache-Control", "no-store");
    return service.updateDetails(userId(principal), expenseId, request.details());
  }
}
