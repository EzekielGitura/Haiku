import { beforeEach, describe, expect, it, vi } from "vitest";
import { OFFLINE_POEMS_KEY, readOfflinePoems, saveOfflinePoems } from "./pwa";
import type { Poem } from "./poem-rules";

const poem: Poem = {
  day: "2026-10-09",
  title: "A little light",
  line_one: "Blue light in your hands",
  line_two: "I come home inside your gaze",
  line_three: "Stay beside me, love",
};

describe("offline completed poems", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("keeps original dates, merges by day, and excludes welcome and incomplete records", () => {
    saveOfflinePoems([
      { ...poem, day: "2026-10-08" },
      { ...poem, day: "" },
      { ...poem, line_two: null },
    ]);
    saveOfflinePoems([poem, { ...poem, title: "Revised saved title" }]);
    expect(readOfflinePoems()).toEqual([
      { ...poem, title: "Revised saved title" },
      { ...poem, day: "2026-10-08" },
    ]);
  });

  it("never saves a terminal failed row even if it has lines", () => {
    saveOfflinePoems([{ ...poem, status: "failed" } as Poem]);
    expect(readOfflinePoems()).toEqual([]);
  });

  it("treats damaged or unavailable browser storage as an empty cache", () => {
    localStorage.setItem(OFFLINE_POEMS_KEY, "not-json");
    expect(readOfflinePoems()).toEqual([]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage quota");
    });
    expect(() => saveOfflinePoems([poem])).not.toThrow();
  });
});
