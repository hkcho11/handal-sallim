import { expect, test } from "@playwright/test";

test("시작 화면을 연다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "한달살림" })).toBeVisible();
});
