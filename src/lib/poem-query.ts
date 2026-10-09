import { queryOptions } from "@tanstack/react-query";
import { readPoems } from "./poems.functions";
import {
  readOfflinePoems,
  saveOfflinePoems,
  markConnectionOffline,
  markConnectionOnline,
} from "./pwa";

export const poemsOptions = queryOptions({
  queryKey: ["poems"],
  queryFn: async () => {
    try {
      const poems = await readPoems();
      saveOfflinePoems(poems);
      markConnectionOnline();
      return poems;
    } catch {
      markConnectionOffline();
      // Keep the public reading experience available during network outages.
      return readOfflinePoems();
    }
  },
  staleTime: 60_000,
  refetchInterval: 60_000,
  refetchOnReconnect: "always",
});
