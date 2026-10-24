// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDailyPoem,
  POEM_SETUP_MESSAGE,
  runDailyGeneration,
  type PoemStore,
} from "./poems.server";
import {
  DEFAULT_POEM_MODEL,
  parsePoemResponse,
  POEM_FAILURE_MESSAGE,
  POEM_PAUSED_MESSAGE,
  writeDailyPoem,
  type WrittenPoem,
} from "./poem-provider.server";
import type { Poem } from "./poem-rules";

const day = "2026-10-09";
const verse: WrittenPoem = {
  title: "Held",
  line_one: "I cup the candle",
  line_two: "Your palms keep the small flame warm",
  line_three: "My breath becomes home",
};
const responsePayload = (poem: unknown = verse) => ({
  status: "completed",
  output: [
    {
      type: "message",
      status: "completed",
      content: [{ type: "output_text", text: JSON.stringify(poem) }],
    },
  ],
});
const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function memoryStore() {
  const records = new Map<string, Poem & { status: string; error_message?: string }>();
  let paused = false;
  const store: PoemStore = {
    readDay: vi.fn(async (date) => records.get(date) || null),
    isPaused: vi.fn(async () => paused),
    claim: vi.fn(async (date) => {
      if (records.has(date)) return false;
      records.set(date, {
        day: date,
        title: null,
        line_one: null,
        line_two: null,
        line_three: null,
        status: "pending",
      });
      return true;
    }),
    recent: vi.fn(async (date) =>
      [...records.values()]
        .filter((poem) => poem.status === "complete" && poem.day < date)
        .slice(-60),
    ),
    alreadyWritten: vi.fn(async (poem) =>
      [...records.values()].some(
        (previous) =>
          previous.status === "complete" &&
          previous.line_one === poem.line_one &&
          previous.line_two === poem.line_two &&
          previous.line_three === poem.line_three,
      ),
    ),
    complete: vi.fn(async (date, poem) => {
      records.set(date, { day: date, ...poem, status: "complete" });
      return { day: date, ...poem };
    }),
    fail: vi.fn(async (date, reason) => {
      records.set(date, { ...records.get(date)!, status: "failed", error_message: reason });
    }),
    pause: vi.fn(async () => {
      paused = true;
    }),
  };
  return { store, records };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("daily generation persistence", () => {
  it("makes only one provider call under concurrent public requests and serves the saved result afterwards", async () => {
    const { store, records } = memoryStore();
    const request = vi.fn(async () => jsonResponse(responsePayload()));
    const run = () => runDailyGeneration({ store, day, apiKey: "test-secret", request });
    const results = await Promise.all(Array.from({ length: 12 }, run));
    expect(request).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => result.poem)).toHaveLength(1);
    expect(records.get(day)?.status).toBe("complete");
    expect(await run()).toEqual({ poem: { day, ...verse }, pending: false, error: null });
    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/responses");
    const body = JSON.parse(String(init.body));
    expect(DEFAULT_POEM_MODEL).toBe("openai/gpt-oss-120b");
    expect(body).toMatchObject({
      model: DEFAULT_POEM_MODEL,
      stream: false,
      reasoning: { effort: "low" },
      max_output_tokens: 2_048,
    });
    expect(body).not.toHaveProperty("store");
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(body.text.format.schema).toMatchObject({
      required: ["title", "line_one", "line_two", "line_three"],
      additionalProperties: false,
    });
    expect(body.input[1].content).toContain(day);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-secret");
  });

  it.each([
    [400, { code: "blocked_api_access" }],
    [401, { code: "invalid_api_key" }],
    [403, { code: "permission_denied" }],
    [429, { code: "insufficient_quota" }],
    [429, { code: "credit_balance_exhausted" }],
    [429, { code: "project_spend_limit_exceeded" }],
    [429, { type: "insufficient_quota" }],
    [404, { code: "model_not_found" }],
    [200, { code: "insufficient_quota" }],
  ])(
    "persists a terminal failure and pause for access or credit errors (%s, %j)",
    async (status, error) => {
      const { store, records } = memoryStore();
      const request = vi.fn(async () =>
        jsonResponse(
          { error: { ...error, message: "private provider detail test-secret" } },
          status,
        ),
      );
      const result = await runDailyGeneration({ store, day, apiKey: "test-secret", request });
      expect(result).toEqual({ poem: null, pending: false, error: POEM_PAUSED_MESSAGE });
      expect(records.get(day)).toMatchObject({
        status: "failed",
        error_message: POEM_PAUSED_MESSAGE,
      });
      expect(store.pause).toHaveBeenCalledWith(POEM_PAUSED_MESSAGE);
      await runDailyGeneration({ store, day, apiKey: "test-secret", request });
      const tomorrow = await runDailyGeneration({
        store,
        day: "2026-10-10",
        apiKey: "test-secret",
        request,
      });
      expect(tomorrow.error).toBe(POEM_PAUSED_MESSAGE);
      expect(request).toHaveBeenCalledTimes(1);
      expect(records.has("2026-10-10")).toBe(false);
    },
  );

  it.each([429, 500, 503])(
    "never replays a failed daily request for a temporary service failure (%s)",
    async (status) => {
      const { store, records } = memoryStore();
      const request = vi.fn(async () =>
        jsonResponse(
          { error: { code: "rate_limit_exceeded", message: "raw provider message" } },
          status,
        ),
      );
      await runDailyGeneration({ store, day, apiKey: "test-secret", request });
      const again = await runDailyGeneration({ store, day, apiKey: "test-secret", request });
      expect(again.error).toBe(POEM_FAILURE_MESSAGE);
      expect(records.get(day)?.status).toBe("failed");
      expect(store.pause).not.toHaveBeenCalled();
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it("does not consume a claim when keys are missing, and does not make a network request without service storage", async () => {
    const { store } = memoryStore();
    const request = vi.fn(async () => jsonResponse(responsePayload()));
    expect((await runDailyGeneration({ store, day, apiKey: undefined, request })).error).toBe(
      POEM_SETUP_MESSAGE,
    );
    expect(store.claim).not.toHaveBeenCalled();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubGlobal("fetch", request);
    expect(await getDailyPoem()).toEqual({ poem: null, pending: false, error: POEM_SETUP_MESSAGE });
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps an interrupted pending claim terminal instead of trying again", async () => {
    const { store } = memoryStore();
    await store.claim(day);
    const request = vi.fn(async () => jsonResponse(responsePayload()));
    expect(await runDailyGeneration({ store, day, apiKey: "test-secret", request })).toEqual({
      poem: null,
      pending: true,
      error: null,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects a repeated recent verse despite changed case or punctuation without paying for a replacement", async () => {
    const { store, records } = memoryStore();
    records.set("2026-10-08", { day: "2026-10-08", ...verse, status: "complete" });
    const request = vi.fn(async () =>
      jsonResponse(responsePayload({ ...verse, line_one: "I CUP THE CANDLE!" })),
    );
    const result = await runDailyGeneration({ store, day, apiKey: "test-secret", request });
    expect(result.error).toBe(POEM_FAILURE_MESSAGE);
    expect(records.get(day)?.status).toBe("failed");
    expect(request).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      String((request.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(body.input[1].content).toContain(verse.line_two);
  });

  it("records a terminal failure after a network timeout and makes no retry", async () => {
    const { store, records } = memoryStore();
    const request = vi.fn(async () => {
      throw new Error("private upstream timeout");
    });
    const result = await runDailyGeneration({ store, day, apiKey: "test-secret", request });
    expect(result.error).toBe(POEM_FAILURE_MESSAGE);
    expect(records.get(day)?.status).toBe("failed");
    await runDailyGeneration({ store, day, apiKey: "test-secret", request });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("keeps a token-truncated response terminal instead of requesting a replacement", async () => {
    const { store, records } = memoryStore();
    const request = vi.fn(async () =>
      jsonResponse({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: responsePayload().output,
      }),
    );
    expect((await runDailyGeneration({ store, day, apiKey: "test-secret", request })).error).toBe(
      POEM_FAILURE_MESSAGE,
    );
    expect(records.get(day)?.status).toBe("failed");
    await runDailyGeneration({ store, day, apiKey: "test-secret", request });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("writes a new future date without any preset end date", async () => {
    const { store } = memoryStore();
    const request = vi.fn(async () => jsonResponse(responsePayload()));
    const result = await runDailyGeneration({
      store,
      day: "2100-01-01",
      apiKey: "test-secret",
      request,
      model: "configured-model",
    });
    expect(result.poem?.day).toBe("2100-01-01");
    const body = JSON.parse(
      String((request.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(body.model).toBe("configured-model");
  });
});

describe("Responses payload validation", () => {
  it("extracts only a complete structured poem", () => {
    expect(parsePoemResponse(responsePayload())).toEqual(verse);
  });
  it("ignores Groq reasoning output and returns only the public poem fields", () => {
    expect(
      parsePoemResponse({
        ...responsePayload(),
        output: [
          {
            type: "reasoning",
            status: "completed",
            content: [{ type: "reasoning_text", text: "private reasoning" }],
          },
          ...responsePayload().output,
        ],
      }),
    ).toEqual(verse);
  });
  it.each([
    { status: "incomplete", output: [] },
    { status: "failed", error: { message: "private error" } },
    {
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "private refusal" }] }],
    },
    responsePayload({ ...verse, line_two: "" }),
    responsePayload({ ...verse, line_one: "First\nSecond" }),
    responsePayload({ ...verse, line_one: 12 }),
    responsePayload({ ...verse, extra: "unexpected" }),
    responsePayload({ ...verse, title: "x".repeat(121) }),
    {
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "{not json}" }] }],
    },
  ])("rejects malformed, refused or incomplete output without leaking it (%j)", (payload) => {
    expect(() => parsePoemResponse(payload)).toThrow(POEM_FAILURE_MESSAGE);
  });
});

describe("Groq prompt budget", () => {
  it("keeps whole recent poems within a bounded history without sending storage metadata", async () => {
    const recent: Poem[] = Array.from({ length: 60 }, (_, index) => ({
      day: `2026-08-${String(index + 1).padStart(2, "0")}`,
      title: `Recent ${index} ${"é".repeat(100)}`,
      line_one: "a".repeat(120),
      line_two: "b".repeat(120),
      line_three: "c".repeat(120),
    }));
    const request = vi.fn(async () => jsonResponse(responsePayload()));
    await writeDailyPoem({ day, recent, apiKey: "test-secret", request });
    const body = JSON.parse(
      String((request.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    const history = body.input[1].content.split("\n").at(-1);
    const entries = JSON.parse(history);
    const first = recent[0]!;
    expect(new TextEncoder().encode(history).length).toBeLessThanOrEqual(6_000);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThan(60);
    expect(entries[0]).toEqual([first.title, first.line_one, first.line_two, first.line_three]);
    expect(entries.every((entry: unknown[]) => entry.length === 4)).toBe(true);
    expect(history).not.toContain(first.day);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
