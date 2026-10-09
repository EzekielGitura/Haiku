import { describe, expect, it } from "vitest";
import {
  silviaDay,
  untilNextPoem,
  cherubsAreBackground,
  CHERUB_RETREAT_MS,
  koreanEndearment,
} from "./poem-rules";

describe("Silvia’s daily rules", () => {
  it("changes the daily poem date at midnight GMT+3, not UTC midnight", () => {
    expect(silviaDay(new Date("2026-10-08T20:59:59Z"))).toBe("2026-10-08");
    expect(silviaDay(new Date("2026-10-08T21:00:00Z"))).toBe("2026-10-09");
  });
  it("counts down to the next midnight in GMT+3", () => {
    expect(untilNextPoem(new Date("2026-10-08T20:59:00Z"))).toBe(60_000);
    expect(untilNextPoem(new Date("2026-10-08T21:00:00Z"))).toBe(86_400_000);
    expect(silviaDay(new Date("2028-02-28T21:00:00Z"))).toBe("2028-02-29");
    expect(silviaDay(new Date("2026-12-31T21:00:00Z"))).toBe("2027-01-01");
  });
  it("retreats cherubs after the first reading minute without requiring sign-in", () => {
    expect(CHERUB_RETREAT_MS).toBe(60_001);
    expect(cherubsAreBackground(60_000, true)).toBe(false);
    expect(cherubsAreBackground(60_001, true)).toBe(true);
    expect(cherubsAreBackground(80_000, false)).toBe(false);
    expect(cherubsAreBackground(60_001)).toBe(true);
  });
  it("uses the author’s own address with its Korean rendering", () => {
    expect(koreanEndearment()).toEqual({
      korean: "나의 다정한 항복",
      translation: "my gentle surrender",
    });
  });
});
