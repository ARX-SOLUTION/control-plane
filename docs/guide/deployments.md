# Deploy Pipeline

## How Deployments Work

Control Plane uses a **blue-green** strategy for zero-downtime deploys.

```
pending → cloning → building → starting → health_check → switching → success
                                                                    ↘ failed → rolled_back
```

| Step | What happens |
|------|-------------|
| cloning | Git clone or fetch + reset to branch HEAD |
| building | `docker build` from the repo's Dockerfile |
| starting | Container created with env vars injected |
| health_check | HTTP poll on `healthCheckPath` until 200 |
| switching | Caddy upstream updated to new container IP |
| success | Old (blue) container stopped |

## Triggering a Deployment

### Manually

1. Project → **Deployments** tab
2. Click **Deploy Now**
3. Watch the pipeline status update in real time

### Via Webhook (GitHub / GitLab)

1. Project → **Settings / VCS** tab
2. Click **Generate Webhook Secret**
3. Add the webhook URL and secret in your GitHub/GitLab repo settings
4. Every push to the project's branch triggers a deployment to all environments

## Deployment Logs

Click on any deployment row to view build and deploy logs streamed live via WebSocket.

## Rollback

If a deployment fails, the previous (blue) container remains running — traffic is unaffected. Fix the issue and redeploy.

::: info
The Dockerfile must be at the repo root. The container must expose the port configured in **App Port**.
:::
