# Notifications & Backup

## Notifications

Control Plane sends deployment event notifications via email, Telegram, or webhook.

### Supported Channels

| Channel | Config Keys |
|---------|------------|
| Email (SMTP) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Generic Webhook | `NOTIFICATION_WEBHOOK_URL` |

Add these to `.env.prod` and restart the app.

### Events

Notifications are sent for:
- `deployment.success` — deploy completed
- `deployment.failed` — deploy failed

### Testing

**Settings → Notifications → Send Test** to verify your channel.

---

## Backup

Control Plane can back up the main PostgreSQL database on demand.

### Triggering a Backup

1. **Settings → Backup → Trigger Backup**
2. A `pg_dump | gzip` is created at `/data/backups/<timestamp>.sql.gz` inside the app container

### Listing Backups

`GET /api/backup` — returns file names and sizes.

### Deleting a Backup

Click the trash icon on a backup entry.

::: warning
Backups are stored inside the Docker volume (`appdata`). If the volume is deleted, backups are lost. Copy important backups off the server regularly.
:::

---

## VCS Integration

### GitHub Webhooks

1. Project → **Settings** tab
2. **Generate Webhook Secret**
3. In GitHub: Settings → Webhooks → Add webhook
   - URL: `https://api.control.xamidullo.uz/api/vcs/webhook/github/<projectId>`
   - Secret: the generated secret
   - Events: Push

Push to the project's branch → all environments redeploy automatically.

### GitLab Webhooks

Same flow but use the GitLab webhook URL:
`https://api.control.xamidullo.uz/api/vcs/webhook/gitlab/<projectId>`
