import { expect, test } from "@playwright/test";
import { FIXED_COST_FIXTURE } from "../src/test/fixedCostFixture";
test.beforeEach(async ({ page }) => {
  await page.route("**/backend/dashboard/fixed-costs*", (route) =>
    route.fulfill({ json: FIXED_COST_FIXTURE }),
  );
});
for (const width of [360, 1280]) {
  test(`세 통계와 중분류 선택·내역 펼침 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const major = page.getByRole("region", { name: "대분류별 지출 통계" });
    const trend = page.getByRole("region", { name: "중분류별 월별 변화" });
    const payments = page.getByRole("region", { name: "결제수단별 지출" });
    await expect(major.getByText("205,000원", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "이번 달 지출 요약" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "등록한 고정비" }),
    ).toHaveCount(0);
    const order = await page
      .locator("main section[aria-labelledby]")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("aria-labelledby")),
      );
    expect(order).toEqual(["major-title", "trend-title", "payments-title"]);
    await major.getByRole("button", { name: "실제", exact: true }).click();
    await expect(major.getByText("155,000원", { exact: true })).toBeVisible();
    await expect(
      trend.getByText("+10,000원 (+22.2%)", { exact: true }),
    ).toBeVisible();
    await trend.getByLabel("중분류", { exact: true }).selectOption("sub-gas");
    await expect(trend.getByRole("img")).toHaveAttribute(
      "aria-label",
      /가스.*기록 없음/,
    );
    await trend
      .getByLabel("중분류", { exact: true })
      .selectOption("sub-electric");
    await trend.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(trend.getByText("2026.09", { exact: true })).toBeVisible();
    await expect(trend.getByText("45,000원", { exact: true })).toBeVisible();
    await expect(
      payments.getByText("실제 계좌", { exact: true }),
    ).toBeVisible();
    await expect(
      payments.getByText("155,000원", { exact: true }),
    ).toBeVisible();
    await expect(payments.getByText("15,000원", { exact: true })).toBeVisible();
    await expect(payments.getByText("未指定")).toHaveCount(0);
    await expect(payments.getByText("미지정", { exact: true })).toBeVisible();
    const category = major.getByRole("button", { name: /공과금/ });
    await category.click();
    await expect(category).toHaveAttribute("aria-expanded", "true");
    await expect(
      major.getByRole("link", { name: /전기.*55,000원/ }),
    ).toBeVisible();
    await category.click();
    await page.screenshot({
      path: `test-results/fixed-statistics-${width}.png`,
      fullPage: true,
    });
    const nav = page.getByRole("navigation", { name: "하단 메뉴" });
    await expect(
      nav.getByRole("link", { name: "홈", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    const unscheduled = page.getByRole("region", { name: "일정 미정 고정비" });
    await unscheduled.scrollIntoViewIfNeeded();
    const last = await unscheduled.boundingBox();
    const menu = await nav.boundingBox();
    expect(last!.y + last!.height).toBeLessThanOrEqual(menu!.y);
  });
}
test("조회 월 변경과 실패 후 재시도·빈 기록을 지원한다", async ({ page }) => {
  let fail = false;
  await page.route("**/backend/dashboard/fixed-costs*", (route) => {
    if (fail) return route.fulfill({ status: 503 });
    const month =
      new URL(route.request().url()).searchParams.get("month") ??
      FIXED_COST_FIXTURE.month;
    const end = new Date(`${month}-01T00:00:00Z`);
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(end);
      date.setUTCMonth(date.getUTCMonth() - 5 + index);
      return date.toISOString().slice(0, 7);
    });
    return route.fulfill({
      json: {
        ...FIXED_COST_FIXTURE,
        month,
        months,
        charges: [],
        unscheduled: [],
      },
    });
  });
  await page.goto("/");
  await expect(page.getByLabel("조회 월", { exact: true })).toHaveValue(
    "2026-10",
  );
  await expect(
    page.getByText("이 달에 등록된 고정비 청구가 없어요."),
  ).toBeVisible();
  await page.getByRole("button", { name: "이전 달", exact: true }).click();
  await expect(page.getByLabel("조회 월", { exact: true })).toHaveValue(
    "2026-09",
  );
  fail = true;
  await page.getByRole("button", { name: "다음 달", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(page.getByLabel("조회 월", { exact: true })).toHaveValue(
    "2026-10",
  );
});
