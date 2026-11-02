import { expect, test } from "./fixtures";
import { FIXED_COST_FIXTURE } from "../src/test/fixedCostFixture";

for (const width of [360, 1280]) {
  test(`홈·수입의 핵심 내용을 첫 화면에 표시한다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.clock.setFixedTime(new Date("2026-10-15T03:00:00Z"));
    await page.route("**/backend/dashboard/fixed-costs*", (route) =>
      route.fulfill({ json: FIXED_COST_FIXTURE }),
    );
    await page.route("**/backend/incomes?*", (route) =>
      route.fulfill({
        json: {
          month: "2026-10",
          totalAmount: "3000000",
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "월급",
              amount: 3000000,
              month: "2026-10",
              version: 0,
              ownerUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              ownerName: "나",
            },
          ],
        },
      }),
    );
    await page.goto("/");
    const major = page.getByRole("region", { name: "상위 분류별 지출 통계" });
    await expect(major).toBeVisible();
    await expect(page.getByText(/일 기준.*예정 결제월로 집계/)).toHaveCount(0);
    await expect(page.locator("h1 img")).toHaveAttribute(
      "src",
      /handal-sallim-blue/,
    );
    expect((await major.boundingBox())!.y).toBeLessThan(180);
    await expect
      .poll(() =>
        page
          .locator("h1 img")
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/compact-home-${width}.png`,
      fullPage: true,
    });
    await page.goto("/income");
    const owner = page.getByRole("button", { name: "나 1건 3,000,000원" });
    await expect(owner).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("월 수입 합계")).toContainText("3,000,000원");
    expect((await owner.boundingBox())!.y).toBeLessThan(360);
    await owner.click();
    const income = page.getByRole("heading", { name: "월급", exact: true });
    await expect(income).toBeVisible();
    await expect(page.getByLabel("월 수입 합계")).toContainText("3,000,000원");
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.screenshot({
      path: `test-results/compact-income-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
