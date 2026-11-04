import { expect, test } from "./fixtures";
import type { FixedExpense } from "../src/features/fixed-expenses/api";

const categoryId = "11111111-1111-4111-8111-111111111111";
const subcategoryId = "22222222-2222-4222-8222-222222222222";
const categories = [
  { id: categoryId, name: "통신" },
  { id: "33333333-3333-4333-8333-333333333333", name: "공과금" },
];
const subcategories = [
  { id: subcategoryId, categoryId, name: "인터넷" },
  {
    id: "44444444-4444-4444-8444-444444444444",
    categoryId: categories[1].id,
    name: "전기",
  },
];

for (const width of [360, 1280]) {
  test(`목록에서 추가하고 상세에서 모든 정보를 수정한다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    let saved: FixedExpense | null = null;
    await page.route("**/backend/recurring-expenses/options", (route) =>
      route.fulfill({
        json: {
          payers: [],
          paymentMethods: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              name: "현금",
              type: "CASH",
            },
          ],
          categories,
          subcategories,
        },
      }),
    );
    await page.route("**/backend/recurring-expenses", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: saved ? [saved] : [] });
      } else {
        saved = {
          id: "3c6b40a1-3fea-454b-93ac-a7a9917cff10",
          ...route.request().postDataJSON(),
          name: route.request().postDataJSON().memo || "인터넷",
          categoryName: "통신",
          subcategoryName: "인터넷",
          firstChargeId: null,
          firstChargeStatus: null,
          paymentMethodName: null,
        } as FixedExpense;
        await route.fulfill({ status: 201, json: saved });
      }
    });
    await page.route(
      "**/backend/recurring-expenses/*/details",
      async (route) => {
        saved = {
          ...saved,
          ...route.request().postDataJSON(),
          name: route.request().postDataJSON().memo || "인터넷",
          categoryName: "통신",
          subcategoryName: "인터넷",
          firstChargeId: "4bdcc856-5663-4052-9a82-f38886058c57",
          firstChargeStatus: "PENDING",
        } as FixedExpense;
        await route.fulfill({ json: saved });
      },
    );
    await page.goto("/fixed-costs");
    await expect(page.getByText("아직 등록한 고정비가 없어요")).toBeVisible();
    await page.getByRole("link", { name: "고정비 추가", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "내역 추가" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "고정비 저장" }).click();
    await expect(page.getByLabel("대분류", { exact: true })).toBeFocused();
    await expect(page.getByLabel("대분류", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByLabel("지출명")).toHaveCount(0);
    await page.getByLabel("대분류", { exact: true }).selectOption(categoryId);
    await page
      .getByLabel("중분류", { exact: true })
      .selectOption(subcategoryId);
    await page
      .getByLabel("대분류", { exact: true })
      .selectOption(categories[1].id);
    await expect(page.getByLabel("중분류", { exact: true })).toHaveValue("");
    await expect(
      page
        .getByLabel("중분류", { exact: true })
        .getByRole("option", { name: "인터넷" }),
    ).toHaveCount(0);
    await page.getByLabel("대분류", { exact: true }).selectOption(categoryId);
    await page
      .getByLabel("중분류", { exact: true })
      .selectOption(subcategoryId);
    await page.getByLabel("반복주기").selectOption("1");
    await page.getByLabel("첫 결제일").fill("2026-10-15");
    await page
      .getByLabel("결제수단", { exact: true })
      .selectOption("55555555-5555-4555-8555-555555555555");
    await page.getByLabel("금액 (원)").fill("35000");
    await expect(page.getByLabel("금액 (원)")).toHaveValue("35,000");
    await page.getByRole("button", { name: "고정비 저장" }).click();
    await expect(page).toHaveURL(/\/fixed-costs\/[a-f0-9-]+$/);
    await expect(page.getByText("35,000")).toBeVisible();
    await expect(page.getByText("자동 기록", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    const firstOptions = page.waitForResponse(
      "**/backend/recurring-expenses/options",
    );
    await page.getByRole("button", { name: "정보 수정" }).click();
    await firstOptions;
    await expect(
      page.getByRole("dialog", { name: "처리 중", exact: true }),
    ).toBeHidden();
    await expect(page.getByLabel("메모 (선택)")).toBeEnabled();
    await page.getByLabel("반복주기").selectOption("1");
    await page.getByLabel("첫 결제일").fill("2026-11-15");
    await page.getByRole("button", { name: "정보 저장" }).click();
    await expect(
      page.getByRole("button", { name: "정보 수정", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("2026-11-15", { exact: true })).toBeVisible();
    const nextOptions = page.waitForResponse(
      "**/backend/recurring-expenses/options",
    );
    await page.getByRole("button", { name: "정보 수정" }).click();
    await nextOptions;
    await expect(
      page.getByRole("dialog", { name: "처리 중", exact: true }),
    ).toBeHidden();
    await page.getByLabel("메모 (선택)").fill("통신비");
    await page.getByLabel("금액 (원)").fill("42000");
    await expect(page.getByLabel("금액 (원)")).toHaveValue("42,000");
    await page.getByLabel("반복주기").selectOption("2");
    await page.getByLabel("반복 결제일").fill("30");
    await page.getByLabel("첫 결제일").fill("2026-11-30");
    await page.getByRole("button", { name: "정보 저장" }).click();
    await expect(
      page.getByRole("button", { name: "정보 수정", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("42,000")).toBeVisible();
    await page
      .getByRole("link", { name: "← 고정비 목록", exact: true })
      .click();
    await expect(page.getByRole("link", { name: /인터넷/ })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await page.getByRole("link", { name: /인터넷/ }).click();
    await expect(page).toHaveURL(/\/fixed-costs\/[a-f0-9-]+$/);
    await page.reload();
    await expect(page.getByText("2026-11-30", { exact: true })).toBeVisible();
    if (width === 360)
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  });
}

for (const width of [360, 1280]) {
  test(`스와이프 삭제 확인과 상세 휴지통을 사용할 수 있다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const expense: FixedExpense = {
      id: "3c6b40a1-3fea-454b-93ac-a7a9917cff10",
      name: "인터넷",
      expectedAmount: 35000,
      intervalMonths: 1,
      recurringDayOfMonth: 15,
      firstDueDate: "2026-11-15",
      firstChargeId: "4bdcc856-5663-4052-9a82-f38886058c57",
      firstChargeStatus: "PENDING",
      payer: null,
      paymentMethodId: null,
      paymentMethodName: null,
    };
    let deleted = false;
    let deleteRequests = 0;
    await page.route("**/backend/recurring-expenses", (route) =>
      route.fulfill({ json: deleted ? [] : [expense] }),
    );
    await page.route(
      `**/backend/recurring-expenses/${expense.id}`,
      async (route) => {
        expect(route.request().method()).toBe("DELETE");
        deleteRequests++;
        if (deleteRequests === 1)
          await route.fulfill({
            status: 500,
            json: { message: "internal error" },
          });
        else {
          deleted = true;
          await route.fulfill({ status: 204 });
        }
      },
    );
    await page.goto("/fixed-costs");
    const card = page.getByRole("link", { name: /인터넷/ });
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    if (!box) throw new Error("고정비 카드가 표시되지 않습니다.");
    await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 120, box.y + box.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(page).toHaveURL(/\/fixed-costs$/);
    await page.getByRole("button", { name: "인터넷 삭제" }).click();
    const dialog = page.getByRole("dialog", { name: "고정비를 삭제할까요?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
    expect(deleteRequests).toBe(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "인터넷 삭제" }),
    ).toBeFocused();
    await page.getByRole("button", { name: "인터넷 삭제" }).click();
    await dialog.getByRole("button", { name: "취소" }).click();
    await card.click(); // 닫힌 팝업 뒤 열린 스와이프를 접는다.
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/fixed-costs/${expense.id}$`));
    await page.getByRole("button", { name: "고정비 삭제" }).click();
    await dialog.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(deleted).toBe(false);
    await dialog.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page).toHaveURL(/\/fixed-costs$/);
    await expect(page.getByText("아직 등록한 고정비가 없어요")).toBeVisible();
    expect(deleteRequests).toBe(2);
  });
}

test("목록에서 키보드로 삭제를 확인하면 항목과 건수가 갱신된다", async ({
  page,
}) => {
  const expense: FixedExpense = {
    id: "3c6b40a1-3fea-454b-93ac-a7a9917cff10",
    name: "인터넷",
    expectedAmount: 35000,
    intervalMonths: null,
    recurringDayOfMonth: null,
    firstDueDate: null,
    firstChargeId: null,
    firstChargeStatus: null,
    payer: null,
    paymentMethodId: null,
    paymentMethodName: null,
  };
  let deleted = false;
  await page.route("**/backend/recurring-expenses", (route) =>
    route.fulfill({ json: deleted ? [] : [expense] }),
  );
  await page.route(
    `**/backend/recurring-expenses/${expense.id}`,
    async (route) => {
      deleted = true;
      await route.fulfill({ status: 204 });
    },
  );
  await page.goto("/fixed-costs");
  const card = page.getByRole("link", { name: /인터넷/ });
  await card.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: "인터넷 삭제" })).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "고정비를 삭제할까요?" });
  await expect(dialog.getByRole("button", { name: "취소" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "삭제", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("고정비를 삭제했습니다.")).toBeVisible();
  await expect(page.getByText("0개")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "등록한 고정비" }),
  ).toBeFocused();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("아직 등록한 고정비가 없어요")).toBeVisible();
});

test.describe("터치 스와이프", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 360, height: 800 },
  });
  test("세로 터치는 삭제를 열지 않고 왼쪽 스와이프 후 확인해야 삭제한다", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Chromium 터치 입력 검사");
    const expense: FixedExpense = {
      id: "3c6b40a1-3fea-454b-93ac-a7a9917cff10",
      name: "인터넷",
      expectedAmount: 35000,
      intervalMonths: null,
      recurringDayOfMonth: null,
      firstDueDate: null,
      firstChargeId: null,
      firstChargeStatus: null,
      payer: null,
      paymentMethodId: null,
      paymentMethodName: null,
    };
    let deleted = false;
    await page.route("**/backend/recurring-expenses", (route) =>
      route.fulfill({ json: deleted ? [] : [expense] }),
    );
    await page.route(
      `**/backend/recurring-expenses/${expense.id}`,
      async (route) => {
        deleted = true;
        await route.fulfill({ status: 204 });
      },
    );
    await page.goto(`/fixed-costs/${expense.id}`);
    await page.getByRole("button", { name: "고정비 삭제" }).tap();
    await expect(
      page.getByRole("dialog", { name: "고정비를 삭제할까요?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "취소", exact: true }).tap();
    await page.getByRole("link", { name: "← 고정비 목록", exact: true }).tap();
    const card = page.getByRole("link", { name: /인터넷/ });
    await expect(card).toBeVisible();
    const session = await context.newCDPSession(page);
    async function swipe(dx: number, dy: number) {
      const box = await card.boundingBox();
      if (!box) throw new Error("고정비 카드가 표시되지 않습니다.");
      const x = box.x + box.width - 30;
      const y = box.y + box.height / 2;
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let step = 1; step <= 8; step++)
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + (dx * step) / 8, y: y + (dy * step) / 8 }],
        });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await swipe(0, -70);
    await expect(page.getByRole("button", { name: "인터넷 삭제" })).toHaveCount(
      0,
    );
    await swipe(-100, 0);
    const deleteButton = page.getByRole("button", { name: "인터넷 삭제" });
    await expect(deleteButton).toBeVisible();
    await expect(page).toHaveURL(/\/fixed-costs$/);
    await deleteButton.tap();
    const dialog = page.getByRole("dialog", { name: "고정비를 삭제할까요?" });
    await expect(dialog).toBeVisible();
    expect(deleted).toBe(false);
    await dialog.getByRole("button", { name: "취소", exact: true }).tap();
    await expect(deleteButton).toBeFocused();
    expect(deleted).toBe(false);
    await deleteButton.tap();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "삭제", exact: true }).tap();
    await expect(page.getByText("고정비를 삭제했습니다.")).toBeVisible();
    await expect(card).toHaveCount(0);
  });
});
