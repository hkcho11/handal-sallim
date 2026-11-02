import { expect, test } from "./fixtures";
import { FIXED_COST_FIXTURE, charge } from "../src/test/fixedCostFixture";
import { SERVICE_UNAVAILABLE_MESSAGE } from "../src/shared/api/serviceAvailability";
test.beforeEach(async ({ page }) => {
  await page.route("**/backend/dashboard/fixed-costs*", (route) =>
    route.fulfill({ json: FIXED_COST_FIXTURE }),
  );
});
test("서버 연결이 끊기면 안내하고 재시도로 통계를 복구한다", async ({
  page,
}) => {
  let unavailable = true;
  await page.route("**/backend/dashboard/fixed-costs*", (route) =>
    unavailable
      ? route.fulfill({
          status: 503,
          json: { message: SERVICE_UNAVAILABLE_MESSAGE },
        })
      : route.fulfill({ json: FIXED_COST_FIXTURE }),
  );
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    SERVICE_UNAVAILABLE_MESSAGE,
  );
  unavailable = false;
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(
    page.getByRole("region", { name: "상위 분류별 지출 통계" }),
  ).toBeVisible();
});
for (const width of [360, 1280]) {
  test(`세 통계와 세부 분류 선택·내역 펼침 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const major = page.getByRole("region", { name: "상위 분류별 지출 통계" });
    const trend = page.getByRole("region", { name: "세부 분류별 월별 변화" });
    const payments = page.getByRole("region", { name: "결제수단별 지출" });
    await expect(major.getByText("155,000원", { exact: true })).toBeVisible();
    await expect(
      major.getByText("전체 실제 지출 대비 분류별 비중"),
    ).toHaveCount(0);
    await expect(major.getByText("총 결제액", { exact: true })).toBeVisible();
    await expect(major.getByRole("heading")).toHaveCount(0);
    const categoryAmount = major.getByRole("button", { name: /공과금/ });
    const comparison = categoryAmount.locator("small");
    const changeAmount = comparison.locator("b");
    await expect(changeAmount).toHaveCSS(
      "font-size",
      await comparison.evaluate(
        (element) => getComputedStyle(element).fontSize,
      ),
    );
    await expect(changeAmount).toHaveCSS(
      "font-weight",
      await comparison.evaluate(
        (element) => getComputedStyle(element).fontWeight,
      ),
    );
    await expect(comparison).toHaveCSS("align-items", "center");
    await expect(comparison).toHaveCSS("justify-content", "flex-end");
    await expect(categoryAmount.locator(":scope > span > span")).toHaveCSS(
      "align-items",
      "flex-end",
    );
    await expect(categoryAmount.locator(":scope > span").first()).toHaveCSS(
      "align-items",
      "center",
    );
    await expect(major.getByText(/^(완료|미결제) \d+건/)).toHaveCount(0);
    const legend = major.getByRole("list", { name: "분류별 지출 비중" });
    await expect(legend.getByRole("listitem")).toHaveText([
      "주거 64.5%",
      "공과금 35.5%",
    ]);
    const housingBar = major
      .locator('[aria-hidden="true"]')
      .filter({ has: page.locator('span[style*="width"]') })
      .locator("> span")
      .first();
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
      .locator(
        'main section[aria-labelledby], main section[aria-label="상위 분류별 지출 통계"]',
      )
      .evaluateAll((items) =>
        items.map(
          (item) =>
            item.getAttribute("aria-labelledby") ??
            item.getAttribute("aria-label"),
        ),
      );
    expect(order).toEqual([
      "상위 분류별 지출 통계",
      "trend-title",
      "payments-title",
    ]);
    await expect(
      major.getByRole("button", { name: "예상", exact: true }),
    ).toHaveCount(0);
    await expect(major.getByText("205,000원", { exact: true })).toHaveCount(0);
    await expect(
      trend.getByText("10,000원 (22.2%)", { exact: true }),
    ).toBeVisible();
    await trend
      .getByLabel("세부 분류", { exact: true })
      .selectOption("sub-gas");
    await expect(
      trend.getByRole("button", { name: /2026년 10월, 기록 없음/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await trend
      .getByLabel("세부 분류", { exact: true })
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
    await expect(payments.getByText("15,000원", { exact: true })).toHaveCount(
      0,
    );
    await expect(payments.getByText("未指定")).toHaveCount(0);
    await expect(payments.getByText("미지정", { exact: true })).toHaveCount(0);
    const category = major.getByRole("button", { name: /공과금/ });
    await category.click();
    await expect(category).toHaveAttribute("aria-expanded", "true");
    await expect(category.getByText("상세 보는 중")).toHaveCount(0);
    await expect(
      major.getByText("결제일 2026-11-02", { exact: true }),
    ).toBeVisible();
    await expect(major.getByRole("list", { name: "미결제 회차" })).toHaveCount(
      0,
    );
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
    page.getByText("이 달에 결제 완료한 내역이 없어요."),
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
  const major = page.getByRole("region", { name: "상위 분류별 지출 통계" });
  await expect(major.getByText("155,000원", { exact: true })).toBeVisible();
  await page.route("**/backend/dashboard/fixed-costs*", (route) =>
    route.fulfill({
      json: { ...FIXED_COST_FIXTURE, charges: [], unscheduled: [] },
    }),
  );
  await page.getByRole("button", { name: "통계 새로고침" }).click();
  await expect(
    page.getByText("이 달에 결제 완료한 내역이 없어요."),
  ).toBeVisible();
});

test("이번 달은 처음과 월 이동 후 모두 중복 선택할 수 없다", async ({
  page,
}) => {
  await page.route("**/backend/dashboard/fixed-costs*", (route) => {
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
  await page.getByRole("button", { name: "이전 달", exact: true }).click();
  await expect(month).toHaveValue("2026-09");
  await current.click();
  await expect(month).toHaveValue("2026-10");
  await expect(current).toBeDisabled();
  await month.fill("2026-12");
  await expect(current).toBeEnabled();
  await month.fill("2026-10");
  await expect(current).toBeDisabled();
});

test("미결제만 있는 달에는 내역 목록 없이 빈 통계를 표시한다", async ({
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
  const major = page.getByRole("region", { name: "상위 분류별 지출 통계" });
  await expect(major.getByRole("link")).toHaveCount(0);
  await expect(major.getByRole("list", { name: "미결제 회차" })).toHaveCount(0);
  await expect(
    major.getByText("이 달에 결제 완료한 내역이 없어요."),
  ).toBeVisible();
});

test("등록 금액을 바꿔도 실제 결제액순 정렬과 열린 분류를 유지한다", async ({
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
  const major = page.getByRole("region", { name: "상위 분류별 지출 통계" });
  const categories = major.locator("button[aria-expanded] strong");
  await expect(categories).toHaveText(["주거", "공과금"]);
  const utilities = major.getByRole("button", { name: /공과금/ });
  await utilities.click();
  await expect(
    major.getByRole("button", { name: "예상", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "통계 새로고침" }).click();
  await expect(categories).toHaveText(["주거", "공과금"]);
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
  const trend = page.getByRole("region", { name: "세부 분류별 월별 변화" });
  const decrease = trend.getByText("감소", { exact: true }).locator("..");
  await expect(decrease.locator("svg")).toBeVisible();
  const arrowCenter = await decrease.locator("svg").boundingBox();
  const amountCenter = await decrease.locator("b").boundingBox();
  expect(arrowCenter).not.toBeNull();
  expect(amountCenter).not.toBeNull();
  expect(
    Math.abs(
      arrowCenter!.y +
        arrowCenter!.height / 2 -
        amountCenter!.y -
        amountCenter!.height / 2,
    ),
  ).toBeLessThan(1);
  await expect(decrease).toContainText("10,000원 (50.0%)");
  await expect(decrease).toHaveCSS("color", "rgb(49, 91, 235)");
  await trend.getByRole("button", { name: /2026년 9월, 20,000원/ }).click();
  const increase = trend.getByText("증가", { exact: true }).locator("..");
  await expect(increase.locator("svg")).toBeVisible();
  await expect(increase).toContainText("10,000원 (100.0%)");
  await expect(increase).toHaveCSS("color", "rgb(196, 61, 72)");
  await trend.getByRole("button", { name: /2026년 8월, 10,000원/ }).click();
  const unchanged = trend
    .getByText("0원 (0.0%)", { exact: true })
    .locator("..");
  await expect(unchanged).toHaveCSS("color", "rgb(104, 113, 130)");
  await expect(unchanged.locator("svg")).toHaveCount(0);
  await trend.getByRole("button", { name: /2026년 5월, 기록 없음/ }).click();
  await expect(trend.getByText("비교 기록 없음")).toBeVisible();
  await expect(trend.getByText("증가", { exact: true })).toHaveCount(0);
  await expect(trend.getByText("감소", { exact: true })).toHaveCount(0);
});

for (const width of [360, 1280]) {
  test(`드롭다운 옵션을 가운데 정렬하고 클릭과 키보드로 선택한다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const select = page.getByLabel("세부 분류", { exact: true });
    await expect(select).toHaveCSS("text-align", "center");
    await expect(select).toHaveCSS("appearance", "base-select");
    await select.click();
    const gas = select.getByRole("option", { name: "가스", exact: true });
    await expect(gas).toBeVisible();
    await expect(gas).toHaveCSS("justify-content", "center");
    await expect(gas).toHaveCSS("text-align", "center");
    await page.screenshot({ path: `test-results/select-options-${width}.png` });
    await gas.click();
    await expect(select).toHaveValue("sub-gas");
    await select.focus();
    await page.keyboard.press("Space");
    await expect(
      select.getByRole("option", { name: "전기", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(select).toHaveValue("sub-electric");
    await select.click();
    await page.keyboard.press("Escape");
    await expect(select).toBeFocused();
    await expect(select).toHaveValue("sub-electric");
  });
}

for (const width of [360, 1280]) {
  test(`긴 드롭다운 목록을 화면 안에서 스크롤하고 마지막 옵션을 선택한다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 600 });
    const classifications = Array.from({ length: 30 }, (_, index) => ({
      categoryId: "cat-utilities",
      categoryName: "공과금",
      subcategoryId: `scroll-option-${index}`,
      subcategoryName: `스크롤 확인 분류 ${index + 1}`,
    }));
    await page.route("**/backend/dashboard/fixed-costs*", (route) =>
      route.fulfill({ json: { ...FIXED_COST_FIXTURE, classifications } }),
    );
    await page.goto("/");
    const select = page.getByLabel("세부 분류", { exact: true });
    await select.click();
    await page.screenshot({
      path: `test-results/select-scroll-top-${width}.png`,
      animations: "disabled",
    });
    await page.keyboard.press("End");
    const last = select.getByRole("option", {
      name: "스크롤 확인 분류 30",
      exact: true,
    });
    await expect(last).toBeVisible();
    const box = await last.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(600);
    await page.screenshot({
      path: `test-results/select-scroll-bottom-${width}.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Enter");
    await expect(select).toHaveValue("scroll-option-29");
  });
}
