# Vestri

Vestri is a web control panel for game server infrastructure.  
It connects frontend, backend, and standalone workers so teams can manage nodes, servers, console, files, and access rights in one place.

## Minecraft and Velocity Databases

Server administrators can use the **Databases** tab on Minecraft and Velocity servers to create MariaDB or PostgreSQL databases, view connection credentials, and start, stop, or delete them. The display name is limited to 48 characters; the backend generates the actual database name, username, and password.

Databases are internal services reachable only on the server's Docker network, using the displayed hostname and internal port (MariaDB: 3306, PostgreSQL: 5432). No public database port is published. Creation does not require a game server restart. Credentials and a JDBC connection URL are available only to server administrators.

Database data is persistent across stops and starts. **Stop** retains the data; **Delete** permanently removes the database and its data and requires typing its exact display name. Plugin configurations are not edited automatically; use the displayed internal connection details in the relevant plugin configuration.

Deploy the updated frontend, backend, and worker together. The game server's Docker network must already exist: start the Minecraft server or Velocity proxy once before creating a database. Velocity databases use the group network and can also be reached by its subservers; create group-shared databases on the Velocity server for clear ownership. Standalone servers use their own Compose network. No game server restart is needed to attach a database.

The worker keeps private Compose files and credentials outside `fs_base_path`, in a sibling `.vestri-databases-<hash>` directory with owner-only access. Database contents live in named Docker volumes. Back up these volumes separately using database-native dumps; the existing game-server backup does not include them. Deleting a game server is blocked until its database containers have been explicitly deleted. The plugin user is scoped to the generated database and does not receive database-administrator credentials.

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

For a public installation, change these values in `.env.stack`:

- `APP_BASE_URL`: the exact public URL visitors use, including `https://` and any non-standard public port, but no trailing path (for example `https://panel.example.com`). Passkey origins and RP ID are derived from this value by default.
- `FRONTEND_PORT`: host port published for the web UI. The container always listens on port `3000`; point Nginx at this host port.
- `POSTGRES_PASSWORD`: replace the example database password with a strong password.
- `NODE_API_KEY_ENCRYPTION_KEY`: replace the example with a generated 32-byte key. Keep the same value after deployment.

`BACKEND_PORT` only needs changing if the backend host port conflicts with another service. For normal use, leave the other values as supplied. Do not set `WEB_AUTHN_ORIGIN`, `WEB_AUTHN_RP_ID`, or `WEB_AUTHN_ORIGINS` unless you need to override the values derived from `APP_BASE_URL`.

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

Use one stable value and keep it unchanged after production setup, otherwise existing encrypted node API keys can no longer be decrypted. Values such as `xy` are not valid keys.

### Nginx reverse proxy

If Nginx runs on the Docker host and `.env.stack` contains `FRONTEND_PORT=3333`, proxy HTTPS traffic to `http://127.0.0.1:3333`. Keep the public host and scheme in the forwarded headers so redirects do not expose the container port:

```nginx
location / {
	proxy_pass http://127.0.0.1:3333;
	proxy_http_version 1.1;
	proxy_set_header Host $host;
	proxy_set_header X-Forwarded-Host $host;
	proxy_set_header X-Forwarded-Proto $scheme;
	proxy_set_header X-Forwarded-Port $server_port;
	proxy_set_header X-Real-IP $remote_addr;

	# Large uploads (files, backups): stream instead of buffering the whole body on disk first.
	client_max_body_size 1g;
	proxy_request_buffering off;
	proxy_read_timeout 900s;
	proxy_send_timeout 900s;
}
```

Use this inside the HTTPS server block for your domain. The browser URL in `APP_BASE_URL` should remain `https://your-domain`, not the internal `:3000` URL.

#### Slow or stalling uploads over WireGuard

If you reach Vestri through a WireGuard tunnel and large uploads crawl at a few KB/s (small requests work fine), the tunnel's path MTU is smaller than the interface MTU and the ICMP "fragmentation needed" replies never arrive. This affects every TCP service behind the tunnel, not just Vestri. Fix it on the WireGuard server by clamping the TCP MSS. Use your working MTU minus 40 (for example `1360 - 40 = 1320`):

```ini
# [Interface] section of the server's WireGuard config
PostUp   = iptables -t mangle -A POSTROUTING -o wg0 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1320
PostUp   = iptables -t mangle -A PREROUTING  -i wg0 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1320
PostDown = iptables -t mangle -D POSTROUTING -o wg0 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1320
PostDown = iptables -t mangle -D PREROUTING  -i wg0 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1320
```

Restart the tunnel (`wg-quick down wg0 && wg-quick up wg0`) and start a new upload. Alternatively, set `MTU = 1360` (or lower) in each client's WireGuard config. The MSS clamp only affects TCP; for UDP traffic such as game servers, lower the MTU in the WireGuard config instead.

### Portainer

1. In Portainer, open **Stacks** and create a stack from the Vestri Git repository, or upload/paste `docker-compose.yml`.
2. Under **Environment variables**, choose the advanced/list editor and add the entries from `.env.stack` as `NAME=value` lines. Do not commit your secrets to GitHub.
3. Set `APP_BASE_URL` to your public HTTPS address and `FRONTEND_PORT` to the port Nginx will use (for example `3333`). Generate and enter a strong `NODE_API_KEY_ENCRYPTION_KEY` and change `POSTGRES_PASSWORD`.
4. Deploy the stack, then configure Nginx to proxy to the host port you selected.

Portainer does not automatically read a local `.env.stack` file from your computer; copy its values into the stack's environment-variable editor.

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

## Velocity Whitelist

Velocity servers have an admin-only **Whitelist** tab, disabled until a subserver exists. The main subserver is the first target in the `try` list in `data/velocity.toml`.

Adding a Minecraft username resolves its official Mojang profile and writes the online UUID and canonical name to the main subserver's `data/whitelist.json`, even when that subserver runs in offline mode. Admins can also view and remove entries. Existing entries are preserved; invalid whitelist files must be repaired before changes are accepted.

The backend needs HTTPS access to `api.mojang.com`. Whitelist enforcement remains controlled by the subserver's `white-list` setting. After edits, run `whitelist reload` on the main subserver or restart it to apply the file changes.

## Linked Paper Plugins

Velocity's Plugin Staging includes a linked-plugin manager for HTTPS project links from Modrinth (`https://modrinth.com/plugin/<project>`) and Hangar (`https://hangar.papermc.io/<author>/<project>`). Downloading a link adds the latest compatible stable Paper release to staging; use the existing staging controls to copy it to a subserver initially.

Update checks run when the manager loads and every 15 minutes while it is open, with results cached on the worker for six hours. Opening the manager after the cache expires refreshes the check. There is no unattended nightly job, and updates are never installed automatically.

When an update is available, **Update all** downloads and verifies the latest stable release, replaces it in staging and on every Paper/Purpur subserver in the group, and removes all older filenames recorded for that plugin. Configuration folders and unrelated files are kept. Restart the affected subservers afterward. File-management permission is required on the Velocity server and every target; all targets must have the same explicit Minecraft version (not `LATEST`). Mixed-version groups, Spigot/Bukkit targets, arbitrary download hosts, paid plugins, and dependency installation are not supported by this linked Paper workflow.

Tracking is stored in `data/vestri-plugin-staging/tracked-plugins.json` on the Velocity server. It survives backend restarts, caches provider checks, and retains filename history for retrying partial deployments. **Stop tracking** leaves all plugin files in place. Existing manually uploaded JARs are not identified automatically: remove any untracked older copy of a plugin before deploying its first linked release. Only filenames observed through tracking are removed during updates.

## Security

- Do not expose Vestri directly to the public internet.
- Put access behind a secure access layer such as Cloudflare Tunnel or Twingate.
- Keep TLS enabled between backend and workers and trust only known worker CAs.
