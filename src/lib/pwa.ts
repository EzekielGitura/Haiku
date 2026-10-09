import { useEffect, useState } from "react";
import type { Poem } from "./poem-rules";

export const OFFLINE_POEMS_KEY = "for-silvia-complete-poems-v1";
const MAX_OFFLINE_POEMS = 365;
const CONNECTION_EVENT = "for-silvia-connection";
let connectionUnavailable = false;

function isCompletePoem(value: unknown): value is Poem {
  if (!value || typeof value !== "object") return false;
  const poem = value as Record<string, unknown>;
  return (
    typeof poem["day"] === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(poem["day"]) &&
    (poem["title"] === null || typeof poem["title"] === "string") &&
    ["line_one", "line_two", "line_three"].every(
      (field) =>
        typeof poem[field] === "string" &&
        (poem[field] as string).trim().length > 0 &&
        (poem[field] as string).length <= 200,
    ) &&
    (poem["status"] === undefined || poem["status"] === "complete")
  );
}

export function readOfflinePoems(): Poem[] {
  if (typeof window === "undefined") return [];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(OFFLINE_POEMS_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.filter(isCompletePoem).sort((a, b) => b.day.localeCompare(a.day))
      : [];
  } catch {
    return [];
  }
}

/** Call only with completed records returned by the public poem reader. */
export function saveOfflinePoems(poems: readonly Poem[]): void {
  if (typeof window === "undefined") return;
  try {
    const byDay = new Map(readOfflinePoems().map((poem) => [poem.day, poem]));
    for (const poem of poems.filter(isCompletePoem)) {
      byDay.set(poem.day, {
        day: poem.day,
        title: poem.title,
        line_one: poem.line_one,
        line_two: poem.line_two,
        line_three: poem.line_three,
      });
    }
    const saved = [...byDay.values()]
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, MAX_OFFLINE_POEMS);
    window.localStorage.setItem(OFFLINE_POEMS_KEY, JSON.stringify(saved));
  } catch {
    // Browsers may disable storage; the live poem remains available.
  }
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () =>
      setOnline(
        navigator.onLine &&
          !connectionUnavailable &&
          !document.querySelector('meta[name="for-silvia-offline"]'),
      );
    const reconnect = () => {
      markConnectionOnline();
    };
    update();
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", update);
    window.addEventListener(CONNECTION_EVENT, update);
    return () => {
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", update);
      window.removeEventListener(CONNECTION_EVENT, update);
    };
  }, []);
  return online;
}

/** A public read can fail even when the browser reports an active network. */
export function markConnectionOffline(): void {
  if (typeof window === "undefined") return;
  connectionUnavailable = true;
  window.dispatchEvent(new Event(CONNECTION_EVENT));
}

export function markConnectionOnline(): void {
  if (typeof window === "undefined") return;
  connectionUnavailable = false;
  document.querySelector('meta[name="for-silvia-offline"]')?.remove();
  window.dispatchEvent(new Event(CONNECTION_EVENT));
}

async function warmFirstVisit(): Promise<void> {
  const worker = (await navigator.serviceWorker.ready).active;
  if (!worker) return;
  if (document.readyState !== "complete") {
    await new Promise<void>((resolve) =>
      window.addEventListener("load", () => resolve(), { once: true }),
    );
  }
  const urls = performance.getEntriesByType("resource").map((entry) => entry.name);
  worker.postMessage({
    type: "SAVE_PUBLIC_PAGE",
    pathname: window.location.pathname,
    assets: urls,
  });
}

let registration: Promise<ServiceWorkerRegistration | null> | undefined;
export function registerPwa(): Promise<ServiceWorkerRegistration | null> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !window.isSecureContext ||
    import.meta.env.DEV
  )
    return Promise.resolve(null);
  registration ??= navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((worker) => {
      void warmFirstVisit().catch(() => undefined);
      return worker;
    })
    .catch(() => null);
  return registration;
}
