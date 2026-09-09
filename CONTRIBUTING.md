# Contributing

Thanks for helping improve ThermalTrace. Issue creation on this repo is currently restricted, so **bugs, feature ideas, account, billing, and household questions** all go through the [contact form](https://thermaltrace.dev/contact) for now. Code contributions are still welcome as PRs — see below.

Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Details: [Local development](https://doodersrage.github.io/thermaltrace/guide/local-dev). Do not commit `.env` or secrets.

## Before you open a PR

```bash
pnpm test
pnpm typecheck
pnpm lint
```

CI on `main` and pull requests runs `pnpm test`, `pnpm build`, Playwright E2E (`pnpm test:e2e`), and Lighthouse. Sync E2E secrets to GitHub with `pnpm setup:e2e-github-secrets` after setting `E2E_TEST_*` and Supabase keys in `.env`. UI changes should stay consistent across pages that share the same state.

The **import-guard** suite (`src/lib/astroImportGuard.test.ts`) fails if an Astro page renders a component it never imports.

## Branch and PR conventions

- Fork and open a PR against `main`
- Keep the change focused; say **why** in the PR description
- Prefer one-line commit messages in present tense (see `git log`)
- Hardware / ingest bugs: include board, sensors, expected vs observed readings, and feed URLs when you have them

## Where docs live

| Audience | Place |
|----------|--------|
| First-time clone | Root [README.md](./README.md) |
| Env, cron, deploy | [Developer docs](https://doodersrage.github.io/thermaltrace/) (`docs/`) |
| Wiring and freeze playbooks | [Guides hub](https://thermaltrace.dev/guides) |
