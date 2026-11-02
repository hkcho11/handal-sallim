import { afterEach, describe, expect, it, vi } from "vitest";
import { listPaymentMethods, savePaymentMethod } from "./api";
const id = "11111111-1111-4111-8111-111111111111";
const method = {
  id,
  name: "생활비 카드",
  type: "CARD" as const,
  holderUserId: null,
  color: null,
  status: "ACTIVE",
  version: 0,
};
afterEach(() => vi.unstubAllGlobals());
describe("결제수단 API 응답 경계", () => {
  it("유효한 목록을 읽고 중복 식별자와 잘못된 종류를 거부한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify([method])))
        .mockResolvedValueOnce(new Response(JSON.stringify([method, method])))
        .mockResolvedValueOnce(
          new Response(JSON.stringify([{ ...method, type: "UNKNOWN" }])),
        ),
    );
    await expect(listPaymentMethods()).resolves.toEqual([method]);
    await expect(listPaymentMethods()).rejects.toThrow("응답");
    await expect(listPaymentMethods()).rejects.toThrow("응답");
  });
  it("생성 요청 키와 다른 결제수단이 반환되면 거부한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(method))),
    );
    await expect(
      savePaymentMethod(
        { name: "생활비 카드", type: "CARD", holderUserId: null, color: null },
        "22222222-2222-4222-8222-222222222222",
      ),
    ).rejects.toThrow("저장 응답");
  });
});
