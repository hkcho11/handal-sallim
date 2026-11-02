import { test, expect } from "./fixtures";

const requestId = "11111111-1111-4111-8111-111111111111";
const replacementId = "22222222-2222-4222-8222-222222222222";
const grant = "g".repeat(43);

for (const width of [360, 1280]) {
  test(`원래 화면에서 인증번호 확인·새로고침·가입 완료 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/backend/auth/register", (route) =>
      route.fulfill({ json: { requestId, expiresInSeconds: 600 } }),
    );
    let checks = 0;
    await page.route("**/backend/auth/verify-code", async (route) => {
      checks++;
      expect(route.request().postDataJSON()).toEqual({
        requestId,
        code: "00001234",
        reset: false,
      });
      await route.fulfill({ json: { token: grant } });
    });
    await page.route("**/backend/auth/verify", async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        token: grant,
        password: "OwnerFixture82!",
      });
      await route.fulfill({ json: { message: "가입이 완료되었습니다." } });
    });
    await page.goto("/auth/register");
    await page.getByLabel("표시 이름").fill("살림이");
    await page
      .getByLabel("이메일", { exact: true })
      .fill("fixture@example.test");
    await page
      .getByRole("button", { name: "가입 인증번호 받기", exact: true })
      .click();
    await expect(page.getByLabel("인증번호", { exact: true })).toBeFocused();
    await expect(page.getByLabel("비밀번호", { exact: true })).toHaveCount(0);
    await page.goto("/auth/login");
    await page
      .getByRole("link", { name: "진행 중인 가입 인증 계속하기" })
      .click();
    await page.reload();
    const input = page.getByLabel("인증번호", { exact: true });
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("autocomplete", "one-time-code");
    await input.fill("letters");
    await expect(input).toHaveValue("");
    await input.fill("0000 1234");
    await expect(input).toHaveValue("00001234");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../../.local/email-code-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "인증번호 확인", exact: true })
      .click();
    await expect(page.getByLabel("비밀번호", { exact: true })).toBeFocused();
    expect(checks).toBe(1);
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...sessionStorage, ...localStorage }),
    );
    expect(stored).not.toContain(grant);
    expect(stored).not.toContain("00001234");
    expect(page.url()).not.toContain("token");
    await page.getByLabel("비밀번호", { exact: true }).fill("OwnerFixture82!");
    await page.getByLabel("비밀번호 확인").fill("OwnerFixture82!");
    await page
      .getByRole("button", { name: "비밀번호 설정하고 가입 완료" })
      .click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      "가입이 완료",
    );
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("handal.auth.pending.signup"),
      ),
    ).toBeNull();
    await expect(page.getByLabel("비밀번호", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/홈 화면 아이콘을 다시 열어/)).toHaveCount(0);
  });
}

test("재설정 번호 오류와 재발급·비밀번호 단계 새로고침을 안내한다", async ({
  page,
}) => {
  let issuance = 0;
  await page.route("**/backend/auth/forgot", (route) =>
    route.fulfill({
      json: {
        requestId: issuance++ === 0 ? requestId : replacementId,
        expiresInSeconds: 600,
      },
    }),
  );
  let checks = 0;
  await page.route("**/backend/auth/verify-code", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.reset).toBe(true);
    if (checks++ === 0)
      await route.fulfill({
        status: 400,
        json: { message: "인증번호가 올바르지 않거나 만료되었습니다." },
      });
    else {
      expect(body.requestId).toBe(replacementId);
      await route.fulfill({ json: { token: grant } });
    }
  });
  await page.goto("/auth/forgot");
  await page.getByLabel("이메일", { exact: true }).fill("fixture@example.test");
  await page.getByRole("button", { name: "재설정 인증번호 받기" }).click();
  await page.getByLabel("인증번호", { exact: true }).fill("12345678");
  await page
    .getByRole("button", { name: "인증번호 확인", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("만료");
  await expect(page.getByLabel("새 비밀번호", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "인증번호 다시 받기", exact: true })
    .click();
  await expect(page.getByLabel("인증번호", { exact: true })).toHaveValue("");
  await page.getByLabel("인증번호", { exact: true }).fill("87654321");
  await page
    .getByRole("button", { name: "인증번호 확인", exact: true })
    .click();
  await expect(page.getByLabel("새 비밀번호", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "인증번호를 다시 받아",
  );
  await expect(page.getByLabel("새 비밀번호", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "이메일 변경", exact: true }).click();
  await expect(page.getByLabel("이메일", { exact: true })).toHaveValue(
    "fixture@example.test",
  );
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("handal.auth.pending.reset"),
    ),
  ).toBeNull();
});
