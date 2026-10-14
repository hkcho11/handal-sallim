import { expect, test } from "@playwright/test";

for (const width of [360, 1280]) {
  test(`고정비 등록 흐름을 ${width}px 화면에서 사용할 수 있다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/backend/recurring-expenses", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: [] });
        return;
      }
      await route.fulfill({
        status: 201,
        json: {
          id: "3c6b40a1-3fea-454b-93ac-a7a9917cff10",
          name: "월세",
          expectedAmount: 650000,
          intervalMonths: 1,
          firstDueDate: "2026-10-15",
          firstChargeId: "4bdcc856-5663-4052-9a82-f38886058c57",
          firstChargeStatus: "PENDING",
        },
      });
    });
    await page.goto("/entries/new");
    await expect(
      page.getByRole("heading", { name: "내역 추가" }),
    ).toBeVisible();
    await expect(page.getByText("등록한 고정비가 없습니다.")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "한달살림" })).toBeFocused();
    await page.getByLabel("비용명").fill("월세");
    await page.getByLabel("최초 예상 금액 (원)").fill("650000");
    await page.getByLabel("반복 주기").selectOption("1");
    await page.getByLabel("첫 예정일").fill("2026-10-15");
    await page.getByRole("button", { name: "고정비 저장" }).click();
    await expect(page.getByText("650,000원")).toBeVisible();
    await expect(page.getByText("첫 예정 2026-10-15")).toBeVisible();
    if (width === 360) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
    }
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(horizontalOverflow).toBe(false);
  });
}
