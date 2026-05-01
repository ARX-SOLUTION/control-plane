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

## What this is

A self-hosted, single-server mini-PaaS that lets a single admin manage projects, databases, environment variables, domains, logs, and metrics through a dashboard. Think of it as a stripped-down Coolify/Dokploy tailored for one operator and one host.

## Hard constraints (do not violate)

- **Single server**: the Control Plane and all managed project containers run on the same host. No SSH-based remote management, no agents, no mTLS. NestJS talks to Docker via the local socket (`/var/run/docker.sock`).
- **Single admin user**: no multi-tenancy, no workspaces, no per-user RBAC. One human logs in and does everything.
- **No 2FA in MVP**. Add later as step-up auth for sensitive actions (secret reveal, project delete).
- **Modular monolith**, not microservices. One NestJS app, multiple modules. Background work goes to BullMQ workers in the same process (or split into a worker process later if needed).
- **Drizzle ORM** for Postgres. Not TypeORM, not Prisma. Migrations via `drizzle-kit generate` + `drizzle-kit migrate`. Never use `drizzle-kit push` in production.
- **Zod** for both env validation and DTO validation. No `class-validator`.
- **Argon2id** for password hashing. Not bcrypt.
- **Session in Redis** (`express-session` + `connect-redis`). HttpOnly, SameSite=strict cookies. No JWT for browser sessions.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20+, pnpm |
| Framework | NestJS 10+ |
| DB | PostgreSQL 16 (two databases: `control_plane` + `control_plane_audit`) |
| ORM | Drizzle |
| Cache / Sessions / Queue | Redis 7 (sessions via `connect-redis`, jobs via BullMQ) |
| Event bus | RabbitMQ (cross-module events, log fan-in from managed projects) |
| Reverse proxy | Caddy 2 (admin API on `:2019`, automatic HTTPS via Cloudflare DNS-01) |
| DNS | Cloudflare API |
| Logs | Loki + Promtail (or Vector) |
| Metrics | Prometheus + node_exporter + cAdvisor |
| Visualization | Grafana (embedded panels in our dashboard via iframe / Grafana API) |
| Tracing | OpenTelemetry SDK → OTLP → Tempo (or Jaeger) |
| Container orchestration | Docker via `dockerode` |
| Validation | Zod |
| Auth | `express-session` + `connect-redis` + `argon2` |
| Security headers | `helmet` |

## Top-level architecture (single host)

```
[ Internet ]
     │
     ▼
┌────────────┐  :80, :443
│   Caddy    │  Cloudflare DNS-01, automatic SSL, admin API on :2019
└─────┬──────┘
      │
      ├──► /api/*  → NestJS Control Plane container
      │              │
      │              ├─► PostgreSQL (control_plane DB)
      │              ├─► PostgreSQL (control_plane_audit DB, INSERT-only role)
      │              ├─► Redis (sessions + BullMQ + cache)
      │              ├─► RabbitMQ (events, log fan-in)
      │              ├─► Loki (log push + query)
      │              ├─► Prometheus (PromQL queries)
      │              └─► Docker socket (project lifecycle)
      │
      └──► <subdomain>.example.com → managed project containers
             (each on its own Docker network: proj_<id>_net)
```

## Network isolation

Three Docker network types:

- `cp_internal` — Postgres, Redis, RabbitMQ, Loki, Prometheus, NestJS. Not reachable from project containers.
- `cp_ingress` — Caddy + NestJS + every project's public-facing container. Caddy bridges in here.
- `proj_<id>_net` — per-project network. Project app containers and their dedicated DB containers live here. Caddy joins this network too so it can route traffic in.

A project's database container is **never** on `cp_ingress`. It's only on its own `proj_<id>_net`.

## Module structure

```
src/
├── core/
│   ├── auth/             # session login, logout, me, bootstrap admin
│   ├── audit/            # append-only writes to audit DB
│   ├── crypto/           # AES-256-GCM, envelope encryption (DEK + master key)
│   └── config/           # zod-validated env, ConfigService (@Global)
│
├── modules/
│   ├── projects/         # GitHub URL, repo metadata, build config
│   ├── environments/     # dev / stage / prod scope per project
│   ├── env-vars/         # encrypted env values, versioned, scoped
│   ├── deployments/      # state machine (pending→running→success/failed),
│   │                     # BullMQ jobs, blue-green orchestration
│   ├── databases/        # PG/Redis container provisioning,
│   │                     # DB user creation, password reset
│   ├── domains/          # Cloudflare DNS records, Caddy admin API routes
│   ├── logs/             # Loki query proxy + WS stream to dashboard
│   ├── monitoring/       # PromQL queries, alert webhook receiver
│   └── notifications/    # email, telegram, generic webhook
│
├── infrastructure/
│   ├── persistence/      # Drizzle schemas, db client, PersistenceModule
│   ├── docker/           # dockerode wrapper (containers, networks, volumes)
│   ├── caddy/            # Caddy admin API client (PATCH config blocks)
│   ├── cloudflare/       # Cloudflare API client (zones, DNS records)
│   ├── git/              # simple-git wrapper (clone, fetch, checkout)
│   ├── queue/            # BullMQ setup, job registration
│   ├── messaging/        # amqplib wrapper, publishers, consumers
│   └── loki/             # log push (Promtail-compatible), query API
│
└── shared/               # DTO base, exceptions, pipes, decorators, utils
    └── pipes/zod-validation.pipe.ts
```

`@Global()` modules: `ConfigModule`, `PersistenceModule`, `CryptoModule`, `AuditModule`. Everything else imports what it needs explicitly.

## Key design decisions and rationale

### Deployments are state machines, run by BullMQ
Every deployment is a row in `deployments` with `status: pending | cloning | building | starting | health_check | switching | success | failed | rolled_back`. A BullMQ worker processes it. Each step is **idempotent** — retrying after a crash must not double-create resources. Each step that creates state has a corresponding compensation step for rollback.

### Zero-downtime deploys = manual blue-green
For each project the running container is `app_<id>_blue`. New deploy creates `app_<id>_green`. After `green` passes health checks, NestJS PATCHes Caddy's `reverse_proxy` upstream to point at `green`, waits for in-flight requests to drain, then stops `blue`. On next deploy the colors swap. No Swarm, no Kubernetes.

### Secrets use envelope encryption
Per-secret Data Encryption Key (DEK), generated randomly. The DEK is encrypted with a master key (from env, ideally backed by an HSM/KMS later). Cipher: AES-256-GCM. Stored fields per secret: `ciphertext`, `encrypted_dek`, `iv`, `auth_tag`, `key_version`. Plaintext is decrypted only at the moment the value is shipped to a container or revealed in the dashboard (with a separate confirmation step). The dashboard never holds plaintext in normal browsing.

### Env vars are secrets with extras
They reuse the crypto layer. On top: versioning (every change = new row, old rows kept), per-environment scope (project → env → key), and a sync trigger that PATCHes the running container's environment via Docker API and restarts (blue-green if zero-downtime is requested, simple restart otherwise).

### Audit log on a separate database with insert-only role
A second Postgres DB `control_plane_audit`. The connection string the app uses for audit writes points to a role that has `INSERT` only on `audit_events`. No `UPDATE`, no `DELETE`. The main app's regular DB role has no access to that DB at all. This survives an attacker who compromises the app DB.

Audit row shape (minimum): `id`, `actor_user_id`, `action` (e.g. `secret.reveal`, `project.delete`), `resource_type`, `resource_id`, `metadata` (jsonb, no plaintext secrets), `ip`, `user_agent`, `created_at`. `created_at` is `DEFAULT now()`, immutable.

### Migrations are a separate job in production
Dev: `pnpm db:generate` then `pnpm db:migrate`. CI checks the diff. Production: a dedicated short-lived container (or systemd one-shot) runs `drizzle-kit migrate` against both DBs **before** the app container starts. The app's `depends_on` waits for the migration job to exit successfully.

### REST for CRUD, WebSocket for streams
REST endpoints under `/api/*` for everything that returns once. WebSocket gateways (`@nestjs/platform-ws` or `socket.io`) for: live deploy status, live log tail (Loki has a streaming query API — proxy that), live metric streams. Auth on WS upgrades by reading the same session cookie.

### Configuration uses zod, not @nestjs/config defaults
`ConfigModule` parses `process.env` against `envSchema` at startup. On failure it logs a formatted error and `process.exit(1)`. `ConfigService.get('SOMETHING')` is fully typed.

### OpenTelemetry from day one
`@opentelemetry/sdk-node` initialized in `src/tracing.ts`, imported as the very first line of `main.ts`. Instruments HTTP, Postgres, Redis, AMQP, ioredis. Exports OTLP to a local collector.

## Coding conventions

- File naming: `kebab-case.ts`. Class names: `PascalCase`. One class per file when reasonable.
- Modules expose only what they want consumed. No deep imports across modules — go through the module's public service.
- Repositories live under `infrastructure/persistence` only when they wrap non-trivial queries. For simple CRUD, just inject `DB_TOKEN` and use Drizzle directly inside the service.
- DTOs are zod schemas. The schema is the source of truth; the TS type is `z.infer<typeof schema>`. Validation happens via the shared `ZodValidationPipe`.
- All async ops that touch external systems (Docker, Caddy, Cloudflare, RabbitMQ) go through their `infrastructure/*` wrapper. Domain modules never import `dockerode`, `axios`, etc. directly.
- Background work that can be retried = BullMQ job. One-shot fire-and-forget event = RabbitMQ publish.
- Idempotency keys on all mutating jobs.
- Errors: throw typed exceptions from `shared/exceptions`. A global filter maps them to HTTP responses. No raw `throw new Error('...')` in controllers/services.

## Security non-negotiables

- Docker socket access = root-equivalent. Document it. NestJS container has minimal mounts otherwise.
- Cookies: `httpOnly`, `secure` in production, `sameSite: 'strict'`, signed with `SESSION_SECRET` (≥32 bytes, random).
- Session fixation: `req.session.regenerate()` on login.
- CSRF: SameSite=strict cookies handle most cases for our single-origin dashboard. If we ever add cross-origin clients, add CSRF tokens.
- Helmet enabled. CORS whitelisted to the dashboard origin only.
- Argon2id with sane defaults (`type: argon2id`, default memory/time costs are fine for our scale).
- Rate-limit `/api/auth/login` (BullMQ-backed throttle keyed on IP + email). Brute-force lockout after N failures.
- Secrets never appear in logs. A redacting log formatter strips known sensitive keys (`password`, `token`, `secret`, `key`).
- `helmet`, `cookie-parser`, `express-session` order matters — see `main.ts`.

## Out of scope for now

Don't propose any of these unless I explicitly ask:

- Multi-tenancy, workspaces, organizations
- Multi-user / RBAC / SSO / OIDC
- Multi-server, agents, mTLS
- 2FA, WebAuthn, passkeys
- Kubernetes, Docker Swarm, Nomad
- TypeORM, Prisma, Sequelize
- JWT for browser sessions
- GraphQL
- Microservices split
- class-validator / class-transformer

## Current implementation status

✅ **Completed (Phase 1 - Core Foundation):**
- Project skeleton (NestJS + pnpm)
- `ConfigModule` with zod-validated env
- `PersistenceModule` with Drizzle, dual DB setup
- `AuthModule` with login/logout/me, session in Redis, argon2id, admin bootstrap
- `CryptoModule` with AES-256-GCM envelope encryption
- `AuditModule` with separate DB, INSERT-only role, log sanitization
- `docker-compose.dev.yml` for local Postgres + Redis
- Initial migrations for users and audit tables

🚧 **Next planned modules (Phase 2 - Project Management):**
1. `projects` + `environments` + `env-vars` (encrypted secrets, versioning)
2. `infrastructure/docker` + `infrastructure/git` (container + repo management)

**Phase 3 - Deployment Pipeline:**
3. `deployments` (state machine + BullMQ, blue-green orchestration)
4. `infrastructure/caddy` + `domains` + `infrastructure/cloudflare` (reverse proxy + DNS)

**Phase 4 - Infrastructure Services:**
5. `databases` (PG/Redis provisioning, user/password management)
6. `logs` (Loki integration, WS streaming)
7. `monitoring` (Prometheus, alert webhook)

**Phase 5 - Production Ready:**
8. OpenTelemetry wiring, performance optimization
9. Production Dockerfile + compose, migration job, backups

## Git Workflow

**Per-phase commits:** Each major module/phase gets committed separately with descriptive messages following pattern: `feat: implement <module-name> - <brief-description>`

**Commit strategy:**
- Atomic commits per logical feature
- Test build success before commit
- Include audit trail in commit metadata
- Push after each phase completion

## Obsidian Wiki

Shared knowledge base: `~/Documents/claude-node/`

- Entity page: `[[entities/control-plane]]` — update when architecture changes
- Memory dir: `~/Documents/claude-node/memory/`
- Link to: `[[entities/NestJS]]`, `[[entities/PostgreSQL]]`, `[[entities/BullMQ]]`, `[[entities/Redis]]`, `[[entities/Docker]]`
- Concepts: `[[concepts/Blue-Green-Deployment]]`, `[[concepts/Envelope-Encryption]]`, `[[concepts/State-Machine]]`

## How to work with me on this project

- I prefer line-by-line implementation instructions, not large dumps. Say "in `auth.service.ts`, replace lines X–Y with…" rather than rewriting whole files when an edit is small.
- Don't generate many `.md` or `.sh` files. One file per real need.
- Don't use artifacts for code unless I ask. Inline code blocks are fine.
- Always state your uncertainty as `Uncertainty: <0..1>` at the top of your reply. If > 0.05, ask clarifying questions before answering.
- I write in Uzbek; reply in Uzbek for explanations, keep code/identifiers in English.
- When proposing a change, briefly say what it does and why before showing code. Keep the prose tight.