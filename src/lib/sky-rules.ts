import { GMT_OFFSET_MS, silviaDay } from "./poem-rules";

const DAY_MS = 86_400_000;
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const NAIROBI_LATITUDE = -1.286389;
const NAIROBI_LONGITUDE = 36.817223;

// Mean lunar cycle and a published new moon, from NASA/GSFC's phase tables.
// This is a date-driven visual approximation, rather than a lunar ephemeris.
// https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html
const NEW_MOON_EPOCH = Date.parse("2025-09-21T19:54:00Z");
export const LUNAR_MONTH_DAYS = 29.530588;

export type SkyPhase = "sunrise" | "day" | "sunset" | "night";
export type MoonPhase =
  | "New moon"
  | "Waxing crescent"
  | "First quarter"
  | "Waxing gibbous"
  | "Full moon"
  | "Waning gibbous"
  | "Last quarter"
  | "Waning crescent";

export type SkyState = {
  day: string;
  phase: SkyPhase;
  localHour: number;
  sunriseMinute: number;
  sunsetMinute: number;
  daylight: number;
  twilight: number;
  cloudCover: number;
  starVisibility: number;
  sun: { x: number; y: number; opacity: number };
  moon: {
    x: number;
    y: number;
    opacity: number;
    phase: number;
    illumination: number;
    name: MoonPhase;
  };
  colors: {
    top: string;
    middle: string;
    horizon: string;
    cloud: string;
    cloudShade: string;
    sun: string;
  };
};

type Palette = [string, string, string];
const MOON_PHASES: MoonPhase[] = [
  "New moon",
  "Waxing crescent",
  "First quarter",
  "Waxing gibbous",
  "Full moon",
  "Waning gibbous",
  "Last quarter",
  "Waning crescent",
];
const NIGHT: Palette = ["#10192f", "#293957", "#697087"];
const DAWN: Palette = ["#666b98", "#c598b0", "#f5d0af"];
const DAY: Palette = ["#82b2da", "#c0dced", "#f4eee7"];
const DUSK: Palette = ["#586182", "#bc8c9c", "#f3bf99"];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smooth(value: number) {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function blendColor(from: string, to: string, amount: number) {
  const first = Number.parseInt(from.slice(1), 16);
  const second = Number.parseInt(to.slice(1), 16);
  const channels = [16, 8, 0].map((shift) => {
    const left = (first >> shift) & 255;
    const right = (second >> shift) & 255;
    return Math.round(left + (right - left) * clamp(amount))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

function blendPalette(from: Palette, to: Palette, amount: number): Palette {
  return [
    blendColor(from[0], to[0], amount),
    blendColor(from[1], to[1], amount),
    blendColor(from[2], to[2], amount),
  ];
}

// Small integer hash; unlike Math.random, the same moment always has the same sky.
function sample(seed: number) {
  let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_295;
}

/** Illustrative weather varies smoothly every three hours, including at midnight. */
export function cloudCoverAt(now: Date): number {
  const block = (now.getTime() + GMT_OFFSET_MS) / (3 * 60 * 60 * 1000);
  const start = Math.floor(block);
  const amount = smooth(block - start);
  return 0.12 + 0.83 * (sample(start) + (sample(start + 1) - sample(start)) * amount);
}

/** Approximate sunrise/sunset in Nairobi, in minutes after the shared daily midnight. */
export function solarTimes(now: Date) {
  const local = new Date(now.getTime() + GMT_OFFSET_MS);
  const year = local.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const localDay = Date.UTC(year, local.getUTCMonth(), local.getUTCDate());
  const yearDays = (Date.UTC(year + 1, 0, 1) - yearStart) / DAY_MS;
  const fractionalYear = (TAU / yearDays) * ((localDay - yearStart) / DAY_MS);
  // NOAA's compact solar equations, evaluated at local noon.
  // https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(fractionalYear) -
      0.032077 * Math.sin(fractionalYear) -
      0.014615 * Math.cos(2 * fractionalYear) -
      0.040849 * Math.sin(2 * fractionalYear));
  const declination =
    0.006918 -
    0.399912 * Math.cos(fractionalYear) +
    0.070257 * Math.sin(fractionalYear) -
    0.006758 * Math.cos(2 * fractionalYear) +
    0.000907 * Math.sin(2 * fractionalYear) -
    0.002697 * Math.cos(3 * fractionalYear) +
    0.00148 * Math.sin(3 * fractionalYear);
  const latitude = NAIROBI_LATITUDE * RAD;
  const hourAngle =
    Math.acos(
      clamp(
        Math.cos(90.833 * RAD) / (Math.cos(latitude) * Math.cos(declination)) -
          Math.tan(latitude) * Math.tan(declination),
        -1,
        1,
      ),
    ) / RAD;
  const noon = 720 - 4 * NAIROBI_LONGITUDE - equationOfTime + GMT_OFFSET_MS / 60_000;
  return { sunriseMinute: noon - 4 * hourAngle, sunsetMinute: noon + 4 * hourAngle };
}

export function lunarPhaseAt(now: Date) {
  const phase = modulo((now.getTime() - NEW_MOON_EPOCH) / (LUNAR_MONTH_DAYS * DAY_MS), 1);
  return {
    phase,
    illumination: (1 - Math.cos(TAU * phase)) / 2,
    name: MOON_PHASES[Math.round(phase * 8) % 8] ?? "New moon",
  };
}

export function skyAt(now: Date): SkyState {
  const { sunriseMinute, sunsetMinute } = solarTimes(now);
  const localMinute = modulo(now.getTime() + GMT_OFFSET_MS, DAY_MS) / 60_000;
  const daylight =
    smooth((localMinute - sunriseMinute + 45) / 90) *
    (1 - smooth((localMinute - sunsetMinute + 45) / 90));
  const morning = localMinute < (sunriseMinute + sunsetMinute) / 2;
  const twilight = morning
    ? 1 - smooth(Math.abs(localMinute - sunriseMinute) / 85)
    : 1 - smooth(Math.abs(localMinute - sunsetMinute) / 85);
  const phase: SkyPhase =
    localMinute >= sunriseMinute - 45 && localMinute <= sunriseMinute + 60
      ? "sunrise"
      : localMinute >= sunsetMinute - 60 && localMinute <= sunsetMinute + 45
        ? "sunset"
        : localMinute > sunriseMinute && localMinute < sunsetMinute
          ? "day"
          : "night";
  const sunProgress = clamp((localMinute - sunriseMinute) / (sunsetMinute - sunriseMinute));
  const nightMinutes = 1440 - sunsetMinute + sunriseMinute;
  const moonProgress = clamp(modulo(localMinute - sunsetMinute, 1440) / nightMinutes);
  const cloudCover = cloudCoverAt(now);
  const lunar = lunarPhaseAt(now);
  const palette = blendPalette(
    blendPalette(NIGHT, DAY, daylight),
    morning ? DAWN : DUSK,
    twilight * 0.88,
  );
  return {
    day: silviaDay(now),
    phase,
    localHour: localMinute / 60,
    sunriseMinute,
    sunsetMinute,
    daylight,
    twilight,
    cloudCover,
    starVisibility: (1 - daylight) ** 2 * (1 - cloudCover * 0.88) * (1 - lunar.illumination * 0.26),
    sun: {
      x: 12 + sunProgress * 76,
      y: 67 - Math.sin(Math.PI * sunProgress) * 54,
      opacity: daylight * (1 - cloudCover * 0.48),
    },
    moon: {
      x: 82 - moonProgress * 64,
      y: 64 - Math.sin(Math.PI * moonProgress) * 49,
      opacity: (1 - daylight) * (1 - cloudCover * 0.4),
      ...lunar,
    },
    colors: {
      top: palette[0],
      middle: palette[1],
      horizon: palette[2],
      cloud: blendColor(
        blendColor("#8390ac", "#ffffff", daylight),
        morning ? "#f7dedc" : "#f5d4c4",
        twilight * 0.7,
      ),
      cloudShade: blendColor("#52607d", "#b8cddb", daylight),
      sun: blendColor("#ffd9a1", "#fff3cb", 1 - twilight),
    },
  };
}

/** The illuminated right/left limb and curved terminator for a 100 × 100 SVG. */
export function moonLitPath(phase: number): string {
  const normalized = modulo(phase, 1);
  const waxing = normalized < 0.5;
  const terminator = Math.cos(TAU * normalized);
  const radius = Math.abs(terminator) * 28;
  const limbSweep = waxing ? 1 : 0;
  const terminatorSweep = waxing ? (terminator >= 0 ? 0 : 1) : terminator >= 0 ? 1 : 0;
  const ending =
    radius < 0.001 ? "L 50 22" : `A ${radius.toFixed(4)} 28 0 0 ${terminatorSweep} 50 22`;
  return `M 50 22 A 28 28 0 0 ${limbSweep} 50 78 ${ending} Z`;
}
