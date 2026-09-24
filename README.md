# Roomcade

Roomcade is a small, private digital House where friends move between rooms, share one Codenames lobby per room, and optionally talk through room-scoped voice.

The current implementation is a complete local MVP foundation:

- React/TypeScript production UI derived from the approved design handoff.
- Guest browser sessions, Houses, rooms, invitations, approval, membership, roles, and canonical games persisted in SQLite.
- Versioned WebSocket snapshots, presence, room switching, duplicate-tab replacement, and 30-second host recovery.
- Real Codenames iframes with local reload, focus mode, external-open fallback, and revision-safe replacement.
- LiveKit token generation and browser voice lifecycle when managed credentials are supplied.
- Docker and Render configuration for a single persistent-disk deployment.

Public deployment still requires Codenames publisher permission and provisioned Render/LiveKit accounts. The application does not bypass provider frame policy or implement Codenames rules.

## Run locally

Requirements: Go 1.26+, Node 22+, and npm.

```sh
npm install
npm run build
go run ./cmd/roomcade
```

Open `http://localhost:8080`. The default local database is `roomcade.db`. Voice displays an explicit unconfigured state until the three `LIVEKIT_*` values are supplied.

For frontend hot reload, run the Go server and `npm run dev` in separate terminals, then open `http://localhost:5173`.

## Verify

```sh
npm test
npm run build
go test ./...
npm run test:e2e
```

Playwright starts the app itself unless port 8080 already contains a compatible local Roomcade server. Install its Chromium build once with `npx playwright install chromium`.

## Configuration

Copy `.env.example` into your preferred local environment loader. The Go process reads variables directly; it does not parse `.env` files.

- `ALLOWED_ORIGINS` is a comma-separated exact allowlist.
- `SECURE_COOKIES` must be `true` under production HTTPS.
- `METRICS_TOKEN` protects `/metrics` with a Bearer token.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` enable room voice and webhook verification.

## Production boundaries

- One House has 1–4 rooms and at most 8 approved members.
- Roomcade host, Roomcade game coordinator, and Codenames Admin are separate authorities.
- Removing a shared URL from Roomcade does not delete the provider match.
- Voice failure never blocks House or game access.
- Houses expire after 30 days without approved-member activity.

See [operations.md](docs/operations.md) for deployment, backup, and recovery procedures. The original experiment and design handoff remain in their existing directories as source evidence.
