# Vestri

Vestri is a web control panel for game server infrastructure.  
It connects frontend, backend, and standalone workers so teams can manage nodes, servers, console, files, and access rights in one place.

## Screenshots

Coming Soon!

## Quick Install

Detailed variables and settings: [`CONFIGURATION.md`](./CONFIGURATION.md).

Compose file:

- GitHub: https://github.com/dhernos/vestri/blob/main/docker-compose.yml
- Repository file: [`docker-compose.yml`](./docker-compose.yml)

### 1) Start Docker stack (frontend + backend + postgres + redis)

Create your stack env file from the example:

```bash
cp .env.stack.example .env.stack
```

Adjust at least these values in `.env.stack`:

- `APP_BASE_URL`: URL users open in the browser (for example `https://panel.example.com`).
- `FRONTEND_PORT`: host port for the web UI.
- `BACKEND_PORT`: host port for the backend API container.
- `POSTGRES_PASSWORD`: database password for the stack.
- `NODE_API_KEY_ENCRYPTION_KEY`: secret used by backend to encrypt worker API keys at rest.
- `WEB_AUTHN_ORIGIN`: passkey origin, should match the browser origin (scheme + host + optional port).
- `WEB_AUTHN_RP_ID`: passkey RP ID, usually only the domain (for example `example.com`).
- `WEB_AUTHN_ORIGINS`: comma-separated allowed passkey origins (include your `APP_BASE_URL` origin).

Generate `NODE_API_KEY_ENCRYPTION_KEY` once and paste it into `.env.stack`:

```bash
openssl rand -hex 32
```

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
([System.BitConverter]::ToString($bytes) -replace '-', '').ToLower()
```

If these commands are not available, generate the key by any other method with one of these accepted formats:

- 64 hex characters (represents 32 bytes / 256-bit).
- Base64 string that decodes to exactly 32 bytes (typically 43 or 44 chars).
- Raw 32-character string (supported, but hex/base64 is recommended).

Use one stable value and keep it unchanged after production setup, otherwise existing encrypted node API keys can no longer be decrypted.

Start the stack:

```bash
docker compose --env-file .env.stack pull
docker compose --env-file .env.stack up -d
```

### 2) Install and start worker on each node host

```bash
git clone --branch main https://github.com/dhernos/vestri-worker.git /opt/vestri-worker
cd /opt/vestri-worker
go build -o vestri-worker ./cmd/worker
sudo install -m 0755 vestri-worker /usr/local/bin/vestri-worker
sudo /usr/local/bin/vestri-worker
```

The first start creates `/etc/vestri/settings.json`, `/etc/vestri/api.key`, and TLS files under `/etc/vestri/certs/`.

Important worker settings in `/etc/vestri/settings.json`:

- `worker_name`
- `http_port`
- `tls_sans`
- `fs_base_path`

### 3) Run worker permanently with systemd (recommended)

Create `/etc/systemd/system/vestri-worker.service`:

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
ExecStart=/usr/bin/go run ./cmd/worker/main.go
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vestri-worker
sudo systemctl status vestri-worker --no-pager
```

## Worker API Key and CA Certificate

- Worker API key is stored at `/etc/vestri/api.key`.
- Worker CA certificate is stored at `/etc/vestri/certs/ca.crt`.
- Copy each worker CA cert into backend CA trust storage (`vestri-backend-worker-cas` volume) and restart backend.

Example:

```bash
docker volume inspect vestri-backend-worker-cas --format '{{ .Mountpoint }}'
sudo cp /etc/vestri/certs/ca.crt /var/lib/docker/volumes/vestri-backend-worker-cas/_data/<node-name>.crt
docker compose --env-file .env.stack restart backend
```

Then create the node in Vestri UI with:

- Base URL: usually `https://<worker-host>:8031`
- API key: content of `/etc/vestri/api.key`

## Security

- Do not expose Vestri directly to the public internet.
- Put access behind a secure access layer such as Cloudflare Tunnel or Twingate.
- Keep TLS enabled between backend and workers and trust only known worker CAs.
