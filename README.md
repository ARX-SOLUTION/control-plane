# Control Plane

Self-hosted single-server mini-PaaS. One admin manages projects, deployments, databases, env vars, domains, logs, and metrics — a stripped-down Coolify/Dokploy for one operator and one host.

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20+, pnpm |
| Framework | NestJS 11+ |
| Database | PostgreSQL 16 (main + audit) |
| ORM | Drizzle |
| Queue / Cache | Redis 7 + BullMQ |
| Event bus | RabbitMQ |
| Reverse proxy | Caddy 2 |
| DNS | Cloudflare API |
| Containers | Docker (dockerode) |
| Tracing | OpenTelemetry → OTLP |
| Logs | Loki |
| Metrics | Prometheus |

## Features

- **Projects** — CRUD, GitHub URL, build/start commands, health check config
- **Environments** — dev / staging / prod per project
- **Env vars** — AES-256-GCM envelope-encrypted, versioned, reveal endpoint
- **Deployments** — blue-green zero-downtime, full state machine via BullMQ
- **Databases** — provision PostgreSQL / Redis containers per project (encrypted credentials)
- **Domains** — Cloudflare DNS A record + Caddy reverse proxy route
- **VCS webhooks** — GitHub (HMAC-SHA256) and GitLab (token) push → auto-deploy
- **Logs** — Loki query proxy + WebSocket live tail
- **Monitoring** — Prometheus PromQL proxy + Alertmanager webhook receiver
- **Notifications** — email (SMTP), Telegram, generic webhook via RabbitMQ events
- **Backup** — `pg_dump` on demand, stored in `/data/backups/`
- **Grafana** — iframe panel URL config endpoint
- **Tracing** — OpenTelemetry SDK with gRPC OTLP export
- **Rate limiting** — Redis sliding window on login (5 req / 15 min / IP+email)
- **Audit log** — separate Postgres DB, INSERT-only role

---

## Development Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start infrastructure

```bash
docker compose -f docker-compose.dev.yml up -d
```

Starts PostgreSQL (main + audit), Redis, and RabbitMQ locally.

### 3. Configure environment

```bash
cp .env.prod.example .env
```

Minimum required values for development:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/control_plane
AUDIT_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/control_plane_audit
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
SESSION_SECRET=dev-secret-at-least-32-characters-xx
MASTER_KEY=0000000000000000000000000000000000000000000000000000000000000001
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme123
```

### 4. Run migrations

```bash
pnpm db:migrate
pnpm db:migrate:audit
```

### 5. Start the app

```bash
pnpm start:dev
```

API: `http://localhost:3000/api`

---

## Production Deployment

### Prerequisites

- A server with Docker installed (`curl -fsSL https://get.docker.com | sh`)
- A domain pointing to the server's IP (A record in DNS)
- Ports 80 and 443 open

### 1. Clone and configure

```bash
git clone <repo-url> control-plane && cd control-plane
cp .env.prod.example .env.prod
```

Fill in all `CHANGE_ME` values:

| Variable | How to generate |
|---|---|
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `MASTER_KEY` | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | strong random password |
| `POSTGRES_AUDIT_PASSWORD` | strong random password |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first-time login credentials |
| `SERVER_IP` | server's public IP |
| `CONTROL_PLANE_DOMAIN` | e.g. `cp.example.com` |
| `ACME_EMAIL` | email for Let's Encrypt TLS |

### 2. Deploy

```bash
docker compose -f docker-compose.prod.yml up -d
```

What happens on first start:
1. PostgreSQL (main + audit) starts and becomes healthy
2. Migration container applies all pending migrations, then exits
3. App starts (waits for migrations to complete)
4. Caddy provisions a TLS certificate automatically

API: `https://cp.example.com/api`

### 3. First login

```bash
curl -c cookies.txt -X POST https://cp.example.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"your-password"}'
```

> **Important:** Back up `MASTER_KEY` somewhere safe. Losing it makes all encrypted secrets (env vars, DB passwords, webhook secrets) unrecoverable.

---

## Scripts

```bash
pnpm start:dev          # development with hot-reload
pnpm build              # compile TypeScript → dist/

pnpm db:generate        # generate migration from schema changes (main DB)
pnpm db:generate:audit  # generate migration (audit DB)
pnpm db:migrate         # apply migrations (main DB)
pnpm db:migrate:audit   # apply migrations (audit DB)
pnpm db:studio          # Drizzle Studio GUI (main DB)
```

---

## API Reference

All endpoints require a valid session cookie except VCS webhooks and the Alertmanager webhook.

### Auth

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/login` | Rate-limited: 5 attempts / 15 min / IP+email |
| `POST` | `/api/auth/logout` | |
| `GET` | `/api/auth/me` | |

### Projects

| Method | Path |
|---|---|
| `GET` | `/api/projects` |
| `POST` | `/api/projects` |
| `GET` | `/api/projects/:id` |
| `PATCH` | `/api/projects/:id` |
| `DELETE` | `/api/projects/:id` |

### Environments

| Method | Path |
|---|---|
| `GET` | `/api/environments?projectId=` |
| `POST` | `/api/environments` |
| `DELETE` | `/api/environments/:id` |

### Env Vars

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/env-vars?environmentId=` | Values hidden |
| `POST` | `/api/env-vars` | Create or update |
| `POST` | `/api/env-vars/:id/reveal` | Decrypt and return plaintext |
| `DELETE` | `/api/env-vars/:id` | |

### Deployments

| Method | Path |
|---|---|
| `GET` | `/api/deployments?environmentId=` |
| `POST` | `/api/deployments` |
| `GET` | `/api/deployments/:id` |
| `POST` | `/api/deployments/:id/cancel` |

**States:** `pending → cloning → building → starting → health_check → switching → success / failed / rolled_back`

### Databases

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/databases` | Provision a PG or Redis container |
| `GET` | `/api/databases?projectId=` | |
| `GET` | `/api/databases/:id` | |
| `POST` | `/api/databases/:id/connection-string` | Decrypted connection URL |
| `DELETE` | `/api/databases/:id` | Stops and removes the container |

### Domains

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/domains` | Creates Cloudflare A record + Caddy route |
| `GET` | `/api/domains?environmentId=` | |
| `DELETE` | `/api/domains/:id` | Removes DNS record + Caddy route |

### VCS Webhooks

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/api/vcs/:id/webhook-secret` | Session | Generate / rotate secret (shown once) |
| `DELETE` | `/api/vcs/:id/webhook-secret` | Session | Revoke |
| `GET` | `/api/vcs/:id/branches` | Session | List remote branches |
| `POST` | `/api/vcs/webhook/github/:id` | HMAC-SHA256 | Push → auto-deploy |
| `POST` | `/api/vcs/webhook/gitlab/:id` | X-Gitlab-Token | Push → auto-deploy |

**GitHub webhook setup:**
1. `POST /api/vcs/:projectId/webhook-secret` — save the returned secret
2. GitHub repo → Settings → Webhooks → Add webhook:
   - Payload URL: `https://cp.example.com/api/vcs/webhook/github/:projectId`
   - Content type: `application/json`
   - Secret: paste from step 1
   - Events: **Just the push event**

### Logs

| Method | Path |
|---|---|
| `GET` | `/api/logs?query={app="my-app"}&start=&end=&limit=100` |
| `WS` | `/api/logs/stream` — send `{"type":"subscribe","data":{"query":"...","start":"..."}}` |

### Monitoring

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/monitoring/query?query=up` | Prometheus instant query |
| `GET` | `/api/monitoring/query_range?query=up&start=&end=&step=60s` | Range query |
| `POST` | `/api/monitoring/webhook` | Alertmanager receiver (no auth) |

### Backup

| Method | Path |
|---|---|
| `POST` | `/api/backup/trigger` |
| `GET` | `/api/backup` |
| `DELETE` | `/api/backup/:name` |

### Grafana

| Method | Path |
|---|---|
| `GET` | `/api/grafana/config` |
| `GET` | `/api/grafana/panel?dashboard=abc123&panelId=5` |

### Notifications

| Method | Path |
|---|---|
| `POST` | `/api/notifications/test` |

---

## Architecture

```
Internet
   │
   ▼
Caddy (:80/:443)
   │
   ├─► /api/*  →  NestJS (:3000)
   │               ├─ PostgreSQL  (main + audit)
   │               ├─ Redis       (sessions + BullMQ)
   │               ├─ RabbitMQ   (deployment events → notifications)
   │               ├─ Docker socket
   │               └─ Loki / Prometheus
   │
   └─► <subdomain>.example.com  →  managed project containers
```

**Docker networks:**
- `cp_internal` — PostgreSQL, Redis, RabbitMQ, NestJS (isolated, no outbound internet)
- `cp_ingress` — Caddy + NestJS + project public containers
- `proj_<id>_net` — per-project isolation; managed DB containers only

---

## Security

- Session cookies: `HttpOnly`, `SameSite=strict`, signed with `SESSION_SECRET`
- Secrets encrypted with AES-256-GCM (per-secret DEK wrapped with master key)
- Audit DB has an INSERT-only role — records cannot be modified or deleted after the fact
- Rate limiting on login prevents brute-force (5 attempts / 15 min / IP+email)
- Docker socket is mounted into the app container — equivalent to root access on the host

---

## Environment Variables

See [`.env.prod.example`](.env.prod.example) for the full annotated list.
