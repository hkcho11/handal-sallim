import { expect, test } from "./fixtures";

for (const width of [360, 1280]) {
  test(`상세 왕복·브라우저 뒤로·탭 이동 후 목록 위치를 복원한다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const categories = [
      "주거",
      "교통",
      "통신",
      "공과금",
      "구독",
      "보험",
      "할부",
      "가전구독",
    ];
    const expenses = Array.from({ length: 67 }, (_, index) => ({
      id: `3c6b40a1-3fea-454b-93ac-${String(index).padStart(12, "0")}`,
      name: `인터넷 ${index}`,
      subcategoryName: index < 60 ? `인터넷 ${index}` : `다른 항목 ${index}`,
      categoryName:
        index < 60
          ? "통신"
          : categories.filter((name) => name !== "통신")[index - 60],
      expectedAmount: 35000,
      intervalMonths: 1,
      recurringDayOfMonth: 15,
      firstDueDate: "2026-05-15",
      firstChargeId: null,
      firstChargeStatus: null,
      payer: null,
      paymentMethodId: null,
      paymentMethodName: null,
    }));
    await page.route("**/backend/recurring-expenses", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.fulfill({ json: expenses });
    });
    await page.route("**/backend/savings", (route) =>
      route.fulfill({
        json: { items: [], totalCurrentAmount: "0", monthlyDepositAmount: "0" },
      }),
    );
    await page.goto("/fixed-costs");
    const filters = page.getByRole("group", { name: "대분류 필터" });
    await filters.getByRole("button", { name: "통신", exact: true }).click();
    await page.getByRole("searchbox", { name: "중분류 검색" }).fill("인터넷");
    const horizontalPosition = await filters.evaluate(
      (element) => element.scrollLeft,
    );
    const target = page.getByRole("link", { name: /인터넷 40 / });
    await target.scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => window.scrollY);
    expect(position).toBeGreaterThan(1000);

    async function expectRestored() {
      await expect(target).toBeVisible();
      await expect
        .poll(async () =>
          Math.abs((await page.evaluate(() => window.scrollY)) - position),
        )
        .toBeLessThan(3);
      await expect(
        page.getByRole("searchbox", { name: "중분류 검색" }),
      ).toHaveValue("인터넷");
      await expect(
        filters.getByRole("button", { name: "전체", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(async () =>
          Math.abs(
            (await filters.evaluate((element) => element.scrollLeft)) -
              horizontalPosition,
          ),
        )
        .toBeLessThan(3);
    }

    await target.click();
    await expect(
      page.getByRole("heading", { name: "고정비 상세" }),
    ).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.getByRole("link", { name: "← 고정비 목록" }).click();
    await expectRestored();

    await target.click();
    await expect(
      page.getByRole("heading", { name: "고정비 상세" }),
    ).toBeVisible();
    await page.goBack();
    await expectRestored();

    const navigation = page.getByRole("navigation", { name: "하단 메뉴" });
    await navigation.getByRole("link", { name: "저축", exact: true }).click();
    await expect(page).toHaveURL("/savings");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await navigation.getByRole("link", { name: "지출", exact: true }).click();
    await expectRestored();
  });
}
