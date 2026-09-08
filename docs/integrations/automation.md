# IFTTT, n8n & Sheets

Pro outbound alert webhooks work with IFTTT Maker, self-hosted n8n, Zapier, and Make.

- Product guide: [thermaltrace.dev/integrations/automation](https://thermaltrace.dev/integrations/automation)
- Zapier/Make: [thermaltrace.dev/about/zapier-make-recipes](https://thermaltrace.dev/about/zapier-make-recipes)
- n8n → Sheets workflow: [thermaltrace.dev/n8n/thermaltrace-alert-to-sheets.json](https://thermaltrace.dev/n8n/thermaltrace-alert-to-sheets.json)

## Outbound payload

```json
{
  "title": "Garage temperature alert",
  "body": "Probe 1 is 31.2°F …",
  "kind": "threshold",
  "sent_at": "2026-08-25T12:00:00.000Z"
}
```

Verify `X-Signature` (HMAC-SHA256 hex) when a webhook secret is set. See [Alert webhooks](/integrations/webhooks).

## Inbound snooze

`POST /api/inbound/{token}` with `{"action":"snooze","hours":24}` and `X-ThermalTrace-Signature`.
