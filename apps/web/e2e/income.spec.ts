import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import type { Income } from "../src/features/income/api";

const selfId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const partnerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
async function mockOwners(page: Page) {
  await page.route("**/backend/incomes/members", (route) =>
    route.fulfill({
      json: {
        currentUserId: selfId,
        members: [
          { id: selfId, name: "내 이름" },
          { id: partnerId, name: "함께하는 사람" },
        ],
      },
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-15T03:00:00Z"));
});

test("월별 수입 등록·조회·수정·삭제와 키보드 접근", async ({ page }) => {
  let items: Income[] = [];
  await page.route("**/backend/incomes**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && /\/incomes\/[^/]+$/.test(url.pathname)) {
      const item = items.find((i) => url.pathname.endsWith(i.id));
      await route.fulfill(item ? { json: item } : { status: 404 });
    } else if (request.method() === "GET") {
      const month = url.searchParams.get("month");
      const visible = items.filter((i) => i.month === month);
      await route.fulfill({
        json: {
          month,
          items: visible,
          totalAmount: visible
            .reduce((sum, i) => sum + BigInt(i.amount), BigInt(0))
            .toString(),
        },
      });
    } else if (request.method() === "DELETE") {
      items = items.filter((i) => !url.pathname.endsWith(i.id));
      await route.fulfill({ status: 204 });
    } else {
      const input = request.postDataJSON();
      const item = {
        ...input,
        ownerName:
          input.ownerUserId === partnerId ? "함께하는 사람" : "내 이름",
        id: items[0]?.id ?? "11111111-1111-4111-8111-111111111111",
        version: request.method() === "PUT" ? 1 : 0,
      };
      items = [item];
      await route.fulfill({ json: item });
    }
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await mockOwners(page);
  await page.goto("/income");
  await expect(
    page.getByRole("group", { name: "조회 월", exact: true }),
  ).toContainText("2026년 10월");
  await expect(page.getByText("아직 등록한 수입이 없어요")).toBeVisible();
  await page.getByRole("link", { name: "수입 등록", exact: true }).click();
  await expect(page).toHaveURL(/\/income\/new\?month=/);
  await expect(
    page.getByRole("group", { name: "조회 월", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("월 수입 합계")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "수입 소유자", exact: true }),
  ).toHaveValue(selfId);
  await page.getByLabel("수입명", { exact: true }).fill("월급");
  await page.getByLabel("금액 (원)").fill("3000000");
  await expect(page.getByLabel("금액 (원)")).toHaveValue("3,000,000");
  await expect(
    page.getByRole("group", { name: "해당 월", exact: true }),
  ).toContainText("2026년 10월");
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/income-form-mobile.png",
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
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByLabel("월 수입 합계")).toContainText("3,000,000원");
  await page.reload();
  await expect(
    page.getByRole("group", { name: "조회 월", exact: true }),
  ).toContainText("2026년 10월");
  await page.getByRole("button", { name: /내 이름.*3,000,000원/ }).click();
  await expect(
    page.getByRole("heading", { name: "월급", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "월급 수정", exact: true }).click();
  await expect(page).toHaveURL(/\/income\/[a-f0-9-]+\/edit/);
  await page.reload();
  await expect(page.getByLabel("수입명", { exact: true })).toHaveValue("월급");
  await expect(page.getByLabel("금액 (원)")).toHaveValue("3,000,000");
  await expect(
    page.getByRole("combobox", { name: "수입 소유자", exact: true }),
  ).toHaveValue(selfId);
  await page
    .getByRole("combobox", { name: "수입 소유자", exact: true })
    .selectOption(partnerId);
  await page.getByLabel("수입명", { exact: true }).fill("성과급");
  await page.getByLabel("금액 (원)").fill("3500000");
  await expect(page.getByLabel("금액 (원)")).toHaveValue("3,500,000");
  await page
    .getByRole("group", { name: "해당 월", exact: true })
    .getByRole("button", { name: "다음 달", exact: true })
    .click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "조회 월", exact: true }),
  ).toContainText("2026년 11월");
  await expect(page.getByLabel("월 수입 합계")).toContainText("3,500,000원");
  await page
    .getByRole("button", { name: /함께하는 사람.*3,500,000원/ })
    .click();
  await expect(
    page.getByText("소유자 함께하는 사람", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/income-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("group", { name: "조회 월", exact: true })
    .getByRole("button", { name: "이전 달", exact: true })
    .click();
  await expect(page.getByText("아직 등록한 수입이 없어요")).toBeVisible();
  await page
    .getByRole("group", { name: "조회 월", exact: true })
    .getByRole("button", { name: "다음 달", exact: true })
    .click();
  await page.getByRole("button", { name: "성과급 삭제", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "취소", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "성과급 삭제", exact: true }),
  ).toBeFocused();
  for (const width of [360, 1280, 180]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  await page.getByRole("button", { name: "성과급 삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page.getByLabel("월 수입 합계")).toContainText("0원");
  await expect(page.getByText("아직 등록한 수입이 없어요")).toBeVisible();
});

test("수입 조회 실패 시 재시도", async ({ page }) => {
  let attempt = 0;
  await page.route("**/backend/incomes**", (route) =>
    route.fulfill(
      attempt++ === 0
        ? { status: 503 }
        : {
            json: {
              month: new URL(route.request().url()).searchParams.get("month"),
              totalAmount: "0",
              items: [],
            },
          },
    ),
  );
  await mockOwners(page);
  await page.goto("/income");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText("아직 등록한 수입이 없어요")).toBeVisible();
});

test("달력 없이 연도를 넘겨 이동하고 선택한 월로 등록을 시작한다", async ({
  page,
}) => {
  await page.route("**/backend/incomes**", (route) =>
    route.fulfill({
      json: {
        month: new URL(route.request().url()).searchParams.get("month"),
        totalAmount: "0",
        items: [],
      },
    }),
  );
  await mockOwners(page);
  await page.goto("/income");
  const query = page.getByRole("group", { name: "조회 월", exact: true });
  const next = query.getByRole("button", { name: "다음 달", exact: true });
  const januaryLoaded = page.waitForResponse((response) =>
    response.url().includes("/backend/incomes?month=2027-01"),
  );
  for (let i = 0; i < 3; i++) await next.click();
  await januaryLoaded;
  await expect(query).toContainText("2027년 1월");
  await expect(
    page.getByRole("dialog", { name: "처리 중", exact: true }),
  ).toBeHidden();
  await next.press("Shift+Tab");
  await expect(
    query.getByRole("button", { name: "이전 달", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(query).toContainText("2026년 12월");
  await page.getByRole("link", { name: "수입 등록", exact: true }).click();
  const entry = page.getByRole("group", { name: "해당 월", exact: true });
  await expect(entry).toContainText("2026년 12월");
  await page.getByLabel("수입명", { exact: true }).fill("월급");
  await entry.getByRole("button", { name: "다음 달", exact: true }).click();
  await expect(entry).toContainText("2027년 1월");
  await expect(page.getByLabel("수입명", { exact: true })).toHaveValue("월급");
  await entry.getByRole("button", { name: "이번 달", exact: true }).click();
  await expect(entry).toContainText("2026년 10월");
  await expect(query).toHaveCount(0);
  await expect(page.locator('input[type="month"]')).toHaveCount(0);
  await page.getByRole("link", { name: "취소", exact: true }).click();
  await expect(query).toContainText("2026년 12월");
  await expect(page.getByLabel("수입명", { exact: true })).toHaveCount(0);
});

test("저장 실패 시 입력을 유지하고 같은 요청 키로 재시도한다", async ({
  page,
}) => {
  const keys: string[] = [];
  let saved: Income | undefined;
  await page.route("**/backend/incomes**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      keys.push(request.headers()["idempotency-key"]);
      if (keys.length === 1) {
        await route.fulfill({ status: 503 });
        return;
      }
      saved = {
        ...request.postDataJSON(),
        ownerName:
          request.postDataJSON().ownerUserId === partnerId
            ? "함께하는 사람"
            : "내 이름",
        id: "11111111-1111-4111-8111-111111111111",
        version: 0,
      };
      await route.fulfill({ json: saved });
    } else {
      await route.fulfill({
        json: {
          month: new URL(request.url()).searchParams.get("month"),
          totalAmount: saved ? String(saved.amount) : "0",
          items: saved ? [saved] : [],
        },
      });
    }
  });
  await mockOwners(page);
  await page.goto("/income");
  await page.getByRole("link", { name: "수입 등록", exact: true }).click();
  await page.getByLabel("수입명", { exact: true }).fill("부수입");
  await page.getByLabel("금액 (원)").fill("150000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("수입명", { exact: true })).toHaveValue(
    "부수입",
  );
  await expect(page.getByLabel("금액 (원)")).toHaveValue("150,000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByLabel("월 수입 합계")).toContainText("150,000원");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test("수정 내역 조회 실패는 입력 폼 대신 재시도를 제공한다", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  let attempts = 0;
  await page.route(`**/backend/incomes/${id}`, (route) =>
    route.fulfill(
      attempts++ === 0
        ? { status: 503 }
        : {
            json: {
              id,
              name: "월급",
              amount: 3000000,
              month: "2026-09",
              version: 2,
              ownerUserId: selfId,
              ownerName: "내 이름",
            },
          },
    ),
  );
  await mockOwners(page);
  await page.goto(`/income/${id}/edit?month=2026-09`);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("수입명", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByLabel("수입명", { exact: true })).toHaveValue("월급");
  await expect(
    page.getByRole("group", { name: "해당 월", exact: true }),
  ).toContainText("2026년 9월");
});
