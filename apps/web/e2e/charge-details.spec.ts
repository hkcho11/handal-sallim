import { expect, test } from "./fixtures";

const expenseId = "11111111-1111-4111-8111-111111111111";
const methodId = "22222222-2222-4222-8222-222222222222";
const row = (digit: string, dueDate: string) => ({
  id: `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`,
  recurringExpenseId: expenseId,
  name: "통신비",
  dueDate,
  expectedAmount: null,
  status: "PENDING",
  actualAmount: null as number | null,
  actualPaidOn: null as string | null,
  plannedPaymentMethodId: methodId,
  actualPaymentMethodId: null as string | null,
  paymentMethodName: "현금",
  version: 0,
});

for (const width of [360, 1280]) {
  test(`회차 최신순·닫기 버튼·숫자 전용 금액과 쉼표 편집 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    let charges = [
      row("3", "2026-07-01"),
      row("4", "2026-09-01"),
      {
        ...row("5", "2026-08-01"),
        status: "COMPLETED",
        actualAmount: 32000,
        actualPaidOn: "2026-08-01",
        actualPaymentMethodId: methodId,
      },
    ];
    let submitted: Record<string, unknown> | null = null;
    await page.route("**/backend/recurring-expenses", (route) =>
      route.fulfill({
        json: [
          {
            id: expenseId,
            name: "통신비",
            expectedAmount: 30000,
            intervalMonths: 1,
            recurringDayOfMonth: 1,
            firstDueDate: "2026-07-01",
            firstChargeDueDate: "2026-07-01",
            firstChargeId: charges[0].id,
            firstChargeStatus: "OVERDUE",
            payer: null,
            paymentMethodId: methodId,
            paymentMethodName: "현금",
          },
        ],
      }),
    );
    await page.route(
      `**/backend/recurring-expenses/${expenseId}/charges`,
      (route) => route.fulfill({ json: charges }),
    );
    await page.route("**/backend/recurring-expenses/options", (route) =>
      route.fulfill({
        json: {
          payers: [],
          paymentMethods: [{ id: methodId, name: "현금", type: "CASH" }],
          categories: [],
          subcategories: [],
        },
      }),
    );
    await page.route(
      "**/backend/scheduled-charges/*/complete",
      async (route) => {
        submitted = route.request().postDataJSON() as Record<string, unknown>;
        const completed = {
          ...charges[1],
          status: "COMPLETED",
          actualAmount: Number(submitted.amount),
          actualPaidOn: String(submitted.paidOn),
          actualPaymentMethodId: methodId,
          version: 1,
        };
        charges = charges.map((charge) =>
          charge.id === completed.id ? completed : charge,
        );
        await route.fulfill({ json: completed });
      },
    );
    await page.goto(`/fixed-costs/${expenseId}`);
    const history = page.getByRole("region", { name: "회차별 결제 내역" });
    await expect(history.getByRole("listitem").locator("strong")).toHaveText([
      "2026-09-01",
      "2026-08-01",
      "2026-07-01",
    ]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../../.local/charge-list-${width}.png`,
      fullPage: true,
    });
    await history.getByRole("button", { name: "2026-09-01 결제 완료" }).click();
    const dialog = page.getByRole("dialog", { name: "결제 완료 확인" });
    await expect(
      dialog.getByRole("button", { name: "돌아가기", exact: true }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: "결제 완료 창 닫기" }).click();
    await expect(dialog).not.toBeVisible();
    expect(submitted).toBeNull();
    await history.getByRole("button", { name: "2026-09-01 결제 완료" }).click();
    const amount = dialog.getByLabel("실제 결제 금액");
    await amount.fill("abc");
    await expect(amount).toHaveValue("");
    await amount.pressSequentially("1234567abc");
    await expect(amount).toHaveValue("1,234,567");
    await amount.press("Home");
    await amount.press("ArrowRight");
    await amount.press("Delete");
    await expect(amount).toHaveValue("134,567");
    await amount.fill("1234567");
    await amount.press("Home");
    await amount.press("ArrowRight");
    await amount.press("ArrowRight");
    await amount.press("Backspace");
    await expect(amount).toHaveValue("234,567");
    await amount.pressSequentially("9");
    await expect(amount).toHaveValue("9,234,567");
    await amount.fill("35,000원 abc");
    await expect(amount).toHaveValue("35,000");
    expect(
      await amount.evaluate(
        (input) => (input as HTMLInputElement).selectionStart,
      ),
    ).toBe(6);
    if (width === 360) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await dialog
        .getByRole("button", { name: "결제 완료 창 닫기" })
        .scrollIntoViewIfNeeded();
      await expect(
        dialog.getByRole("button", { name: "결제 완료 창 닫기" }),
      ).toBeVisible();
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
      });
    }
    await page.screenshot({
      path: `../../.local/charge-dialog-${width}.png`,
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: "확인하고 결제 완료", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    expect(submitted).toEqual({
      amount: 35000,
      paidOn: "2026-09-01",
      paymentMethodId: methodId,
      version: 0,
    });
  });
}
