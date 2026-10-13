import { expect, test } from "@playwright/test";

for (const width of [360, 1280]) {
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
    await expect(page.getByText("등록한 고정비가 없습니다.")).toBeVisible();
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
