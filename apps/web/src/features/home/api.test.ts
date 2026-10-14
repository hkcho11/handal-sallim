import { afterEach, expect, test, vi } from "vitest";
import { DASHBOARD_FIXTURE } from "../../test/dashboardFixtures";
import { getDashboard } from "./api";
afterEach(() => vi.unstubAllGlobals());
test("유효한 서버 공동 데이터를 받아 반환한다", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(DASHBOARD_FIXTURE))),
  );
  expect(await getDashboard()).toEqual(DASHBOARD_FIXTURE);
});
test("개인 거래가 섞인 서버 응답을 화면에 전달하지 않는다", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...DASHBOARD_FIXTURE,
          entries: [{ ...DASHBOARD_FIXTURE.entries[0], scope: "개인" }],
        }),
      ),
    ),
  );
  await expect(getDashboard()).rejects.toThrow("응답을 확인");
});
test("잘못된 금액과 날짜를 화면에 전달하지 않는다", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...DASHBOARD_FIXTURE,
          entries: [
            {
              ...DASHBOARD_FIXTURE.entries[0],
              amount: "150000",
              date: "2026-02-30",
            },
          ],
        }),
      ),
    ),
  );
  await expect(getDashboard()).rejects.toThrow("응답을 확인");
});
