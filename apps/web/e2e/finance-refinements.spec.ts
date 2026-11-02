import { test, expect } from "./fixtures";
import { FIXED_COST_FIXTURE } from "../src/test/fixedCostFixture";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const x = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const y = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const z = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

for (const width of [360, 1280]) {
  test(`세부 분류는 가로 배치하고 검색에서 소속과 수정 결과를 확인한다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/backend/recurring-expenses/options", (route) =>
      route.fulfill({
        json: {
          categories: [
            { id: a, name: "주거" },
            { id: b, name: "공과금" },
            { id: "33333333-3333-4333-8333-333333333333", name: "기타" },
          ],
          subcategories: [
            { id: x, categoryId: a, name: "월세" },
            { id: y, categoryId: a, name: "주택 대출이자" },
            {
              id: z,
              categoryId: b,
              name: "관리비와 함께 납부하는 공동 전기 사용료",
            },
          ],
          payers: [],
          paymentMethods: [],
        },
      }),
    );
    await page.goto("/settings/categories");
    const first = page.locator("[data-sort-category]").first();
    await expect(first).toBeVisible();
    await expect(
      page.getByLabel("새 상위 분류 이름", { exact: true }),
    ).toHaveCount(0);
    async function checkLayout() {
      const rows = await page
        .locator("[data-sort-sub]")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              height: rect.height,
              hasConnector:
                getComputedStyle(element, "::before").content !== "none",
              overflow: element.scrollWidth > element.clientWidth,
            };
          }),
        );
      for (const row of rows) {
        expect(row.height).toBeGreaterThanOrEqual(44);
        expect(row.hasConnector).toBe(false);
        expect(row.overflow).toBe(false);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await checkLayout();
    const rent = await page
      .getByRole("button", { name: "월세", exact: true })
      .boundingBox();
    const loan = await page
      .getByRole("button", { name: "주택 대출이자", exact: true })
      .boundingBox();
    expect(rent!.y).toBe(loan!.y);
    expect(loan!.x).toBeGreaterThan(rent!.x);
    await page.screenshot({
      path: `../../.local/classification-compact-${width}.png`,
    });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await checkLayout();
    await page.getByRole("searchbox", { name: "분류 검색" }).fill("  대출 ");
    await expect(page.locator("[data-sort-category]")).toHaveCount(1);
    await expect(page.locator("[data-sort-sub]")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "주택 대출이자", exact: true }),
    ).toContainText("주거 ›");
    await page.route(
      `**/backend/recurring-expenses/subcategories/${y}`,
      (route) => route.fulfill({ status: 204 }),
    );
    const result = page.getByRole("button", {
      name: "주택 대출이자",
      exact: true,
    });
    await result.focus();
    await page.keyboard.press("ArrowUp");
    await result.click();
    await page
      .getByLabel("세부 분류 이름", { exact: true })
      .fill("임차 보증금 이자");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByText("일치하는 분류가 없어요.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "분류 검색" }),
    ).toBeFocused();
    await page.getByRole("button", { name: "분류 검색 지우기" }).click();
    await expect(page.locator("[data-sort-category]")).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: "임차 보증금 이자", exact: true }),
    ).toBeVisible();
    await page.getByRole("searchbox", { name: "분류 검색" }).fill("공과금");
    await expect(
      page.getByRole("button", {
        name: "관리비와 함께 납부하는 공동 전기 사용료",
        exact: true,
      }),
    ).toBeVisible();
  });
}

for (const width of [360, 1280]) {
  test(`소유자별 수입을 펼치고 다른 소유자로 전환 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/backend/incomes?**", (route) =>
      route.fulfill({
        json: {
          month: new URL(route.request().url()).searchParams.get("month"),
          totalAmount: "3600000",
          items: [
            {
              id: a,
              name: "내 월급",
              amount: 3000000,
              ownerUserId: x,
              ownerName: "나",
              month: "2026-10",
              version: 0,
            },
            {
              id: b,
              name: "상대 수당",
              amount: 600000,
              ownerUserId: y,
              ownerName: "상대",
              month: "2026-10",
              version: 0,
            },
          ],
        },
      }),
    );
    await page.goto("/income?month=2026-10");
    const mine = page.getByRole("button", { name: /나.*3,000,000원/ });
    const other = page.getByRole("button", { name: /상대.*600,000원/ });
    await expect(mine).toHaveAttribute("aria-expanded", "false");
    await expect(mine.locator("[data-disclosure-chevron]")).toHaveCount(1);
    await mine.click();
    await expect(
      page.getByRole("heading", { name: "내 월급", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "상대 수당", exact: true }),
    ).toHaveCount(0);
    await other.click();
    await expect(mine).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("heading", { name: "상대 수당", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("월 수입 합계")).toContainText("3,600,000원");
    await page.screenshot({
      path: `../../.local/income-disclosure-${width}.png`,
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
    await page.screenshot({
      path: `../../.local/income-owners-${width}.png`,
      fullPage: true,
    });
  });

  test(`분류 이름 수정·순서 저장·다른 상위로 드래그 이동 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    let categories = [
      { id: a, name: "주거" },
      { id: b, name: "공과금" },
    ];
    let subs = [
      { id: x, categoryId: a, name: "월세" },
      { id: y, categoryId: a, name: "대출" },
      { id: z, categoryId: b, name: "전기" },
    ];
    await page.route("**/backend/recurring-expenses/options", (route) =>
      route.fulfill({
        json: {
          categories,
          subcategories: subs,
          payers: [],
          paymentMethods: [],
        },
      }),
    );
    await page.route(
      "**/backend/recurring-expenses/categories/**",
      async (route) => {
        const body = route.request().postDataJSON();
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() === "PATCH") {
          expect(body.expectedName).toBe("주거");
          categories = categories.map((item) =>
            item.id === a ? { ...item, name: body.name } : item,
          );
          await route.fulfill({
            json: categories.find((item) => item.id === a),
          });
        } else if (path.endsWith("/subcategories/order")) {
          expect(body.previousIds).toEqual([x, y]);
          subs = [
            ...subs.filter((item) => item.categoryId !== a),
            ...body.ids.map((id: string) =>
              subs.find((item) => item.id === id)!,
            ),
          ];
          await route.fulfill({ status: 204 });
        } else {
          expect(body.previousIds).toEqual([a, b]);
          categories = body.ids.map((id: string) =>
            categories.find((item) => item.id === id)!,
          );
          await route.fulfill({ status: 204 });
        }
      },
    );
    let moves = 0;
    let editFails = true;
    await page.route(
      "**/backend/recurring-expenses/subcategories/*",
      async (route) => {
        const body = route.request().postDataJSON();
        expect(body.expectedName).toBe("월세");
        expect(body.name).toBe("주택 임차료");
        expect(body.expectedCategoryId).toBe(b);
        expect(body.categoryId).toBe(a);
        if (editFails) {
          editFails = false;
          await route.fulfill({
            status: 409,
            json: {
              message: "분류가 변경되었습니다. 확인 후 다시 저장해 주세요.",
            },
          });
        } else {
          subs = subs.map((item) =>
            item.id === x
              ? { ...item, name: body.name, categoryId: body.categoryId }
              : item,
          );
          await route.fulfill({ status: 204 });
        }
      },
    );
    await page.route(
      "**/backend/recurring-expenses/subcategories/*/parent",
      async (route) => {
        moves++;
        const body = route.request().postDataJSON();
        expect(body.expectedCategoryId).toBe(a);
        expect(body.categoryId).toBe(b);
        subs = subs.map((item) =>
          item.id === x ? { ...item, categoryId: b } : item,
        );
        await route.fulfill({ status: 204 });
      },
    );
    await page.goto("/settings/categories");
    await page.getByRole("button", { name: "주거", exact: true }).click();
    await page.getByLabel("상위 분류 이름", { exact: true }).fill("집과 생활");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "집과 생활", exact: true }),
    ).toBeVisible();
    const utility = page.getByRole("button", {
      name: "공과금",
      exact: true,
    });
    if (width === 1280) {
      const from = await utility.boundingBox();
      const to = await page
        .getByRole("button", { name: "집과 생활", exact: true })
        .boundingBox();
      if (!from || !to) throw new Error("Category labels missing");
      await page.mouse.move(from.x + 20, from.y + 24);
      await page.mouse.down();
      await page.mouse.move(to.x + 20, to.y + 24, { steps: 12 });
      await expect
        .poll(() =>
          page
            .locator("[data-sort-category]")
            .evaluateAll((rows) =>
              rows.map((row) => row.getAttribute("data-sort-category")),
            ),
        )
        .toEqual([b, a]);
      await expect(page.locator("[data-drag-floating]")).toBeVisible();
      await page.mouse.up();
      // A drag on the editable name must never open the rename dialog.
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } else {
      await utility.focus();
      await page.keyboard.press("ArrowUp");
    }
    await expect
      .poll(() =>
        page
          .locator("[data-sort-category]")
          .evaluateAll((rows) =>
            rows.map((row) => row.getAttribute("data-sort-category")),
          ),
      )
      .toEqual([b, a]);
    // The reordered preview is visible before the save request has finished.
    await expect(utility).toBeEnabled();
    await expect(utility).toBeFocused();
    await utility.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "상위 분류 수정" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(utility).toBeFocused();
    const loan = page.getByRole("button", {
      name: "대출",
      exact: true,
    });
    await loan.focus();
    await page.keyboard.press("ArrowUp");
    await expect
      .poll(() =>
        page
          .locator(`[data-sort-category="${a}"] [data-sort-sub]`)
          .evaluateAll((rows) =>
            rows.map((row) => row.getAttribute("data-sort-sub")),
          ),
      )
      .toEqual([y, x]);
    await page.getByRole("button", { name: "월세", exact: true }).click();
    await expect(
      page.getByRole("combobox", { name: "소속 상위 분류", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByLabel("소속 상위 분류", { exact: true }),
    ).toHaveCount(1);
    await page.keyboard.press("Escape");
    expect(moves).toBe(0);
    await page
      .locator("[data-sort-category]")
      .first()
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    // Leave room above the drop target; the viewport edge intentionally auto-scrolls.
    await page.evaluate(() => window.scrollBy(0, -40));
    const source = await page
      .getByRole("button", { name: "월세", exact: true })
      .boundingBox();
    await expect(page.locator(`[data-handle-id="${x}"]`)).toContainText("월세");
    await expect(page.locator(`[data-handle-id="${x}"]`)).not.toContainText(
      "⠿",
    );
    const dest = await page
      .getByRole("button", { name: "공과금", exact: true })
      .boundingBox();
    if (!source || !dest) throw new Error("Drag elements missing");
    const sx = source.x + source.width / 2,
      sy = source.y + source.height / 2,
      dx = dest.x + dest.width / 2,
      dy = dest.y + dest.height / 2;
    expect(
      await page.evaluate(
        ({ x, y }) => ({
          x,
          y,
          element: document.elementFromPoint(x, y)?.outerHTML.slice(0, 240),
          id: document
            .elementFromPoint(x, y)
            ?.closest("[data-handle-id]")
            ?.getAttribute("data-handle-id"),
        }),
        { x: sx, y: sy },
      ),
    ).toMatchObject({ id: x });
    expect(
      await page.evaluate(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest("[data-sort-category]")
            ?.getAttribute("data-sort-category"),
        { x: dx, y: dy },
      ),
    ).toBe(b);
    if (width === 360) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: sx, y: sy }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: dx, y: dy }],
      });
      await expect(
        page.locator(`[data-sort-category="${b}"] [data-sort-sub="${x}"]`),
      ).toBeVisible();
      expect(moves).toBe(0);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
    } else {
      // Leaving the drop area cancels the tentative move.
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(dx, dy, { steps: 6 });
      await expect(
        page.locator(`[data-sort-category="${b}"] [data-sort-sub="${x}"]`),
      ).toBeVisible();
      await page.mouse.move(1, 1, { steps: 6 });
      await page.mouse.up();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.locator(`[data-sort-category="${a}"] [data-sort-sub="${x}"]`),
      ).toBeVisible();
      const nextSource = await page
        .locator(`[data-handle-id="${x}"]`)
        .boundingBox();
      const nextTarget = await page
        .getByRole("button", { name: "공과금", exact: true })
        .boundingBox();
      if (!nextSource || !nextTarget)
        throw new Error("Moved viewport labels missing");
      await page.mouse.move(
        nextSource.x + nextSource.width / 2,
        nextSource.y + nextSource.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        nextTarget.x + nextTarget.width / 2,
        nextTarget.y + nextTarget.height / 2,
        { steps: 12 },
      );
      await page.mouse.up();
    }
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(moves).toBe(0);
    await page.getByRole("button", { name: "변경 저장", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.locator(`[data-sort-category="${b}"] [data-sort-sub="${x}"]`),
    ).toBeVisible();
    await page.getByRole("button", { name: "월세", exact: true }).click();
    await page
      .getByLabel("세부 분류 이름", { exact: true })
      .fill("주택 임차료");
    await page.getByLabel("소속 상위 분류", { exact: true }).selectOption(a);
    await expect(page.getByRole("dialog")).toContainText("과거 내역과 통계도");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "분류가 변경되었습니다",
    );
    await expect(
      page.getByLabel("세부 분류 이름", { exact: true }),
    ).toHaveValue("주택 임차료");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "저장", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(
      page
        .locator(`[data-sort-category="${a}"]`)
        .getByRole("button", { name: "주택 임차료", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("[data-handle-id]").getByText(/끌어 이동|옮기기/),
    ).toHaveCount(0);
    expect(moves).toBe(1);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "집과 생활", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(`[data-sort-category="${a}"] [data-sort-sub="${x}"]`),
    ).toBeVisible();
    await page.screenshot({
      path: `../../.local/classification-text-drag-${width}.png`,
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
    await page.screenshot({
      path: `../../.local/classifications-${width}.png`,
      fullPage: true,
    });
  });
}

test("모든 선택창과 펼침 화살표가 홈과 같은 스타일을 사용한다", async ({
  page,
}) => {
  await page.route("**/backend/dashboard/fixed-costs*", (route) =>
    route.fulfill({ json: FIXED_COST_FIXTURE }),
  );
  await page.route("**/backend/recurring-expenses/options", (route) =>
    route.fulfill({
      json: {
        categories: [{ id: a, name: "주거" }],
        subcategories: [],
        payers: [],
        paymentMethods: [],
      },
    }),
  );
  await page.goto("/");
  const home = page.getByRole("combobox").first();
  await expect(home).toBeVisible();
  const visual = (element: Element) => {
    const s = getComputedStyle(element);
    return [
      s.borderRadius,
      s.backgroundColor,
      s.minHeight,
      s.backgroundImage,
      s.fontSize,
    ];
  };
  const reference = await home.evaluate(visual);
  const summary = page.locator("[data-disclosure-trigger]").first();
  await summary.click();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(summary.locator("[data-disclosure-chevron]")).toHaveCount(1);
  await page.goto("/settings/categories");
  await page.getByRole("button", { name: "+ 추가", exact: true }).click();
  await page.getByRole("button", { name: "세부 분류", exact: true }).click();
  expect(await page.getByRole("combobox").first().evaluate(visual)).toEqual(
    reference,
  );
});

test("결제수단에서 설정으로 복귀하고 선택한 보관 상태를 색상으로 구분한다", async ({
  page,
}) => {
  await page.route("**/backend/payment-methods", (route) =>
    route.fulfill({
      json: [
        {
          id: a,
          name: "생활비 카드",
          type: "CARD",
          holderUserId: null,
          color: null,
          status: "ACTIVE",
          version: 0,
        },
        {
          id: b,
          name: "이전 카드",
          type: "CARD",
          holderUserId: null,
          color: null,
          status: "ARCHIVED",
          version: 0,
        },
      ],
    }),
  );
  await page.goto("/payment-methods");
  const active = page.getByRole("button", { name: "사용 중", exact: true });
  const archive = page.getByRole("button", { name: "보관함", exact: true });
  const color = await active.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(
    await archive.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).not.toBe(color);
  await archive.click();
  await expect(archive).toHaveAttribute("aria-pressed", "true");
  expect(
    await archive.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe(color);
  await expect(page.getByRole("link", { name: /이전 카드/ })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: /설정/ }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
