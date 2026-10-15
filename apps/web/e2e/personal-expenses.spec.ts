import { expect, test } from "@playwright/test";

for (const width of [360, 1280]) {
  test(`개인 지출 탭의 월 이동과 준비 상태를 확인한다 (${width}px)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.clock.install({ time: new Date("2026-12-31T15:30:00Z") });
    await page.setViewportSize({ width, height: 800 });
    await page.route("**/backend/recurring-expenses", (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "하단 메뉴" });
    await navigation
      .getByRole("link", { name: "개인 지출", exact: true })
      .click();
    await expect(page).toHaveURL("/personal-expenses");
    await expect(
      navigation.getByRole("link", { name: "개인 지출", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      navigation.getByRole("link", { name: "홈", exact: true }),
    ).not.toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: "개인 지출", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "2027년 1월" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "이전 달" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "2026년 12월" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "다음 달" }).click();
    await page.getByRole("button", { name: "다음 달" }).click();
    await expect(
      page.getByRole("heading", { name: "2027년 2월" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "이번 달", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "2027년 1월" }),
    ).toBeVisible();
    await expect(
      page.getByText("화면 미리보기", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "지출 추가" }),
    ).toBeDisabled();
    await expect(page.getByText("0원", { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: `test-results/personal-expenses-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      navigation.getByRole("link", { name: "개인 지출", exact: true }),
    ).toBeInViewport();
    await navigation.getByRole("link", { name: "홈", exact: true }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/personal-expenses");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "개인 지출", exact: true }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}
