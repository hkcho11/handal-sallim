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
  it("신규 종류와 기존 카드를 읽고 이름을 가나다순으로 정렬한다", async () => {
    const methods = ["현금", "체크", "간편", "기존", "신용"].map(
      (name, index) => ({
        ...method,
        id: `11111111-1111-4111-8111-11111111111${index}`,
        name,
        type: ["CASH", "DEBIT_CARD", "SIMPLE_PAY", "CARD", "CREDIT_CARD"][
          index
        ],
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(methods))),
    );
    const result = await listPaymentMethods();
    expect(result.map((item) => item.name)).toEqual([
      "간편",
      "기존",
      "신용",
      "체크",
      "현금",
    ]);
  });
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
