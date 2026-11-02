import { test, expect } from "./fixtures";
const parent = "11111111-1111-4111-8111-111111111111";
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
for (const width of [360, 1280]) {
  test(`드래그 미리보기는 저장 전 이동하고 취소·저장 실패 시 복원한다 (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    let subs = [
      { id: a, categoryId: parent, name: "월세" },
      { id: b, categoryId: parent, name: "관리비" },
    ];
    await page.route("**/backend/recurring-expenses/options", (route) =>
      route.fulfill({
        json: {
          categories: [{ id: parent, name: "주거" }],
          subcategories: subs,
          payers: [],
          paymentMethods: [],
        },
      }),
    );
    let requests = 0;
    await page.route(
      `**/backend/recurring-expenses/categories/${parent}/subcategories/order`,
      async (route) => {
        requests++;
        expect(route.request().postDataJSON()).toEqual({
          ids: [b, a],
          previousIds: [a, b],
        });
        if (requests === 1)
          await route.fulfill({
            status: 500,
            json: { message: "순서를 저장하지 못했습니다." },
          });
        else {
          subs = [subs[1], subs[0]];
          await route.fulfill({ status: 204 });
        }
      },
    );
    await page.goto("/settings/categories");
    const order = () =>
      page
        .locator("[data-sort-sub]")
        .evaluateAll((rows) =>
          rows.map((row) => row.getAttribute("data-sort-sub")),
        );
    async function begin() {
      const source = await page
        .getByRole("button", { name: "월세", exact: true })
        .boundingBox();
      const to = await page
        .getByRole("button", { name: "관리비", exact: true })
        .boundingBox();
      if (!source || !to) throw new Error("분류 위치 없음");
      await page.mouse.move(
        source.x + source.width / 2,
        source.y + source.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(to.x + to.width - 2, to.y + to.height / 2, {
        steps: 10,
      });
      await expect.poll(order).toEqual([b, a]);
      await expect(page.locator("[data-drag-floating]")).toBeVisible();
      await expect(page.locator("[data-drop-target]")).toHaveCount(0);
    }
    await begin();
    expect(requests).toBe(0);
    await page.screenshot({
      path: `../../.local/classification-live-drag-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect.poll(order).toEqual([a, b]);
    await expect(page.locator("[data-drag-floating]")).toHaveCount(0);
    expect(requests).toBe(0);
    await begin();
    await page.mouse.up();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "순서를 저장하지 못했습니다.",
    );
    await expect.poll(order).toEqual([a, b]);
    await begin();
    await page.mouse.up();
    await expect.poll(() => requests).toBe(2);
    await expect.poll(order).toEqual([b, a]);
    await expect(
      page.getByText("분류 순서를 저장했습니다.", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect.poll(order).toEqual([b, a]);
  });
}

test("다른 상위 분류의 미리보기를 취소하거나 터치가 중단되면 소속을 복원한다", async ({
  page,
}) => {
  const other = "22222222-2222-4222-8222-222222222222";
  await page.setViewportSize({ width: 360, height: 844 });
  await page.route("**/backend/recurring-expenses/options", (route) =>
    route.fulfill({
      json: {
        categories: [
          { id: parent, name: "주거" },
          { id: other, name: "공과금" },
        ],
        subcategories: [{ id: a, categoryId: parent, name: "월세" }],
        payers: [],
        paymentMethods: [],
      },
    }),
  );
  let requests = 0;
  await page.route(
    "**/backend/recurring-expenses/subcategories/*/parent",
    (route) => {
      requests++;
      return route.fulfill({ status: 204 });
    },
  );
  await page.goto("/settings/categories");
  const cdp = await page.context().newCDPSession(page);
  async function begin() {
    const source = await page
      .getByRole("button", { name: "월세", exact: true })
      .boundingBox();
    const dest = await page
      .getByRole("button", { name: "공과금", exact: true })
      .boundingBox();
    if (!source || !dest) throw new Error("분류 위치 없음");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: source.x + source.width / 2, y: source.y + source.height / 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: dest.x + dest.width / 2, y: dest.y + dest.height / 2 },
      ],
    });
    await expect(
      page.locator(`[data-sort-category="${other}"] [data-sort-sub="${a}"]`),
    ).toBeVisible();
    expect(requests).toBe(0);
  }
  await begin();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByRole("dialog", { name: "소속 분류 변경" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "취소", exact: true })
    .click();
  await expect(
    page.locator(`[data-sort-category="${parent}"] [data-sort-sub="${a}"]`),
  ).toBeVisible();
  await begin();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect(
    page.locator(`[data-sort-category="${parent}"] [data-sort-sub="${a}"]`),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-drag-floating]")).toHaveCount(0);
  expect(requests).toBe(0);
  await cdp.detach();
});
