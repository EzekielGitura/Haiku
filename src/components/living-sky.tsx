import { useEffect, useId, useState, type CSSProperties } from "react";
import { moonLitPath, skyAt, type SkyState } from "@/lib/sky-rules";
import { CLOUD_PATHS } from "@/lib/sky-art";
import "@/sky.css";

// A shared first frame keeps server markup and client hydration identical.
const FIRST_FRAME = skyAt(new Date("2025-09-22T09:00:00Z"));
const TICK_MS = 30_000;
type SkyStyle = CSSProperties & { [key: `--${string}`]: number | string };

function useSkyState(): SkyState {
  const [sky, setSky] = useState(FIRST_FRAME);
  useEffect(() => {
    const refresh = () => setSky(skyAt(new Date()));
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") refresh();
    }, TICK_MS);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);
  return sky;
}

const CLOUDS = [
  { kind: "cirrus", x: -7, y: 8, width: 40, speed: 190, delay: -93 },
  { kind: "cirrus", x: 61, y: 20, width: 37, speed: 210, delay: -37 },
  { kind: "cirrus", x: 24, y: 38, width: 43, speed: 230, delay: -119 },
  { kind: "stratus", x: -12, y: 65, width: 70, speed: 160, delay: -17 },
  { kind: "stratus", x: 53, y: 74, width: 65, speed: 185, delay: -84 },
  { kind: "cumulus", x: -14, y: 29, width: 38, speed: 105, delay: -71 },
  { kind: "cumulus", x: 70, y: 42, width: 34, speed: 130, delay: -27 },
  { kind: "cumulus", x: 6, y: 76, width: 48, speed: 150, delay: -39 },
  { kind: "cumulus", x: 65, y: 87, width: 45, speed: 125, delay: -63 },
] as const;

const STARS = Array.from({ length: 92 }, (_, index) => ({
  x: ((index * 73.19 + 13.7) % 100).toFixed(3),
  y: ((index * 37.81 + 4.2) % 77).toFixed(3),
  size: index % 13 === 0 ? 2.3 : index % 4 === 0 ? 1.7 : 1.1,
  delay: -((index * 1.71) % 11),
  opacity: 0.35 + ((index * 17) % 65) / 100,
}));

function Cloud({ kind, id }: { kind: (typeof CLOUDS)[number]["kind"]; id: string }) {
  return (
    <svg viewBox="0 0 600 240" fill="none" focusable="false">
      <defs>
        <linearGradient id={id} x1="300" y1="40" x2="300" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--sky-cloud)" />
          <stop offset="1" stopColor="var(--sky-cloud-shade)" stopOpacity="0.56" />
        </linearGradient>
      </defs>
      {kind === "cumulus" && (
        <>
          <path d={CLOUD_PATHS.cumulus} fill={`url(#${id})`} />
          <path
            d={CLOUD_PATHS.cumulusHighlights}
            stroke="var(--sky-cloud)"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.45"
          />
        </>
      )}
      {kind === "stratus" && (
        <>
          <path
            d="M7 132C61 101 118 119 166 111C213 78 259 108 309 99C363 72 408 106 457 98C504 89 549 105 594 118C565 143 515 139 470 147C412 157 365 146 316 159C257 171 208 147 154 158C97 167 43 158 7 132Z"
            fill={`url(#${id})`}
            opacity="0.7"
          />
          <path
            d="M36 172C98 158 151 170 217 162C291 145 356 169 421 158C471 150 527 157 572 170C485 192 397 182 310 193C219 200 119 192 36 172Z"
            fill="var(--sky-cloud)"
            opacity="0.25"
          />
        </>
      )}
      {kind === "cirrus" && (
        <g stroke="var(--sky-cloud)" strokeLinecap="round">
          <path d={CLOUD_PATHS.cirrus[0]} strokeWidth="11" opacity="0.42" />
          <path d={CLOUD_PATHS.cirrus[1]} strokeWidth="6" opacity="0.32" />
          <path d={CLOUD_PATHS.cirrus[2]} strokeWidth="3" opacity="0.22" />
        </g>
      )}
    </svg>
  );
}

/** A decorative, local-time sky; clouds are simulated, not a weather forecast. */
export function LivingSky() {
  const sky = useSkyState();
  const id = useId().replace(/:/g, "");
  const style: SkyStyle = {
    "--sky-top": sky.colors.top,
    "--sky-middle": sky.colors.middle,
    "--sky-horizon": sky.colors.horizon,
    "--sky-cloud": sky.colors.cloud,
    "--sky-cloud-shade": sky.colors.cloudShade,
    "--sky-sun": sky.colors.sun,
    "--sky-cover": sky.cloudCover,
    "--sky-stars": sky.starVisibility,
    "--sky-twilight": sky.twilight,
    "--sky-night": 1 - sky.daylight,
    "--sky-sun-x": `${sky.sun.x}%`,
    "--sky-sun-y": `${sky.sun.y}%`,
    "--sky-sun-opacity": sky.sun.opacity,
    "--sky-moon-x": `${sky.moon.x}%`,
    "--sky-moon-y": `${sky.moon.y}%`,
    "--sky-moon-opacity": sky.moon.opacity,
    "--sky-moon-light": sky.moon.illumination,
  };
  return (
    <div
      className="living-sky"
      data-sky-phase={sky.phase}
      data-sky-tone={sky.daylight < 0.42 ? "dark" : "light"}
      data-moon-phase={sky.moon.name}
      style={style}
      aria-hidden="true"
    >
      <div className="sky-horizon-glow" />
      <div className="sky-stars">
        {STARS.map((star, index) => (
          <i
            key={index}
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="sky-sun">
        <div className="sky-sun-disc" />
      </div>
      <div className="sky-moon">
        <svg viewBox="0 0 100 100" focusable="false">
          <defs>
            <clipPath id={`${id}-moon-disc`}>
              <circle cx="50" cy="50" r="28" />
            </clipPath>
          </defs>
          <circle className="moon-earthshine" cx="50" cy="50" r="28" />
          <g clipPath={`url(#${id}-moon-disc)`}>
            <path className="moon-light" d={moonLitPath(sky.moon.phase)} />
            <g className="moon-craters">
              <circle cx="43" cy="36" r="5" />
              <circle cx="60" cy="53" r="8" />
              <circle cx="37" cy="62" r="4" />
              <circle cx="58" cy="29" r="3" />
              <circle cx="68" cy="65" r="3" />
            </g>
          </g>
        </svg>
      </div>
      <div className="sky-clouds">
        {CLOUDS.map((cloud, index) => (
          <div
            key={index}
            className={`sky-cloud sky-cloud-${cloud.kind}`}
            style={{
              left: `${cloud.x}%`,
              top: `${cloud.y}%`,
              width: `${cloud.width}%`,
              animationDuration: `${cloud.speed}s`,
              animationDelay: `${cloud.delay}s`,
            }}
          >
            <Cloud kind={cloud.kind} id={`${id}-cloud-${index}`} />
          </div>
        ))}
      </div>
      <div className="sky-atmosphere" />
    </div>
  );
}
