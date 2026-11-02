import { expect, test } from "./fixtures";

test("로그인 필요 시 복귀 경로를 유지하고 오류를 안내한다", async ({
  page,
}) => {
  await page.route("**/backend/auth/session", (route) =>
    route.fulfill({ status: 401, json: { message: "로그인이 필요합니다." } }),
  );
  await page.route("**/backend/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "이메일 또는 비밀번호를 확인해 주세요." },
    }),
  );
  await page.goto("/fixed-costs");
  await expect(page).toHaveURL(/auth\/login\?returnTo=/);
  await page.getByLabel("이메일", { exact: true }).fill("test@example.test");
  await page.getByLabel("비밀번호", { exact: true }).fill("BadFixture82!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "이메일 또는 비밀번호",
  );
  await expect(page.getByLabel("이메일", { exact: true })).toHaveValue(
    "test@example.test",
  );
  await expect(page.getByRole("navigation", { name: "하단 메뉴" })).toHaveCount(
    0,
  );
});
for (const width of [360, 1280]) {
  test(`가입 확인 메일 요청과 입력 검증 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/backend/auth/register", async (route) => {
      const input = route.request().postDataJSON();
      expect(input.name).toBe("살림이");
      expect(input).not.toHaveProperty("password");
      await route.fulfill({
        json: {
          requestId: "11111111-1111-4111-8111-111111111111",
          expiresInSeconds: 600,
        },
      });
    });
    await page.goto("/auth/register");
    await page.getByLabel("표시 이름").fill("살림이");
    await page.getByLabel("이메일", { exact: true }).fill("test@example.test");
    await expect(page.getByLabel("비밀번호", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "가입 인증번호 받기" }).click();
    await expect(page.getByRole("status")).toContainText("메일함을 확인");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/auth-register-${width}.png`,
      fullPage: true,
    });
  });
}
for (const width of [360, 1280]) {
  test(`메일 링크에서 비밀번호를 정한 뒤 가입 완료 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    let calls = 0;
    await page.route("**/backend/auth/verify", async (route) => {
      calls++;
      expect(route.request().postDataJSON().token).toBe("fixture-token");
      expect(route.request().postDataJSON().password).toBe("OwnerFixture82!");
      await route.fulfill({
        json: { message: "이메일 확인이 완료되었습니다." },
      });
    });
    await page.goto("/auth/verify#token=fixture-token");
    await expect(page).toHaveURL(/\/auth\/verify$/);
    expect(calls).toBe(0);
    await page.getByLabel("비밀번호", { exact: true }).fill("OwnerFixture82!");
    await page.getByLabel("비밀번호 확인").fill("Different82!");
    await page
      .getByRole("button", { name: "비밀번호 설정하고 가입 완료" })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "비밀번호 확인이 일치하지 않습니다.",
    );
    expect(calls).toBe(0);
    await page.getByLabel("비밀번호 확인").fill("OwnerFixture82!");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../../.local/signup-verify-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "비밀번호 설정하고 가입 완료" })
      .click();
    await expect(page.getByRole("status")).toContainText("가입이 완료");
    expect(calls).toBe(1);
    await expect(page.getByText(/홈 화면에 추가한 한달살림/)).toBeVisible();
    await expect(page.getByLabel("비밀번호", { exact: true })).toHaveCount(0);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
test("초기 공간이 없는 계정은 개인 공간을 만든 뒤 서비스를 이용한다", async ({
  page,
}) => {
  await page.route("**/backend/auth/session", (route) =>
    route.fulfill({
      json: { userId: "test-user", name: "살림이", hasSpace: false },
    }),
  );
  await page.route("**/backend/auth/space", (route) =>
    route.fulfill({
      json: { userId: "test-user", name: "살림이", hasSpace: true },
    }),
  );
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "첫 공간을 만들어 주세요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "내 살림 시작하기" }).click();
  await expect(
    page.getByRole("heading", { name: "설정", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "내 계정" }).click();
  await expect(page.getByText("살림이님으로 로그인 중이에요.")).toBeVisible();
});
