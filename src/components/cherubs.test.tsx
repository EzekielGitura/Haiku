import { act, render, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Cherubs } from "./cherubs";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("retreats after one minute of reading without an account", () => {
  vi.useFakeTimers();
  const view = render(<Cherubs />);
  act(() => {
    vi.advanceTimersByTime(60_000);
  });
  expect(view.container.firstElementChild?.getAttribute("data-cherub-state")).toBe("foreground");
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(view.container.firstElementChild?.getAttribute("data-cherub-state")).toBe("background");
});
