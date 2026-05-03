# Getting Started

Control Plane is a self-hosted mini-PaaS for a single administrator managing multiple projects on one server.

## First Login

1. Open [control.xamidullo.uz](https://control.xamidullo.uz)
2. Log in with your admin credentials
3. You will land on the **Dashboard** showing projects and recent deployments

## Dashboard Overview

| Section | Purpose |
|---------|---------|
| Projects | Create and manage applications |
| Databases | Provision Postgres/Redis containers |
| Domains | Attach custom domains with SSL |
| Logs | Query logs via Loki |
| Monitoring | Grafana metrics |
| Audit | Full action history |

## Creating Your First Project

1. Go to **Projects → New Project**
2. Fill in display name, GitHub URL, branch, and app port
3. Click **Create**
4. Open the project → **Environments** tab
5. Click **Set Up** for dev / staging / prod as needed

## Quick Workflow

```
Create Project → Create Environment → Add Env Vars → Deploy
```

After deploy succeeds, add a custom domain and it will be live at that domain automatically.
