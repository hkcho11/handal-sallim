import { expect, test } from "./fixtures";
import { charge, FIXED_COST_FIXTURE } from "../src/test/fixedCostFixture";

for (const width of [360, 1280]) {
  test(`홈의 월·통계 선택·펼친 내역을 유지하고 명시적 목록 이동을 구분한다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const id = (index: number) =>
      `3c6b40a1-3fea-454b-93ac-${String(index).padStart(12, "0")}`;
    await page.route("**/backend/dashboard/fixed-costs*", async (route) => {
      const month =
        new URL(route.request().url()).searchParams.get("month") ?? "2026-10";
      const date = new Date(`${month}-01T00:00:00Z`);
      const months = Array.from({ length: 6 }, (_, index) => {
        const point = new Date(date);
        point.setUTCMonth(point.getUTCMonth() - 5 + index);
        return point.toISOString().slice(0, 7);
      });
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        json: {
          ...FIXED_COST_FIXTURE,
          month,
          months,
          asOf: "2026-10-15",
          charges: Array.from({ length: 30 }, (_, index) =>
            charge(`entry-${index}`, month, 1000, {
              recurringExpenseId: id(index),
              name: `테스트 전기 ${index}`,
            }),
          ),
          unscheduled: [],
        },
      });
    });
    await page.route("**/backend/recurring-expenses", (route) =>
      route.fulfill({
        json: Array.from({ length: 30 }, (_, index) => ({
          id: id(index),
          name: `테스트 전기 ${index}`,
          subcategoryName: "전기",
          categoryName: "공과금",
          expectedAmount: 1000,
          intervalMonths: 1,
          recurringDayOfMonth: 10,
          firstDueDate: "2026-05-10",
          firstChargeId: null,
          firstChargeStatus: null,
          payer: null,
          paymentMethodId: null,
          paymentMethodName: null,
        })),
      }),
    );
    await page.goto("/");
    await page.getByLabel("조회 월", { exact: true }).fill("2026-09");
    const major = page.getByRole("region", { name: "상위 분류별 지출 통계" });
    const category = major.getByRole("button", { name: /공과금/ });
    await category.click();
    const trend = page.getByRole("region", { name: "세부 분류별 월별 변화" });
    await trend
      .getByLabel("세부 분류", { exact: true })
      .selectOption("sub-gas");
    await trend.getByRole("button", { name: /2026년 8월/ }).click();
    const entry = major.locator(`a[href^='/fixed-costs/${id(24)}?charge=']`);
    await entry.scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => window.scrollY);
    expect(position).toBeGreaterThan(1000);
    await entry.click();
    await expect(page).toHaveURL(`/fixed-costs/${id(24)}?charge=entry-24`);
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(category).toHaveAttribute("aria-expanded", "true");
    await expect(
      major.getByRole("button", { name: "예상", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("조회 월", { exact: true })).toHaveValue(
      "2026-09",
    );
    await expect(trend.getByLabel("세부 분류", { exact: true })).toHaveValue(
      "sub-gas",
    );
    await expect(
      trend.getByRole("button", { name: /2026년 8월/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () =>
        Math.abs((await page.evaluate(() => window.scrollY)) - position),
      )
      .toBeLessThan(3);

    await entry.click();
    await page.getByRole("link", { name: "← 고정비 목록" }).click();
    await expect(page).toHaveURL("/fixed-costs");
    await page.goBack();
    await expect(page).toHaveURL(`/fixed-costs/${id(24)}?charge=entry-24`);
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(category).toHaveAttribute("aria-expanded", "true");
  });
}
