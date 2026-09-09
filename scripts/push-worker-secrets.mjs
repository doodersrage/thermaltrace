#!/usr/bin/env node
/**
 * Push Worker secrets from .env using wrangler secret bulk.
 * Usage: pnpm secrets:push [--env-file .env] [--dry-run]
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { parseEnvFile as parseEnvText } from "./parseEnvFile.mjs";

const SECRET_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GARAGE_TEMP_FEED_URL",
  "OPENWEATHER_API_KEY",
  "OPENWEATHER_CITY_ID",
  "AMBIENT_APPLICATION_KEY",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_TOKEN",
  "SMTP_MAIL_FROM",
  "SMTP_MAIL_TO",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID",
  "STRIPE_PRICE_ID_PRO",
  "STRIPE_PRICE_ID_ANNUAL",
  "STRIPE_PRICE_ID_PRO_ANNUAL",
  "STRIPE_PRICE_ID_PORTFOLIO",
  "STRIPE_PRICE_ID_PORTFOLIO_ANNUAL",
  "STRIPE_DISPLAY_MEMBER_MONTHLY",
  "STRIPE_DISPLAY_MEMBER_ANNUAL",
  "STRIPE_DISPLAY_PRO_MONTHLY",
  "STRIPE_DISPLAY_PRO_ANNUAL",
  "STRIPE_DISPLAY_PORTFOLIO_MONTHLY",
  "STRIPE_DISPLAY_PORTFOLIO_ANNUAL",
  "PRICING_DEFAULT_INTERVAL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "FCM_SERVICE_ACCOUNT_JSON",
  "FCM_PROJECT_ID",
  "FCM_CLIENT_EMAIL",
  "FCM_PRIVATE_KEY",
  "SITE_URL",
  "ORIGIN",
  "PUBLIC_AMAZON_ASSOCIATE_TAG",
  "PUBLIC_PLAY_STORE_URL",
  "CRON_SECRET",
  "ALERT_ACK_SECRET",
  "MFA_STEPUP_SECRET",
  "INGEST_KEY_ENCRYPTION_SECRET",
  "OPS_DISCORD_WEBHOOK_URL",
  "YUBICO_CLIENT_ID",
  "YUBICO_API_KEY",
  "NEST_CLIENT_ID",
  "NEST_CLIENT_SECRET",
  "NEST_PROJECT_ID",
  "ECOBEE_CLIENT_ID",
  "SENTRY_DSN",
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const envFileArg = args.find((a) => a.startsWith("--env-file="));
const envPath = resolve(envFileArg?.split("=")[1] ?? ".env");

let parsed;
try {
  parsed = parseEnvText(readFileSync(envPath, "utf8"));
} catch (error) {
  console.error(`Could not read ${envPath}:`, error.message);
  process.exit(1);
}

const secrets = {};
for (const key of SECRET_KEYS) {
  const value = parsed[key]?.trim();
  if (value) secrets[key] = value;
}

const fcmJson = secrets.FCM_SERVICE_ACCOUNT_JSON;
if (fcmJson) {
  try {
    const account = JSON.parse(fcmJson);
    if (!account?.project_id || !account?.client_email || !account?.private_key) {
      console.error(
        "FCM_SERVICE_ACCOUNT_JSON parses but is missing project_id, client_email, or private_key.",
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("FCM_SERVICE_ACCOUNT_JSON is not valid JSON after env unquote:", error.message);
    process.exit(1);
  }
}

const missing = SECRET_KEYS.filter((k) => !secrets[k]);
const critical = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const missingCritical = critical.filter((k) => !secrets[k]);

if (missingCritical.length > 0) {
  console.error("Missing required secrets in env file:", missingCritical.join(", "));
  process.exit(1);
}

console.log(`Prepared ${Object.keys(secrets).length} secrets (${missing.length} optional keys empty).`);

if (dryRun) {
  console.log("Dry run — would push:", Object.keys(secrets).join(", "));
  console.log("Dry run — would write .dev.vars with the same keys.");
  process.exit(0);
}

const devVarsPath = resolve(".dev.vars");
const devVarsBody = Object.entries(secrets)
  .map(([key, value]) => {
    const escaped =
      value.includes("\n") || value.includes('"') || value.includes(" ")
        ? `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
        : value;
    return `${key}=${escaped}`;
  })
  .join("\n")
  .concat("\n");
writeFileSync(devVarsPath, devVarsBody);
console.log(`Wrote ${Object.keys(secrets).length} keys to .dev.vars for local dev.`);

const tmp = resolve(".wrangler-secrets.json");
writeFileSync(tmp, JSON.stringify(secrets, null, 2));

try {
  execSync("pnpm exec wrangler secret bulk .wrangler-secrets.json", {
    stdio: "inherit",
    cwd: resolve("."),
  });
  console.log("Worker secrets updated.");
} finally {
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
}
