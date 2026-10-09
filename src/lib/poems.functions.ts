import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { silviaDay } from "./poem-rules";
import type { Database } from "@/integrations/supabase/types";

export const readPoems = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) return [];
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { data, error } = await client
    .from("daily_poems")
    .select("day,title,line_one,line_two,line_three")
    .eq("status", "complete")
    .lte("day", silviaDay())
    .order("day", { ascending: false })
    .limit(365);
  if (error) throw new Error("The poem collection could not be opened. Please try again.");
  return data;
});

export const generateToday = createServerFn({ method: "POST" }).handler(async () => {
  const { getDailyPoem } = await import("./poems.server");
  return getDailyPoem();
});
