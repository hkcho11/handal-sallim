import { expect, test } from "@playwright/test";

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
  await expect(registered.getByText(/등록 금액 합계 42,000원/)).toBeVisible();
  const summary = page.getByRole("region", { name: "이번 달 결제 현황" });
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
    await expect(summary.getByText("예시 데이터")).toBeVisible();
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
    await expect(actualDetails.getByRole("listitem")).toHaveCount(9);
    await expect(page).toHaveURL("/");
    await remaining.click();
    await expect(actualDetails).toHaveCount(0);
    await expect(remaining).toHaveAttribute("aria-expanded", "true");
    const remainingDetails = summary.getByRole("region", {
      name: "남은 지출 내역",
    });
    await expect(remainingDetails.getByRole("listitem")).toHaveCount(4);
    await expect(remainingDetails.getByRole("listitem").first()).toContainText(
      "전기요금",
    );
    await page.screenshot({
      path: `test-results/spending-summary-${width}.png`,
    });
    await remaining.click();
    await expect(remainingDetails).toHaveCount(0);
    await expect(remaining).toHaveAttribute("aria-expanded", "false");
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
    await expect(page.getByRole("link", { name: "+ 내역 추가" })).toBeFocused();
    await expect(page.getByText("미결제 4건")).toBeVisible();
    const statistics = page.getByRole("region", { name: "이번 달 지출 요약" });
    await expect(statistics.getByText("545,000원")).toBeVisible();
    await expect(statistics.getByText("1,363,000원")).toBeVisible();
    const categories = page.getByRole("region", { name: "카테고리별 지출" });
    const food = categories.locator("details").filter({ hasText: "식비" });
    await food.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(food).toHaveAttribute("open", "");
    await expect(food.getByText("장보기")).toBeVisible();
    await expect(food.getByText("식사")).toBeVisible();
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
    await page.getByRole("link", { name: "+ 내역 추가" }).click();
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
    const lastCard = page.getByRole("heading", { name: "내 개인 내역" });
    await lastCard.scrollIntoViewIfNeeded();
    const card = await lastCard.boundingBox();
    const nav = await navigation.boundingBox();
    expect(card!.y + card!.height).toBeLessThanOrEqual(nav!.y);
  });
}
