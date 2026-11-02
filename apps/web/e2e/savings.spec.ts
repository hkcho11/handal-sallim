import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import type { Savings } from "../src/features/savings/api";

const selfId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const partnerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
async function mockOwners(page: Page) {
  await page.route("**/backend/savings/members", (route) =>
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

test("기존 적금과 예금 등록·상세·수정·삭제 및 합계", async ({ page }) => {
  let items: Savings[] = [];
  const ids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];
  await page.route("**/backend/savings**", async (route) => {
    const request = route.request();
    const id = new URL(request.url()).pathname.split("/").at(-1);
    if (request.method() === "GET") {
      if (id === "savings")
        await route.fulfill({
          json: {
            totalCurrentAmount: items
              .reduce((sum, i) => sum + BigInt(i.currentAmount), BigInt(0))
              .toString(),
            monthlyDepositAmount: items
              .filter((i) => i.type === "INSTALLMENT")
              .reduce((sum, i) => sum + BigInt(i.depositAmount), BigInt(0))
              .toString(),
            items,
          },
        });
      else {
        const item = items.find((i) => i.id === id);
        await route.fulfill(item ? { json: item } : { status: 404 });
      }
    } else if (request.method() === "DELETE") {
      items = items.filter((i) => i.id !== id);
      await route.fulfill({ status: 204 });
    } else {
      const input = request.postDataJSON();
      const saved: Savings = {
        ...input,
        ownerName:
          input.ownerUserId === partnerId ? "함께하는 사람" : "내 이름",
        id: request.method() === "POST" ? ids[items.length] : id,
        version: request.method() === "POST" ? 0 : input.version + 1,
      };
      items = [...items.filter((i) => i.id !== saved.id), saved];
      await route.fulfill({ json: saved });
    }
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await mockOwners(page);
  await page.goto("/savings");
  await expect(page.getByText("아직 등록한 저축이 없어요")).toBeVisible();
  await page.getByRole("link", { name: "저축 등록", exact: true }).click();
  await expect(page).toHaveURL(/\/savings\/new$/);
  await expect(page.getByLabel("저축 합계")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "저축 소유자", exact: true }),
  ).toHaveValue(selfId);
  await page.getByLabel("저축명", { exact: true }).fill("기존 여행 적금");
  await page.getByLabel("월 납입액 (원)").fill("300000");
  await page.getByLabel("현재 금액 (원)").fill("2400000");
  await expect(page.getByLabel("현재 금액 (원)")).toHaveValue("2,400,000");
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/savings-form-mobile.png",
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
  await expect(page).toHaveURL(new RegExp(`/savings/${ids[0]}$`));
  await expect(page.getByLabel("현재 저축 금액")).toContainText("2,400,000원");
  await page.reload();
  await page.getByRole("link", { name: "정보 수정", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/savings/${ids[0]}/edit$`));
  await page.reload();
  await expect(page.getByLabel("현재 금액 (원)")).toHaveValue("2,400,000");
  await expect(
    page.getByRole("combobox", { name: "저축 소유자", exact: true }),
  ).toHaveValue(selfId);
  await page
    .getByRole("combobox", { name: "저축 소유자", exact: true })
    .selectOption(partnerId);
  await page.getByLabel("월 납입액 (원)").fill("400000");
  await expect(page.getByLabel("현재 금액 (원)")).toHaveValue("2,400,000");
  await page.getByLabel("현재 금액 (원)").fill("2700000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByLabel("현재 저축 금액")).toContainText("2,700,000원");
  await expect(
    page.getByText("소유자 함께하는 사람", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "← 저축 목록", exact: true }).click();
  await page.getByRole("link", { name: "저축 등록", exact: true }).click();
  await page.getByLabel("저축 종류").selectOption("DEPOSIT");
  await page.getByLabel("저축명", { exact: true }).fill("목돈 예금");
  await page.getByLabel("예치 금액 (원)").fill("5000000");
  await page.getByLabel("현재 금액 (원)").fill("5050000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/savings/${ids[1]}$`));
  await page.getByRole("link", { name: "← 저축 목록", exact: true }).click();
  await expect(page.getByLabel("저축 합계")).toContainText("7,750,000원");
  await expect(page.getByLabel("저축 합계")).toContainText(
    "적금 월 납입액 400,000원",
  );
  await page.screenshot({
    path: "test-results/savings-list-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: /기존 여행 적금/ }).click();
  await page.getByRole("button", { name: "저축 삭제", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "취소", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "저축 삭제", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "저축 삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page.getByLabel("저축 합계")).toContainText("5,050,000원");
  await expect(page.getByLabel("저축 합계")).toContainText(
    "적금 월 납입액 0원",
  );
});

test("조회 실패와 존재하지 않는 수정 내역을 안전하게 처리한다", async ({
  page,
}) => {
  let attempt = 0;
  await page.route("**/backend/savings**", (route) =>
    route.fulfill(
      attempt++ === 0
        ? { status: 503 }
        : {
            json: {
              totalCurrentAmount: "0",
              monthlyDepositAmount: "0",
              items: [],
            },
          },
    ),
  );
  await mockOwners(page);
  await page.goto("/savings");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByText("아직 등록한 저축이 없어요")).toBeVisible();
  await page.route(
    "**/backend/savings/11111111-1111-4111-8111-111111111111",
    (route) => route.fulfill({ status: 404 }),
  );
  await mockOwners(page);
  await page.goto("/savings/11111111-1111-4111-8111-111111111111/edit");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "저축을 찾을 수 없습니다",
  );
  await expect(page.getByLabel("저축명", { exact: true })).toHaveCount(0);
});

test("현재 금액 0원 신규 저축과 저장 실패 후 같은 키 재시도", async ({
  page,
}) => {
  const keys: string[] = [];
  const id = "11111111-1111-4111-8111-111111111111";
  let saved: Savings;
  await page.route("**/backend/savings**", async (route) => {
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
        id,
        version: 0,
      };
      await route.fulfill({ json: saved });
    } else await route.fulfill({ json: saved });
  });
  await mockOwners(page);
  await page.goto("/savings/new");
  await page.getByLabel("저축명", { exact: true }).fill("새 적금");
  await page.getByLabel("월 납입액 (원)").fill("100000");
  await page.getByLabel("현재 금액 (원)").fill("0");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("저축명", { exact: true })).toHaveValue(
    "새 적금",
  );
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByLabel("현재 저축 금액")).toContainText("0원");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});
