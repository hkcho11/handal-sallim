import { expect, test } from "./fixtures";
import type { FixedExpense } from "../src/features/fixed-expenses/api";
import type { ScheduledCharge } from "../src/features/fixed-expenses/chargeApi";
const id = "11111111-1111-4111-8111-111111111111";
const category = "22222222-2222-4222-8222-222222222222";
const sub = "33333333-3333-4333-8333-333333333333";
const method = "44444444-4444-4444-8444-444444444444";
for (const width of [360, 1280]) {
  test(`변동 고정비 등록·월별 수동 입력·실패 재시도·완료 내역 수정 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    let saved: FixedExpense | null = null;
    let charges: ScheduledCharge[] = [];
    const keys: string[] = [];
    await page.route("**/backend/recurring-expenses/options", (route) =>
      route.fulfill({
        json: {
          payers: [],
          paymentMethods: [
            { id: method, name: "생활비 카드", type: "CREDIT_CARD" },
          ],
          categories: [{ id: category, name: "공과금" }],
          subcategories: [{ id: sub, categoryId: category, name: "전기" }],
        },
      }),
    );
    await page.route("**/backend/recurring-expenses", async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: saved ? [saved] : [] });
      const input = route.request().postDataJSON();
      expect(input).toMatchObject({
        billingMode: "VARIABLE",
        billingMonth: "2026-10",
        expectedAmount: null,
        firstDueDate: null,
        intervalMonths: null,
        recurringDayOfMonth: null,
      });
      saved = {
        id,
        ...input,
        name: "전기",
        categoryName: "공과금",
        subcategoryName: "전기",
        firstChargeId: null,
        firstChargeStatus: null,
        paymentMethodName: null,
      };
      await route.fulfill({ json: saved });
    });
    await page.route(`**/backend/recurring-expenses/${id}/charges`, (route) =>
      route.fulfill({ json: charges }),
    );
    await page.route(
      `**/backend/recurring-expenses/${id}/payments`,
      async (route) => {
        keys.push(route.request().headers()["idempotency-key"]);
        if (keys.length === 1)
          return route.fulfill({
            status: 503,
            json: { message: "일시 오류입니다. 다시 저장해 주세요." },
          });
        const input = route.request().postDataJSON();
        charges = [
          {
            id: keys[1],
            recurringExpenseId: id,
            name: "전기",
            billingMonth: input.billingMonth,
            dueDate: `${input.billingMonth}-01`,
            expectedAmount: null,
            status: "COMPLETED",
            actualAmount: input.amount,
            actualPaidOn: input.paidOn,
            plannedPaymentMethodId: method,
            actualPaymentMethodId: method,
            paymentMethodName: "생활비 카드",
            version: 1,
          },
        ];
        await route.fulfill({ json: charges[0] });
      },
    );
    await page.route("**/backend/scheduled-charges/*/edit", async (route) => {
      const input = route.request().postDataJSON();
      charges = [
        {
          ...charges[0],
          billingMonth: input.billingMonth,
          actualAmount: input.amount,
          actualPaidOn: input.paidOn,
          version: 2,
        },
      ];
      await route.fulfill({ json: charges[0] });
    });
    await page.goto("/entries/new");
    await page.getByLabel("금액 변동 여부").selectOption("VARIABLE");
    await expect(page.getByLabel("금액 (원)")).toHaveCount(0);
    await expect(page.getByLabel("첫 결제일")).toHaveCount(0);
    await page.getByLabel("해당 월", { exact: true }).fill("2026-10");
    await page.getByLabel("대분류", { exact: true }).selectOption(category);
    await page.getByLabel("중분류", { exact: true }).selectOption(sub);
    await page.getByRole("button", { name: "고정비 저장" }).click();
    await expect(page).toHaveURL(`/fixed-costs/${id}`);
    const history = page.getByRole("region", { name: "회차별 결제 내역" });
    await expect(history.getByRole("listitem")).toHaveCount(0);
    await history.getByRole("button", { name: "+ 결제 내역 입력" }).click();
    const form = history.getByRole("form", { name: "결제 내역 입력" });
    await form.getByLabel("결제 금액", { exact: true }).fill("50000");
    await form.getByLabel("실제 결제일").fill("2026-11-10");
    await form
      .getByRole("combobox", { name: "결제수단", exact: true })
      .selectOption(method);
    await form.getByRole("button", { name: "결제 내역 저장" }).click();
    await expect(form.getByRole("alert")).toContainText("일시 오류");
    await expect(form.getByLabel("결제 금액", { exact: true })).toHaveValue(
      "50,000",
    );
    await form.getByRole("button", { name: "결제 내역 저장" }).click();
    await expect(form).toHaveCount(0);
    expect(keys[0]).toBe(keys[1]);
    await expect(history.getByRole("listitem")).toContainText([
      "2026-10 · 전기50,000원생활비 카드 · 2026-11-10",
    ]);
    await expect(
      page.getByRole("dialog", { name: "결제 완료 확인" }),
    ).toHaveCount(0);
    await history
      .getByRole("button", { name: "2026-10 결제 내역 수정" })
      .click();
    const edit = history.getByRole("form", { name: "결제 내역 수정" });
    await edit.getByLabel("해당 월", { exact: true }).fill("2026-09");
    await edit.getByLabel("결제 금액", { exact: true }).fill("55000");
    await edit.getByLabel("실제 결제일").fill("2026-11-11");
    await edit.getByRole("button", { name: "결제 내역 저장" }).click();
    await expect(history.getByRole("listitem")).toHaveCount(1);
    await expect(history.getByRole("listitem")).toContainText([
      "2026-09 · 전기55,000원생활비 카드 · 2026-11-11",
    ]);
    if (width === 360) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    await page.screenshot({
      path: `../../.local/billing-mode-${width}.png`,
      fullPage: true,
    });
  });
}
