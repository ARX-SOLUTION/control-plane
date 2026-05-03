# Databases

Control Plane can provision **PostgreSQL** and **Redis** containers per project.

## Provisioning a Database

1. **Databases → Provision Database**
2. Select project and type (Postgres or Redis)
3. Enter a name (alphanumeric, hyphens, underscores; e.g. `my-app-db`)
4. Click **Provision**

A Docker container is created with a random password. Credentials are stored encrypted.

## Getting the Connection String

1. Click the database row
2. Click **Reveal Connection String**
3. The full `postgresql://` or `redis://` URI is shown for 30 seconds

Use this connection string as an environment variable in your project.

## Database Isolation

Each database container is attached to the project's private network (`proj_<id>_net`). It is not reachable from the public internet.

## Deleting a Database

1. Click the trash icon on the database row
2. Confirm the deletion

::: danger
Deleting a database stops and removes the Docker container. All data is lost. Back up first.
:::

## Supported Types

| Type | Image | Default Port |
|------|-------|-------------|
| PostgreSQL | `postgres:16-alpine` | 5432 |
| Redis | `redis:7-alpine` | 6379 |
