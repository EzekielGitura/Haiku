// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const ORIGIN = "https://forsilvia.example";
const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const html = "<html><head></head><body>A saved poem</body></html>";

function worker() {
  const callbacks = new Map<string, (event: unknown) => void>();
  const stores = new Map<string, Map<string, Response>>();
  const requestKey = (request: Request | string) =>
    new URL(typeof request === "string" ? request : request.url, ORIGIN).href;
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(
    async (request) =>
      new Response(html, {
        headers: {
          "Content-Type": (request as Request).url.endsWith(".js")
            ? "text/javascript"
            : "text/html",
        },
      }),
  );
  const caches = {
    open: async (name: string) => {
      const store = stores.get(name) || new Map<string, Response>();
      stores.set(name, store);
      return {
        match: async (request: Request | string) => store.get(requestKey(request))?.clone(),
        put: async (request: Request | string, response: Response) => {
          store.set(requestKey(request), response.clone());
        },
      };
    },
    match: async (request: Request | string) =>
      [...stores.values()]
        .map((store) => store.get(requestKey(request)))
        .find(Boolean)
        ?.clone(),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (name: string, callback: (event: unknown) => void) =>
      callbacks.set(name, callback),
    clients: { claim: vi.fn() },
  };
  runInContext(
    source,
    createContext({ self, caches, fetch, URL, Request, Response, Headers, Promise, Set }),
  );
  const dispatch = (path: string, options: RequestInit = {}, navigation = false) => {
    const request = new Request(new URL(path, ORIGIN), options);
    if (navigation) Object.defineProperty(request, "mode", { value: "navigate" });
    const respondWith = vi.fn();
    callbacks.get("fetch")!({ request, respondWith });
    return respondWith;
  };
  return { callbacks, dispatch, fetch, stores };
}

describe("PWA cache boundary", () => {
  it("never intercepts generation, API reads, cross-origin data, or non-public navigations", () => {
    const app = worker();
    for (const path of [
      "/_serverFn/readPoems",
      "/api/poems",
      "https://db.supabase.co/rest/v1/daily_poems",
      "/assets/file.json",
      "/assets/file.js?generation=true",
    ]) {
      expect(app.dispatch(path)).not.toHaveBeenCalled();
    }
    expect(app.dispatch("/", { method: "POST", body: "generate" })).not.toHaveBeenCalled();
    expect(app.dispatch("/reset-password", {}, true)).not.toHaveBeenCalled();
    expect(app.fetch).not.toHaveBeenCalled();
  });

  it("saves complete successful public HTML and marks its offline fallback", async () => {
    const app = worker();
    const initial = (await app.dispatch("/", {}, true).mock.calls[0]![0]) as Response;
    expect(await initial.text()).toContain("A saved poem");
    app.fetch.mockRejectedValueOnce(new TypeError("Network unavailable"));
    const offline = (await app.dispatch("/", {}, true).mock.calls[0]![0]) as Response;
    expect(await offline.text()).toContain('<meta name="for-silvia-offline" content="true">');
    expect(offline.headers.get("X-For-Silvia-Offline")).toBe("true");
  });

  it("serves the marked saved page during an HTTP 503 outage without caching the failure", async () => {
    const app = worker();
    await app.dispatch("/", {}, true).mock.calls[0]![0];
    app.fetch.mockResolvedValueOnce(
      new Response("Server unavailable", { status: 503, headers: { "Content-Type": "text/html" } }),
    );
    const failure = (await app.dispatch("/", {}, true).mock.calls[0]![0]) as Response;
    expect(failure.status).toBe(200);
    expect(failure.headers.get("X-For-Silvia-Offline")).toBe("true");
    expect(await failure.text()).toContain("A saved poem");
    app.fetch.mockRejectedValueOnce(new TypeError("Network unavailable"));
    const saved = (await app.dispatch("/", {}, true).mock.calls[0]![0]) as Response;
    expect(await saved.text()).toContain("A saved poem");
  });

  it("does not cache a misrouted asset response that contains an HTML error page", async () => {
    const app = worker();
    app.fetch.mockResolvedValueOnce(
      new Response("An HTML error page", { headers: { "Content-Type": "text/html" } }),
    );
    await app.dispatch("/assets/app.js").mock.calls[0]![0];
    expect([...app.stores.values()].every((store) => store.size === 0)).toBe(true);
  });

  it("warms only public assets and pages from the first-visit message", async () => {
    const app = worker();
    const waitUntil = vi.fn();
    app.callbacks.get("message")!({
      source: { url: `${ORIGIN}/` },
      data: {
        type: "SAVE_PUBLIC_PAGE",
        pathname: "/",
        assets: [
          `${ORIGIN}/assets/app.js`,
          `${ORIGIN}/_serverFn/readPoems`,
          "https://db.supabase.co/rest/v1/daily_poems",
        ],
      },
      waitUntil,
    });
    await waitUntil.mock.calls[0]![0];
    const fetched = app.fetch.mock.calls.map(([request]) => (request as Request).url);
    expect(fetched).toEqual([`${ORIGIN}/assets/app.js`, `${ORIGIN}/`, `${ORIGIN}/collection`]);
  });
});
