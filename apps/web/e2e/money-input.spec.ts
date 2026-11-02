import { expect, test } from "./fixtures";

test("금액 쉼표 주변에서 입력·삭제·붙여넣기를 해도 숫자와 커서가 유지된다", async ({
  page,
}) => {
  await page.route("**/backend/incomes/members", (route) =>
    route.fulfill({
      json: {
        currentUserId: "11111111-1111-4111-8111-111111111111",
        members: [
          { id: "11111111-1111-4111-8111-111111111111", name: "테스트" },
        ],
      },
    }),
  );
  await page.goto("/income/new?month=2026-10");
  const amount = page.getByLabel("금액 (원)");
  await amount.fill("1234567");
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
  await amount.fill("3,000,000");
  await expect(amount).toHaveValue("3,000,000");
  await amount.fill("");
  await expect(amount).toHaveValue("");
  await amount.pressSequentially("9007199254740991");
  await expect(amount).toHaveValue("9,007,199,254,740,991");
});
