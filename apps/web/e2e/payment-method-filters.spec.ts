import { expect, test } from "./fixtures";
import type { PaymentMethod } from "../src/features/payment-methods/api";

test("종류와 두 명의 명의자를 조합하고 가나다순 목록과 보관함을 확인한다", async ({
  page,
}) => {
  const members = [
    { id: "11111111-1111-4111-8111-111111111111", name: "첫째" },
    { id: "22222222-2222-4222-8222-222222222222", name: "둘째" },
  ];
  const methods: PaymentMethod[] = [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "하나 카드",
      type: "CREDIT_CARD",
      holderUserId: members[0].id,
      color: null,
      status: "ACTIVE",
      version: 0,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "국민 카드",
      type: "DEBIT_CARD",
      holderUserId: members[1].id,
      color: null,
      status: "ACTIVE",
      version: 0,
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      name: "간편 지갑",
      type: "SIMPLE_PAY",
      holderUserId: null,
      color: null,
      status: "ACTIVE",
      version: 0,
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      name: "기존 카드",
      type: "CARD",
      holderUserId: members[0].id,
      color: null,
      status: "ACTIVE",
      version: 0,
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      name: "보관 카드",
      type: "CREDIT_CARD",
      holderUserId: members[0].id,
      color: null,
      status: "ARCHIVED",
      version: 0,
    },
  ];
  await page.route("**/backend/payment-methods**", (route) =>
    route.fulfill({
      json: route.request().url().endsWith("/members") ? members : methods,
    }),
  );
  await page.goto("/payment-methods");
  const rows = page.locator(
    'main a[href^="/payment-methods/"]:not([href$="/new"])',
  );
  await expect(rows).toHaveCount(4);
  await expect(rows).toContainText([
    "간편 지갑",
    "국민 카드",
    "기존 카드",
    "하나 카드",
  ]);
  await expect(rows.nth(1)).toContainText("체크카드 · 둘째");
  await expect(rows.nth(2)).toContainText("카드(미분류) · 첫째");
  await page
    .getByRole("combobox", { name: "명의자 / 담당자", exact: true })
    .selectOption(members[0].id);
  await expect(rows).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "종류", exact: true })
    .selectOption("CREDIT_CARD");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(["하나 카드"]);
  await page
    .getByRole("combobox", { name: "명의자 / 담당자", exact: true })
    .selectOption(members[1].id);
  await expect(page.getByText("조건에 맞는 결제수단이 없어요")).toBeVisible();
  await page
    .getByRole("combobox", { name: "종류", exact: true })
    .selectOption("DEBIT_CARD");
  await expect(rows).toContainText(["국민 카드"]);
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await expect(rows).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "명의자 / 담당자", exact: true })
    .selectOption("unassigned");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(["간편 지갑"]);
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await page
    .getByRole("combobox", { name: "종류", exact: true })
    .selectOption("CREDIT_CARD");
  await page
    .getByRole("combobox", { name: "명의자 / 담당자", exact: true })
    .selectOption(members[0].id);
  await page.getByRole("button", { name: "보관함" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(["보관 카드"]);
  for (const width of [360, 1280, 180]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("combobox", { name: "종류", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("combobox", { name: "명의자 / 담당자", exact: true }),
  ).toBeFocused();
});
