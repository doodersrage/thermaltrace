# Alert webhooks

Pro accounts can enable an **outbound webhook** under Dashboard → Alerts. Each alert POSTs JSON:

```json
{
  "title": "Garage temperature alert",
  "body": "Probe 1 is 31.2°F …",
  "kind": "threshold",
  "sent_at": "2026-08-25T12:00:00.000Z"
}
```

`kind` may be `threshold`, `rate`, `outage`, `forecast`, `runway` (time-to-freeze remaining hours), `rule`, `digest`, or `generic`.

## HMAC verification

When a webhook secret is configured, requests include:

```http
X-Signature: <hex HMAC-SHA256 of raw body>
```

Verify before acting on the payload (Home Assistant, Zapier code step, custom worker).

## Reading webhooks

Separately, Pro can POST **reading** payloads to a URL for every stored snapshot (high volume — use carefully).
When a signing secret is set, requests include `X-ThermalTrace-Signature` (and the legacy `X-GarageTemp-Signature` alias) as `sha256=<hex>`.

## Home Assistant

**Recommended:** install the [official HACS integration](https://thermaltrace.dev/integrations/home-assistant). Share-link tokens populate temperature, humidity, door, and leak entities; optional Pro **inbound webhooks** expose `thermaltrace.snooze`, `thermaltrace.vacation`, and `thermaltrace.status` services.

For **alerts into HA** (ThermalTrace → Home Assistant), use a Pro **outbound webhook** URL in Dashboard → Alerts, or import the [ThermalTrace webhook blueprint](https://thermaltrace.dev/ha/thermaltrace_webhook.yaml). Verify HMAC with the same secret pattern as inbound calls when configured.

## Zapier / Make / IFTTT / n8n

Use **Webhooks by Zapier → Catch Hook**, IFTTT Maker, or an n8n Webhook node as the outbound URL.
Product recipes:

- [IFTTT, n8n & Sheets](https://thermaltrace.dev/integrations/automation)
- [Zapier & Make](https://thermaltrace.dev/about/zapier-make-recipes)

## Channels beyond webhooks

Email, Discord, Telegram, Slack, Teams, ntfy, Pushover on Free+; SMS / WhatsApp / browser push on Pro when configured.
