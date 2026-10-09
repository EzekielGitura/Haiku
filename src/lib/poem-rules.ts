export const CHERUB_RETREAT_MS = 60_001;
export const GMT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function silviaDay(now = new Date()): string {
  return new Date(now.getTime() + GMT_OFFSET_MS).toISOString().slice(0, 10);
}

export function untilNextPoem(now = new Date()): number {
  const shifted = now.getTime() + GMT_OFFSET_MS;
  return 86_400_000 - (shifted % 86_400_000);
}

export function cherubsAreBackground(elapsed: number, reading = true): boolean {
  return reading && elapsed >= CHERUB_RETREAT_MS;
}

const POEM_ADDRESS = {
  korean: "나의 다정한 항복",
  translation: "my gentle surrender",
} as const;

export function koreanEndearment() {
  return POEM_ADDRESS;
}

export type Poem = {
  day: string;
  title: string | null;
  line_one: string | null;
  line_two: string | null;
  line_three: string | null;
};

export const welcomePoem: Poem = {
  day: "",
  title: "A flame, held gently",
  line_one: "I cup the candle",
  line_two: "Your palms keep the small flame warm",
  line_three: "My breath becomes home",
};
