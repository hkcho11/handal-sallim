import { afterEach, expect, it, vi } from "vitest";
import { hasOwner, listOwners } from "./owners";

const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const partner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const options = {
  currentUserId: user,
  members: [
    { id: user, name: "내 이름" },
    { id: partner, name: "함께하는 사람" },
  ],
};
afterEach(() => vi.unstubAllGlobals());
it("작성자와 공간 멤버를 서버 응답에서 확인한다", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => options });
  vi.stubGlobal("fetch", fetch);
  expect(await listOwners("incomes")).toEqual(options);
  expect(fetch).toHaveBeenCalledWith(
    "/backend/incomes/members",
    expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
  );
  expect(hasOwner({ ownerUserId: partner, ownerName: "함께하는 사람" })).toBe(
    true,
  );
  expect(hasOwner({ ownerUserId: partner, ownerName: null })).toBe(false);
});
it.each([
  { ...options, currentUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
  { ...options, members: [options.members[0], options.members[0]] },
  { ...options, members: [{ id: user, name: " " }] },
])("잘못된 작성자·중복 멤버·빈 이름을 거부한다", async (value) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => value }),
  );
  await expect(listOwners("savings")).rejects.toThrow("응답");
});
