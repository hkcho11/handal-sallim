import { expect, test } from "./fixtures";

for (const width of [360, 1280]) {
  test(`요청 중 조작과 Escape를 막고 실패 후 입력을 보존한다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requests = 0;
    await page.route("**/backend/auth/register", async (route) => {
      requests++;
      await wait;
      await route.fulfill({
        status: 503,
        json: { message: "잠시 후 다시 시도해 주세요." },
      });
    });
    await page.goto("/auth/register");
    await page.getByLabel("표시 이름").fill("테스트");
    const email = page.getByLabel("이메일", { exact: true });
    await email.fill("fixture@example.test");
    const submit = page.getByRole("button", {
      name: "가입 인증번호 받기",
      exact: true,
    });
    const box = await submit.boundingBox();
    if (!box) throw new Error("등록 버튼이 없습니다.");
    await submit.click();
    const loading = page.getByRole("dialog", { name: "처리 중", exact: true });
    try {
      await expect(loading).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(loading).toBeVisible();
      await email.evaluate((element) => element.focus());
      await expect(email).not.toBeFocused();
      await expect.poll(() => requests).toBe(1);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(loading).toBeVisible();
      expect(requests).toBe(1);
      await page.screenshot({
        path: `../../.local/blocking-loading-${width}.png`,
      });
    } finally {
      release();
    }
    await expect(loading).toBeHidden();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "잠시 후 다시 시도해 주세요.",
    );
    await expect(email).toHaveValue("fixture@example.test");
    await email.fill("retry@example.test");
    await expect(email).toHaveValue("retry@example.test");
  });
}

test("이동한 화면의 데이터 수신이 끝날 때까지 하단 메뉴를 막는다", async ({
  page,
}) => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/backend/incomes?*", async (route) => {
    await wait;
    await route.fulfill({
      json: {
        month: new URL(route.request().url()).searchParams.get("month"),
        totalAmount: 0,
        items: [],
      },
    });
  });
  await page.goto("/settings");
  await page
    .getByRole("navigation", { name: "하단 메뉴" })
    .getByRole("link", { name: "수입", exact: true })
    .click();
  const loading = page.getByRole("dialog", { name: "처리 중", exact: true });
  try {
    await expect(loading).toBeVisible();
    const settings = page
      .getByRole("navigation", { name: "하단 메뉴" })
      .getByRole("link", { name: "설정", exact: true });
    const box = await settings.boundingBox();
    if (!box) throw new Error("설정 메뉴가 없습니다.");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(/\/income$/);
  } finally {
    release();
  }
  await expect(loading).toBeHidden();
  await page
    .getByRole("navigation", { name: "하단 메뉴" })
    .getByRole("link", { name: "설정", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings$/);
});
