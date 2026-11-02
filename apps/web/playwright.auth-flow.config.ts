import { defineConfig } from "@playwright/test";
const port = Number(process.env.AUTH_FLOW_WEB_PORT);
if (
  !port ||
  !process.env.AUTH_FLOW_API_ORIGIN ||
  !process.env.AUTH_FLOW_MAILPIT_ORIGIN
) {
  throw new Error(
    "Run scripts/test-auth-flow.ps1 to prepare isolated services.",
  );
}
export default defineConfig({
  testDir: "./e2e-integration",
  outputDir: "../../.local/auth-flow-browser",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    actionTimeout: 15_000,
    trace: "off",
  },
  webServer: {
    command: `pnpm start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    env: { API_ORIGIN: process.env.AUTH_FLOW_API_ORIGIN },
    reuseExistingServer: false,
  },
});
