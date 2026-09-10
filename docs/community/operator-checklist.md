# Operator checklist (ThermalTrace)

Tasks only **you** can complete — everything else in the HACS/integration pass is shipped.

## Growth (winter focus)

- [ ] Drive `/share-kit`, `/freeze-season`, and `/about/esp32-freeze-kit` before the first hard freeze
- [ ] Push freeze-map opt-ins so seed cities give way to live aggregates
- Kit SKU / pre-flash batch is outside this repo (BOM page is ready)

## Google Play

- [ ] When review clears, set `PUBLIC_PLAY_STORE_URL` in `.env` / Worker secrets and redeploy — `/android` flips to Play CTA automatically
- [ ] Update marketing copy if needed beyond the env flip
- [ ] After Play is live, consider iOS (PWA covers Apple users today)
- **Blocked externally** — no listing URL yet; do not invent a placeholder

## Nest / Ecobee (status)

- [x] **Nest OAuth** — secrets in `.env`; Connect UI live when Worker has `NEST_*` (already marked production-ready below)
- [ ] **Ecobee** — developer signup still closed; keep HA → ingest → Indoor reference workaround

## Waiting on HACS maintainers

- [ ] **[hacs/default#10550](https://github.com/hacs/default/pull/10550)** — still **open** (not merged as of 2026-09-02); default store listing in FIFO review queue
- After merge: flip `HACS_BADGE_URL` in `src/lib/integrationsHub.ts` from Custom → Default badge

## Growth (copy/paste ready)

- [x] **Home Assistant forum** — posted; awaiting moderator approval ([draft](./home-assistant-forum-post.md))
- [x] **Discord / social** — [announcement draft](./discord-hacs-announcement.md) posted

## Thermostat OAuth (Pro feature)

Connect UI stays hidden until Worker secrets exist. Full steps: [thermaltrace.dev/about/thermostat-oauth](https://thermaltrace.dev/about/thermostat-oauth)

Check what's missing locally: `pnpm operator:check`

1. **Nest** — [Device Access Console](https://console.nest.google.com/device-access) + Google Cloud OAuth web client  
   Redirect URI: `https://thermaltrace.dev/api/integrations/nest/callback`  
   **Enable [Smart Device Management API](https://console.cloud.google.com/apis/library/smartdevicemanagement.googleapis.com)** in the GCP project that owns your OAuth client (prefix of `NEST_CLIENT_ID` before the first `-`).  
   Secrets: `NEST_CLIENT_ID`, `NEST_CLIENT_SECRET`, `NEST_PROJECT_ID`

2. **Ecobee** — [Developer portal](https://www.ecobee.com/en-us/developer/) (signups often closed)  
   Redirect URI: `https://thermaltrace.dev/api/integrations/ecobee/callback`  
   Secret: `ECOBEE_CLIENT_ID` (no client secret)  
   **Workaround:** HA → ingest → **Indoor reference** on Dashboard → Devices (see [HA indoor temp guide](https://doodersrage.github.io/thermaltrace/integrations/home-assistant#indoor-temperature-indoor-temperature-ecobee--any-thermostat))

3. Add values to `.env`, then: `pnpm secrets:push`

## WebAuthn MFA

- [ ] Re-enable `MFA_WEBAUTHN_UI_ENABLED` in `src/lib/mfaWebAuthnUi.ts` when Supabase Cloud supports WebAuthn MFA
- **Blocked externally** — do not flip the flag until Supabase documents WebAuthn MFA on the project

## Affiliates (optional commerce)

- [x] Set `PUBLIC_AMAZON_ASSOCIATE_TAG` in `.env` / Worker secrets (`pnpm secrets:push`) — tag live on Worker
- Adafruit has no affiliate program — do not invent an Adafruit tag; those shop links stay direct
- Unset Amazon tag keeps clean amazon.com URLs; shared disclosure (`AffiliateDisclosure`) covers kit / BOM pages
- Prefer `/dp/{ASIN}` product links in `src/lib/bomLinks.ts`; keep search URLs for niche / commodity parts

## Shipped in product (no operator action)

- Overview **first-run focus**: Insights + full Status strip stay hidden until device + freeze email + a test alert
- Signed-in **Live** at `/dashboard/live`; Overview stays risk/trends (product + architecture docs updated 2026-09-10)
- Companion apps: no API sync needed for that dashboard UX pass — see [external-apps-sync.md](./external-apps-sync.md)
- Android **time-to-freeze** clock on Home (consumes `time_to_freeze` from `/api/user/home-insights`)
- Claims pack page includes adjuster talking points (`/claims-pack`)

## Already done (no action)

- HACS integration repo: [thermaltrace-home-assistant](https://github.com/doodersrage/thermaltrace-home-assistant) v1.0.2
- **Nest OAuth + SDM API** — live thermostat readings on Devices
- **Ambient Weather** — `AMBIENT_APPLICATION_KEY` synced; users add station MAC + API key in Settings
- **Ingest key vault** — `INGEST_KEY_ENCRYPTION_SECRET` for Reveal ingest key on Devices
- Product pages: `/integrations`, `/integrations/home-assistant`
- Dashboard share-link → HACS nudge
- Deploy + `pnpm build` in CI
- 15-minute cron polling, stale/battery UX, ops cron-gap alerts
- CI E2E wiring: `pnpm setup:e2e-github-secrets` (syncs test user + Supabase anon key to GitHub)
- GA4 funnel guide: [docs/analytics-funnel.md](../analytics-funnel.md)
- External app doc sync: [external-apps-sync.md](./external-apps-sync.md)
