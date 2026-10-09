import { describe, expect, it } from "vitest";
import { silviaDay } from "./poem-rules";
import { cloudCoverAt, lunarPhaseAt, skyAt, solarTimes, LUNAR_MONTH_DAYS } from "./sky-rules";

const DAY_MS = 86_400_000;

describe("the living sky", () => {
  it("uses the same Nairobi day as daily poems at midnight", () => {
    for (const instant of ["2026-10-08T20:59:59Z", "2026-10-08T21:00:00Z"]) {
      const date = new Date(instant);
      expect(skyAt(date).day).toBe(silviaDay(date));
    }
    expect(skyAt(new Date("2026-10-08T21:00:00Z")).localHour).toBe(0);
  });

  it("moves from night through sunrise, daylight and sunset back to night", () => {
    const date = new Date("2026-10-09T09:00:00Z");
    const times = solarTimes(date);
    const midnight = Date.parse("2026-10-08T21:00:00Z");
    expect(skyAt(new Date(midnight)).phase).toBe("night");
    expect(skyAt(new Date(midnight + times.sunriseMinute * 60_000)).phase).toBe("sunrise");
    expect(skyAt(date).phase).toBe("day");
    expect(skyAt(new Date(midnight + times.sunsetMinute * 60_000)).phase).toBe("sunset");
    expect(skyAt(new Date("2026-10-09T19:00:00Z")).phase).toBe("night");
    expect(skyAt(date).starVisibility).toBe(0);
    expect(skyAt(new Date(midnight)).starVisibility).toBeGreaterThan(0);
  });

  it("keeps Nairobi sunrise and sunset seasonal and within plausible equatorial hours", () => {
    const annualTimes = Array.from({ length: 12 }, (_, month) =>
      solarTimes(new Date(Date.UTC(2026, month, 15, 9))),
    );
    for (const times of annualTimes) {
      expect(times.sunriseMinute).toBeGreaterThan(5.5 * 60);
      expect(times.sunriseMinute).toBeLessThan(7 * 60);
      expect(times.sunsetMinute).toBeGreaterThan(17.5 * 60);
      expect(times.sunsetMinute).toBeLessThan(19 * 60);
    }
    expect(annualTimes[0]!.sunriseMinute).not.toBeCloseTo(annualTimes[6]!.sunriseMinute, 0);
  });

  it("moves the sun up to midday and down through the afternoon", () => {
    const morning = skyAt(new Date("2026-10-09T04:00:00Z")).sun;
    const midday = skyAt(new Date("2026-10-09T09:00:00Z")).sun;
    const evening = skyAt(new Date("2026-10-09T14:00:00Z")).sun;
    expect(morning.x).toBeLessThan(midday.x);
    expect(midday.x).toBeLessThan(evening.x);
    expect(midday.y).toBeLessThan(morning.y);
    expect(midday.y).toBeLessThan(evening.y);
  });

  it("has repeatable, varying cloud cover that remains continuous at midnight", () => {
    const before = new Date("2026-10-08T20:59:59.999Z");
    const after = new Date("2026-10-08T21:00:00.001Z");
    expect(cloudCoverAt(before)).toBe(cloudCoverAt(before));
    expect(cloudCoverAt(after)).toBeCloseTo(cloudCoverAt(before), 6);
    const covers = Array.from({ length: 32 }, (_, index) =>
      cloudCoverAt(new Date(before.getTime() + index * 3 * 60 * 60_000)),
    );
    expect(Math.max(...covers) - Math.min(...covers)).toBeGreaterThan(0.6);
    expect(Math.min(...covers)).toBeGreaterThanOrEqual(0.12);
    expect(Math.max(...covers)).toBeLessThanOrEqual(0.95);
  });

  it("follows the lunar month through all eight phases and works before the reference date", () => {
    const reference = Date.parse("2025-09-21T19:54:00Z");
    const expected = [
      "New moon",
      "Waxing crescent",
      "First quarter",
      "Waxing gibbous",
      "Full moon",
      "Waning gibbous",
      "Last quarter",
      "Waning crescent",
    ];
    expected.forEach((phase, index) => {
      expect(lunarPhaseAt(new Date(reference + (index / 8) * LUNAR_MONTH_DAYS * DAY_MS)).name).toBe(
        phase,
      );
    });
    expect(lunarPhaseAt(new Date(reference)).illumination).toBe(0);
    expect(
      lunarPhaseAt(new Date(reference + (LUNAR_MONTH_DAYS * DAY_MS) / 2)).illumination,
    ).toBeCloseTo(1);
    expect(
      lunarPhaseAt(new Date(reference - (LUNAR_MONTH_DAYS * DAY_MS) / 2)).illumination,
    ).toBeCloseTo(1);
    // NASA/GSFC: full moon 2025-10-07 03:47 UTC. A mean-cycle visual is close.
    expect(lunarPhaseAt(new Date("2025-10-07T03:47:00Z")).name).toBe("Full moon");
    expect(lunarPhaseAt(new Date("2025-10-07T03:47:00Z")).illumination).toBeGreaterThan(0.99);
  });

  it("makes thick cloud cover obscure stars without showing stars by day", () => {
    const nights = Array.from({ length: 28 }, (_, index) =>
      skyAt(new Date(Date.UTC(2026, 9, index + 1, 21))),
    );
    const clear = nights.reduce((best, state) =>
      state.cloudCover < best.cloudCover ? state : best,
    );
    const cloudy = nights.reduce((best, state) =>
      state.cloudCover > best.cloudCover ? state : best,
    );
    expect(cloudy.starVisibility).toBeLessThan(clear.starVisibility);
    expect(skyAt(new Date("2026-10-09T09:00:00Z")).moon.opacity).toBe(0);
    expect(skyAt(new Date("2026-10-09T21:00:00Z")).sun.opacity).toBe(0);
  });
});
