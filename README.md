# Vestri Frontend

The `vestri` project is the Next.js frontend for Vestri. It provides:

- Authentication and session UI
- Node and server management screens
- Read-only and interactive console views
- i18n (German/English) with `next-intl`

## Requirements

- Node.js 20+
- npm 10+
- A running Vestri backend (`vestri-backend`)

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env` (or `.env.local`):

- `GO_API_URL` (default backend API URL used by Next API routes)
- `NEXT_PUBLIC_APP_URL` (public frontend URL)

3. Start dev server:

```bash
npm run dev
```

Frontend runs on `http://localhost:3000` by default.

## Build and Quality Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## i18n

Translations are in:

- `messages/en.json`
- `messages/de.json`

Server and node management UI uses translation keys instead of hardcoded labels/messages.  
When adding new UI text, add both EN and DE keys in the same namespace.

## Backend/Worker Connectivity

- Frontend talks to backend via Next API routes under `src/app/api/...`.
- Backend handles worker communication (HTTP/HTTPS, TLS trust, signing).
- If worker TLS is enabled (default in backend), frontend does not need worker cert details.
  It only needs reachable frontend/backend URLs.

## Notes

- The live log stream endpoint is proxied as a chunked stream (`/console/logs/stream`) for read-only auto updates.
- Interactive console uses WebSocket proxying (`/console/exec/ws`) via backend.
