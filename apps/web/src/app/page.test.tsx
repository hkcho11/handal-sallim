import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("한달살림 시작 화면을 표시한다", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { name: "한달살림" })).toBeTruthy();
});
