import { expect, test, type Page } from "@playwright/test";
import type {
  PersonalExpense,
  PersonalExpenseInput,
} from "../src/features/personal-expenses/api";

const expenseId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const methodId = "33333333-3333-4333-8333-333333333333";

async function mockApi(page: Page, sharedSpace = false) {
  const state = {
    saved: null as PersonalExpense | null,
    failSave: false,
    failDelete: false,
    failList: false,
    keys: [] as string[],
    deleteCount: 0,
  };
  await page.route("**/backend/recurring-expenses", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/backend/personal-expenses**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith("/options")) {
      await route.fulfill({
        json: {
          sharedSpace,
          categories: [{ id: categoryId, name: "식비" }],
          paymentMethods: [{ id: methodId, name: "현금" }],
        },
      });
    } else if (method === "GET" && url.searchParams.has("month")) {
      if (state.failList) {
        state.failList = false;
        await route.fulfill({ status: 503 });
        return;
      }
      const month = url.searchParams.get("month");
      const items = state.saved?.occurredOn.startsWith(month!)
        ? [state.saved]
        : [];
      await route.fulfill({
        json: {
          month,
          totalAmount: items
            .reduce((sum, item) => sum + BigInt(item.amount), BigInt(0))
            .toString(),
          items,
        },
      });
    } else if (method === "GET") {
      await route.fulfill(
        state.saved ? { json: state.saved } : { status: 404 },
      );
    } else if (method === "DELETE") {
      state.deleteCount++;
      if (state.failDelete) {
        state.failDelete = false;
        await route.fulfill({ status: 503 });
        return;
      }
      state.saved = null;
      await route.fulfill({ status: 204 });
    } else {
      const input = route.request().postDataJSON() as PersonalExpenseInput;
      if (method === "POST")
        state.keys.push(route.request().headers()["idempotency-key"]);
      if (state.failSave) {
        state.failSave = false;
        await route.fulfill({ status: 503 });
        return;
      }
      state.saved = {
        id: expenseId,
        ...input,
        categoryName: "식비",
        paymentMethodName: "현금",
        version: method === "PUT" ? (state.saved?.version ?? 0) + 1 : 0,
      };
      await route.fulfill({
        status: method === "POST" ? 201 : 200,
        json: state.saved,
      });
    }
  });
  return state;
}

async function fillExpense(page: Page) {
  await page.getByLabel("지출명", { exact: true }).fill("테스트 점심");
  await page.getByLabel("금액 (원)", { exact: true }).fill("12300");
  await page.getByLabel("날짜", { exact: true }).fill("2026-10-14");
  await page.getByLabel("카테고리", { exact: true }).selectOption(categoryId);
  await page.getByLabel("결제수단", { exact: true }).selectOption(methodId);
  await page.getByLabel("메모 (선택)", { exact: true }).fill("테스트 메모");
}

test("빈 목록과 존재하지 않는 상세는 오류 경고 대신 내역 없음으로 표시한다", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/personal-expenses?month=2026-10");
  const main = page.getByRole("main");
  await expect(
    main.getByText("등록한 개인 지출이 없어요", { exact: true }),
  ).toBeVisible();
  await expect(
    main
      .getByRole("region", { name: "월간 개인 지출", exact: true })
      .getByText("0원", { exact: true }),
  ).toBeVisible();
  await expect(main.getByRole("alert")).toHaveCount(0);
  await expect(
    main.getByRole("button", { name: "다시 시도", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/personal-expenses/${expenseId}`);
  await expect(
    main.getByText("등록된 지출 내역이 없어요", { exact: true }),
  ).toBeVisible();
  await expect(main.getByRole("alert")).toHaveCount(0);
  await expect(
    main.getByRole("button", { name: "다시 시도", exact: true }),
  ).toHaveCount(0);
  await expect(
    main.getByRole("link", { name: "← 개인 지출 목록", exact: true }),
  ).toBeVisible();
});

for (const width of [360, 1280]) {
  test(`개인 지출 등록·조회·수정·영구 삭제 (${width}px)`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 800 });
    await page.clock.install({ time: new Date("2026-12-31T15:30:00Z") });
    const state = await mockApi(page);
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "하단 메뉴" });
    await navigation
      .getByRole("link", { name: "개인 지출", exact: true })
      .click();
    await expect(
      navigation.getByRole("link", { name: "개인 지출", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: "2027년 1월" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "이전 달" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "2026년 12월" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "다음 달" }).click();
    await page.getByRole("button", { name: "다음 달" }).click();
    await expect(
      page.getByRole("heading", { name: "2027년 2월" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "이번 달", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "2027년 1월" }),
    ).toBeVisible();
    await expect(page.getByText("등록한 개인 지출이 없어요")).toBeVisible();
    await page.getByRole("link", { name: "+ 지출 추가", exact: true }).click();
    await expect(page.getByLabel("지출명", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "지출 저장", exact: true }).click();
    await expect(page.getByLabel("지출명", { exact: true })).toBeFocused();
    await fillExpense(page);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await page.getByRole("button", { name: "지출 저장", exact: true }).click();
    await expect(page).toHaveURL(`/personal-expenses/${expenseId}`);
    await expect(page.getByText("12,300원", { exact: true })).toBeVisible();
    await expect(page.getByText("테스트 메모", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("12,300원", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "정보 수정", exact: true }).click();
    await page.getByLabel("지출명", { exact: true }).fill("테스트 저녁");
    await page.getByLabel("금액 (원)", { exact: true }).fill("20000");
    await page.getByLabel("날짜", { exact: true }).fill("2026-11-01");
    await page.getByRole("button", { name: "수정 저장", exact: true }).click();
    await expect(page.getByText("지출을 수정했습니다.")).toBeVisible();
    await page
      .getByRole("link", { name: "← 개인 지출 목록", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "2026년 11월" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "월간 개인 지출", exact: true })
        .getByText("20,000원"),
    ).toBeVisible();
    await page.getByRole("button", { name: "이전 달" }).click();
    await expect(
      page
        .getByRole("region", { name: "월간 개인 지출", exact: true })
        .getByText("0원"),
    ).toBeVisible();
    await page.getByRole("button", { name: "다음 달" }).click();
    await page.getByRole("link", { name: /테스트 저녁/ }).click();
    await page.getByRole("button", { name: "지출 삭제", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "취소", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(state.deleteCount).toBe(0);
    await expect(
      page.getByRole("button", { name: "지출 삭제", exact: true }),
    ).toBeFocused();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/personal-expenses-detail-${width}.png`,
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "100%";
    });
    await page.getByRole("button", { name: "지출 삭제", exact: true }).click();
    await expect(dialog.getByText(/서버에서도 완전히 삭제/)).toBeVisible();
    await dialog.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page).toHaveURL("/personal-expenses?month=2026-11");
    await expect(page.getByText("등록한 개인 지출이 없어요")).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "월간 개인 지출", exact: true })
        .getByText("0원"),
    ).toBeVisible();
    expect(state.saved).toBeNull();
    expect(errors).toEqual([]);
  });
}

test("함께 관리에서 개인 등록 확인과 실패 후 재시도를 지원한다", async ({
  page,
}) => {
  const state = await mockApi(page, true);
  state.failList = true;
  await page.goto("/personal-expenses?month=2026-10");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByText("등록한 개인 지출이 없어요")).toBeVisible();
  await page.getByRole("link", { name: "+ 지출 추가", exact: true }).click();
  await fillExpense(page);
  await page.getByRole("button", { name: "지출 저장", exact: true }).click();
  await expect(page.getByRole("checkbox")).toBeFocused();
  expect(state.keys).toHaveLength(0);
  await page.getByRole("checkbox").check();
  state.failSave = true;
  await page.getByRole("button", { name: "지출 저장", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("지출명", { exact: true })).toHaveValue(
    "테스트 점심",
  );
  await page.getByRole("button", { name: "지출 저장", exact: true }).click();
  await expect(page.getByText("12,300원", { exact: true })).toBeVisible();
  expect(state.keys).toHaveLength(2);
  expect(state.keys[0]).toBe(state.keys[1]);
  state.failDelete = true;
  await page.getByRole("button", { name: "지출 삭제", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(state.saved).not.toBeNull();
  await dialog.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText("등록한 개인 지출이 없어요")).toBeVisible();
});
