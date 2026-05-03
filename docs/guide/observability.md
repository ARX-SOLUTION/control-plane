# Logs & Monitoring

## Logs

Control Plane uses **Loki** for log aggregation and **Promtail** for log collection.

### Viewing Logs

1. **Logs** in the sidebar
2. Enter a LogQL query (e.g. `{job="docker"}` for all Docker container logs)
3. Select a time range
4. Click **Run**

### Common LogQL Queries

| Query | Description |
|-------|-------------|
| `{job="docker"}` | All container logs |
| `{container_name="control-plane_app_1"}` | App container only |
| `{container_name=~"app_.*"}` | All deployed app containers |

### Setting Up Loki

If logs are empty, Loki may not be configured. Add to `.env.prod`:
```
LOKI_URL=http://localhost:3100
```

Then deploy Loki + Promtail via Docker Compose and restart the app.

---

## Monitoring

Control Plane embeds **Grafana** dashboards as iframes.

### Viewing Metrics

1. **Monitoring** in the sidebar
2. The main metrics dashboard is shown inline

### Grafana Configuration

In `.env.prod`:
```
GRAFANA_URL=http://localhost:3001
GRAFANA_METRICS_DASHBOARD=<uid>
GRAFANA_DEPLOYMENT_DASHBOARD=<uid>
```

Grafana runs at `localhost:3001` (not exposed publicly). The control-plane backend proxies the embed URLs.

### Available Metrics

- **Node Exporter**: CPU, memory, disk, network per host
- **cAdvisor**: Per-container resource usage
- **Prometheus**: Custom app metrics via OpenTelemetry
