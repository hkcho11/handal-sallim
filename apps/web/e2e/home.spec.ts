import { expect, test } from "@playwright/test";
import { DASHBOARD_FIXTURE } from "../src/test/dashboardFixtures";

test.beforeEach(async ({ page }) => {
  await page.route("**/backend/dashboard", (route) =>
    route.fulfill({ json: DASHBOARD_FIXTURE }),
  );
});

test("홈 조회 실패 후 다시 불러오면 빈 통계를 표시한다", async ({ page }) => {
  let failed = true;
  await page.route("**/backend/dashboard", (route) =>
    failed
      ? route.fulfill({ status: 503 })
      : route.fulfill({
          json: { ...DASHBOARD_FIXTURE, entries: [], charges: [] },
        }),
  );
  await page.route("**/backend/recurring-expenses", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  failed = false;
  await page.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(page.getByText("아직 지출이 없어요")).toBeVisible();
  await expect(page.getByRole("img", { name: /카테고리별 비중/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /남은 지출/ }).click();
  await expect(page.getByText("남은 결제가 없어요.")).toBeVisible();
});

test("등록한 실제 항목을 홈에 표시하고 예시 합계와 구분한다", async ({
  page,
}) => {
  await page.route("**/backend/recurring-expenses", (route) =>
    route.fulfill({
      json: [
        {
          id: "3c6b40a1-3fea-454b-93ac-a7a9917cff10",
          name: "테스트 등록 고정비",
          expectedAmount: 42000,
          intervalMonths: null,
          recurringDayOfMonth: null,
          firstDueDate: null,
          firstChargeId: null,
          firstChargeStatus: null,
          payer: null,
          paymentMethodId: null,
          paymentMethodName: null,
        },
      ],
    }),
  );
  await page.goto("/");
  const registered = page.getByRole("region", { name: "등록한 고정비" });
  await expect(
    registered.getByRole("heading", { name: "테스트 등록 고정비" }),
  ).toBeVisible();
  await expect(registered.getByText("일정 미정")).toBeVisible();
  await expect(registered.getByText(/1건 · 42,000원/)).toBeVisible();
  const summary = page.getByRole("region", { name: "이번 달 지출 요약" });
  await expect(summary.getByText("818,000원")).toBeVisible();
});

for (const width of [360, 1280]) {
  test(`지출 요약에서 내역을 아래에 펼친다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/backend/recurring-expenses", (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto("/");
    const summary = page.getByRole("region", { name: "이번 달 지출 요약" });
    const actual = summary.getByRole("button", { name: /실제 지출/ });
    const remaining = summary.getByRole("button", { name: /남은 지출/ });
    await expect(actual).toBeVisible();
    await expect(actual.getByText("내역 보기")).toBeVisible();
    await expect(remaining.getByText("내역 보기")).toBeVisible();
    const labels = summary
      .locator("span")
      .filter({ hasText: /^(실제 지출|남은 지출|월 예상 지출)$/ });
    const boxes = await labels.evaluateAll((items) =>
      items.map((item) => {
        const { x, y } = item.getBoundingClientRect();
        return { x, y };
      }),
    );
    expect(boxes).toHaveLength(3);
    expect(boxes[0].y).toBe(boxes[1].y);
    expect(boxes[1].y).toBe(boxes[2].y);
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
    expect(boxes[1].x).toBeLessThan(boxes[2].x);
    await expect(summary.getByRole("link")).toHaveCount(0);
    await expect(summary.getByText("예시 데이터")).toHaveCount(0);
    await expect(actual).toHaveAttribute("aria-expanded", "false");
    await actual.focus();
    await page.keyboard.press("Enter");
    await expect(actual).toHaveAttribute("aria-expanded", "true");
    const actualDetails = summary.getByRole("region", {
      name: "실제 지출 내역",
    });
    await expect(
      actualDetails.getByText("장보기", { exact: true }),
    ).toBeVisible();
    await expect(actualDetails.getByRole("listitem")).toHaveCount(6);
    const search = actualDetails.getByRole("searchbox", {
      name: "지출 내역 검색",
    });
    await search.fill("장보기");
    await expect(actualDetails.getByRole("listitem")).toHaveCount(1);
    await search.fill("없는 내역");
    await expect(
      actualDetails.getByText("검색한 내역이 없어요."),
    ).toBeVisible();
    await search.fill("");
    await expect(actualDetails.locator("time").first()).toHaveText(
      /10월 \d+일/,
    );
    await actualDetails.getByRole("button", { name: "지출 내역 닫기" }).click();
    await expect(actualDetails).toHaveCount(0);
    await expect(actual).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(actualDetails.getByText("식사", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      actualDetails.getByText("대중교통", { exact: true }),
    ).toHaveCount(0);
    await expect(
      actualDetails.getByText("기타 지출", { exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL("/");
    await remaining.click();
    await expect(actualDetails).toHaveCount(0);
    await expect(remaining).toHaveAttribute("aria-expanded", "true");
    const remainingDetails = summary.getByRole("region", {
      name: "남은 지출 내역",
    });
    await expect(remainingDetails.getByRole("listitem")).toHaveCount(4);
    await expect(
      remainingDetails.getByRole("heading", { name: /결제 예정/ }),
    ).toBeVisible();
    await expect(remainingDetails.getByRole("listitem").first()).toContainText(
      "전기요금",
    );
    await page.screenshot({
      path: `test-results/spending-summary-${width}.png`,
    });
    await remaining.click();
    await expect(remainingDetails).toHaveCount(0);
    await expect(remaining).toHaveAttribute("aria-expanded", "false");
    await remaining.click();
    await remainingDetails
      .getByRole("button", { name: "지출 내역 닫기" })
      .focus();
    await page.keyboard.press("Escape");
    await expect(remainingDetails).toHaveCount(0);
    await expect(remaining).toBeFocused();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  });
  test(`대시보드와 하단 탭을 ${width}px에서 사용할 수 있다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/backend/recurring-expenses", (route) =>
      route.fulfill({ json: [] }),
    );
    await page.route("**/backend/recurring-expenses/options", (route) =>
      route.fulfill({ json: { payers: [], paymentMethods: [] } }),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "한달살림" })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "+ 고정비 추가" }),
    ).toBeFocused();
    await expect(
      page.getByRole("region", { name: "다가오는 결제·지연 항목" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "이번 달 결제 현황" }),
    ).toHaveCount(0);
    const statistics = page.getByRole("region", { name: "이번 달 지출 요약" });
    await expect(statistics.getByText("419,000원")).toBeVisible();
    await expect(statistics.getByText("1,237,000원")).toBeVisible();
    const methods = page.getByRole("region", { name: "결제수단별 금액" });
    await methods.getByRole("button", { name: "예상", exact: true }).click();
    await expect(methods.getByText("816,000원")).toBeVisible();
    await methods.getByRole("button", { name: "실제", exact: true }).click();
    await expect(methods.getByText("118,000원")).toBeVisible();
    const categories = page.getByRole("region", { name: "카테고리별 지출" });
    const food = categories.locator("details").filter({ hasText: "식비" });
    await food.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(food).toHaveAttribute("open", "");
    await expect(food.getByText("장보기")).toBeVisible();
    await expect(food.getByText("식사")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(food.getByText("장보기")).toBeHidden();
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
    const navigation = page.getByRole("navigation", { name: "하단 메뉴" });
    await expect(
      navigation.getByRole("link", { name: "홈", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await navigation.getByRole("link", { name: "고정비", exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-costs$/);
    await expect(
      page.getByRole("heading", { name: "고정비", exact: true }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "고정비", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await navigation.getByRole("link", { name: "홈", exact: true }).click();
    await expect(page).toHaveURL("/");
    await page.getByRole("link", { name: "+ 고정비 추가" }).click();
    await expect(page).toHaveURL(/\/entries\/new$/);
    await expect(
      navigation.getByRole("link", { name: "고정비", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await navigation.getByRole("link", { name: "홈", exact: true }).click();
    await expect(page).toHaveURL("/");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
    const lastCard = page
      .getByRole("region", { name: "결제수단별 금액" })
      .getByText("미지정", { exact: true });
    await lastCard.scrollIntoViewIfNeeded();
    const card = await lastCard.boundingBox();
    const nav = await navigation.boundingBox();
    expect(card!.y + card!.height).toBeLessThanOrEqual(nav!.y);
  });
}
