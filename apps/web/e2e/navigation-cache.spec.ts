import { expect, test } from "./fixtures";
import { FIXED_COST_FIXTURE } from "../src/test/fixedCostFixture";

for (const target of ["홈", "수입", "지출", "저축"]) {
  test(`${target} 재방문 시 최근 조회를 재사용하고 새로고침하면 다시 조회한다`, async ({
    page,
  }) => {
    let calls = 0;
    const endpoint = {
      홈: "**/backend/dashboard/fixed-costs*",
      수입: "**/backend/incomes?*",
      지출: "**/backend/recurring-expenses",
      저축: "**/backend/savings",
    }[target]!;
    await page.route(endpoint, (route) => {
      calls++;
      const month = new URL(route.request().url()).searchParams.get("month");
      const data =
        target === "홈"
          ? FIXED_COST_FIXTURE
          : target === "수입"
            ? { month, totalAmount: "0", items: [] }
            : target === "저축"
              ? {
                  monthlyDepositAmount: "0",
                  totalCurrentAmount: "0",
                  items: [],
                }
              : [];
      return route.fulfill({ json: data });
    });
    const nav = page.getByRole("navigation", { name: "하단 메뉴" });
    await page.goto("/settings");
    await nav.getByRole("link", { name: target, exact: true }).click();
    await expect.poll(() => calls).toBe(1);
    await expect(
      page.getByRole("dialog", { name: "처리 중", exact: true }),
    ).toBeHidden();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await nav.getByRole("link", { name: "설정", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "설정", exact: true }),
    ).toBeVisible();
    await nav.getByRole("link", { name: target, exact: true }).click();
    await expect(
      nav.getByRole("link", { name: target, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(calls).toBe(1);
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    if (target === "홈") {
      await page
        .getByRole("button", { name: "통계 새로고침", exact: true })
        .click();
      await expect.poll(() => calls).toBe(2);
    } else {
      await page.reload();
      await expect.poll(() => calls).toBe(2);
    }
  });
}
