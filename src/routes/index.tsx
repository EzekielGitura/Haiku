import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Heart,
  Sparkles,
  Share2,
  Clock3,
  CalendarDays,
  Feather,
  Download,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LivingSky } from "@/components/living-sky";
import { Cherubs } from "@/components/cherubs";
import { SilviaHeader, SilviaFooter } from "@/components/silvia-shell";
import { generateToday } from "@/lib/poems.functions";
import { poemsOptions } from "@/lib/poem-query";
import { downloadPoem, POEM_DOWNLOAD_MESSAGE } from "@/lib/poem-download";
import { useOnlineStatus, readOfflinePoems, saveOfflinePoems } from "@/lib/pwa";
import {
  silviaDay,
  untilNextPoem,
  welcomePoem,
  koreanEndearment,
  type Poem,
} from "@/lib/poem-rules";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "For Silvia — my daily confession" },
      {
        name: "description",
        content:
          "A new haiku for Silvia every day, beneath a living sky of clouds, sunlight, moonlight and stars.",
      },
      { property: "og:title", content: "For Silvia — my daily confession" },
      {
        property: "og:description",
        content: "Three little lines. An endless amount of love. A daily haiku just for Silvia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(poemsOptions),
  component: Index,
});

function Index() {
  const { data: poems } = useSuspenseQuery(poemsOptions);
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const [now, setNow] = useState<Date | null>(null);
  const [generated, setGenerated] = useState<Poem | null>(null);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const writePoem = useServerFn(generateToday);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const cached = readOfflinePoems();
    if (
      !online &&
      cached.length &&
      (cached.length > poems.length || !poems.length || cached[0]!.day > poems[0]!.day)
    )
      queryClient.setQueryData(poemsOptions.queryKey, cached);
    else saveOfflinePoems(poems);
  }, [online, poems, queryClient]);
  const day = now ? silviaDay(now) : "";
  const today =
    (generated?.day === day ? generated : null) || poems.find((poem) => poem.day === day);
  const lastSaved = !online ? poems.find((item) => item.day <= day) : undefined;
  const poem = today || lastSaved || welcomePoem;
  const endearment = koreanEndearment();
  useEffect(() => {
    if (!day || today || !online) return;
    let active = true;
    let polling: ReturnType<typeof setTimeout> | undefined;
    let checks = 0;
    setWriting(true);
    setError("");
    const check = async () => {
      try {
        const result = await writePoem();
        if (!active) return;
        if (result.poem) {
          setGenerated(result.poem);
          setWriting(false);
          queryClient.setQueryData<Poem[]>(poemsOptions.queryKey, (old) => [
            result.poem!,
            ...(old || []).filter((item) => item.day !== result.poem!.day),
          ]);
        } else if (result.pending && ++checks < 24) polling = setTimeout(check, 5000);
        else if (result.pending) {
          setError("Today’s poem is taking a little longer. Please return soon.");
          setWriting(false);
        } else {
          setError(result.error || "Today’s poem is unavailable.");
          setWriting(false);
        }
      } catch (failure) {
        if (active) {
          setWriting(false);
          setError(failure instanceof Error ? failure.message : "Your poem could not be opened.");
        }
      }
    };
    check();
    return () => {
      active = false;
      if (polling) clearTimeout(polling);
    };
  }, [day, today, online, writePoem, queryClient]);
  const remaining = now ? untilNextPoem(now) : 0;
  const countdown = now
    ? [
        Math.floor(remaining / 3_600_000),
        Math.floor(remaining / 60_000) % 60,
        Math.floor(remaining / 1000) % 60,
      ]
        .map((value) => String(value).padStart(2, "0"))
        .join(" : ")
    : "— : — : —";
  const dateLabel = poem.day
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Nairobi",
      }).format(new Date(`${poem.day}T12:00:00Z`))
    : "A little welcome poem";
  async function share() {
    const text = `For Silvia · ${dateLabel}\n${endearment.korean}\n\n${poem.line_one}\n${poem.line_two}\n${poem.line_three}\n\n언제나 너를 사랑해`;
    try {
      if (navigator.share) await navigator.share({ title: "For Silvia", text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 3000);
    } catch (failure) {
      if (failure instanceof Error && failure.name !== "AbortError")
        setError("Sharing is unavailable. You can save the poem instead.");
    }
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      await downloadPoem(poem, dateLabel);
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    } catch {
      setSaveError("Your poem image couldn’t be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="silvia-page">
      <LivingSky />
      <SilviaHeader />
      <Cherubs />
      <main className="daily-main">
        <div className="daily-eyebrow">
          <Sparkles size={12} strokeWidth={1.3} /> my daily confession
        </div>
        <h1>
          For you, <em>Silvia.</em>
        </h1>
        <div className="korean-endearment">
          <span lang="ko">{endearment.korean}</span>
          <span>{endearment.translation}</span>
        </div>
        <p className="daily-subtitle">
          Three little lines. An endless amount of love.
          <br />A new haiku, just for you, every day.
        </p>
        <article
          className="poem-paper"
          aria-label={poem.day ? `Haiku for ${dateLabel}` : "Welcome haiku"}
        >
          <span className="paper-corner corner-tl" />
          <span className="paper-corner corner-tr" />
          <span className="paper-corner corner-bl" />
          <span className="paper-corner corner-br" />
          <div className="poem-date">
            <CalendarDays size={11} strokeWidth={1.3} />
            {poem.day ? dateLabel : "A LITTLE WELCOME POEM"}
          </div>
          <div className="poem-flourish">
            <Heart size={15} strokeWidth={1} />
          </div>
          <div className="poem-lines">
            <p>{poem.line_one}</p>
            <p>{poem.line_two}</p>
            <p>{poem.line_three}</p>
          </div>
          <div className="poem-signature" lang="ko">
            언제나 너를 사랑해
          </div>
          <span className="poem-count">5 · 7 · 5</span>
        </article>
        {!online && (
          <p className="poem-status" role="status">
            Offline ·{" "}
            {poem.day
              ? "your last saved poem, kept with its original date."
              : "a welcome poem, until we’re connected again."}{" "}
            A new daily haiku needs a connection.
          </p>
        )}
        {online && writing && (
          <p className="poem-status" role="status">
            My daily confession is finding its words…
          </p>
        )}
        {online && error && (
          <p className="poem-status poem-status-error" role="alert">
            {error}
          </p>
        )}
        <div className="poem-actions">
          <Button
            className="keep-poem-button"
            onClick={save}
            disabled={saving}
            aria-busy={saving}
            title="Save this haiku as a blue-sky image"
          >
            {saved ? <Check size={14} /> : <Heart size={14} strokeWidth={1.5} />}
            {saving
              ? "Preparing your keepsake…"
              : saved
                ? "Saved with love"
                : "Keep this little poem"}
            <Download size={12} strokeWidth={1.4} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="share-poem-button"
            aria-label={shared ? "Poem copied" : "Share poem"}
            title={shared ? "Poem copied" : "Share poem"}
            onClick={share}
          >
            {shared ? <Check size={14} /> : <Share2 size={14} strokeWidth={1.4} />}
          </Button>
        </div>
        {saved && (
          <p className="poem-status" role="status">
            {POEM_DOWNLOAD_MESSAGE}
          </p>
        )}
        {saveError && (
          <p className="poem-status poem-status-error" role="alert">
            {saveError}
          </p>
        )}
        <div className="next-poem">
          <Clock3 size={12} strokeWidth={1.4} />
          <span>Next daily haiku at midnight</span>
          <strong>{countdown}</strong>
          <span className="timezone">GMT+3</span>
        </div>
      </main>
      <section className="love-note">
        <div className="love-note-label">
          <Feather size={13} strokeWidth={1.3} /> A NOTE FROM MY HEART
        </div>
        <p>
          “I carry this longing for you
          <br />
          like a candle cupped against the wind.”
        </p>
        <p className="note-signature" lang="ko">
          나의 다정한 항복, 너는 나의 집이야.
        </p>
      </section>
      <SilviaFooter />
    </div>
  );
}
