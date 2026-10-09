/* Cache public pages and app assets only. Poem API data stays outside this worker. */
const CACHE_PREFIX = "for-silvia-";
// Bump when the offline shell changes. Hashed /assets/ URLs identify app builds.
const CACHE_VERSION = "v1";
const ASSET_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`;
const PAGE_CACHE = `${CACHE_PREFIX}pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const PUBLIC_PAGES = new Set(["/", "/collection"]);
const STATIC_PATHS = new Set([
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
]);
const ASSET_EXTENSION = /\.(?:js|mjs|css|woff2?|ttf|otf|svg|png|jpe?g|webp|avif|gif|ico)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(ASSET_CACHE).then((cache) => cache.addAll([...STATIC_PATHS])));
  // Updates wait for the existing app to close so its chunks keep matching its worker.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith(CACHE_PREFIX) && ![ASSET_CACHE, PAGE_CACHE].includes(name),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticRequest(request, url) {
  if (url.search) return false;
  if (STATIC_PATHS.has(url.pathname)) return true;
  return (
    url.pathname.startsWith("/assets/") &&
    ASSET_EXTENSION.test(url.pathname) &&
    ["script", "style", "font", "image", ""].includes(request.destination)
  );
}

function isStaticResponse(request, response) {
  if (!response.ok || response.redirected) return false;
  const path = new URL(request.url).pathname;
  const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (path === OFFLINE_URL) return type === "text/html";
  if (path === "/manifest.webmanifest")
    return ["application/manifest+json", "application/json"].includes(type);
  if (/\.(?:js|mjs)$/i.test(path))
    return /^(?:text|application)\/(?:javascript|ecmascript)$/.test(type);
  if (/\.css$/i.test(path)) return type === "text/css";
  if (/\.(?:woff2?|ttf|otf)$/i.test(path))
    return /^(?:font\/|application\/(?:font|x-font|octet-stream))/.test(type);
  return type.startsWith("image/");
}

async function completeResponse(response) {
  // Do not persist interrupted streamed HTML or asset bodies.
  const body = await response.clone().arrayBuffer();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function offlineDocument(response) {
  const html = await response.text();
  const marker = '<meta name="for-silvia-offline" content="true">';
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("X-For-Silvia-Offline", "true");
  return new Response(html.replace("</head>", `${marker}</head>`), { status: 200, headers });
}

async function navigate(request, url) {
  const cache = await caches.open(PAGE_CACHE).catch(() => null);
  try {
    const response = await fetch(request);
    if (response.status >= 500) throw new Error("The site is temporarily unavailable.");
    const type = response.headers.get("content-type") || "";
    if (
      cache &&
      response.ok &&
      response.status === 200 &&
      !response.redirected &&
      type.includes("text/html")
    ) {
      try {
        await cache.put(url.pathname, await completeResponse(response));
      } catch {
        // Storage limits never prevent the live page from opening.
      }
    }
    return response;
  } catch {
    const saved = cache ? await cache.match(url.pathname).catch(() => undefined) : undefined;
    if (saved) return offlineDocument(saved);
    const offline = await caches.match(OFFLINE_URL).catch(() => undefined);
    return (
      offline ||
      new Response("Connect to the internet to open For Silvia for the first time.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function asset(request) {
  const cache = await caches.open(ASSET_CACHE).catch(() => null);
  const saved = cache ? await cache.match(request).catch(() => undefined) : undefined;
  if (saved) return saved;
  const response = await fetch(request);
  if (cache && isStaticResponse(request, response)) {
    try {
      await cache.put(request, await completeResponse(response));
    } catch {
      /* storage may be full */
    }
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && !url.search && PUBLIC_PAGES.has(url.pathname)) {
    event.respondWith(navigate(request, url));
  } else if (isStaticRequest(request, url)) {
    event.respondWith(asset(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SAVE_PUBLIC_PAGE" || !event.source?.url) return;
  if (new URL(event.source.url).origin !== self.location.origin) return;
  const pathname = event.data.pathname;
  if (!PUBLIC_PAGES.has(pathname)) return;
  event.waitUntil(
    (async () => {
      // Assets from the first visit loaded before this worker could control the page.
      const urls = Array.isArray(event.data.assets) ? event.data.assets.slice(0, 150) : [];
      await Promise.allSettled(
        urls.map(async (value) => {
          if (typeof value !== "string") return;
          const url = new URL(value, self.location.origin);
          const request = new Request(url.href, { credentials: "same-origin" });
          if (url.origin === self.location.origin && isStaticRequest(request, url))
            await asset(request);
        }),
      );
      await Promise.allSettled(
        [...PUBLIC_PAGES].map(async (page) => {
          const url = new URL(page, self.location.origin);
          const response = await navigate(
            new Request(url.href, { headers: { Accept: "text/html" }, credentials: "same-origin" }),
            url,
          );
          if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html"))
            return;
          const html = await response.text();
          // Each route may preload a different component chunk. Warm those links too.
          const assets = [...html.matchAll(/["'](\/assets\/[^"'<>\s]+)["']/g)].map(
            (match) => match[1],
          );
          await Promise.allSettled(
            [...new Set(assets)].slice(0, 150).map(async (path) => {
              const assetUrl = new URL(path, self.location.origin);
              const request = new Request(assetUrl.href, { credentials: "same-origin" });
              if (isStaticRequest(request, assetUrl)) await asset(request);
            }),
          );
        }),
      );
    })(),
  );
});
