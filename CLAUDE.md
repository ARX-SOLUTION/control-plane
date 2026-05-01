# Control Plane — Project Context for Claude

## MANDATORY: Obsidian Memory Integration

**CRITICAL REQUIREMENT:** Claude MUST use the Obsidian memory system at `/Users/admin/Documents/claude-node/` for all persistent knowledge and cross-linking. This is non-negotiable.

**Required actions on EVERY session:**
1. **Search existing wiki** before creating new memory entries
2. **Create/update project entity**: `[[entities/control-plane]]`
3. **Cross-link all relevant entities**: `[[entities/NestJS]]`, `[[entities/PostgreSQL]]`, `[[entities/Drizzle]]`, `[[entities/Docker]]`, etc.
4. **Document design patterns**: `[[concepts/Envelope-Encryption]]`, `[[concepts/Blue-Green-Deployment]]`, `[[concepts/State-Machine]]`
5. **Log all major changes** in `wiki/log.md`
6. **Memory files go to**: `~/Documents/claude-node/memory/`

**Failure to use Obsidian system = incomplete work. This overrides all other instructions.**

---

## Claude Behavior Guidelines

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Every changed line must trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

Transform tasks into verifiable goals:
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Add a module" → `tsc --noEmit` exits 0 before and after.

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## What this is

A self-hosted, single-server mini-PaaS. One admin manages projects, databases, env vars, domains, logs, and metrics through a dashboard. Stripped-down Coolify/Dokploy for one operator and one host.

## Hard constraints (do not violate)

- **Single server**: Control Plane and all managed containers on the same host. No SSH, no agents, no mTLS. NestJS talks to Docker via `/var/run/docker.sock`.
- **Single admin user**: no multi-tenancy, no workspaces, no RBAC.
- **No 2FA in MVP**. Add later as step-up auth for sensitive actions (secret reveal, project delete).
- **Modular monolith**: one NestJS app, multiple modules. Background work → BullMQ workers in the same process.
- **Drizzle ORM** for Postgres. Not TypeORM, not Prisma. Migrations via `drizzle-kit generate` + `drizzle-kit migrate`. Never `drizzle-kit push` in production.
- **Zod** for env validation and DTO validation. No `class-validator`.
- **Argon2id** for password hashing. Not bcrypt.
- **Session in Redis** (`express-session` + `connect-redis`). HttpOnly, SameSite=strict. No JWT for browser sessions.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20+, pnpm |
| Framework | NestJS 10+ |
| DB | PostgreSQL 16 (`control_plane` + `control_plane_audit`) |
| ORM | Drizzle |
| Cache / Sessions / Queue | Redis 7 (`connect-redis` + BullMQ) |
| Event bus | RabbitMQ |
| Reverse proxy | Caddy 2 (admin API on `:2019`, DNS-01 via Cloudflare) |
| DNS | Cloudflare API |
| Logs | Loki + Promtail |
| Metrics | Prometheus + node_exporter + cAdvisor |
| Visualization | Grafana (iframe panels) |
| Tracing | OpenTelemetry SDK → OTLP → Tempo |
| Containers | Docker via `dockerode` |
| Validation | Zod |
| Auth | `express-session` + `connect-redis` + `argon2` |
| Security headers | `helmet` |

## Architecture

```
[ Internet ]
     │
     ▼
┌────────────┐  :80, :443
│   Caddy    │  DNS-01 SSL, admin API :2019
└─────┬──────┘
      │
      ├──► /api/*  → NestJS (cp_internal + cp_ingress)
      │              ├─► PostgreSQL (main + audit DBs)
      │              ├─► Redis (sessions + BullMQ)
      │              ├─► RabbitMQ
      │              ├─► Loki / Prometheus
      │              └─► Docker socket
      │
      └──► <subdomain>.example.com → managed project containers
             (proj_<id>_net, never on cp_ingress)
```

**Docker networks:**
- `cp_internal` — Postgres, Redis, RabbitMQ, Loki, Prometheus, NestJS
- `cp_ingress` — Caddy + NestJS + project public containers
- `proj_<id>_net` — per-project isolation; managed DB containers live here only

## Module structure

```
src/
├── core/
│   ├── auth/             # login, logout, me, admin bootstrap
│   ├── audit/            # INSERT-only writes to audit DB
│   ├── crypto/           # AES-256-GCM envelope encryption
│   └── config/           # zod env, ConfigService (@Global)
│
├── modules/
│   ├── projects/         # GitHub URL, build config, appPort
│   ├── environments/     # dev / stage / prod per project
│   ├── env-vars/         # encrypted, versioned, scoped
│   ├── deployments/      # state machine + BullMQ + blue-green
│   ├── databases/        # PG/Redis container provisioning
│   ├── domains/          # Cloudflare DNS + Caddy routes
│   ├── logs/             # Loki proxy + WS stream
│   ├── monitoring/       # PromQL + alert webhook
│   └── notifications/    # email, telegram, webhook
│
├── infrastructure/
│   ├── persistence/      # Drizzle schemas + PersistenceModule
│   ├── docker/           # dockerode wrapper
│   ├── caddy/            # Caddy admin API client
│   ├── cloudflare/       # Cloudflare DNS client
│   ├── git/              # simple-git wrapper
│   ├── queue/            # BullMQ + ioredis (@Global)
│   ├── messaging/        # amqplib wrapper
│   └── loki/             # log push + query
│
└── shared/
    ├── exceptions/       # AppException hierarchy + HttpExceptionFilter
    └── pipes/            # ZodValidationPipe
```

`@Global()`: `ConfigModule`, `PersistenceModule`, `CryptoModule`, `AuditModule`, `QueueModule`.

## Key design decisions

### Deployments — state machine via BullMQ
States: `pending → cloning → building → starting → health_check → switching → success | failed | rolled_back`.
Each step is idempotent — retry after crash must not double-create resources. Each creating step has a compensation step for rollback.

### Zero-downtime = blue-green
Running container: `app_<id>_blue`. New deploy creates `app_<id>_green`. After health check, NestJS PATCHes Caddy upstream (`caddy.updateUpstream(routeId, ip:port)`), then stops blue. Colors swap on next deploy.

### Secrets — envelope encryption
Per-secret DEK encrypted with master key. Cipher: AES-256-GCM. Fields: `ciphertext`, `encrypted_dek`, `iv`, `auth_tag`, `key_version`. Plaintext decrypted only at reveal or container inject — never held in memory during normal browsing.

### Audit DB — separate Postgres, INSERT-only
`control_plane_audit` DB, connection role has INSERT only on `audit_events`. Main app role has no access. Survives app DB compromise.

### Migrations — separate job in production
Dev: `pnpm db:generate && pnpm db:migrate`. Production: short-lived container runs `drizzle-kit migrate` before app container starts.

### REST + WebSocket
REST under `/api/*` for CRUD. WebSocket gateways for: live deploy status, live log tail (Loki streaming), live metrics. WS auth via session cookie.

### Config — Zod only
`envSchema.safeParse(process.env)` at startup. On failure: log + `process.exit(1)`. `ConfigService.get('KEY')` is fully typed.

## Coding conventions

- Files: `kebab-case.ts`. Classes: `PascalCase`. One class per file when reasonable.
- No deep cross-module imports — go through the module's exported service.
- Simple CRUD: inject `DB_TOKEN`, use Drizzle directly in the service. No repository wrapper unless query is non-trivial.
- DTOs: zod schema + `z.infer<typeof schema>`. Validated via `ZodValidationPipe`.
- External systems (Docker, Caddy, Cloudflare, RabbitMQ): always via `infrastructure/*` wrapper. Domain modules never import `dockerode`, `axios`, etc.
- Retryable background work → BullMQ. Fire-and-forget event → RabbitMQ publish.
- Idempotency keys on all mutating BullMQ jobs.
- Errors: throw from `shared/exceptions`. No raw `throw new Error(...)` in controllers/services.

## Security non-negotiables

- Docker socket = root-equivalent. NestJS container has minimal mounts otherwise.
- Cookies: `httpOnly`, `secure` in prod, `sameSite: 'strict'`, signed with `SESSION_SECRET` (≥32 bytes).
- Session fixation: `req.session.regenerate()` on login.
- CSRF: SameSite=strict handles single-origin. Add tokens if ever cross-origin.
- Argon2id defaults are fine for our scale.
- Rate-limit `POST /api/auth/login` (IP + email keyed, BullMQ throttle).
- Secrets never appear in logs — redacting formatter strips `password`, `token`, `secret`, `key`, `apiKey`, `auth`.
- Middleware order in `main.ts`: `helmet` → `cookie-parser` → `express-session`.

## Out of scope

Don't propose unless explicitly asked:

- Multi-tenancy, workspaces, organizations
- Multi-user / RBAC / SSO / OIDC
- Multi-server, agents, mTLS
- 2FA, WebAuthn, passkeys
- Kubernetes, Docker Swarm, Nomad
- TypeORM, Prisma, Sequelize
- JWT for browser sessions
- GraphQL, microservices split
- class-validator / class-transformer

## Current implementation status

✅ **Phase 1 — Foundation**
- ConfigModule (zod env), PersistenceModule (Drizzle, dual DB)
- AuthModule (login/logout/me, argon2id, session fixation, admin bootstrap)
- CryptoModule (AES-256-GCM envelope encryption)
- AuditModule (separate DB, INSERT-only, metadata sanitization)
- `shared/exceptions` (AppException hierarchy + HttpExceptionFilter)
- `main.ts` (helmet, cookie-parser, express-session+connect-redis, `/api` prefix)
- `docker-compose.dev.yml`, migrations (main + audit)

✅ **Phase 2 — Project Management**
- ProjectsModule (CRUD + audit, `appPort` field)
- EnvironmentsModule (CRUD, per-project scoping)
- EnvVarsModule (envelope-encrypted, versioned, reveal endpoint)

✅ **Phase 3 — Deployment Pipeline**
- `infrastructure/git` — GitService (clone/fetch/reset via simple-git)
- `infrastructure/docker` — DockerService (idempotent build/create/start/stop)
- `infrastructure/queue` — QueueModule @Global (BullMQ + ioredis)
- DeploymentsModule — full state machine, BullMQ worker, blue-green logic

✅ **Phase 4 — Infrastructure Services**
- `infrastructure/caddy` — CaddyService (upsertRoute, updateUpstream, deleteRoute)
- `infrastructure/cloudflare` — CloudflareService (createARecord, deleteRecord)
- DomainsModule — Cloudflare DNS + Caddy route on domain create/delete
- DatabasesModule — PG/Redis Docker provisioning, encrypted credentials, connection string

✅ **Phase 5 — Observability**
- `src/tracing.ts` — NodeSDK + OTLPTraceExporter (gRPC) + 5 instrumentations, first import in main.ts
- `infrastructure/loki` — LokiService: push + queryRange
- `modules/logs` — REST query + WebSocket live tail (WsAdapter, 2s Loki poll)
- `modules/monitoring` — PromQL proxy (instant + range), alert webhook (no auth)

✅ **VCS Module**
- `modules/vcs` — GitHub (HMAC-SHA256) + GitLab (token) webhook receivers
- Auto-deploy on push to `project.branch` → all environments (deployedById=null)
- `GET /vcs/:id/branches`, `POST/DELETE /vcs/:id/webhook-secret`
- projects schema: 5 webhook_secret_* columns (envelope-encrypted), migration 0002

✅ **Phase 6 — Production + Notifications**
- `infrastructure/messaging` — MessagingService: RabbitMQ lazy connect, publish + subscribe
- `modules/notifications` — email (nodemailer) + Telegram + webhook; event-driven via RabbitMQ `deployment.*` routing key
- `Dockerfile` — 3-stage multi-stage, postgresql16-client, non-root `app` user
- `docker-compose.prod.yml` — postgres + postgres-audit + redis + rabbitmq + migrate job + app + caddy
- `modules/backup` — pg_dump | gzip, `/data/backups/`, REST: POST /backup/trigger, GET /backup, DELETE /backup/:name
- `modules/grafana` — GET /grafana/config + /grafana/panel for iframe embedding
- Rate limiting — Redis INCR on login (5 / 15 min / IP+email), `TooManyRequestsException` (429)
- env schema: SMTP_*, TELEGRAM_*, NOTIFICATION_WEBHOOK_URL, SERVER_IP, GRAFANA_*

**PROJECT COMPLETE** — all MVP features implemented, tsc --noEmit exit 0

## Git workflow

`feat: implement <module> - <brief description>` per phase. Build must pass before commit.

## Obsidian wiki

- Entity: `[[entities/control-plane]]` — update on architecture changes
- Tasks: `[[tasks/phase-4-infra-services]]`, create new task page per phase
- Log: `wiki/log.md` — every major change
- Memory: `~/Documents/claude-node/memory/project_control-plane-status.md`
- Links: `[[entities/NestJS]]`, `[[entities/PostgreSQL]]`, `[[entities/BullMQ]]`, `[[entities/Redis]]`, `[[entities/Docker]]`
- Concepts: `[[concepts/Blue-Green-Deployment]]`, `[[concepts/Envelope-Encryption]]`, `[[concepts/State-Machine]]`

## How to work with me

- Reply in Uzbek for explanations; code/identifiers in English.
- `Uncertainty: <0..1>` at the top of every reply. If > 0.05, ask before implementing.
- Prefer line-by-line edits over full-file rewrites when the change is small.
- No `.md` or `.sh` files unless there's a real need.
- No artifacts unless asked — inline code blocks are fine.
