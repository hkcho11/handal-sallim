import { afterEach, expect, test } from "vitest";
import {
  parseCodeGrant,
  parseCodeRequest,
  pendingEmailCode,
  saveEmailCode,
} from "./emailCode";

afterEach(() => sessionStorage.clear());
test("validates requests and grants without accepting malformed responses", () => {
  expect(() => parseCodeRequest({ requestId: "bad" })).toThrow();
  expect(() => parseCodeGrant({ token: "12345678" })).toThrow();
  expect(parseCodeGrant({ token: "g".repeat(43) })).toHaveLength(43);
});
test("retains only a pending request and keeps signup and reset separate", () => {
  const pending = {
    requestId: "11111111-1111-4111-8111-111111111111",
    email: "fixture@example.test",
    phase: "code" as const,
  };
  saveEmailCode(false, pending);
  expect(pendingEmailCode(false)).toEqual(pending);
  expect(pendingEmailCode(true)).toBeNull();
  saveEmailCode(false, null);
  expect(pendingEmailCode(false)).toBeNull();
  sessionStorage.setItem("handal.auth.pending.signup", "malformed");
  expect(pendingEmailCode(false)).toBeNull();
});
