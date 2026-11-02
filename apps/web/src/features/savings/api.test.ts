import { afterEach, expect, it, vi } from "vitest";
import { getSavings, listSavings, saveSavings, type Savings } from "./api";

const item: Savings = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "기존 적금",
  type: "INSTALLMENT",
  depositAmount: 300000,
  currentAmount: 2400000,
  version: 0,
  ownerUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ownerName: "내 이름",
};
afterEach(() => vi.unstubAllGlobals());
function reply(data: unknown) {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => data });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
it("기존 잔액과 월 납입액을 따로 검증한다", async () => {
  reply({
    totalCurrentAmount: "2400000",
    monthlyDepositAmount: "300000",
    items: [item],
  });
  expect((await listSavings()).items[0].currentAmount).toBe(2400000);
  reply({
    totalCurrentAmount: "2700000",
    monthlyDepositAmount: "300000",
    items: [item],
  });
  await expect(listSavings()).rejects.toThrow("응답");
});
it("예금 예치금은 적금 월 납입 합계에 넣지 않는다", async () => {
  reply({
    totalCurrentAmount: "2400000",
    monthlyDepositAmount: "0",
    items: [{ ...item, type: "DEPOSIT" }],
  });
  expect((await listSavings()).monthlyDepositAmount).toBe("0");
});
it.each([
  { ...item, currentAmount: -1 },
  { ...item, depositAmount: 0 },
  { ...item, type: "INVALID" },
  { ...item, currentAmount: 1.5 },
  { ...item, version: -1 },
])("잘못된 금액·종류·버전 응답을 거부한다", async (data) => {
  reply(data);
  await expect(getSavings(item.id)).rejects.toThrow("응답");
});
it("등록 키와 수정 버전을 전송하고 단건 ID를 확인한다", async () => {
  const { id, version } = item;
  const input = {
    name: item.name,
    type: item.type,
    depositAmount: item.depositAmount,
    currentAmount: item.currentAmount,
    ownerUserId: item.ownerUserId,
  };
  const fetch = reply(item);
  await saveSavings(input, "retry-key");
  expect(fetch).toHaveBeenLastCalledWith(
    "/backend/savings",
    expect.objectContaining({
      headers: expect.objectContaining({ "Idempotency-Key": "retry-key" }),
    }),
  );
  await saveSavings(input, "ignored", item);
  expect(fetch).toHaveBeenLastCalledWith(
    `/backend/savings/${id}`,
    expect.objectContaining({ body: JSON.stringify({ ...input, version }) }),
  );
  reply({ ...item, id: "22222222-2222-4222-8222-222222222222" });
  await expect(getSavings(id)).rejects.toThrow("응답");
});
it("안전 정수 범위를 넘는 합계도 정확히 검증한다", async () => {
  const items = [
    {
      ...item,
      depositAmount: Number.MAX_SAFE_INTEGER,
      currentAmount: Number.MAX_SAFE_INTEGER,
    },
    {
      ...item,
      id: "22222222-2222-4222-8222-222222222222",
      depositAmount: Number.MAX_SAFE_INTEGER,
      currentAmount: Number.MAX_SAFE_INTEGER,
    },
  ];
  reply({
    totalCurrentAmount: "18014398509481982",
    monthlyDepositAmount: "18014398509481982",
    items,
  });
  expect((await listSavings()).items).toHaveLength(2);
});
