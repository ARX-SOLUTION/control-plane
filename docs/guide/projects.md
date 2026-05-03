# Projects & Environments

## Projects

A **project** maps to one Git repository. Each project has:

- **GitHub URL** — the repo to clone (HTTPS)
- **Branch** — default branch to deploy (`main`)
- **App Port** — the port your container listens on (default `3000`)
- **Health Check Path** — path to poll after start (default `/`)
- **Build / Start commands** — optional overrides (uses Dockerfile by default)

### Creating a Project

1. **Projects → New Project**
2. Fill in the form fields
3. Save — the project is created with no environments yet

### Editing a Project

Click the project name → **Overview** tab → edit any field.

---

## Environments

Each project can have up to three environments: **dev**, **staging**, and **prod**.

Each environment is independent: its own deployments, env vars, domains, and container.

### Creating an Environment

1. Project → **Environments** tab
2. Click **Set Up** next to the environment type you need
3. Enter a display name (e.g. "Production")

### Deleting an Environment

Deleting an environment removes its deployments, env vars, and domains from the database. Running containers must be stopped manually via **Databases** or Docker.

::: warning
Deleting `prod` is irreversible. The running container is not automatically stopped.
:::
