import { expect, test } from "./fixtures";
import type { PaymentMethod } from "../src/features/payment-methods/api";

const memberId = "11111111-1111-4111-8111-111111111111";
test("결제수단 추가·수정·보관과 설정 분류 관리", async ({ page }) => {
  const methods: PaymentMethod[] = [];
  const subcategories: { id: string; categoryId: string; name: string }[] = [];
  const categories = [
    { id: "22222222-2222-4222-8222-222222222222", name: "통신" },
  ];
  await page.route("**/backend/recurring-expenses**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/options"))
      await route.fulfill({
        json: {
          payers: [],
          paymentMethods: methods.filter((item) => item.status === "ACTIVE"),
          categories,
          subcategories,
        },
      });
    else if (url.pathname.endsWith("/categories")) {
      const name = route.request().postDataJSON().name;
      const item = { id: "33333333-3333-4333-8333-333333333333", name };
      categories.push(item);
      await route.fulfill({ json: item });
    } else if (url.pathname.endsWith("/subcategories")) {
      const input = route.request().postDataJSON();
      const item = { id: "44444444-4444-4444-8444-444444444444", ...input };
      subcategories.push(item);
      await route.fulfill({ json: item });
    } else await route.fulfill({ json: [] });
  });
  await page.route("**/backend/payment-methods**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/members")) {
      await route.fulfill({ json: [{ id: memberId, name: "나" }] });
      return;
    }
    if (request.method() === "GET") {
      await route.fulfill({ json: methods });
      return;
    }
    if (url.pathname.endsWith("/archive")) {
      methods[0] = {
        ...methods[0],
        status: "ARCHIVED",
        version: methods[0].version + 1,
      };
      await route.fulfill({ status: 204 });
      return;
    }
    const input = request.postDataJSON();
    const saved: PaymentMethod = {
      ...input,
      id: methods[0]?.id ?? request.headers()["idempotency-key"],
      status: "ACTIVE",
      version: methods[0] ? methods[0].version + 1 : 0,
    };
    methods[0] = saved;
    await route.fulfill({ json: saved });
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/payment-methods");
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(5);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "설정", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("등록한 결제수단이 없어요")).toBeVisible();
  await page.getByRole("link", { name: "결제수단 추가" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "이름" })).toBeFocused();
  await page.getByRole("textbox", { name: "이름" }).fill("생활비 카드");
  await page.getByRole("combobox", { name: "명의자" }).selectOption(memberId);
  await page.getByRole("button", { name: "파랑", exact: true }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "생활비 카드" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "정보 수정" }).click();
  await page.getByRole("textbox", { name: "이름" }).fill("공용 카드");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("heading", { name: "공용 카드" })).toBeVisible();
  await page.getByRole("button", { name: "보관", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "취소", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "보관", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "보관", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "보관", exact: true })
    .click();
  await expect(page.getByText("보관됨", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "결제수단 목록" }).click();
  await page.getByRole("button", { name: "보관함" }).click();
  await expect(page.getByRole("link", { name: /공용 카드/ })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "설정" })
    .click();
  await page.getByRole("link", { name: /분류 설정/ }).click();
  await expect(
    page.getByRole("link", { name: "설정", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "+ 추가", exact: true }).click();
  await page
    .getByRole("textbox", { name: "새 상위 분류 이름" })
    .fill("반려동물");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "추가", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "반려동물", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "반려동물 분류를 사용할 수 있어요.",
  );
  await page.getByRole("button", { name: "+ 추가", exact: true }).click();
  await page.getByRole("button", { name: "세부 분류", exact: true }).click();
  await page.getByLabel("상위 분류 선택").selectOption(categories[1].id);
  await page.getByLabel("새 세부 분류 이름").fill("동물병원 정기권");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "추가", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "동물병원 정기권 세부 분류를 사용할 수 있어요.",
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "지출", exact: true })
    .click();
  await page.getByRole("link", { name: "고정비 추가", exact: true }).click();
  await page
    .getByLabel("대분류", { exact: true })
    .selectOption(categories[1].id);
  await expect(
    page
      .getByLabel("중분류", { exact: true })
      .getByRole("option", { name: "동물병원 정기권" }),
  ).toHaveCount(1);
  await page.goto("/settings/categories");
  for (const width of [360, 1280, 180]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("결제수단 조회 실패 후 재시도", async ({ page }) => {
  let attempt = 0;
  await page.route("**/backend/payment-methods", (route) =>
    route.fulfill(attempt++ === 0 ? { status: 503 } : { json: [] }),
  );
  await page.goto("/payment-methods");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText("등록한 결제수단이 없어요")).toBeVisible();
});
