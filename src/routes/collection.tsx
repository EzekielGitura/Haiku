import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Heart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SilviaHeader, SilviaFooter } from "@/components/silvia-shell";
import { LivingSky } from "@/components/living-sky";
import { poemsOptions } from "@/lib/poem-query";
import { useOnlineStatus, readOfflinePoems, saveOfflinePoems } from "@/lib/pwa";

export const Route = createFileRoute("/collection")({
  head: () => ({
    meta: [
      { title: "Our Collection — For Silvia" },
      {
        name: "description",
        content:
          "Every little love letter, kept together. Explore Silvia’s collection of daily romantic haikus.",
      },
      { property: "og:title", content: "Our Collection — For Silvia" },
      {
        property: "og:description",
        content: "A collection of three-line love letters, written for Silvia day by day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(poemsOptions),
  component: Collection,
});

function Collection() {
  const { data } = useSuspenseQuery(poemsOptions);
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  useEffect(() => {
    const cached = readOfflinePoems();
    if (
      !online &&
      cached.length &&
      (cached.length > data.length || !data.length || cached[0]!.day > data[0]!.day)
    )
      queryClient.setQueryData(poemsOptions.queryKey, cached);
    else saveOfflinePoems(data);
  }, [online, data, queryClient]);
  return (
    <div className="silvia-page">
      <LivingSky />
      <SilviaHeader />
      <main className="collection-main">
        <h1>Our little collection.</h1>
        <p className="collection-intro">
          Every day, another way to say <span lang="ko">사랑해.</span>
          {!online && (
            <>
              <br />
              Offline · poems saved on this device, with their original dates.
            </>
          )}
        </p>
        {data.length ? (
          <div className="collection-grid">
            {data.map((poem) => (
              <article className="collection-poem" key={poem.day}>
                <time dateTime={poem.day}>
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "Africa/Nairobi",
                  }).format(new Date(`${poem.day}T12:00:00Z`))}
                </time>
                <h2>{poem.title}</h2>
                <p>{poem.line_one}</p>
                <p>{poem.line_two}</p>
                <p>{poem.line_three}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="collection-empty">
            <Heart size={35} strokeWidth={1} />
            <p>Our story begins with today.</p>
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft size={14} />
                Today’s love letter
              </Link>
            </Button>
          </div>
        )}
      </main>
      <SilviaFooter />
    </div>
  );
}
