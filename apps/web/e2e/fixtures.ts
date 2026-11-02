import { test as base, expect } from "@playwright/test";
export const test = base.extend({
  page: async ({ page }, run) => {
    // Existing screen fixtures have no generated charge history unless a test supplies it.
    await page.route("**/backend/recurring-expenses/*/charges", (route) =>
      route.fulfill({ json: [] }),
    );
    await page.route("**/backend/auth/session", (route) =>
      route.fulfill({
        json: {
          userId: "11111111-1111-4111-8111-111111111111",
          name: "테스트",
          hasSpace: true,
        },
      }),
    );
    await page.route("**/backend/auth/csrf", (route) =>
      route.fulfill({ json: { token: "test-csrf" } }),
    );
    await run(page);
  },
});
export { expect };
