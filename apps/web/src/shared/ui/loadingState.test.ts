import { expect, test } from "vitest";
import { beginLoading, loadingState } from "../loadingState";

test("동시에 진행하는 작업이 모두 끝나야 해제하고 중복 종료는 무시한다", () => {
  const first = beginLoading();
  const second = beginLoading();
  expect(loadingState.snapshot()).toBe(true);
  first();
  first();
  expect(loadingState.snapshot()).toBe(true);
  second();
  expect(loadingState.snapshot()).toBe(false);
});
