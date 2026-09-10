#!/usr/bin/env node
/**
 * Operator readiness check — which optional deployment secrets are set in .env.
 * Usage: pnpm operator:check [--env-file .env]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envFile = process.argv.includes("--env-file")
  ? process.argv[process.argv.indexOf("--env-file") + 1]
  : ".env";

const path = resolve(process.cwd(), envFile);
let raw = "";
try {
  raw = readFileSync(path, "utf8");
} catch {
  console.error(`Could not read ${path}`);
  process.exit(1);
}

const values = new Map();
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  values.set(key, value);
}

function isSet(key) {
  const v = values.get(key);
  return Boolean(v && v.trim());
}

const groups = [
  {
    title: "Push ingest key recovery (Reveal key on Devices)",
    keys: ["INGEST_KEY_ENCRYPTION_SECRET"],
    doc: "https://thermaltrace.dev/dashboard/devices",
  },
  {
    title: "YubiKey OTP (YubiCloud)",
    keys: ["YUBICO_CLIENT_ID", "YUBICO_API_KEY"],
    doc: "https://upgrade.yubico.com/getapikey/",
  },
  {
    title: "Nest thermostat OAuth",
    keys: ["NEST_CLIENT_ID", "NEST_CLIENT_SECRET", "NEST_PROJECT_ID"],
    doc: "https://thermaltrace.dev/about/thermostat-oauth",
  },
  {
    title: "Ecobee thermostat OAuth",
    keys: ["ECOBEE_CLIENT_ID"],
    doc: "https://thermaltrace.dev/about/thermostat-oauth",
  },
  {
    title: "Ambient Weather (personal stations)",
    keys: ["AMBIENT_APPLICATION_KEY"],
    doc: "https://thermaltrace.dev/about/personal-weather-stations",
  },
];

console.log(`Operator secret check (${path})\n`);

let anyMissing = false;
for (const group of groups) {
  const missing = group.keys.filter((k) => !isSet(k));
  const ready = missing.length === 0;
  if (!ready) anyMissing = true;
  console.log(`${ready ? "✓" : "○"} ${group.title}`);
  if (missing.length > 0) {
    console.log(`    Missing: ${missing.join(", ")}`);
  }
  if (group.title === "Nest thermostat OAuth" && isSet("NEST_CLIENT_ID")) {
    const gcpProject = values.get("NEST_CLIENT_ID")?.split("-")[0];
    if (gcpProject) {
      console.log(
        `    Also enable SDM API: https://console.developers.google.com/apis/api/smartdevicemanagement.googleapis.com/overview?project=${gcpProject}`,
      );
    }
  }
  console.log(`    Docs: ${group.doc}`);
  console.log(`    When ready: pnpm secrets:push`);
  console.log("");
}

console.log("Growth (manual):");
console.log("  • HA forum post: docs/community/home-assistant-forum-post.md");
console.log("  • Discord/social: docs/community/discord-hacs-announcement.md");
console.log("  • HACS default PR: https://github.com/hacs/default/pull/10550");

process.exit(anyMissing ? 1 : 0);
