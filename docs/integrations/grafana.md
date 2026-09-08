# Grafana & Prometheus

Pro API keys expose Prometheus metrics:

```http
GET https://thermaltrace.dev/api/v1/metrics
Authorization: Bearer <api-key>
```

## Grafana

1. Create an API key under **Dashboard → Share**  
2. Add a Prometheus data source (or use Infinity / scrape) pointing at the metrics URL with the Bearer header  
3. Import the dashboard JSON:

- Docs/repo path: [`public/grafana/thermaltrace-dashboard.json`](https://github.com/doodersrage/thermaltrace/blob/main/public/grafana/thermaltrace-dashboard.json)  
- Download: [thermaltrace.dev/grafana/thermaltrace-dashboard.json](https://thermaltrace.dev/grafana/thermaltrace-dashboard.json)

## Example scrape config

```yaml
scrape_configs:
  - job_name: thermaltrace
    metrics_path: /api/v1/metrics
    scheme: https
    static_configs:
      - targets: ["thermaltrace.dev"]
    authorization:
      type: Bearer
      credentials: <your-api-key>
```

Metrics are a single gauge, `thermaltrace_sensor_value`, with `device`, `key`, and `kind` labels (`temperature`, `humidity`, `flood`, …). The bundled dashboard graphs those kinds.

Want InfluxDB or VictoriaMetrics instead of (or in addition to) Grafana? See [InfluxDB & Telegraf](/integrations/influx) and the sample [Telegraf config](https://thermaltrace.dev/telegraf/thermaltrace.conf).

The in-app Share page also shows a Grafana setup wizard with a filled-in snippet for your key.
