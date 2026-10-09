import { createHash, timingSafeEqual } from "node:crypto";
import { silviaDay } from "./poem-rules";
import { getDailyPoem, type DailyPoemResult } from "./poems.server";

function authorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const supplied = request.headers.get("Authorization");
  if (!supplied) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`));
}

export async function handleScheduledPoem(
  request: Request,
  {
    secret = process.env["CRON_SECRET"],
    generate = getDailyPoem,
  }: { secret?: string; generate?: () => Promise<DailyPoemResult> } = {},
): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(request, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  const day = silviaDay();
  try {
    const result = await generate();
    if (result.poem)
      return Response.json({ status: "complete", day: result.poem.day }, { headers });
    if (result.pending) return Response.json({ status: "pending", day }, { status: 202, headers });
    return Response.json(
      { status: "unavailable", day, message: "Daily generation needs the site owner’s attention." },
      { status: 503, headers },
    );
  } catch {
    return Response.json(
      { status: "unavailable", day, message: "Daily generation needs the site owner’s attention." },
      { status: 503, headers },
    );
  }
}
