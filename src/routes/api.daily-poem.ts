import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/daily-poem")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleScheduledPoem } = await import("@/lib/poem-scheduler.server");
        return handleScheduledPoem(request);
      },
      POST: async ({ request }) => {
        const { handleScheduledPoem } = await import("@/lib/poem-scheduler.server");
        return handleScheduledPoem(request);
      },
    },
  },
});
