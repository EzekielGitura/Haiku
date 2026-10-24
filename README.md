# For Silvia

My daily confession: a public daily haiku, “my gentle surrender” in Korean and English, and a living sky. No account is needed to read, share, download, or browse completed poems.

## Run locally

Use Node.js 22.12+ (Node 24 LTS recommended) and npm. Copy `.env.example` to `.env` and fill in your own values. A welcome poem remains available while generation is unconfigured.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm start
```

Development is at http://localhost:3000. Production builds a Node server in `.output/` using standard Vite, TanStack Start, and Nitro. The start command loads a local `.env` when present; deployed environment variables take precedence.

## Daily writing

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GROQ_API_KEY` on the server. `GROQ_MODEL` is optional (default `openai/gpt-oss-120b`, hosted by GroqCloud). These names have no `VITE_` prefix: service credentials must stay on the server. The API request goes directly to [Groq's Responses API](https://console.groq.com/docs/responses-api) and uses strict JSON output, low reasoning effort, and one request per claimed date. The model name identifies the open-weight GPT-OSS model; no OpenAI API account or key is required. Groq's Responses API is currently beta. The model is instructed to count 5/7/5 syllables; structural validation does not guarantee a perfect phonetic count.

For a new database, apply `drizzle/migrations/0000_daily_silvia_haikus.sql` once in the Supabase SQL editor. The date primary key and service-only `claim_daily_poem` function prevent concurrent visitors from buying duplicate generations. Completed poems are read using the publishable client under RLS. Pending records and pause state are private. Preserve existing rows when moving to a separately managed database.

Dates and countdowns roll over at midnight in Nairobi (GMT+3), using `src/lib/poem-rules.ts`. A visitor opening the page starts that date's poem if none exists. There is no preset rotation or final date; each request asks for a new poem, avoids recent imagery, and rejects exact repeats against the archive. The prompt follows the supplied author's intimate, atmospheric voice; the fixed address “my gentle surrender” appears in Korean with an English gloss, separate from the English haiku lines.

To write every day even when nobody visits, set a strong `CRON_SECRET` in Vercel's Production environment. Vercel Cron calls `GET /api/daily-poem` and automatically supplies `Authorization: Bearer <CRON_SECRET>`. The daily schedule is **21:00 UTC** (`0 21 * * *`, midnight Nairobi); cron jobs run on production deployments. Vercel Hobby may invoke a daily job within the scheduled hour, so opening the public page can still start the poem immediately after midnight. Other schedulers can use `POST /api/daily-poem` with the same authorization header. Both methods reuse the same atomic claim and return uncached status summaries. See [Vercel Cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs) and [scheduling precision](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Credit/access failures pause generation and failed dates never automatically replay. After fixing billing or access, the owner can clear `poem_generation_state.paused` using service access to allow future dates. Do not delete failed daily rows to retry them. Interrupted pending claims also remain claimed, preserving the one-request limit.

## Sky and PWA

The lightweight SVG/CSS sky follows Nairobi's seasonal sunrise/sunset. Sunlight, cloud cover, twilight, and stars vary through the day; the moon uses a mean lunar-cycle approximation. Clouds simulate cover rather than report live weather. The sky and cherubs respect reduced-motion settings.

Deploy over HTTPS with a running server (a static-only host cannot run daily generation). The manifest, home-screen icons, and service worker enable installation. The header's “Add to home” action uses the browser's install prompt where supported and offers instructions elsewhere. iPhone users can install from Safari's Share menu.

After an online visit, the PWA caches its public pages/assets and up to 365 completed poems on that device. Offline poems keep their original dates and show an offline label. A generic welcome poem is never presented as today's generated poem. Network reconnection restores public reads. POST requests, server-function/API responses, external data, and generation failures are never cached by the service worker. The full database archive is retained independently of the device's offline limit.

## Deployment references

### Vercel

The included `vercel.json` selects TanStack Start and schedules `/api/daily-poem` once daily at 21:00 UTC. Vite selects Nitro's Vercel adapter on Vercel, uses Node 24, and allows 120 seconds for server requests. Local `npm start` continues to use the Node server adapter.

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, and a random `CRON_SECRET` in the project's **Production** environment variables. Keep the service key, Groq key, and scheduler secret sensitive. Redeploy after changing variables. No `VITE_` variables are needed.

In **Settings → Environment Variables → Add Environment Variable**, choose **Secret**, enter `GROQ_API_KEY` as the key, paste your GroqCloud key into Value, select **Production**, and save. Use a Free-plan key if you want to stay within Groq's free quota. `GROQ_MODEL` does not need to be added unless changing the default model. For local development, put the key in the ignored `.env` file; `.env.example` contains placeholders only.

From this folder, deploy using the Vercel CLI:

```sh
vercel login
vercel link
vercel --prod
```

The source is uploaded and built on Vercel; a Git repository is optional for CLI deployment. `.vercelignore` excludes local secrets and generated output. For automatic deployments later, connect a Git repository in the Vercel project settings. Check the live home page, `/collection`, and PWA installation over HTTPS. The cron endpoint should return 401 without its authorization header.

The build follows the official [TanStack Start hosting setup](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) and [Nitro Vite integration](https://nitro.build/docs/vite). Any Node hosting service can run `npm ci`, `npm run build`, and `npm start`; set secrets in its environment and configure its daily scheduler if desired.
