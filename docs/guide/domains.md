# Domains

Custom domains are attached to project environments. Caddy handles TLS automatically.

## Adding a Domain

1. **Domains → Add Domain**
2. Select project and environment
3. Enter the domain (e.g. `app.example.com`)
4. Optionally enter a **Cloudflare Zone ID** and **Server IP** for automatic DNS A record creation
5. Click **Add Domain**

On save:
- A Caddy route is created for the domain
- If Zone ID + Server IP are provided, a Cloudflare DNS A record is created

## How Routing Works

Each environment has one Caddy route. Multiple domains can be added to one environment — they all route to the same container. When a new deployment succeeds, Caddy's upstream is updated automatically.

## Removing a Domain

1. Click the trash icon on the domain row
2. Confirm removal

On delete:
- The domain is removed from the Caddy route (other environment domains are preserved)
- If a Cloudflare DNS record was created automatically, it is deleted

## SSL

Caddy manages TLS certificates automatically via Let's Encrypt DNS-01 (Cloudflare). The `sslEnabled` field on a domain reflects whether the certificate is active.

::: tip
Point your domain's DNS A record to the server IP (`185.190.142.239`) before adding it. Caddy will issue a certificate on first request.
:::
