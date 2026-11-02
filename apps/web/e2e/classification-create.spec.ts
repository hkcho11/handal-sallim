import { test, expect } from "./fixtures";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const sub = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

for (const width of [360, 1280]) {
  test(`분류 추가 팝업의 닫기·검증·실패 복구·중복 제출 방지 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const subs: { id: string; name: string; categoryId: string }[] = [];
    await page.route("**/backend/recurring-expenses/options", (route) =>
      route.fulfill({
        json: {
          categories: [
            { id: a, name: "주거" },
            { id: b, name: "공과금" },
          ],
          subcategories: subs,
          payers: [],
          paymentMethods: [],
        },
      }),
    );
    let requests = 0;
    let release!: () => void;
    const waitForSave = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      "**/backend/recurring-expenses/subcategories",
      async (route) => {
        requests++;
        expect(route.request().postDataJSON()).toEqual({
          categoryId: b,
          name: "수도",
        });
        if (requests === 1) {
          await route.fulfill({
            status: 503,
            json: { message: "잠시 후 다시 시도해 주세요." },
          });
        } else {
          await waitForSave;
          const saved = { id: sub, categoryId: b, name: "수도" };
          subs.push(saved);
          await route.fulfill({ status: 201, json: saved });
        }
      },
    );
    await page.goto("/settings/categories");
    const add = page.getByRole("button", { name: "+ 추가", exact: true });
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await page
      .getByRole("searchbox", { name: "분류 검색" })
      .fill("아직 없는 분류");
    await add.click();
    const popup = page.getByRole("dialog", { name: "분류 추가", exact: true });
    await expect(popup).toBeVisible();
    await expect(
      popup.getByLabel("새 상위 분류 이름", { exact: true }),
    ).toBeFocused();
    await popup
      .getByLabel("새 상위 분류 이름", { exact: true })
      .fill("닫기 확인");
    await popup
      .getByRole("button", { name: "분류 추가 닫기", exact: true })
      .click();
    await expect(popup).toHaveCount(0);
    await expect(add).toBeFocused();
    await add.click();
    await expect(
      popup.getByLabel("새 상위 분류 이름", { exact: true }),
    ).toHaveValue("");
    await popup.getByRole("button", { name: "추가", exact: true }).click();
    await expect(popup.getByRole("alert")).toContainText("이름은 1~80자");
    await popup.getByRole("button", { name: "세부 분류", exact: true }).click();
    await popup.getByLabel("새 세부 분류 이름", { exact: true }).fill("수도");
    await popup.getByRole("button", { name: "추가", exact: true }).click();
    await expect(
      popup.getByLabel("상위 분류 선택", { exact: true }),
    ).toBeFocused();
    await popup.getByLabel("상위 분류 선택", { exact: true }).selectOption(b);
    expect(requests).toBe(0);
    await page.screenshot({
      path: `../../.local/classification-create-${width}.png`,
    });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await popup.getByRole("button", { name: "추가", exact: true }).click();
    await expect(popup.getByRole("alert")).toBeVisible();
    await expect(
      popup.getByLabel("새 세부 분류 이름", { exact: true }),
    ).toHaveValue("수도");
    await expect(
      popup.getByLabel("상위 분류 선택", { exact: true }),
    ).toHaveValue(b);
    await popup.getByRole("button", { name: "추가", exact: true }).click();
    await expect(
      popup.getByRole("button", { name: "추가 중…", exact: true }),
    ).toBeDisabled();
    await expect(
      popup.getByRole("button", { name: "분류 추가 닫기", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(popup).toBeVisible();
    expect(requests).toBe(2);
    release();
    await expect(popup).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "수도", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("searchbox", { name: "분류 검색" }),
    ).toHaveValue("");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "수도", exact: true }),
    ).toBeVisible();
    await add.click();
    await page.keyboard.press("Escape");
    await expect(add).toBeFocused();
  });
}

test("상위 분류가 없는 경우 먼저 상위 분류를 추가한다", async ({ page }) => {
  await page.route("**/backend/recurring-expenses/options", (route) =>
    route.fulfill({
      json: {
        categories: [],
        subcategories: [],
        payers: [],
        paymentMethods: [],
      },
    }),
  );
  await page.route("**/backend/recurring-expenses/categories", (route) =>
    route.fulfill({ status: 201, json: { id: a, name: "주거" } }),
  );
  await page.goto("/settings/categories");
  await page.getByRole("button", { name: "+ 추가", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "세부 분류", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("새 상위 분류 이름", { exact: true }).fill("주거");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "추가", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "주거", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "+ 추가", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "세부 분류", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
