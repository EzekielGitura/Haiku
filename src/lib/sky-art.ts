/** Shared daylight colors and cloud silhouettes for the live sky and saved poems. */
export const DAY_SKY_COLORS = {
  top: "#82b2da",
  middle: "#c0dced",
  horizon: "#f4eee7",
  cloud: "#ffffff",
  cloudShade: "#b8cddb",
  sun: "#fff3cb",
} as const;

export const CLOUD_PATHS = {
  cumulus:
    "M38 188C15 166 30 132 69 128C54 89 95 59 139 71C147 26 209 17 239 48C267 6 334 17 347 63C397 42 441 67 447 102C480 83 518 107 520 134C558 126 594 154 578 180C568 198 546 203 515 204H86C65 204 47 199 38 188Z",
  cumulusHighlights:
    "M63 157C88 139 113 136 135 142M173 88C191 82 210 87 220 101M290 64C304 60 324 69 328 82M428 145C448 134 471 139 482 149",
  cirrus: [
    "M14 144C135 86 241 126 336 78C394 52 456 76 583 31",
    "M67 164C161 132 227 151 328 111C400 80 460 103 547 62",
    "M161 177C242 153 283 162 371 126C423 105 461 121 503 98",
  ],
} as const;
