# Vestri

Vestri is a web control panel for game server infrastructure.  
It connects frontend, backend, and standalone workers so teams can manage nodes, servers, console, files, and access rights in one place.

## Dynamic Minecraft Servers

Node owners and admins can manage **Minecraft Game Templates** on the node details page. The workflow is:

1. Upload mandatory plugin JARs and their configuration folders to the node's **Minecraft Plugin Library**. Every Velocity group on this node uses this same library.
2. Create a **Base server**, select Paper or Purpur and an explicit Minecraft release, select mandatory plugins/configurations, and accept the Minecraft EULA. The server JAR and default files are downloaded without starting a container. Open its files to upload or edit plugin configurations. Plugins that generate their configuration on first boot must have those files prepared separately and uploaded.
3. Create **Worlds** and upload each world's contents, including `level.dat`, using folder upload. Create **Game plugins** packages and upload JARs alongside their configuration folders. Folder upload strips the selected outer folder; its contents go into the selected destination.
4. Create a **Game template** by selecting a base server, an optional world, optional game-plugin packages, a Velocity proxy on this node, and an instance limit. This makes an independent snapshot. Later changes to the base, world, or plugin packages do not silently change existing templates. Plugin packages are applied in selection order; later files overwrite earlier files with the same relative path.
5. Spawn instances from the panel, or issue a template-scoped API key. An empty world selection clears any inherited seed and generates a new world for every instance. A selected world is cloned; its runtime lock and Bukkit world identity are removed. Live instances have independent writable copies, and deleting them does not delete the template.

The worker stores shared resources below its configured `fs_base_path`:

```text
.vestri-minecraft/<node-id>/
	plugins/                         shared mandatory plugins and configs
	tracked-plugins.json              shared plugin-update tracking
	bases/<resource-id>/data/         prepared, never-started base servers
	worlds/<resource-id>/data/        world contents, including level.dat
	plugin-packs/<resource-id>/data/   game plugin JARs and config folders
	templates/<resource-id>/data/     composed game-server snapshots
mcgame-<unique-id>/                 disposable instance and Compose file
```

Each resource also has a `manifest.json` beside `data`. Names are kept in the database; stable IDs in paths prevent naming conflicts and path traversal. The reserved `.vestri-minecraft` directory cannot collide with a normal game server slug, so deleting a regular server cannot remove the library. Back up the shared resource directories **and PostgreSQL** together. Plugin-package overlays are limited to 5,000 files and 16 directory levels per package. A node permits at most 100 tracked dynamic instances, with a configurable limit of 1-100 per game template; stopped or failed instances count until deleted.

### Deployment and Velocity Bridge

Deploy the updated frontend, backend, and worker together. Apply backend migration `000008_minecraft_templates` before using the feature, through the existing migration mechanism or `go run ./cmd/migrate` from the backend directory with `DATABASE_URL` configured. No existing migration is changed.

Build the included bridge from the backend repository with Java 17+ and Maven:

```bash
mvn -f velocity-plugin/pom.xml package
```

Install `velocity-plugin/target/vestri-dynamic-servers-1.0.0.jar` in the selected Velocity proxy's `data/plugins` directory and restart that proxy once. The bridge uses the Velocity 3.3 API. The proxy must be running with its interactive console enabled (`stdin_open: true`, `tty: true`, as in the standard Vestri template). The worker must run on Linux for its PTY console support. No extra public plugin port or plugin API key is needed.

Subsequent spawns/deletions synchronize the running proxy through the console-only `vestridynamic sync` command. The backend writes `data/vestri-dynamic-servers.json`; the bridge only manages names matching `mcgame-<32 hex characters>` and their corresponding internal Docker hostnames on port 25565. Keep that namespace reserved. Dynamic games are not added to the Velocity fallback list. This bridge is necessary because stock `velocity reload` does not unregister removed backend servers.

Existing Velocity staging folders (`<proxy-root>/data/vestri-plugin-staging`) are preserved, not merged automatically. Before switching, copy their `plugins` contents into `.vestri-minecraft/<node-id>/plugins`, resolving duplicate filenames intentionally. To preserve update tracking from one group, copy its `tracked-plugins.json` beside the new `plugins` folder; multiple manifests must not be blindly concatenated. Other groups can re-import their tracked plugin links. Existing deployed server plugins are not moved or deleted.

### Spawn API

Create an API key in the node's **API keys** view and select exactly one game template. The token is shown only once and is stored only as a SHA-256 digest. Keys expire after 1-365 days, can be revoked, and stop working if their issuing user loses node-admin access. A revoked key does not stop existing games; a node admin can still delete those instances from the panel.

Use the panel's public **HTTPS** origin. Do not expose the HTTP backend directly. Pass the key only in the `Authorization` header, never in a URL or query string. Do not reuse the worker's administrative API key.

```bash
# MINECRAFT_API_KEY is the template-scoped token, not the worker API key.
curl -X POST https://panel.example.com/api/minecraft/v1/instances/ \
	-H "Authorization: Bearer $MINECRAFT_API_KEY" \
	-H 'Content-Type: application/json' \
	-d '{"requestId":"fe392ba1-0602-43de-acbf-509a34e7c651"}'
```

The response is `202 Accepted` with `serverId`, `slug`, internal `host`, `port`, `parentId`, and `state: "starting"`. This confirms container startup and proxy registration, **not Minecraft/plugin readiness**. The game controller should wait for its normal game-ready signal before sending players, and use the returned `slug` as the Velocity server name.

Retry the **same request UUID** with the **same key** after a timeout or partial startup failure. It returns/restarts the existing instance rather than creating a second server. A new game must use a new UUID. Limits count failed starts too; error responses after creation include `serverId` so the instance can be removed. After an instance is deleted its request UUID is no longer retained and must not be reused.

```bash
curl https://panel.example.com/api/minecraft/v1/instances/ \
	-H "Authorization: Bearer $MINECRAFT_API_KEY"

curl -X DELETE https://panel.example.com/api/minecraft/v1/instances/SERVER_ID \
	-H "Authorization: Bearer $MINECRAFT_API_KEY"
```

Listing and deletion only expose instances created by that exact API key for its assigned template, never normal servers or another key's games. Deletion stops the container, removes the proxy registration, and deletes only the instance files and database record. Move players back to a lobby before deleting a game. Attached databases must be removed separately before instance deletion. Successful deletion returns `204`; unknown or inaccessible instances return `404`. Requests are limited to 30 per minute per key (`429`, `Retry-After: 60`); conflicting operations or exhausted instance limits return `409` and should be retried with backoff.

## Minecraft and Velocity Databases

Server administrators can use the **Databases** tab on Minecraft and Velocity servers to create MariaDB or PostgreSQL databases, view connection credentials, and start, stop, or delete them. The display name is limited to 48 characters; the backend generates the actual database name, username, and password.

Databases are internal services reachable only on the server's Docker network, using the displayed hostname and internal port (MariaDB: 3306, PostgreSQL: 5432). No public database port is published. Creation does not require a game server restart. Credentials and a JDBC connection URL are available only to server administrators.

Database data is persistent across stops and starts. **Stop** retains the data; **Delete** permanently removes the database and its data and requires typing its exact display name. Plugin configurations are not edited automatically; use the displayed internal connection details in the relevant plugin configuration.

Deploy the updated frontend, backend, and worker together. The game server's Docker network must already exist: start the Minecraft server or Velocity proxy once before creating a database. Velocity databases use the group network and can also be reached by its subservers; create group-shared databases on the Velocity server for clear ownership. Standalone servers use their own Compose network. No game server restart is needed to attach a database.

The worker keeps private Compose files and credentials outside `fs_base_path`, in a sibling `.vestri-databases-<hash>` directory with owner-only access. Database contents live in named Docker volumes. Back up these volumes separately using database-native dumps; the existing game-server backup does not include them. Deleting a game server is blocked until its database containers have been explicitly deleted. The plugin user is scoped to the generated database and does not receive database-administrator credentials.

## Minecraft BlueMap

Paper and Purpur servers (including Velocity subservers) have a **Map** entry in the left server menu. Install the BlueMap plugin on the Minecraft server, start it once, and leave its integrated webserver enabled. Initial rendering can take a while. Missing configuration, a stopped server, or an unreachable webserver is shown on the Map page with a reload action.

The map, assets, tiles, and live updates travel through the existing authenticated Vestri frontend, backend, and worker connection. **Do not publish or forward BlueMap's port** (normally 8100); no Compose port mapping is needed. The worker must run on the Docker host with access to the Minecraft container's bridge-network IP. Host-network containers and remote Docker daemons without a reachable container network are not supported by this integration.

Vestri reads `data/plugins/BlueMap/webserver.conf` inside the server directory. Keep the standard generated configuration with literal `enabled` and `port` values; a custom numeric port is supported. Keep BlueMap's `map-data-root` and `live-data-root` relative (their default is `maps`) so that data stays behind the authenticated proxy. Custom external scripts, fonts, or tile/CDN URLs are intentionally blocked by the map's content security policy.

If the browser blocks the map with `frame-ancestors 'none'`, update and restart the backend: map responses must replace the default API frame restrictions, not append a second policy. Any external reverse proxy must also avoid adding `X-Frame-Options: DENY` or `frame-ancestors 'none'` to the map view route. Keep those protections on other routes.

All users with access to a server can view its map; it is not publicly accessible. Install only trusted BlueMap builds and custom web scripts: the embedded map is served on the panel's origin. Deploy the updated frontend, backend, and worker together. The worker uses a separate map-asset rate-limit budget of 20 times its configured request rate and burst, so tile loading does not consume the control API's budget.

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
