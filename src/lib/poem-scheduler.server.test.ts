// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleScheduledPoem } from "./poem-scheduler.server";
import type { DailyPoemResult } from "./poems.server";
import { Route } from "@/routes/api.daily-poem";

const secret = "private-scheduler-token";
const makeRequest = (authorization?: string, method = "POST") =>
  new Request("https://example.test/api/daily-poem", {
    method,
    headers: authorization ? { Authorization: authorization } : {},
  });

afterEach(() => vi.unstubAllEnvs());

it("registers GET for Vercel Cron and POST for other schedulers", () => {
  expect(Route.options).toMatchObject({
    server: { handlers: { GET: expect.any(Function), POST: expect.any(Function) } },
  });
});

describe.each(["GET", "POST"])("protected daily scheduler using %s", (method) => {
  it.each([undefined, "", "Bearer wrong-token", secret, `Basic ${secret}`])(
    "rejects invalid authorization before any generation (%s)",
    async (authorization) => {
      const generate = vi.fn<() => Promise<DailyPoemResult>>();
      const response = await handleScheduledPoem(makeRequest(authorization, method), {
        secret,
        generate,
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
      expect(generate).not.toHaveBeenCalled();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    },
  );

  it("keeps the endpoint closed when CRON_SECRET is absent", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const generate = vi.fn<() => Promise<DailyPoemResult>>();
    const response = await handleScheduledPoem(makeRequest(`Bearer ${secret}`, method), {
      generate,
    });
    expect(response.status).toBe(401);
    expect(generate).not.toHaveBeenCalled();
  });

  it("uses the same daily generation path and returns only a safe completion summary", async () => {
    const generate = vi.fn(async () => ({
      poem: {
        day: "2026-10-09",
        title: "Private title",
        line_one: "one",
        line_two: "two",
        line_three: "three",
      },
      pending: false,
      error: null,
    }));
    const response = await handleScheduledPoem(makeRequest(`Bearer ${secret}`, method), {
      secret,
      generate,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "complete", day: "2026-10-09" });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("makes an authorized pending request visible only as a pending summary", async () => {
    const generate = vi.fn(async () => ({ poem: null, pending: true, error: null }));
    const response = await handleScheduledPoem(makeRequest(`Bearer ${secret}`, method), {
      secret,
      generate,
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ status: "pending" });
  });

  it("keeps internal errors out of the scheduler response", async () => {
    const generate = vi.fn(async () => {
      throw new Error("private upstream error and secret");
    });
    const response = await handleScheduledPoem(makeRequest(`Bearer ${secret}`, method), {
      secret,
      generate,
    });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private upstream");
  });
});
