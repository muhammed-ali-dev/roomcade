# Roomcade

A private place for friends to play Codenames together. Create a House, approve friends through an invite link, and move between rooms with a shared game lobby and optional voice.

**Go · SQLite · WebSockets · React / TypeScript · LiveKit**

The interesting part is keeping everyone in agreement when tabs disconnect, two people edit the same game, or the host leaves. The backend owns membership, permissions, room state, and game revisions; browsers receive snapshots of that state.

## Start with the backend

| Problem | Implementation | Code |
| --- | --- | --- |
| Two clients replace the same lobby | Game writes check the caller's expected revision inside a transaction; stale writes return a conflict. | [repository.go](internal/app/repository.go) |
| An invitation is shared beyond the intended group | An invite allows a join request. The host must approve it, and approval checks capacity inside the transaction. | [repository.go](internal/app/repository.go) |
| A browser reconnects or opens a second tab | Reconnects receive a full snapshot. The new connection replaces the old connection for that session in the House. | [hub.go](internal/app/hub.go) |
| The host loses their connection | A 30-second grace period allows recovery before authority transfers to a connected member, ordered by join time and member ID. | [hub.go](internal/app/hub.go) |
| Voice access outlives a room change | Room switching revokes the previous media identity before updating the member's room; failed revocation rejects the switch. | [voice.go](internal/app/voice.go), [hub.go](internal/app/hub.go) |

[Architecture and tradeoffs](docs/architecture.md) covers transaction boundaries, recovery, and the current scaling limits.

## Try it

Run the app, then open it in two separate browser profiles. Create a House in the first, send its invite to the second, and approve the request as the host. Share a Codenames lobby and switch rooms. Separate profiles matter: two tabs in the same session intentionally replace one another.

## Run locally

Requirements: Go 1.26+, Node 22+, and npm.

```sh
npm ci
npm run build
go run ./cmd/roomcade
```

Open `http://localhost:8080`. The default local database is `roomcade.db`. Voice displays an explicit unconfigured state until the three `LIVEKIT_*` values are supplied.

For frontend hot reload, run the Go server and `npm run dev` in separate terminals, then open `http://localhost:5173`.

## Verify

```sh
npm test
npm run build
CGO_ENABLED=1 go test -race ./...
npm run test:e2e
```

Playwright starts the app itself unless port 8080 already contains a compatible local Roomcade server. Install its Chromium build once with `npx playwright install chromium`.

## Configuration

Copy `.env.example` into your preferred local environment loader. The Go process reads variables directly; it does not parse `.env` files.

- `ALLOWED_ORIGINS` is a comma-separated exact allowlist.
- `SECURE_COOKIES` must be `true` under production HTTPS.
- `METRICS_TOKEN` protects `/metrics` with a Bearer token.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` enable room voice and webhook verification.

## Scope and current limits

This is a single-process application with a local SQLite database. A House supports up to eight approved members and four rooms. Presence and recovery timers live in memory; membership and game state survive restarts.

The server serializes authenticated HTTP handlers and realtime commands with one shared lock. That keeps coordination straightforward at this scale, but a slow broadcast can delay unrelated Houses. There are no throughput or production-availability claims here.

LiveKit integration requires credentials and a separate live-audio verification. Docker and Render configuration are included; hosted deployment is not verified here. Public Codenames embedding also requires publisher permission. Roomcade shares provider lobby URLs and does not implement the game's rules.

## Tests and operations

The [Go tests](internal/app/repository_test.go) cover URL validation, room limits, persisted game state, stale game deletion, invitation approval, and member capacity. The [browser tests](e2e/roomcade.spec.ts) cover House creation and navigation on desktop and mobile. Disconnect recovery and multi-client races need broader integration coverage.

See [operations](docs/operations.md) for configuration, backups, and restore procedures, and the [release checklist](docs/completion-plan.md) for remaining hosted verification. Design handoffs and embedding experiments are retained as project history.
