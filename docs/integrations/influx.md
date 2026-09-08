# InfluxDB, Telegraf & VictoriaMetrics

Scrape Pro Prometheus metrics into a long-term TSDB — same endpoint Grafana uses.

- Product guide: [thermaltrace.dev/integrations/influx](https://thermaltrace.dev/integrations/influx)
- Telegraf sample: [thermaltrace.dev/telegraf/thermaltrace.conf](https://thermaltrace.dev/telegraf/thermaltrace.conf)
- Grafana: [Grafana & Prometheus](/integrations/grafana)

```http
GET /api/v1/metrics
Authorization: Bearer <api-key>
```

Metric: `thermaltrace_sensor_value{device,key,kind}` (numeric only).

```bash
export THERMALTRACE_API_KEY=…
export INFLUX_TOKEN=…
export INFLUX_ORG=…
export INFLUX_BUCKET=thermaltrace
telegraf --config thermaltrace.conf
```

For VictoriaMetrics, use the commented `outputs.http` Prometheus remote-write block in the sample config.
