# Vestri Frontend

Vestri is a server management frontend built with Next.js.  
It is designed for teams that operate game server infrastructure and need one secure control surface for:

- Node onboarding and health visibility
- Template-based server provisioning
- Runtime controls (start/stop/status, logs, console)
- File/config management
- Team access, invites, and step-up protected critical actions

## Product Focus

- Manage worker nodes and game servers from one workspace
- Keep permissions explicit (viewer/operator/admin style access patterns)
- Support operational safety with 2FA + step-up verification
- Keep deployment workflows repeatable via templates and image repulls

## Stack

- Next.js 16 (App Router, Turbopack)
- React + TypeScript
- Tailwind CSS (global theme tokens in `src/app/[locale]/globals.css`)
- `next-intl` for i18n (`en`, `de`)

## Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose
- Running backend (`vestri-backend`)
- Running worker (`vestri-worker`) for node/server operations

## Environment and Settings Reference

### Frontend (`vestri`) environment variables

Create `.env` (or `.env.local`) in this directory.

| Variable                  | Required                           | Default                 | Description                                                                               |
| ------------------------- | ---------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `GO_API_URL`              | Yes (for non-local/default setups) | `http://localhost:8080` | Backend base URL used by Next rewrites, middleware auth checks, and proxy route handlers. |
| `NEXT_PUBLIC_CONSOLE_WS_BASE_URL` | Optional                  | unset                   | Optional public API origin for browser WebSocket log endpoint (`/console/logs/ws`). Interactive console does not require browser WebSockets anymore. |
| `NODE_ENV`                | Optional                           | framework default       | Runtime mode (`production` in container images).                                          |
| `NEXT_TELEMETRY_DISABLED` | Optional                           | unset                   | Set to `1` to disable Next.js telemetry.                                                  |

Example:

```env
GO_API_URL=http://localhost:8080
```

### Backend (`vestri-backend`) environment variables

Boolean variables accept `1`, `true`, or `yes` (case-insensitive).  
List variables use comma-separated values.

| Variable                      | Required    | Default                                                    | Description                                                                        |
| ----------------------------- | ----------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `PORT`                        | Optional    | `8080`                                                     | Backend HTTP port (the server listens on `:<PORT>`).                               |
| `APP_BASE_URL`                | Optional    | falls back to `NEXTAUTH_URL`, then `http://localhost:3000` | Base URL used for callbacks and URL generation.                                    |
| `NEXTAUTH_URL`                | Optional    | fallback source for `APP_BASE_URL`                         | Secondary base URL fallback.                                                       |
| `DATABASE_URL`                | Yes         | none                                                       | PostgreSQL connection string.                                                      |
| `REDIS_URL`                   | Optional    | `redis://localhost:6379`                                   | Redis connection string for sessions/rate limits.                                  |
| `UPLOAD_DIR`                  | Optional    | `../vestri/public/uploads`                                 | Directory for uploaded profile images (resolved to absolute path).                 |
| `LOG_FILE`                    | Optional    | `logs/server.log`                                          | Backend log file path (rotation enabled when set).                                 |
| `LOG_MAX_SIZE_MB`             | Optional    | `5`                                                        | Max size per log file before rotation.                                             |
| `LOG_MAX_BACKUPS`             | Optional    | `1`                                                        | Number of rotated log backups to keep.                                             |
| `NO_EMAIL_VERIFY`             | Optional    | `true`                                                     | Disable email verification checks.                                                 |
| `TOTP_ISSUER`                 | Optional    | `Vestri`                                                   | Issuer name shown in authenticator apps.                                           |
| `WORKER_TLS_CA_CERT_FILE`     | Optional    | unset                                                      | Additional CA certificate file trusted for worker TLS.                             |
| `WORKER_TLS_CA_CERT_DIR`      | Optional    | `./certs/worker-cas`                                       | Directory containing trusted worker CA cert files.                                 |
| `NODE_API_KEY_ENCRYPTION_KEY` | Recommended | unset                                                      | Key used to encrypt stored worker node API keys.                                   |
| `TRUSTED_PROXIES`             | Optional    | empty list                                                 | Comma-separated proxy CIDRs/IPs trusted for forwarded headers.                     |
| `EMAIL_SERVER_HOST`           | Optional    | unset                                                      | SMTP host.                                                                         |
| `EMAIL_SERVER_PORT`           | Optional    | `587`                                                      | SMTP port (invalid values fall back to `587`).                                     |
| `EMAIL_SERVER_USER`           | Optional    | unset                                                      | SMTP username.                                                                     |
| `EMAIL_SERVER_PASSWORD`       | Optional    | unset                                                      | SMTP password.                                                                     |
| `EMAIL_FROM`                  | Optional    | unset                                                      | Sender address. Email sending is enabled only when host, port, and from are valid. |
| `EMAIL_SERVER_SECURE`         | Optional    | `false`                                                    | Use SMTPS/TLS mode for SMTP transport.                                             |
| `WEB_AUTHN_ORIGIN`            | Optional    | `APP_BASE_URL`                                             | Primary WebAuthn origin.                                                           |
| `WEB_AUTHN_RP_ID`             | Optional    | host part of `WEB_AUTHN_ORIGIN`                            | WebAuthn RP ID.                                                                    |
| `WEB_AUTHN_RP_NAME`           | Optional    | `Auth Service`                                             | WebAuthn RP display name.                                                          |
| `WEB_AUTHN_ORIGINS`           | Optional    | `WEB_AUTHN_ORIGIN`                                         | Comma-separated allowed WebAuthn origins.                                          |
| `GITHUB_CLIENT_ID`            | Optional    | unset                                                      | GitHub OAuth client ID.                                                            |
| `GITHUB_CLIENT_SECRET`        | Optional    | unset                                                      | GitHub OAuth client secret.                                                        |
| `GITHUB_REDIRECT_URL`         | Optional    | `<APP_BASE_URL>/api/oauth/github/callback`                 | GitHub OAuth callback URL.                                                         |
| `AUTO_MIGRATE`                | Optional    | `true`                                                     | Auto-apply SQL migrations on backend startup.                                      |
| `MIGRATIONS_DIR`              | Optional    | `./migrations`                                             | Migration directory path used by backend startup and migrate CLI.                  |

### Migration CLI (`vestri-backend/cmd/migrate`) environment variables

| Variable         | Required | Default        | Description                                           |
| ---------------- | -------- | -------------- | ----------------------------------------------------- |
| `DATABASE_URL`   | Yes      | none           | PostgreSQL connection string for migration execution. |
| `MIGRATIONS_DIR` | Optional | `./migrations` | Directory containing `*.up.sql` migration files.      |

### Worker settings file options (`/etc/vestri/settings.json`)

`vestri-worker` uses `settings.json` (not env variables) as main runtime config.

| Key                         | Default                           | Description                                                           |
| --------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| `useTLS`                    | `true`                            | Enables HTTPS listener and TLS certificate handling.                  |
| `TLSCert`                   | `/etc/vestri/certs/worker.crt`    | Worker TLS certificate path.                                          |
| `TLSKey`                    | `/etc/vestri/certs/worker.key`    | Worker TLS private key path.                                          |
| `tls_ca_cert`               | `/etc/vestri/certs/ca.crt`        | CA certificate path used to sign/generated worker certs.              |
| `tls_ca_key`                | `/etc/vestri/certs/ca.key`        | CA private key path.                                                  |
| `tls_auto_generate`         | `true`                            | Auto-generates missing TLS CA/server certificates.                    |
| `tls_sans`                  | `["localhost","127.0.0.1","::1"]` | Additional certificate SAN entries.                                   |
| `http_port`                 | `:8031`                           | Worker listen address/port.                                           |
| `worker_name`               | empty                             | Added to SAN candidates during auto-cert generation.                  |
| `fs_base_path`              | `/etc/vestri/servers`             | Safe root for worker filesystem operations.                           |
| `replay_window_seconds`     | `300`                             | Allowed request timestamp skew for signed API calls.                  |
| `rate_limit_rps`            | `10`                              | Rate limit token refill rate.                                         |
| `rate_limit_burst`          | `20`                              | Rate limit burst bucket size.                                         |
| `max_archive_request_bytes` | `1048576`                         | Max payload size for archive endpoints.                               |
| `max_inline_write_bytes`    | `10485760`                        | Max payload size for inline file writes.                              |
| `max_upload_bytes`          | `1073741824`                      | Max upload size for `/fs/upload`.                                     |
| `max_unzip_bytes`           | `10737418240`                     | Max extracted byte limit for unzip operations.                        |
| `max_zip_entries`           | `100000`                          | Max number of zip entries allowed.                                    |
| `require_tls`               | `true`                            | Rejects non-TLS requests unless trusted proxy headers indicate HTTPS. |
| `trust_proxy_headers`       | `false`                           | Trusts `X-Forwarded-*` / `X-Real-IP` headers for TLS/IP decisions.    |
| `health_requires_auth`      | `false`                           | Requires API auth for `/health` endpoint.                             |

## Docker Compose Quick Start (Frontend + Backend)

Use this for local Docker Compose or Portainer Stacks.  
The worker is intentionally not part of this Docker setup.

1. Create stack env file:

```bash
cp .env.stack.example .env.stack
```

2. Start the core stack:

```bash
docker compose --env-file .env.stack pull
docker compose --env-file .env.stack up -d
```

Images used by default:

- `dhernos/vestri:latest`
- `dhernos/vestri-backend:latest`

Named volumes used by this stack:

- `vestri-postgres-data`
- `vestri-redis-data`
- `vestri-backend-uploads`
- `vestri-backend-logs`
- `vestri-backend-worker-cas`

On standard rootful Docker Engine (Linux), named volumes are stored under  
`/var/lib/docker/volumes/<volume-name>/_data`.

Portainer flow:

1. `Stacks` -> `Add stack`
2. Use this repository `docker-compose.yml` and `.env.stack` values
3. Deploy stack

## Worker Standalone Installation (Per Node Host)

Install `vestri-worker` directly on each node host from `https://github.com/dhernos/vestri-worker.git`.

Clone and build:

```bash
# stable
git clone --branch main https://github.com/dhernos/vestri-worker.git /opt/vestri-worker

cd /opt/vestri-worker
go version   # requires Go >= 1.22.2
go build -o vestri-worker ./cmd/worker
sudo install -m 0755 vestri-worker /usr/local/bin/vestri-worker
```

First startup (generates defaults under `/etc/vestri` if missing):

```bash
sudo /usr/local/bin/vestri-worker
sudo ls -la /etc/vestri
sudo cat /etc/vestri/api.key
```

## Connect Worker to Backend and Frontend

1. Copy each worker CA certificate into the named CA trust volume:

```bash
docker volume inspect vestri-backend-worker-cas --format '{{ .Mountpoint }}'
sudo cp /etc/vestri/certs/ca.crt /var/lib/docker/volumes/vestri-backend-worker-cas/_data/<node-name>.crt
docker compose --env-file .env.stack restart backend
```

2. Ensure backend trusts `WORKER_TLS_CA_CERT_DIR` (default `./certs/worker-cas`, mounted from `vestri-backend-worker-cas`).
3. In Vestri UI, open `Nodes -> Create node`, then enter Host/Base URL (usually `https://<worker-host>:8031`) and API key from `/etc/vestri/api.key`.
4. Run the node health check immediately and verify status before provisioning servers.

## Node Server Setup and Management Workflow

1. Select the target node in the dashboard.
2. Create servers from templates only (identifier/version filled explicitly).
3. Start server and validate first boot via logs.
4. Manage runtime with start/stop/status, console, and file/config editor.
5. Apply updates with repull + restart in planned maintenance windows.

## Local Development

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Default local URL: `http://localhost:3000`

## Quality Gates

Run all checks:

```bash
npm run check
```

Or run individually:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Public Guide Page

Vestri includes a public setup guide:

- Route: `/{locale}/how-to` (e.g. `/en/how-to`, `/de/how-to`)
- Purpose: onboarding + operational workflow documentation

## systemd Startup (Production)

Recommended production pattern:

- Frontend + backend + databases via Docker Compose or Portainer
- Worker as standalone process (host-near execution)

Example `vestri-worker.service`:

```ini
[Unit]
Description=Vestri Worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=vestri
Group=vestri
WorkingDirectory=/opt/vestri-worker
ExecStart=/usr/local/bin/vestri-worker
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Create worker user once:

```bash
id -u vestri 2>/dev/null || sudo useradd --system --create-home --home-dir /opt/vestri-worker --shell /usr/sbin/nologin vestri
sudo mkdir -p /opt/vestri-worker
sudo chown -R vestri:vestri /opt/vestri-worker
```

Enable worker service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vestri-worker
sudo systemctl status vestri-worker --no-pager
```

## Log Retention Defaults

Backend file log rotation is intentionally short by default:

- `LOG_MAX_SIZE_MB=5`
- `LOG_MAX_BACKUPS=1`

When the file reaches the limit, rotation occurs and the oldest backup is removed first.

## Architecture Notes

- Frontend calls backend APIs and proxies through Next route handlers under `src/app/api/...`
- Backend handles signing, worker communication, and TLS trust decisions
- Console/log views:
  - Log stream: proxied chunked endpoint (`/console/logs/stream`)
  - Interactive console: HTTP session + chunked stream (`/console/exec/session`, `/console/exec/stream`, `/console/exec/input`, `/console/exec/resize`)
  - Legacy interactive WebSocket path (`/console/exec/ws`) still exists for compatibility

## Security Notes

- Even tho I try to make this as secure as possible I do not recommend to host it public. If you want other userers to access the application use a tool like Cloudflare tunnel or Twingate
