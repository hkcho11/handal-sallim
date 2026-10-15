import { expect, test } from "@playwright/test";
import { FIXED_COST_FIXTURE, charge } from "../src/test/fixedCostFixture";
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
    await expect(major.getByText("155,000원", { exact: true })).toBeVisible();
    await expect(
      major.getByText("전체 실제 지출 대비 분류별 비중"),
    ).toBeVisible();
    const housingBar = major
      .getByRole("button", { name: /주거/ })
      .locator(":scope > span[aria-hidden='true'] > span");
    expect(
      await housingBar.evaluate(
        (element) =>
          element.getBoundingClientRect().width /
          element.parentElement!.getBoundingClientRect().width,
      ),
    ).toBeCloseTo(0.645, 2);
    await expect(
      page.getByRole("region", { name: "선택 월 지출 요약" }),
    ).toHaveCount(0);
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
    await expect(
      major.getByRole("button", { name: "실제", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await major.getByRole("button", { name: "예상", exact: true }).click();
    await expect(major.getByText("205,000원", { exact: true })).toBeVisible();
    await expect(major.getByText("전체 예정액 대비 분류별 비중")).toBeVisible();
    expect(
      await housingBar.evaluate(
        (element) =>
          element.getBoundingClientRect().width /
          element.parentElement!.getBoundingClientRect().width,
      ),
    ).toBeCloseTo(0.488, 2);
    await major.getByRole("button", { name: "실제", exact: true }).click();
    await expect(major.getByText("155,000원", { exact: true })).toBeVisible();
    await expect(
      trend.getByText("10,000원 (22.2%)", { exact: true }),
    ).toBeVisible();
    await trend.getByLabel("중분류", { exact: true }).selectOption("sub-gas");
    await expect(
      trend.getByRole("button", { name: /2026년 10월, 기록 없음/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await trend
      .getByLabel("중분류", { exact: true })
      .selectOption("sub-electric");
    const september = trend.getByRole("button", {
      name: /2026년 9월, 45,000원/,
    });
    await september.focus();
    await page.keyboard.press("Enter");
    await expect(september).toHaveAttribute("aria-pressed", "true");
    await expect(
      trend.getByText("전기 · 2026년 9월", { exact: true }),
    ).toBeVisible();
    await expect(trend.getByText("45,000원", { exact: true })).toBeVisible();
    await expect(
      trend.getByText("비교 기록 없음", { exact: true }),
    ).toBeVisible();
    await expect(trend.locator("details")).toHaveCount(0);
    const october = trend.getByRole("button", {
      name: /2026년 10월, 55,000원/,
    });
    await october.click();
    await expect(october).toHaveAttribute("aria-pressed", "true");
    await expect(
      trend.getByText("10,000원 (22.2%)", { exact: true }),
    ).toBeVisible();
    await expect(trend.getByText("5.5만", { exact: true })).toBeVisible();
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
    await expect(category.getByText("상세 보는 중")).toHaveCount(0);
    await expect(
      major.getByText("결제일 2026-11-02", { exact: true }),
    ).toBeVisible();
    await expect(
      major.getByRole("link", { name: /전기.*D\+23 · 23일 지연/ }),
    ).toBeVisible();
    await expect(
      major.getByRole("link", { name: /전기.*55,000원/ }),
    ).toBeVisible();
    await major.screenshot({
      path: `test-results/expanded-category-${width}.png`,
    });
    await category.click();
    await expect(
      major.getByRole("link", { name: /전기.*55,000원/ }),
    ).toBeHidden();
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
test("새로고침으로 DB 조회 결과가 바뀌면 차트에 반영한다", async ({ page }) => {
  await page.goto("/");
  const major = page.getByRole("region", { name: "대분류별 지출 통계" });
  await expect(major.getByText("155,000원", { exact: true })).toBeVisible();
  await page.route("**/backend/dashboard/fixed-costs*", (route) =>
    route.fulfill({
      json: { ...FIXED_COST_FIXTURE, charges: [], unscheduled: [] },
    }),
  );
  await page.getByRole("button", { name: "통계 새로고침" }).click();
  await expect(
    page.getByText("이 달에 등록된 고정비 청구가 없어요."),
  ).toBeVisible();
});

test("이번 달은 처음과 월 이동 후 모두 중복 선택할 수 없다", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/backend/dashboard/fixed-costs*", (route) => {
    requests++;
    const month =
      new URL(route.request().url()).searchParams.get("month") ?? "2026-10";
    const end = new Date(`${month}-01T00:00:00Z`);
    return route.fulfill({
      json: {
        ...FIXED_COST_FIXTURE,
        month,
        asOf: "2026-10-15",
        months: Array.from({ length: 6 }, (_, index) => {
          const date = new Date(end);
          date.setUTCMonth(date.getUTCMonth() - 5 + index);
          return date.toISOString().slice(0, 7);
        }),
        charges: [],
        unscheduled: [],
      },
    });
  });
  await page.goto("/");
  const current = page.getByRole("button", { name: "이번 달", exact: true });
  const month = page.getByLabel("조회 월", { exact: true });
  await expect(current).toBeDisabled();
  await page.getByRole("button", { name: "이전 달", exact: true }).click();
  await expect(month).toHaveValue("2026-09");
  await expect(current).toBeEnabled();
  await page.getByRole("button", { name: "다음 달", exact: true }).click();
  await expect(month).toHaveValue("2026-10");
  await expect(current).toBeDisabled();
  expect(requests).toBe(3);
  await page.getByRole("button", { name: "이전 달", exact: true }).click();
  await expect(month).toHaveValue("2026-09");
  await current.click();
  await expect(month).toHaveValue("2026-10");
  await expect(current).toBeDisabled();
  expect(requests).toBe(5);
  await month.fill("2026-12");
  await expect(current).toBeEnabled();
  await month.fill("2026-10");
  await expect(current).toBeDisabled();
});

test("선택 분류의 예정·지연·당일 디데이와 모션 줄이기를 지원한다", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/backend/dashboard/fixed-costs*", (route) =>
    route.fulfill({
      json: {
        ...FIXED_COST_FIXTURE,
        asOf: "2026-10-15",
        charges: [
          charge("future", "2026-10", null, {
            name: "예정 전기",
            dueDate: "2026-10-20",
          }),
          charge("late", "2026-10", null, {
            name: "지연 전기",
            dueDate: "2026-10-12",
            status: "지연",
          }),
          charge("today", "2026-10", null, {
            name: "당일 전기",
            dueDate: "2026-10-15",
          }),
        ],
      },
    }),
  );
  await page.goto("/");
  const major = page.getByRole("region", { name: "대분류별 지출 통계" });
  const category = major.getByRole("button", { name: /공과금/ });
  await category.click();
  await expect(
    major.getByRole("link", { name: /예정 전기.*D-5 · 5일 남음/ }),
  ).toBeVisible();
  await expect(
    major.getByRole("link", { name: /지연 전기.*D\+3 · 3일 지연/ }),
  ).toBeVisible();
  await expect(
    major.getByRole("link", { name: /당일 전기.*D-Day · 오늘 결제/ }),
  ).toBeVisible();
  const detailsId = await category.getAttribute("aria-controls");
  expect(
    parseFloat(
      await page
        .locator(`[id="${detailsId}"]`)
        .evaluate((element) => getComputedStyle(element).transitionDuration),
    ),
  ).toBeLessThanOrEqual(0.001);
  await category.click();
  await expect(major.getByRole("link", { name: /예정 전기/ })).toBeHidden();
});

test("실제·예상 전환 시 각 금액순으로 정렬하고 열린 분류를 유지한다", async ({
  page,
}) => {
  await page.route("**/backend/dashboard/fixed-costs*", (route) =>
    route.fulfill({
      json: {
        ...FIXED_COST_FIXTURE,
        charges: FIXED_COST_FIXTURE.charges.map((item) =>
          item.id === "current" ? { ...item, expectedAmount: 600000 } : item,
        ),
      },
    }),
  );
  await page.goto("/");
  const major = page.getByRole("region", { name: "대분류별 지출 통계" });
  const categories = major.locator("button[aria-expanded] strong");
  await expect(categories).toHaveText(["주거", "공과금", "대분류 미지정"]);
  const utilities = major.getByRole("button", { name: /공과금/ });
  await utilities.click();
  await major.getByRole("button", { name: "예상", exact: true }).click();
  await expect(categories).toHaveText(["공과금", "주거", "대분류 미지정"]);
  await expect(utilities).toHaveAttribute("aria-expanded", "true");
  await major.getByRole("button", { name: "실제", exact: true }).click();
  await expect(categories).toHaveText(["주거", "공과금", "대분류 미지정"]);
  await expect(utilities).toHaveAttribute("aria-expanded", "true");
});

test("전월 대비 증가·감소에 색과 화살표를 적용하고 변동 없음은 중립으로 표시한다", async ({
  page,
}) => {
  await page.route("**/backend/dashboard/fixed-costs*", (route) =>
    route.fulfill({
      json: {
        ...FIXED_COST_FIXTURE,
        charges: [
          charge("june", "2026-06", 20000),
          charge("july", "2026-07", 10000),
          charge("august", "2026-08", 10000),
          charge("september", "2026-09", 20000),
          charge("october", "2026-10", 10000),
        ],
      },
    }),
  );
  await page.goto("/");
  const trend = page.getByRole("region", { name: "중분류별 월별 변화" });
  const decrease = trend.getByText("감소", { exact: true }).locator("..");
  await expect(decrease).toContainText("↓");
  await expect(decrease).toContainText("10,000원 (50.0%)");
  await expect(decrease).toHaveCSS("color", "rgb(49, 91, 235)");
  await trend.getByRole("button", { name: /2026년 9월, 20,000원/ }).click();
  const increase = trend.getByText("증가", { exact: true }).locator("..");
  await expect(increase).toContainText("↑");
  await expect(increase).toContainText("10,000원 (100.0%)");
  await expect(increase).toHaveCSS("color", "rgb(196, 61, 72)");
  await trend.getByRole("button", { name: /2026년 8월, 10,000원/ }).click();
  const unchanged = trend
    .getByText("0원 (0.0%)", { exact: true })
    .locator("..");
  await expect(unchanged).toHaveCSS("color", "rgb(104, 113, 130)");
  await expect(unchanged).not.toContainText("↑");
  await expect(unchanged).not.toContainText("↓");
  await trend.getByRole("button", { name: /2026년 5월, 기록 없음/ }).click();
  await expect(trend.getByText("비교 기록 없음")).toBeVisible();
  await expect(trend.getByText("증가", { exact: true })).toHaveCount(0);
  await expect(trend.getByText("감소", { exact: true })).toHaveCount(0);
});
