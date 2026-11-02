import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteIncome,
  getIncome,
  listIncomes,
  saveIncome,
  type Income,
} from "./api";

const item: Income = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "월급",
  amount: 3000000,
  month: "2026-10",
  version: 0,
  ownerUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ownerName: "내 이름",
};
afterEach(() => vi.unstubAllGlobals());
function reply(data: unknown, status = 200) {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: status < 400, status, json: async () => data });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
describe("수입 API 경계", () => {
  it("수정 화면의 단건 응답 ID와 내용을 검증한다", async () => {
    reply(item);
    expect(await getIncome(item.id)).toEqual(item);
    reply({ ...item, id: "22222222-2222-4222-8222-222222222222" });
    await expect(getIncome(item.id)).rejects.toThrow("응답");
    reply({ ...item, version: -1 });
    await expect(getIncome(item.id)).rejects.toThrow("응답");
  });
  it("큰 합계도 정확히 검증하고 조회 월을 전달한다", async () => {
    const items = [
      { ...item, amount: Number.MAX_SAFE_INTEGER },
      {
        ...item,
        id: "22222222-2222-4222-8222-222222222222",
        amount: Number.MAX_SAFE_INTEGER,
      },
    ];
    const fetch = reply({
      month: "2026-10",
      totalAmount: "18014398509481982",
      items,
    });
    expect((await listIncomes("2026-10")).items).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith(
      "/backend/incomes?month=2026-10",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
  it.each([
    { month: "2026-09", totalAmount: "3000000", items: [item] },
    { month: "2026-10", totalAmount: "0", items: [item] },
    { month: "2026-10", totalAmount: "6000000", items: [item, item] },
    {
      month: "2026-10",
      totalAmount: "3000000",
      items: [{ ...item, amount: 1.5 }],
    },
    {
      month: "2026-10",
      totalAmount: "3000000",
      items: [{ ...item, month: "2026-13" }],
    },
  ])("월·합계·중복·금액이 잘못된 응답을 거부한다", async (data) => {
    reply(data);
    await expect(listIncomes("2026-10")).rejects.toThrow("응답");
  });
  it("생성에는 재시도 키, 수정과 삭제에는 버전을 보낸다", async () => {
    const fetch = reply(item);
    const input = {
      name: item.name,
      amount: item.amount,
      month: item.month,
      ownerUserId: item.ownerUserId,
    };
    await saveIncome(input, "retry-key");
    expect(fetch).toHaveBeenLastCalledWith(
      "/backend/incomes",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Idempotency-Key": "retry-key" }),
      }),
    );
    await saveIncome(input, "ignored", item);
    expect(fetch).toHaveBeenLastCalledWith(
      `/backend/incomes/${item.id}`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ ...input, version: 0 }),
      }),
    );
    reply(null, 204);
    await deleteIncome(item);
  });
  it("충돌과 네트워크 오류를 사용자 문구로 변환한다", async () => {
    reply({}, 409);
    await expect(deleteIncome(item)).rejects.toThrow("내역이 변경");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("raw server detail")),
    );
    await expect(listIncomes("2026-10")).rejects.toThrow("연결할 수 없습니다");
  });
});
