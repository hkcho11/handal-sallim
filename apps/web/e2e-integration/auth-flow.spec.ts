import {
  test,
  expect,
  type BrowserContext,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const password = "FlowFixture82!River";
const mailbox = process.env.AUTH_FLOW_MAILPIT_ORIGIN!;
interface Message {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}
function email() {
  return `flow-${randomUUID()}@example.test`;
}
async function latestCode(
  request: APIRequestContext,
  address: string,
  reset = false,
  previous?: string,
) {
  let token: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(`${mailbox}/api/v1/messages`);
      const data = (await response.json()) as { messages: Message[] };
      const message = data.messages.find(
        (value) =>
          value.To.some((to) => to.Address === address) &&
          value.Subject.includes(reset ? "비밀번호" : "이메일 확인"),
      );
      if (!message) return false;
      const content = await request.get(
        `${mailbox}/api/v1/message/${message.ID}`,
      );
      const body = (await content.json()) as { Text: string };
      expect(body.Text).not.toMatch(/https?:\/\//);
      const candidate = body.Text.match(/인증번호: ([0-9]{6})/)?.[1];
      if (!candidate || candidate === previous) return false;
      token = candidate;
      return true;
    })
    .toBe(true);
  return token!;
}
async function register(page: Page, address: string, name = "새 사용자") {
  await page.goto("/auth/register");
  await page.getByLabel("표시 이름").fill(name);
  await page.getByLabel("이메일", { exact: true }).fill(address);
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "가입 인증번호 받기" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "메일함을 확인",
  );
}
async function fillSignupPassword(page: Page, pass = password) {
  await page.getByLabel("비밀번호", { exact: true }).fill(pass);
  await page.getByLabel("비밀번호 확인").fill(pass);
  await page
    .getByRole("button", { name: "비밀번호 설정하고 가입 완료" })
    .click();
}
async function confirmSignup(page: Page, code: string, pass = password) {
  await page.goto("/auth/register");
  await page.getByLabel("인증번호", { exact: true }).fill(code);
  await page
    .getByRole("button", { name: "인증번호 확인", exact: true })
    .click();
  await fillSignupPassword(page, pass);
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "가입이 완료",
  );
}
async function login(page: Page, address: string, pass = password) {
  await page.goto("/auth/login");
  await page.getByLabel("이메일", { exact: true }).fill(address);
  await page.getByLabel("비밀번호", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}
async function createSpace(page: Page) {
  await expect(
    page.getByRole("heading", { name: "첫 공간을 만들어 주세요" }),
  ).toBeVisible();
  await page.getByLabel("공간 이름").fill("검증용 공간");
  await page.getByRole("button", { name: "내 살림 시작하기" }).click();
  await expect(
    page.getByRole("navigation", { name: "하단 메뉴" }),
  ).toBeVisible();
}
async function action(
  context: BrowserContext,
  name: string,
  body: Record<string, string | boolean>,
) {
  const csrf = await context.request.get("/backend/auth/csrf");
  const { token } = (await csrf.json()) as { token: string };
  return context.request.post(`/backend/auth/${name}`, {
    data: body,
    headers: { "X-XSRF-TOKEN": token },
  });
}

test("두 신규 사용자가 실제 메일 인증·로그인·첫 공간 생성 후 서로의 데이터에 접근하지 못한다", async ({
  browser,
  page,
  context,
  request,
}) => {
  const first = email(),
    second = email();
  await page.goto("/");
  await expect(page).toHaveURL(/auth\/login/);
  await register(page, first);
  await login(page, first);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "가입 이메일 확인",
  );
  await confirmSignup(page, await latestCode(request, first));
  await login(page, first);
  await createSpace(page);
  const csrf = await context.request.get("/backend/auth/csrf");
  const { token } = (await csrf.json()) as { token: string };
  const saved = await context.request.post("/backend/incomes", {
    data: { name: "첫 사용자 기록", amount: 50000, month: "2026-10" },
    headers: { "X-XSRF-TOKEN": token, "Idempotency-Key": randomUUID() },
  });
  expect(saved.status()).toBe(201);
  const { id } = (await saved.json()) as { id: string };
  const other = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.AUTH_FLOW_WEB_PORT}`,
  });
  try {
    const otherPage = await other.newPage();
    await register(otherPage, second);
    await confirmSignup(otherPage, await latestCode(request, second));
    await login(otherPage, second);
    await createSpace(otherPage);
    const income = await other.request.get("/backend/incomes?month=2026-10");
    expect(income.status()).toBe(200);
    expect(((await income.json()) as { items: unknown[] }).items).toHaveLength(
      0,
    );
    expect((await other.request.get(`/backend/incomes/${id}`)).status()).toBe(
      404,
    );
    await page.goto("/auth/account");
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(/auth\/login/);
    await login(page, second);
    await expect(
      page.getByRole("navigation", { name: "하단 메뉴" }),
    ).toBeVisible();
    expect(
      (
        (await (
          await context.request.get("/backend/incomes?month=2026-10")
        ).json()) as { items: unknown[] }
      ).items,
    ).toHaveLength(0);
  } finally {
    await other.close();
  }
});

test("공개 재가입으로 비밀번호를 설정할 수 없고 이메일 소유자가 정한 비밀번호만 유효하다", async ({
  page,
  context,
  request,
}) => {
  const address = email();
  await register(page, address);
  const original = await latestCode(request, address);
  const replacement = "RetryFixture97!River";
  const injection = await action(context, "register", {
    email: address,
    name: "재가입 사용자",
    password: "InjectedFixture73!River",
  });
  expect(injection.status()).toBe(200);
  const updated = await latestCode(request, address, false, original);
  expect(updated === original).toBe(false);
  await page.getByLabel("인증번호", { exact: true }).fill(updated);
  await page
    .getByRole("button", { name: "인증번호 확인", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "인증번호가 올바르지",
  );
  await page
    .getByRole("button", { name: "인증번호 다시 받기", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "인증번호를 보냈습니다",
  );
  await confirmSignup(
    page,
    await latestCode(request, address, false, updated),
    replacement,
  );
  await login(page, address, "InjectedFixture73!River");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "비밀번호를 확인",
  );
  await login(page, address, replacement);
  await expect(
    page.getByRole("heading", { name: "첫 공간을 만들어 주세요" }),
  ).toBeVisible();
});

test("실제 SMTP 중단 시 가입 오류를 안내하고 복구 뒤 같은 입력으로 다시 가입할 수 있다", async ({
  page,
  request,
}) => {
  const container = process.env.AUTH_FLOW_MAILPIT_CONTAINER!;
  if (!/^[0-9a-f]{64}$/.test(container))
    throw new Error("Disposable Mailpit identity required");
  const address = email();
  execFileSync("docker", ["stop", container], { stdio: "ignore" });
  try {
    await page.goto("/auth/register");
    await page.getByLabel("표시 이름").fill("메일 재시도");
    await page.getByLabel("이메일", { exact: true }).fill(address);
    await page.getByRole("button", { name: "가입 인증번호 받기" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "메일을 보내지 못했습니다",
    );
    await expect(page.getByLabel("이메일", { exact: true })).toHaveValue(
      address,
    );
    await expect(page.getByLabel("비밀번호", { exact: true })).toHaveCount(0);
  } finally {
    execFileSync("docker", ["start", container], { stdio: "ignore" });
  }
  await expect
    .poll(async () => {
      try {
        return (await request.get(`${mailbox}/api/v1/messages`)).ok();
      } catch {
        return false;
      }
    })
    .toBe(true);
  await page.getByRole("button", { name: "가입 인증번호 받기" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "메일함을 확인",
  );
  await confirmSignup(page, await latestCode(request, address));
  await login(page, address);
  await createSpace(page);
});

test("재발송 전 번호·사용한 번호를 거부하고 앱 안에서 비밀번호를 재설정한다", async ({
  page,
  request,
  context,
}) => {
  const address = email();
  await register(page, address);
  const original = await latestCode(request, address);
  const resendResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/backend/auth/resend") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "인증번호 다시 받기", exact: true })
    .click();
  expect((await resendResponse).status()).toBe(200);
  const updated = await latestCode(request, address, false, original);
  expect(updated === original).toBe(false);
  await page.getByLabel("인증번호", { exact: true }).fill(original);
  await page
    .getByRole("button", { name: "인증번호 확인", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "인증번호가 올바르지",
  );
  const requestId = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("handal.auth.pending.signup")!)
        .requestId as string,
  );
  await confirmSignup(page, updated);
  expect(
    (
      await action(context, "verify-code", {
        requestId,
        code: updated,
        reset: false,
      })
    ).status(),
  ).toBe(400);
  await login(page, address);
  await createSpace(page);
  await page.goto("/auth/forgot");
  await page.getByLabel("이메일", { exact: true }).fill(address);
  await page.getByRole("button", { name: "재설정 인증번호 받기" }).click();
  await expect(page.getByLabel("인증번호", { exact: true })).toBeVisible();
  const reset = await latestCode(request, address, true);
  const replacement = "ResetFixture91!River";
  await page.getByLabel("인증번호", { exact: true }).fill(reset);
  await page
    .getByRole("button", { name: "인증번호 확인", exact: true })
    .click();
  await page.getByLabel("새 비밀번호", { exact: true }).fill(replacement);
  await page.getByLabel("비밀번호 확인").fill(replacement);
  await page.getByRole("button", { name: "비밀번호 변경" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "비밀번호를 변경",
  );
  expect((await context.request.get("/backend/auth/session")).status()).toBe(
    401,
  );
  await login(page, address);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "비밀번호를 확인",
  );
  await login(page, address, replacement);
  await expect(
    page.getByRole("navigation", { name: "하단 메뉴" }),
  ).toBeVisible();
});

test("회원코드 요청·수락 후 새 기록을 공유하고 과거 기록은 본인만 보존한다", async ({
  browser,
  page,
  context,
  request,
}) => {
  const first = email(),
    second = email();
  await register(page, first, "요청받는 사용자");
  await confirmSignup(page, await latestCode(request, first));
  await login(page, first);
  await createSpace(page);
  const csrf = await context.request.get("/backend/auth/csrf");
  const { token } = (await csrf.json()) as { token: string };
  const old = await context.request.post("/backend/incomes", {
    data: { name: "연결 전 비공개 수입", amount: 123000, month: "2026-10" },
    headers: { "X-XSRF-TOKEN": token, "Idempotency-Key": randomUUID() },
  });
  expect(old.status()).toBe(201);
  await page.goto("/settings/sharing");
  await expect(
    page.getByRole("heading", { name: "내 회원코드" }),
  ).toBeVisible();
  const firstCode = await page.getByLabel("내 회원코드").textContent();
  expect(Boolean(firstCode)).toBe(true);
  const other = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.AUTH_FLOW_WEB_PORT}`,
  });
  try {
    const otherPage = await other.newPage();
    await register(otherPage, second, "요청하는 사용자");
    await confirmSignup(otherPage, await latestCode(request, second));
    await login(otherPage, second);
    await expect(
      otherPage.getByRole("heading", { name: "첫 공간을 만들어 주세요" }),
    ).toBeVisible();
    await otherPage
      .getByRole("link", { name: "회원코드로 다른 사람과 함께 쓰기" })
      .click();
    await otherPage.getByLabel("상대 회원코드").fill(firstCode!.toLowerCase());
    await otherPage.getByLabel("상대 회원코드").press("Enter");
    await expect(
      otherPage.getByRole("heading", { name: "요청받는 사용자님이 맞나요?" }),
    ).toBeVisible();
    await otherPage
      .getByRole("button", { name: "이 사람에게 함께 쓰기 요청" })
      .click();
    await expect(otherPage.getByRole("status")).toContainText(
      "연결 요청을 보냈어요",
    );
    expect(
      (
        (await (await context.request.get("/backend/sharing")).json()) as {
          connection: unknown;
        }
      ).connection,
    ).toBeNull();
    await page.getByRole("button", { name: "요청 상태 새로고침" }).click();
    await page.getByRole("button", { name: "요청 확인", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "연결 수락 확인" }),
    ).toContainText("이전 기록은 각자에게만 보존");
    await page
      .getByRole("button", { name: "이 사람과 함께 쓰기 시작" })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("navigation", { name: "하단 메뉴" }),
    ).toBeVisible();
    await otherPage.getByRole("button", { name: "요청 상태 새로고침" }).click();
    await expect(
      otherPage.getByRole("heading", {
        name: "요청받는 사용자님과 함께 쓰는 중",
      }),
    ).toBeVisible();
    await otherPage.getByRole("button", { name: "공유 가계부 열기" }).click();
    await expect(
      otherPage.getByRole("navigation", { name: "하단 메뉴" }),
    ).toBeVisible();
    const empty = await context.request.get("/backend/incomes?month=2026-10");
    expect(((await empty.json()) as { items: unknown[] }).items).toHaveLength(
      0,
    );
    const sharedCsrf = await other.request.get("/backend/auth/csrf");
    const sharedToken = ((await sharedCsrf.json()) as { token: string }).token;
    expect(
      (
        await other.request.post("/backend/incomes", {
          data: { name: "새 공유 수입", amount: 456000, month: "2025-01" },
          headers: {
            "X-XSRF-TOKEN": sharedToken,
            "Idempotency-Key": randomUUID(),
          },
        })
      ).status(),
    ).toBe(201);
    const sharedIncome = await context.request.get(
      "/backend/incomes?month=2025-01",
    );
    expect(
      ((await sharedIncome.json()) as { items: { name: string }[] }).items[0]
        .name,
    ).toBe("새 공유 수입");
    // Verify every currently exposed financial screen using the real paired accounts.
    const addResource = async (path: string, data: Record<string, unknown>) => {
      const csrfResponse = await other.request.get("/backend/auth/csrf");
      const csrfToken = ((await csrfResponse.json()) as { token: string })
        .token;
      const response = await other.request.post(path, {
        data,
        headers: { "X-XSRF-TOKEN": csrfToken, "Idempotency-Key": randomUUID() },
      });
      expect(response.ok()).toBe(true);
      return (await response.json()) as { id: string };
    };
    await addResource("/backend/savings", {
      name: "화면 공유 저축",
      type: "DEPOSIT",
      depositAmount: 10000,
      currentAmount: 43000,
    });
    const category = await addResource(
      "/backend/recurring-expenses/categories",
      { name: "화면 공유 분류" },
    );
    const subcategory = await addResource(
      "/backend/recurring-expenses/subcategories",
      { categoryId: category.id, name: "화면 공유 비용" },
    );
    const card = await addResource("/backend/payment-methods", {
      name: "화면 공유 카드",
      type: "CARD",
    });
    const month = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    const sharedExpense = await addResource("/backend/recurring-expenses", {
      expectedAmount: 25000,
      intervalMonths: 1,
      recurringDayOfMonth: 1,
      firstDueDate: `${month}-01`,
      payer: "PARTNER",
      paymentMethodId: card.id,
      categoryId: category.id,
      subcategoryId: subcategory.id,
    });
    for (const financialPage of [page, otherPage]) {
      for (const [path, name] of [
        ["/income?month=2025-01", "새 공유 수입"],
        ["/savings", "화면 공유 저축"],
        ["/fixed-costs", "화면 공유 비용"],
        ["/payment-methods", "화면 공유 카드"],
        ["/settings/categories", "화면 공유 분류"],
      ]) {
        await financialPage.goto(path);
        if (path.startsWith("/income?"))
          await financialPage
            .getByRole("button", { name: /456,000원/ })
            .click();
        const sharedEntry =
          path === "/settings/categories"
            ? financialPage.getByRole("heading", { name, exact: true })
            : financialPage.getByRole("main").getByText(name, { exact: true });
        await expect(sharedEntry).toBeVisible();
      }
      for (const [path, label] of [
        ["/income/new", "수입 소유자"],
        ["/savings/new", "저축 소유자"],
      ]) {
        await financialPage.goto(path);
        const owners = financialPage.getByLabel(label);
        await expect(owners.getByRole("option")).toHaveCount(2);
        await expect(
          owners.getByRole("option", { name: /요청받는 사용자/ }),
        ).toHaveCount(1);
        await expect(
          owners.getByRole("option", { name: /요청하는 사용자/ }),
        ).toHaveCount(1);
      }
      await financialPage.goto("/");
      await expect(
        financialPage.getByRole("region", { name: "상위 분류별 지출 통계" }),
      ).toBeVisible();
      await expect(
        financialPage.getByRole("main").getByRole("alert"),
      ).toHaveCount(0);
    }
    await page.goto(`/fixed-costs/${sharedExpense.id}`);
    await page
      .getByRole("button", { name: `${month} 결제 내역 입력`, exact: true })
      .click();
    const completion = page.getByRole("form", { name: "결제 내역 수정" });
    await expect(completion.getByLabel("결제 금액")).toHaveValue("");
    await expect(completion.getByLabel("실제 결제일")).toHaveValue(
      `${month}-01`,
    );
    await completion.getByLabel("결제 금액").fill("35000");
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(completion).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `../../.local/payment-complete-${width}.png`,
        fullPage: true,
      });
      if (width === 360) {
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "200%";
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await completion
          .getByRole("button", { name: "결제 내역 저장", exact: true })
          .scrollIntoViewIfNeeded();
        await expect(
          completion.getByRole("button", {
            name: "결제 내역 저장",
            exact: true,
          }),
        ).toBeVisible();
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "";
        });
      }
    }
    await completion
      .getByRole("button", { name: "결제 내역 저장", exact: true })
      .click();
    await expect(completion).not.toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "회차별 결제 내역" })
        .getByRole("listitem")
        .filter({ hasText: "35,000원" }),
    ).toHaveCount(1);
    const sharedCycles = await context.request.get(
      `/backend/recurring-expenses/${sharedExpense.id}/charges`,
    );
    const cycles = (await sharedCycles.json()) as {
      id: string;
      status: string;
      expectedAmount: number | null;
      actualAmount: number | null;
      dueDate: string;
    }[];
    expect(cycles.filter((c) => c.status === "COMPLETED")).toHaveLength(1);
    expect(cycles.find((c) => c.status === "COMPLETED")!.actualAmount).toBe(
      35000,
    );
    expect(
      cycles
        .filter((c) => c.status === "PENDING")
        .every((c) => c.expectedAmount === null),
    ).toBe(true);
    for (const financialPage of [page, otherPage]) {
      await financialPage.goto("/");
      const major = financialPage.getByRole("region", {
        name: "상위 분류별 지출 통계",
      });
      await expect(
        major.getByText("35,000원", { exact: true }).first(),
      ).toBeVisible();
      await expect(
        major.getByRole("button", { name: "예상", exact: true }),
      ).toHaveCount(0);
    }
    const actualEntries = await context.request.get(
      `/backend/dashboard?month=${month}`,
    );
    const entries = (await actualEntries.json()) as {
      entries: { id: string; date: string; amount: number }[];
    };
    expect(entries.entries).toHaveLength(1);
    expect(entries.entries[0].amount).toBe(35000);
    const destination = await addResource(
      "/backend/recurring-expenses/categories",
      { name: "공유 재분류 대상" },
    );
    await otherPage.goto("/settings/categories");
    await otherPage
      .getByRole("button", { name: "화면 공유 분류", exact: true })
      .click();
    await otherPage
      .getByLabel("상위 분류 이름", { exact: true })
      .fill("화면 공유 분류 수정");
    await otherPage
      .getByRole("dialog")
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(otherPage.getByRole("dialog")).toHaveCount(0);
    await otherPage
      .getByRole("button", {
        name: "화면 공유 비용",
        exact: true,
      })
      .click();
    await otherPage
      .getByLabel("소속 상위 분류", { exact: true })
      .selectOption(destination.id);
    await otherPage
      .getByRole("dialog")
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(otherPage.getByRole("dialog")).toHaveCount(0);
    for (const viewer of [context, other]) {
      const response = await viewer.request.get(
        `/backend/dashboard?month=${month}`,
      );
      const result = (await response.json()) as {
        entries: {
          id: string;
          date: string;
          amount: number;
          category: string;
        }[];
        charges: { categoryId: string; actualAmount: number | null }[];
      };
      expect(
        result.entries.map(({ id, date, amount }) => ({ id, date, amount })),
      ).toEqual(
        entries.entries.map(({ id, date, amount }) => ({ id, date, amount })),
      );
      expect(result.entries[0].category).toBe("공유 재분류 대상");
      expect(
        result.charges
          .filter((item) => item.actualAmount === 35000)
          .every((item) => item.categoryId === destination.id),
      ).toBe(true);
    }
    await page.goto("/settings/sharing/history");
    await expect(
      page.getByText("연결 전 비공개 수입", { exact: true }),
    ).toBeVisible();
    await otherPage.goto("/settings/sharing/history");
    await expect(
      otherPage.getByText("보존된 과거 기록이 없어요."),
    ).toBeVisible();
    await expect(
      otherPage.getByText("연결 전 비공개 수입", { exact: true }),
    ).toHaveCount(0);
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/settings/sharing");
      await expect(
        page.getByRole("heading", { name: "요청하는 사용자님과 함께 쓰는 중" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `../../.local/sharing-${width}.png`,
        fullPage: true,
      });
      if (width === 360) {
        await page.evaluate(() => {
          document.body.style.zoom = "2";
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await page.evaluate(() => {
          document.body.style.zoom = "";
        });
      }
    }
    // Disconnection keeps sharing until the second member explicitly agrees.
    await page.goto("/settings/sharing");
    await page
      .getByRole("button", { name: "연결 해제 요청", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("region", { name: "연결 해제 확인", exact: true }),
    ).toContainText("읽기 전용");
    await page
      .getByRole("button", { name: "상대에게 해제 요청 보내기" })
      .click();
    await expect(
      page.getByText("연결 해제를 요청했어요. 상대의 수락을 기다리고 있어요.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "해제 요청 취소", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "연결 해제 요청", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "연결 해제 요청", exact: true })
      .click();
    await page
      .getByRole("button", { name: "상대에게 해제 요청 보내기" })
      .click();
    await expect(
      page.getByRole("button", { name: "해제 요청 취소", exact: true }),
    ).toBeVisible();
    await otherPage.goto("/settings/sharing");
    await otherPage
      .getByRole("button", { name: "해제 거절", exact: true })
      .click();
    await expect(
      otherPage.getByRole("button", { name: "연결 해제 요청", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "요청 상태 새로고침" }).click();
    await page
      .getByRole("button", { name: "연결 해제 요청", exact: true })
      .click();
    await page
      .getByRole("button", { name: "상대에게 해제 요청 보내기" })
      .click();
    await expect(
      page.getByRole("button", { name: "해제 요청 취소", exact: true }),
    ).toBeVisible();
    await otherPage.getByRole("button", { name: "요청 상태 새로고침" }).click();
    await otherPage
      .getByRole("button", { name: "해제 요청 확인", exact: true })
      .click();
    await expect(
      otherPage.getByRole("region", { name: "연결 해제 확인", exact: true }),
    ).toContainText("각자의 새 개인 가계부");
    // Reviewing a request does not itself break the shared connection.
    const stillSharing = await other.request.get("/backend/sharing");
    expect(
      ((await stillSharing.json()) as { connection: unknown }).connection,
    ).not.toBeNull();
    for (const width of [360, 1280]) {
      await otherPage.setViewportSize({ width, height: 844 });
      await otherPage.screenshot({
        path: `../../.local/disconnect-${width}.png`,
        fullPage: true,
      });
      expect(
        await otherPage.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (width === 360) {
        await otherPage.evaluate(() => {
          document.body.style.zoom = "2";
        });
        expect(
          await otherPage.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await otherPage.evaluate(() => {
          document.body.style.zoom = "";
        });
      }
    }
    await otherPage
      .getByRole("button", { name: "동의하고 연결 해제", exact: true })
      .click();
    await expect(
      otherPage.getByRole("heading", { name: "계정 연결하기" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "요청 상태 새로고침" }).click();
    await expect(
      page.getByRole("heading", { name: "계정 연결하기" }),
    ).toBeVisible();
    for (const personalPage of [page, otherPage]) {
      await personalPage.goto("/income?month=2025-01");
      await expect(
        personalPage.getByText("새 공유 수입", { exact: true }),
      ).toHaveCount(0);
      await personalPage.goto("/savings");
      await expect(
        personalPage.getByText("화면 공유 저축", { exact: true }),
      ).toHaveCount(0);
      await personalPage.goto("/fixed-costs");
      await expect(
        personalPage.getByText("화면 공유 비용", { exact: true }),
      ).toHaveCount(0);
      await personalPage.goto("/income/new");
      await expect(
        personalPage.getByLabel("수입 소유자").getByRole("option"),
      ).toHaveCount(1);
      await personalPage.goto("/settings/sharing/history");
      await expect(
        personalPage.getByText("새 공유 수입", { exact: true }),
      ).toBeVisible();
      await expect(
        personalPage.getByText("화면 공유 저축", { exact: true }),
      ).toBeVisible();
      await expect(
        personalPage.getByText("함께 쓴 기록 · 당시 두 멤버에게 보존", {
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect(
      otherPage.getByText("연결 전 비공개 수입", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await other.close();
  }
});
