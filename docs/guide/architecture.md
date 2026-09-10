# Architecture

ThermalTrace is an **Astro 6** app with **`output: 'server'`** on **Cloudflare Workers**, **Supabase** (Auth + Postgres + RLS), and **Stripe** for paid plans.

```
Sensors / relays ──push or pull──► Cloudflare Worker (Astro)
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
               Supabase DB          Stripe webhooks      Email / SMS / push
               (readings,           (subscriptions)      (alerts, digests)
                devices,
                households)
```

## App shape

- SSR by default; dashboard uses `DashboardLayout` (sidebar + topbar + main) plus shared **property chrome** from the dashboard shell (space switcher, plan, returning-user shortcuts)
- Prefer Astro components; hydrate Preact only where needed (`client:visible` / `client:load`)
- Shared chrome under `src/components/dashboard/`
- **Live** (`src/pages/dashboard/live.astro`) — signed-in current readings (probe cards, optional outdoor weather, offline warnings). Companion apps and share links use the same readings APIs; this page is web-only chrome.
- **Overview** (`src/pages/dashboard.astro`) — risk and trends, not live cards. Loads Simple or Insights mode (`dashboardOverviewMode`). Until essentials are done (device + freeze email + test alert), **first-run focus** hides the Status strip and Insights cards. Status metrics and Insights cards are derived in `src/lib/overviewExtras.ts`, `freezeHours.ts`, and `heatingInsights.ts`. A forecast-backed **time-to-freeze** clock (`src/lib/spaceThermalModel.ts`) models this unheated space's lag vs outdoor hourly forecast and can alert on remaining hours before the probe crosses freeze. Week/history charts (`HistoryChart.tsx`) optionally overlay humidity and dew point from `ChartPoint.humidity` (probe curves load on Simple and Insights; heavy weather/Open-Meteo stays Insights-only).
- Dense pages split into panes: **Devices** Setup vs Status, **Alerts** Activity vs Settings, **Share** links / integrations / API, **History** chart vs exports.

## Mutations

| Flow | Mechanism |
|------|-----------|
| Prefs, alert settings, snooze, invites | Astro Actions (`src/actions/`) |
| Devices, feeds, Stripe, ingest, admin | `src/pages/api/**` |
| Background | `src/worker.ts` `scheduled` (15‑min history poll; hourly maintenance) |

## Data model (conceptual)

- **Households** own devices and memberships (roles: owner, member, viewer, …)
- **Devices** are push or pull; **sensors** map JSON keys → labels / kinds
- **Readings** store history; raw rows roll up on a retention schedule
- **Alert settings** drive freeze / humidity / leak / outage / forecast / time-to-freeze remaining-hours / channel fan-out (`src/lib/alerts.ts`, `notify.ts`, `spaceThermalModel.ts`). Shared form parsing: `src/lib/alertSettingsForm.ts`
- Canonical storage is **household devices + sensors + readings** (legacy temp-feed rows auto-migrate into Devices)

## Background jobs

Hourly cron (`0 * * * *`) plus quarter-hour history polls (`15,30,45 * * * *`) in `wrangler.jsonc` run via `src/worker.ts`:

- Collect history snapshots (every 15 minutes)
- Evaluate alerts on each poll (pull feeds when available; otherwise latest stored readings — push-only households included)
- Freeze-map city aggregates (opt-in)
- Trial reminders and onboarding drips
- Monthly / quarterly reports on schedule
- Retention / housekeeping as configured

Push ingest also evaluates threshold, leak, and rule alerts immediately (same cooldowns as cron). Weekly digests send **Monday 08:00 UTC** when enabled.

Failed jobs appear on the Jobs admin UI and notify ops via `SMTP_MAIL_TO` and optional `OPS_DISCORD_WEBHOOK_URL`.

Manual history collection (Bearer `CRON_SECRET`; per-IP rate limited):

```bash
curl -X POST https://your-domain/api/cron/collect-history \
  -H "Authorization: Bearer $CRON_SECRET"
```

Push ingest (`POST /api/ingest/<key>`): ~64KB max payload, ~60 req/min/device (per Worker isolate).

## Conventions

Cursor rules under [`.cursor/rules/`](https://github.com/doodersrage/thermaltrace/tree/main/.cursor/rules) cover Astro architecture, design tokens, dashboard hydration, and performance.

An **import-guard** Vitest suite (`src/lib/astroImportGuard.test.ts`) fails CI if a page renders a component it never imports.

## Repo map

```
src/pages/api/ingest/   Push ingest
src/lib/                Devices, alerts, mailer, Stripe, households
src/worker.ts           fetch + cron
supabase/migrations/    Schema + RLS
sketches/               Sample firmware
docs/                   This VitePress site → GitHub Pages
public/openapi.yaml     HTTP API contract
```

## Related

- [Local development](/guide/local-dev) — env, database, scripts
- [Deploy & ops](/guide/deploy) — Worker secrets, email sending, post-deploy checklist
- Product DIY guides: [thermaltrace.dev/about](https://thermaltrace.dev/about)
