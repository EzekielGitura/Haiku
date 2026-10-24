import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import { silviaDay, type Poem } from "./poem-rules";
import {
  DEFAULT_POEM_MODEL,
  POEM_FAILURE_MESSAGE,
  POEM_PAUSED_MESSAGE,
  PoemProviderError,
  samePoem,
  writeDailyPoem,
  type WrittenPoem,
} from "./poem-provider.server";

export const POEM_SETUP_MESSAGE =
  "The daily poem garden is being prepared. Please enjoy this welcome poem.";
const POEM_STORAGE_MESSAGE = "Your poem collection is resting for a moment. Please return soon.";

export type DailyPoemResult = { poem: Poem | null; pending: boolean; error: string | null };
type DailyRecord = Pick<Tables<"daily_poems">, keyof Poem | "status">;

export type PoemStore = {
  readDay(day: string): Promise<DailyRecord | null>;
  isPaused(): Promise<boolean>;
  claim(day: string): Promise<boolean>;
  recent(day: string): Promise<Poem[]>;
  alreadyWritten(poem: WrittenPoem): Promise<boolean>;
  complete(day: string, poem: WrittenPoem): Promise<Poem>;
  fail(day: string, reason: string): Promise<void>;
  pause(reason: string): Promise<void>;
};

const emptyResult = (error: string | null = null, pending = false): DailyPoemResult => ({
  poem: null,
  pending,
  error,
});

export async function runDailyGeneration({
  store,
  day,
  apiKey,
  model = DEFAULT_POEM_MODEL,
  request = fetch,
}: {
  store: PoemStore;
  day: string;
  apiKey: string | undefined;
  model?: string;
  request?: typeof fetch;
}): Promise<DailyPoemResult> {
  try {
    const existing = await store.readDay(day);
    if (existing?.status === "complete") {
      const { title, line_one, line_two, line_three } = existing;
      return { poem: { day, title, line_one, line_two, line_three }, pending: false, error: null };
    }
    // A failed or interrupted claim is terminal. There is never another paid attempt for this date.
    if (existing?.status === "failed") return emptyResult(POEM_FAILURE_MESSAGE);
    if (existing) return emptyResult(null, true);
    if (await store.isPaused()) return emptyResult(POEM_PAUSED_MESSAGE);
    if (!apiKey) return emptyResult(POEM_SETUP_MESSAGE);
    if (!(await store.claim(day))) return emptyResult(null, true);
  } catch {
    return emptyResult(POEM_STORAGE_MESSAGE);
  }

  try {
    const recent = await store.recent(day);
    const poem = await writeDailyPoem({ day, recent, apiKey: apiKey!, model, request });
    if (recent.some((previous) => samePoem(previous, poem)) || (await store.alreadyWritten(poem)))
      throw new PoemProviderError();
    return { poem: await store.complete(day, poem), pending: false, error: null };
  } catch (error) {
    const paused = error instanceof PoemProviderError && error.pauseGeneration;
    const reason = paused ? POEM_PAUSED_MESSAGE : POEM_FAILURE_MESSAGE;
    // Persist both independently: a pause failure must not prevent recording today's terminal failure.
    const writes = [store.fail(day, reason), ...(paused ? [store.pause(reason)] : [])];
    const results = await Promise.allSettled(writes);
    if (results.some((result) => result.status === "rejected"))
      return emptyResult(POEM_STORAGE_MESSAGE);
    return emptyResult(reason);
  }
}

function supabasePoemStore(client: SupabaseClient<Database>): PoemStore {
  return {
    async readDay(day) {
      const { data, error } = await client
        .from("daily_poems")
        .select("day,title,line_one,line_two,line_three,status")
        .eq("day", day)
        .maybeSingle();
      if (error) throw new Error(POEM_STORAGE_MESSAGE);
      return data;
    },
    async isPaused() {
      const { data, error } = await client
        .from("poem_generation_state")
        .select("paused")
        .eq("id", true)
        .maybeSingle();
      if (error) throw new Error(POEM_STORAGE_MESSAGE);
      return data?.paused || false;
    },
    async claim(day) {
      const { data, error } = await client.rpc("claim_daily_poem", { p_day: day });
      if (error) throw new Error(POEM_STORAGE_MESSAGE);
      return data;
    },
    async recent(day) {
      const { data, error } = await client
        .from("daily_poems")
        .select("day,title,line_one,line_two,line_three")
        .eq("status", "complete")
        .lt("day", day)
        .order("day", { ascending: false })
        .limit(60);
      if (error) throw new Error(POEM_STORAGE_MESSAGE);
      return data || [];
    },
    async alreadyWritten(poem) {
      const { data, error } = await client
        .from("daily_poems")
        .select("day")
        .eq("status", "complete")
        .eq("line_one", poem.line_one)
        .eq("line_two", poem.line_two)
        .eq("line_three", poem.line_three)
        .limit(1);
      if (error) throw new Error(POEM_STORAGE_MESSAGE);
      return !!data?.length;
    },
    async complete(day, poem) {
      const { data, error } = await client
        .from("daily_poems")
        .update({ ...poem, status: "complete", error_message: null })
        .eq("day", day)
        .eq("status", "pending")
        .select("day,title,line_one,line_two,line_three")
        .single();
      if (error) throw new Error(POEM_STORAGE_MESSAGE);
      return data;
    },
    async fail(day, reason) {
      const { error } = await client
        .from("daily_poems")
        .update({ status: "failed", error_message: reason })
        .eq("day", day)
        .eq("status", "pending");
      if (error) throw new Error(POEM_STORAGE_MESSAGE);
    },
    async pause(reason) {
      const { error } = await client
        .from("poem_generation_state")
        .upsert({ id: true, paused: true, reason });
      if (error) throw new Error(POEM_STORAGE_MESSAGE);
    },
  };
}

export async function getDailyPoem(): Promise<DailyPoemResult> {
  const { hasSupabaseAdminConfig, supabaseAdmin } =
    await import("@/integrations/supabase/client.server");
  if (!hasSupabaseAdminConfig()) return emptyResult(POEM_SETUP_MESSAGE);
  return runDailyGeneration({
    store: supabasePoemStore(supabaseAdmin),
    day: silviaDay(),
    apiKey: process.env["GROQ_API_KEY"],
    model: process.env["GROQ_MODEL"] || DEFAULT_POEM_MODEL,
  });
}
