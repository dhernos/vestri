# Vestri Configuration Reference

This file is the detailed reference for all environment variables and worker settings used by Vestri.

## 1) Docker Stack Env (`.env.stack`)

Create from [`./.env.stack.example`](./.env.stack.example):

```bash
cp .env.stack.example .env.stack
```

These variables are consumed by `docker-compose.yml` for the default stack.

| Variable | Default | Required | What it controls |
| --- | --- | --- | --- |
| `POSTGRES_USER` | `vestri` | Yes | PostgreSQL username for the stack database. |
| `POSTGRES_PASSWORD` | `vestri` | Yes | PostgreSQL password. Change this in all real setups. |
| `POSTGRES_DB` | `vestri` | Yes | PostgreSQL database name. |
| `FRONTEND_PORT` | `3000` | Yes | Host port mapped to frontend container port `3000`. |
| `BACKEND_PORT` | `8080` | Yes | Host port mapped to backend container port `8080`. |
| `APP_BASE_URL` | `http://localhost:3000` | Yes | Public base URL used for callbacks and generated links. |
| `ENFORCE_HTTPS_AUTH` | auto (`true` if `APP_BASE_URL` is `https`) | Optional | Forces HTTPS requirement for password endpoints. |
| `SESSION_COOKIE_SECURE` | auto (`true` if `APP_BASE_URL` is `https`) | Optional | Forces `Secure` cookie flag for auth/session cookies. |
| `NODE_API_KEY_ENCRYPTION_KEY` | `change-me` | Strongly recommended | Encrypts stored worker API keys in backend storage. Accepted formats: `64-char hex`, base64 that decodes to `32 bytes`, or raw `32-char` string. Generate with `openssl rand -hex 32` (or use PowerShell command from README). |
| `WEB_AUTHN_ORIGIN` | `http://localhost:3000` | For passkeys | Primary WebAuthn origin. |
| `WEB_AUTHN_RP_ID` | `localhost` | For passkeys | WebAuthn RP ID (usually the domain only). |
| `WEB_AUTHN_RP_NAME` | `Auth Service` | Optional | Display name shown in authenticator apps. |
| `WEB_AUTHN_ORIGINS` | `http://localhost:3000` | For passkeys | Comma-separated list of allowed WebAuthn origins. |
| `NO_EMAIL_VERIFY` | `true` | Optional | Skip email verification checks. |
| `EMAIL_SERVER_HOST` | empty | Optional | SMTP host. |
| `EMAIL_SERVER_PORT` | `587` | Optional | SMTP port. |
| `EMAIL_SERVER_USER` | empty | Optional | SMTP username. |
| `EMAIL_SERVER_PASSWORD` | empty | Optional | SMTP password. |
| `EMAIL_FROM` | empty | Optional | Sender address used for outgoing mail. |
| `EMAIL_SERVER_SECURE` | `false` | Optional | Enable SMTPS/TLS mode for SMTP transport. |
| `GITHUB_CLIENT_ID` | empty | Optional | GitHub OAuth client ID. |
| `GITHUB_CLIENT_SECRET` | empty | Optional | GitHub OAuth client secret. |
| `GITHUB_REDIRECT_URL` | `<APP_BASE_URL>/api/oauth/github/callback` | Optional | GitHub OAuth callback URL override. |
| `LOG_MAX_SIZE_MB` | `5` | Optional | Max backend log file size before rotation. |
| `LOG_MAX_BACKUPS` | `1` | Optional | Number of rotated backend log files kept. |
| `TOTP_ISSUER` | `Vestri` | Optional | Issuer label shown in authenticator apps. |
| `WORKER_TLS_CA_CERT_FILE` | empty | Optional | Extra worker CA cert file trusted by backend. |
| `TRUSTED_PROXIES` | empty | Optional | Comma-separated trusted proxy CIDRs/IPs. |
| `AUTO_MIGRATE` | `true` | Optional | Run SQL migrations automatically on backend startup. |
| `NEXT_TELEMETRY_DISABLED` | `1` | Optional | Disable Next.js telemetry in frontend container. |

Quick key generation for `NODE_API_KEY_ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

Requirements if you generate it another way:

- Must resolve to exactly 32 bytes (256-bit) key material.
- Valid input formats in backend: `64-char hex`, base64 (padded or unpadded) decoding to 32 bytes, or raw 32-char string.
- Keep this value stable after rollout; changing it prevents decryption of existing stored node API keys.

## 2) Frontend Env (`vestri/.env` or `vestri/.env.local`)

| Variable | Default | Required | What it controls |
| --- | --- | --- | --- |
| `GO_API_URL` | `http://localhost:8080` | Yes for non-default setups | Backend base URL used by rewrites, proxy routes, and auth checks. |
| `NEXTAUTH_URL` | `http://localhost:3000` | Yes | Frontend base URL used by eg. Cookies |
| `NEXT_PUBLIC_CONSOLE_WS_BASE_URL` | empty | Optional | Public API origin for browser log WebSocket endpoint (`/console/logs/ws`). |
| `NODE_ENV` | framework default (`production` in containers) | Optional | Runtime mode. |
| `NEXT_TELEMETRY_DISABLED` | empty | Optional | Set to `1` to disable Next.js telemetry. |

## 3) Backend Env (`vestri-backend`)

Boolean values accept `1`, `true`, or `yes` (case-insensitive).  
List values are comma-separated.

| Variable | Default | Required | What it controls |
| --- | --- | --- | --- |
| `PORT` | `8080` | Optional | Backend HTTP listen port (`:<PORT>`). |
| `APP_BASE_URL` | fallback to `NEXTAUTH_URL`, then `http://localhost:3000` | Optional | Base URL for callbacks and generated URLs. |
| `NEXTAUTH_URL` | none | Optional | Fallback source for `APP_BASE_URL`. |
| `DATABASE_URL` | none | Yes | PostgreSQL connection string. |
| `REDIS_URL` | `redis://localhost:6379` | Optional | Redis connection string for sessions and rate limits. |
| `UPLOAD_DIR` | `../vestri/public/uploads` | Optional | Directory for uploaded profile images (resolved to absolute path). |
| `LOG_FILE` | `logs/server.log` | Optional | Backend log file path. |
| `LOG_MAX_SIZE_MB` | `5` | Optional | Log rotation size limit in MB. |
| `LOG_MAX_BACKUPS` | `1` | Optional | Number of rotated log backups to keep. |
| `NO_EMAIL_VERIFY` | `true` | Optional | Disables email verification requirement. |
| `TOTP_ISSUER` | `Vestri` | Optional | Issuer name in authenticator apps. |
| `WORKER_TLS_CA_CERT_FILE` | empty | Optional | Additional trusted worker CA cert file. |
| `WORKER_TLS_CA_CERT_DIR` | `./certs/worker-cas` | Optional | Directory with trusted worker CA cert files. |
| `NODE_API_KEY_ENCRYPTION_KEY` | empty | Strongly recommended | Encryption key for stored worker API keys. |
| `TRUSTED_PROXIES` | empty | Optional | Trusted proxy CIDRs/IPs for forwarded headers. |
| `ENFORCE_HTTPS_AUTH` | auto based on `APP_BASE_URL` scheme | Optional | Enforces HTTPS on password/auth endpoints. |
| `SESSION_COOKIE_SECURE` | auto based on `APP_BASE_URL` scheme | Optional | Forces `Secure` cookie flag. |
| `WEB_AUTHN_ORIGIN` | `APP_BASE_URL` | Optional | Primary WebAuthn origin. |
| `WEB_AUTHN_RP_ID` | host from `WEB_AUTHN_ORIGIN` | Optional | WebAuthn relying party ID. |
| `WEB_AUTHN_RP_NAME` | `Auth Service` | Optional | WebAuthn relying party display name. |
| `WEB_AUTHN_ORIGINS` | `WEB_AUTHN_ORIGIN` | Optional | Comma-separated allowed WebAuthn origins. |
| `EMAIL_SERVER_HOST` | empty | Optional | SMTP host. |
| `EMAIL_SERVER_PORT` | `587` | Optional | SMTP port (`587` used if invalid). |
| `EMAIL_SERVER_USER` | empty | Optional | SMTP username. |
| `EMAIL_SERVER_PASSWORD` | empty | Optional | SMTP password. |
| `EMAIL_FROM` | empty | Optional | Sender email address. |
| `EMAIL_SERVER_SECURE` | `false` | Optional | Use SMTPS/TLS mode for SMTP transport. |
| `GITHUB_CLIENT_ID` | empty | Optional | GitHub OAuth client ID. |
| `GITHUB_CLIENT_SECRET` | empty | Optional | GitHub OAuth client secret. |
| `GITHUB_REDIRECT_URL` | `<APP_BASE_URL>/api/oauth/github/callback` | Optional | GitHub OAuth callback URL override. |
| `AUTO_MIGRATE` | `true` | Optional | Applies migrations during backend startup. |
| `MIGRATIONS_DIR` | `./migrations` | Optional | Migrations directory path. |

## 4) Migration CLI Env (`vestri-backend/cmd/migrate`)

| Variable | Default | Required | What it controls |
| --- | --- | --- | --- |
| `DATABASE_URL` | none | Yes | PostgreSQL DSN used by migration CLI. |
| `MIGRATIONS_DIR` | `./migrations` | Optional | Directory containing `*.up.sql` files. |

## 5) Worker Settings (`/etc/vestri/settings.json`)

`vestri-worker` uses JSON settings (not env variables) for runtime behavior.

| Key | Default | What it controls |
| --- | --- | --- |
| `useTLS` | `true` | Enables TLS listener mode. |
| `TLSCert` | `/etc/vestri/certs/worker.crt` | Worker certificate file path. |
| `TLSKey` | `/etc/vestri/certs/worker.key` | Worker private key file path. |
| `tls_ca_cert` | `/etc/vestri/certs/ca.crt` | Worker CA certificate file path. |
| `tls_ca_key` | `/etc/vestri/certs/ca.key` | Worker CA private key file path. |
| `tls_auto_generate` | `true` | Auto-generate missing CA/server certs and keys. |
| `tls_sans` | `["localhost","127.0.0.1","::1"]` | Extra SAN entries for generated server cert. |
| `http_port` | `:8031` | Worker listen address/port. |
| `worker_name` | empty | Added to SAN candidates during cert generation. |
| `fs_base_path` | `/etc/vestri/servers` | Safe base path for worker filesystem operations. |
| `replay_window_seconds` | `300` | Allowed timestamp skew for signed requests. |
| `rate_limit_rps` | `10` | Rate limit token refill rate. |
| `rate_limit_burst` | `20` | Rate limit burst bucket size. |
| `max_archive_request_bytes` | `1048576` | Max archive endpoint request size. |
| `max_inline_write_bytes` | `10485760` | Max inline write payload size. |
| `max_upload_bytes` | `1073741824` | Max upload size for `/fs/upload`. |
| `max_unzip_bytes` | `10737418240` | Max extracted byte limit for unzip operations. |
| `max_zip_entries` | `100000` | Max ZIP entry count allowed. |
| `require_tls` | `true` | Reject non-TLS requests unless trusted proxy headers indicate HTTPS. |
| `trust_proxy_headers` | `false` | Trust `X-Forwarded-*`/`X-Real-IP` headers for TLS/IP decisions. |
| `health_requires_auth` | `false` | Require API auth for `/health`. |

## 6) Worker-Generated Files and Placement

After first worker start:

- API key file: `/etc/vestri/api.key`
- Worker CA certificate: `/etc/vestri/certs/ca.crt`
- Worker cert/key: `/etc/vestri/certs/worker.crt` and `/etc/vestri/certs/worker.key`

Backend CA trust path in Docker stack:

- Volume name: `vestri-backend-worker-cas`
- In backend container: `/app/certs/worker-cas`

Typical Linux host copy target for rootful Docker:

`/var/lib/docker/volumes/vestri-backend-worker-cas/_data/<node-name>.crt`
