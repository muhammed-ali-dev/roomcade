# Roomcade Full Application Implementation Plan

## 1. Product and Architecture Summary

Build Roomcade as a private, guest-first place where up to eight friends share a House containing one to four rooms. Each room combines one embedded Codenames lobby with managed voice.

```text
Browser ──HTTP/WebSocket──> Go application ──> SQLite
   │                              │
   ├──WebRTC audio────────> LiveKit Cloud
   │
   └──isolated iframe─────> codenames.game
```

### Locked product decisions

- A new House starts with one renameable **Living Room**.
- Houses support four rooms and eight total members.
- Invitees require approval from the current House host.
- Guest memberships persist in the current browser; there are no accounts or cross-device recovery.
- Houses are deleted after 30 days without authenticated member activity.
- The host transfers after a 30-second disconnect grace period.
- Any member may place a game in an empty room and become its game coordinator.
- Only the coordinator or House host may replace or clear an existing game.
- Codenames is the only MVP game.
- Voice is opt-in once; after joining voice, it follows committed room switches automatically.
- MVP voice uses LiveKit Cloud’s managed SFU.
- Roomcade never interprets Codenames players, roles, readiness, scores, or match state.
- Cozy digital-House styling surrounds a game-dominant central surface.

### Stack

- React, TypeScript, Vite, React Router, TanStack Query, and CSS Modules.
- Go 1.26 using `net/http`, `coder/websocket`, `database/sql`, and `modernc.org/sqlite`.
- Official LiveKit browser components and Go server SDK.
- Vitest, React Testing Library, Playwright, and Go’s test/race tooling.
- One production Go process serving the embedded React build, API, WebSocket endpoint, and health endpoints.
- Render web service with one persistent disk and LiveKit Cloud.
- No Redis, PostgreSQL, Node backend, custom WebRTC signaling, or first-party game engine.

Render supports public WebSockets and managed HTTPS. Its persistent disk constrains the service to one instance and causes brief deployment downtime, which matches the intentionally single-authority MVP if clients reconnect honestly. [Render WebSockets](https://render.com/docs/websocket), [Render persistent disks](https://render.com/docs/disks). LiveKit tokens will be short-lived and room-scoped; Cloud participant removal provides token revocation for room switches and removals. [LiveKit token lifecycle](https://docs.livekit.io/home/server/generating-tokens).

## 2. Product Behavior and System Design

### Identity, membership, and invitations

- Store an opaque 256-bit guest-session token in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie. Store only its SHA-256 hash in SQLite; expire it after 180 days and extend it on use.
- Display names belong to House memberships, allowing a guest to use a different name in another House. Require 2–24 visible characters and case-insensitive uniqueness within a House.
- Creating a House creates the host membership, Living Room, and one active invite link transactionally.
- An invite reveals only House name and available capacity. A visitor selects a display name and submits a join request.
- The visitor polls their session-bound request status while the host receives the request in the House’s realtime snapshot.
- Requests expire after 24 hours. Rotating an invite revokes its pending requests.
- Approval transactionally rechecks the eight-member limit and name uniqueness. Pending requests do not reserve capacity.
- Existing members opening an invite bypass approval and enter normally.
- A removed member loses HTTP, WebSocket, and LiveKit access immediately. Rejoining requires another approved request.
- Losing the browser cookie creates a new guest identity; the host must remove the abandoned membership if it occupies one of eight seats.

### House and room authority

- Persist one `hostMembershipId` per House.
- A disconnected person remains visibly “reconnecting” for 30 seconds.
- If the host does not return, transfer authority to the longest-tenured connected membership and persist the change. The original host returns as a normal member.
- If no other member is connected, retain the existing host; start the same 30-second transfer check when another member later connects.
- Explicit host transfer is immediate. A host leaving explicitly transfers to the longest-tenured remaining member; the sole member must delete the House instead.
- Only the host may rename/delete the House, add/rename/delete rooms, rotate invites, approve requests, or remove members.
- A House always retains at least one room. A room may be deleted only when no connected member is inside it; stored `lastRoomId` references move to Living Room.
- Maintain room order from zero through three and reject creation of a fifth room.
- All members may move freely between rooms.

### Room game lifecycle

- Persist either no game or one `ExternalGame` per room:
  - Provider: fixed enum value `codenames`.
  - Canonical normalized `https://codenames.game/r/{slug}` URL.
  - Revision number.
  - Coordinator membership.
  - Set/update timestamp.
- Reject credentials, custom ports, subdomains, fragments, queries, homepage URLs, and non-room paths.
- Empty-room setup presents:
  1. **Create Codenames lobby**, opening the official site in a new tab.
  2. Instructions to create a private lobby and copy its share URL.
  3. A paste-and-validate form.
- The first member to set an empty room’s URL becomes game coordinator.
- Replacing a nonempty game requires the expected game revision and explicit confirmation. Concurrent stale updates return `revision_conflict` plus the current snapshot.
- If a coordinator deliberately switches rooms, leaves, or remains disconnected for 30 seconds, transfer coordination to the longest-tenured connected member in that room. If nobody remains, retain the coordinator until someone returns. The House host may always override.
- Roomcade labels this role “game coordinator”; it never claims that this person is Codenames Admin.
- Expose three distinct controls:
  - **Reload for me:** recreate only the local iframe.
  - **Open externally:** open the canonical URL directly.
  - **Replace for everyone:** authorized, confirmed canonical-URL replacement.
- Mount only the active room’s iframe. Unmount it during room switches and remount from the server snapshot on return.
- Do not add a restrictive iframe sandbox until the production compatibility gate identifies a tested policy. Do not grant microphone or camera permission to the iframe.
- Include an environment-controlled embedding feature flag. If framing later fails, preserve the room and voice experience while making **Open externally** the primary action.

### Presence, room switching, and multiple tabs

- Use one serialized command loop per active **House**, not per room. This makes cross-room membership, host transfer, coordinator transfer, and snapshots one ordering domain.
- Load a House actor from SQLite on first use and evict it five minutes after its final connection closes.
- Persist durable mutations before changing actor state and broadcasting.
- Keep presence, socket information, transition generations, and reconnect timers in memory.
- Maintain one active realtime connection per guest session. A newer tab sends `session.replaced` to the previous connection, invalidates its media generation, and shows an inactive-tab overlay.
- A room switch uses a client-generated transition ID:
  1. Immediately stop old audio and unmount the old iframe.
  2. Send the switch command.
  3. Server validates membership and commits active-room presence.
  4. Server returns a new snapshot and voice generation.
  5. Client mounts the new iframe and, if voice is enabled, obtains a new LiveKit token.
  6. Failed switches restore the previous room from the authoritative snapshot.
- Ignore callbacks, tokens, and media events from older transition generations.
- A reconnect uses bounded exponential backoff with jitter, then receives a complete snapshot rather than replaying missed events.
- Process restarts intentionally drop ephemeral presence and voice while retaining Houses, rooms, memberships, hosts, and game URLs.

### Voice

- Entering a House never requires microphone permission.
- The first **Join voice** action requests microphone access. Once enabled, voice follows future room changes until **Leave voice** is selected.
- If microphone access is denied, connect as a listener and display a persistent mic-blocked state with recovery instructions.
- Issue LiveKit tokens only when the requesting membership is currently present in the requested room and supplies the current media generation.
- Tokens allow subscribing and publishing audio only; disable video, data publishing, recording, and room administration.
- Use a stable LiveKit room name derived from the Roomcade room UUID and a participant identity containing membership ID plus media generation.
- On switches, kicks, and explicit voice leave, disconnect locally and call LiveKit `RemoveParticipant` for the old identity. Retry failed removals with bounded backoff and withhold new-room voice until cleanup succeeds or the UI enters a recoverable “voice unavailable” state.
- LiveKit callbacks control speaking, mute, and media connection UI; they do not alter Roomcade membership.
- Voice failure never prevents joining a House, switching rooms, or playing Codenames.

### Persistence and lifecycle

Use forward-only SQLite migrations for:

- `guest_sessions`
- `houses`
- `house_memberships`
- `rooms`
- `room_games`
- `house_invites`
- `join_requests`
- `idempotency_keys`
- `schema_migrations`

Enable WAL, foreign keys, busy timeout, and one application writer connection. House actors serialize application-level writes.

- Update `lastMemberActivityAt` when an approved member connects or performs an authorized action; pending invite activity does not extend House life.
- Every six hours and at startup, delete Houses inactive for 30 days using cascading transactions.
- Skip connected Houses during cleanup.
- Best-effort delete corresponding LiveKit rooms after database deletion; retry failures without restoring deleted House data.
- Run migrations before accepting traffic.
- Checkpoint SQLite during graceful shutdown and rely on Render disk snapshots, with a documented restore drill before public use.

## 3. Public Interfaces and Client Structure

### HTTP API

All mutation endpoints require the guest cookie, matching `Origin`, JSON content type, and the CSRF token returned by bootstrap. Responses use `{data}` or `{error:{code,message,requestId,details}}`.

- Session/bootstrap:
  - `POST /api/v1/guest-session`
  - `GET /api/v1/bootstrap`
- Houses:
  - `POST /api/v1/houses`
  - `GET/PATCH/DELETE /api/v1/houses/{houseId}`
  - `POST /api/v1/houses/{houseId}/host-transfer`
- Rooms:
  - `POST /api/v1/houses/{houseId}/rooms`
  - `PATCH/DELETE /api/v1/houses/{houseId}/rooms/{roomId}`
- Invitations and approvals:
  - `GET /api/v1/invites/{token}`
  - `POST /api/v1/invites/{token}/requests`
  - `GET /api/v1/join-requests/{requestId}`
  - `POST /api/v1/houses/{houseId}/join-requests/{requestId}/decision`
  - `POST /api/v1/houses/{houseId}/invite/rotate`
- Membership:
  - `DELETE /api/v1/houses/{houseId}/members/{membershipId}`
- Game:
  - `PUT/DELETE /api/v1/houses/{houseId}/rooms/{roomId}/game`
  - `POST /api/v1/houses/{houseId}/rooms/{roomId}/coordinator-transfer`
- Media:
  - `POST /api/v1/houses/{houseId}/rooms/{roomId}/voice-token`
  - `POST /api/v1/livekit/webhook`
- Operations:
  - `GET /healthz`, `GET /readyz`, protected `GET /metrics`

Create-House and join-request POSTs accept an `Idempotency-Key`, retained for 24 hours.

### Realtime protocol

Connect to `/api/v1/realtime?houseId={id}` with the authenticated cookie and fixed `roomcade.v1` subprotocol. Reject unapproved origins, oversized messages, and nonmembers.

Client messages:

- `house.enter {desiredRoomId, clientInstanceId}`
- `room.switch {targetRoomId, transitionId}`
- `presence.resync`
- `connection.pong`

Server messages:

- `house.snapshot`
- `command.accepted`
- `command.rejected`
- `connection.ping`
- `session.replaced`
- `house.deleted`

Use a maximum 16 KiB inbound frame, server ping every 20 seconds, stale timeout after 45 seconds, a bounded House command queue, and one bounded writer queue per socket. Disconnect slow consumers and let them recover from a new snapshot.

The complete `HouseSnapshot` includes:

- House ID, name, host membership, durable revision, and expiry time.
- Ordered rooms and each room’s game metadata/revision.
- Approved memberships with display name and `online`, `reconnecting`, or `offline` presence.
- Each connected member’s active room.
- The current member’s permissions and media generation.
- Host-visible pending join requests.
- Monotonic durable and presence versions.

Because Houses contain only eight members and four rooms, broadcast full snapshots after changes instead of implementing an event replay system. Clients discard older versions.

### Application surfaces

- Landing page: product explanation, create House, and browser-session House list.
- Create flow: House name, display name, Living Room creation, invite link.
- Invite flow: preview, display-name request, waiting/approved/rejected/full/expired states.
- House shell: compact House selector, room list with occupancy, game-dominant center, participant panel, and persistent voice bar.
- Host controls: join requests, room management, invite rotation, member removal, and explicit host transfer.
- Empty-game setup, Codenames iframe, external fallback, reload, and confirmed replacement states.
- Responsive layout: desktop side panels; mobile drawers around a full-width game. Mobile joining, approval, room switching, and voice controls must remain usable even before the mobile iframe gate passes.
- Styling: warm neutral surfaces, distinct room accent colors, subtle architectural/arcade motifs, readable modern typography, restrained motion, visible focus, reduced-motion support, and WCAG AA contrast.

## 4. Implementation Milestones

### Milestone 0 — Repository and deployable foundation

- Initialize Git, ignore generated frontend/build/database artifacts, and preserve the experiment directory.
- Scaffold the Go module and Vite React application.
- Add repeatable `dev`, `test`, `lint`, `build`, `race`, and `e2e` commands.
- Configure Vite to proxy API/WebSocket traffic locally and build into a Go-embedded production asset directory.
- Add JSON logging, request IDs, configuration validation, health endpoints, Docker multi-stage build, Render blueprint, SQLite migration runner, and CI.
- Provide `.env.example`; never commit Render, LiveKit, session, or metrics secrets.

Acceptance: a single production binary serves the SPA and health endpoints; local development works without Docker; CI builds both stacks.

### Milestone 1 — Guest Houses and approval flow

- Implement guest sessions, SQLite schema, House creation, Living Room, House list, hashed invites, pending approval, eight-member enforcement, and host management.
- Build landing, create, invite waiting, approval, full, rejected, and expired experiences.
- Add host-only House/room/member operations and 30-day cleanup with an injectable clock.

Acceptance: two isolated browser contexts can create a House, request admission, approve, refresh, and retain membership; a ninth member is rejected; unapproved visitors cannot read House details.

### Milestone 2 — Realtime presence and room movement

- Implement the House manager/actor, full versioned snapshots, bounded WebSocket connections, reconnect state, single-active-tab policy, room switching, and host/coordinator timers.
- Build room navigation, participant grouping, reconnect indicators, inactive-tab overlay, and host-change notices.
- Persist host changes and last-room choices.

Acceptance: eight automated clients can distribute across four rooms, switch concurrently without appearing in two rooms, survive refresh, and deterministically transfer host after 30 seconds.

### Milestone 3 — Codenames vertical slice

- Add the internal provider registry with only Codenames enabled.
- Implement URL normalization, revision checks, coordinator permissions, local reload, shared replacement, clear, and external fallback.
- Integrate the ordinary iframe while keeping the House shell mounted.
- Add explicit copy explaining that the provider creator—not Roomcade—starts the match.

Acceptance: four approved members establish one canonical private lobby, load the same provider match in separate iframes, switch away/back, and replace a stuck lobby without stale writes winning.

### Milestone 4 — Managed room voice

- Integrate LiveKit Cloud, scoped token issuance, audio rendering, speaking indicators, mute, listen-only fallback, leave voice, media generations, removal calls, and cleanup retries.
- Make enabled voice follow room switches without allowing stale audio callbacks to reconnect to an old room.
- Process verified LiveKit webhooks for metrics/auditing only.

Acceptance: two users on separate networks talk while playing; mute and mic denial are clear; switching rooms stops old audio before new audio starts; kicked members cannot reacquire a token.

### Milestone 5 — Hardening and production preview

- Apply CSP, security headers, strict WebSocket origin policy, rate limits, request/message size limits, redacted logging, graceful shutdown, SQLite backup/restore documentation, and operational metrics.
- Deploy one Render instance with `/var/data/roomcade.db`, managed HTTPS, health checks, and LiveKit secrets.
- Add reconnect UX for deploys and provider/service outages.
- Finish responsive, accessibility, empty, error, and permission states.

Acceptance: deployment restarts disconnect clients cleanly; reconnect restores durable House/game state; raw invite tokens, cookies, lobby URLs, and LiveKit credentials never appear in logs.

### Milestone 6 — Architecture gates and private alpha

- Production embedding gate: exercise HTTPS Chrome, Firefox, Safari, iPhone Safari, Android Chrome, and a bounded eight-person session. Preserve external-open fallback for failures.
- Voice gate: test 2/4/6/8 participants for at least 15 minutes each, including TURN/relay conditions, packet loss, mute, reconnect, and room switching. Record CPU, memory, upload bandwidth, join time, and failure rate.
- Realtime gate: run 10 Houses × four rooms × eight members per House, with members distributed and then concentrated in one room. Include concurrent switches, host loss, URL revision conflicts, slow sockets, reconnects, and cleanup.
- Keep provider-heavy Codenames runs manual or opt-in; normal CI uses a controlled iframe fixture.
- Resolve publisher permission before a public launch; do not contact the publisher without explicit authorization.

Acceptance: no cross-House/room leakage, race detector failures, unbounded queues, or stale media reconnections; the team records measured capacity rather than claiming unsupported scale.

## 5. Test Strategy, Rollout, and Explicit Boundaries

### Automated coverage

- Go unit tests: URL/name validation, permission matrix, host/coordinator selection, eight-member/four-room limits, revisions, expiry, and token grants.
- SQLite integration tests: migrations, cascading deletion, idempotency, concurrent approval, stale game replacement, and crash/reload snapshots.
- Go concurrency tests: House actor serialization, queue pressure, socket replacement, reconnect timers, and `go test -race`.
- Frontend tests: invite states, permission-driven controls, snapshot ordering, room-transition generations, iframe lifecycle, and voice error states.
- Playwright multi-context tests: approval, capacity, host transfer, four rooms, refresh, replacement conflicts, single-tab enforcement, and game switching.
- LiveKit tests: fake-media browser automation plus at least one real separate-network and relay-path test.
- Security tests: invite enumeration resistance, cross-House access, CSRF/origin rejection, hostile URLs, oversized WebSocket messages, removed-member access, and log redaction.
- Cleanup tests use an injectable clock rather than waiting 30 days.

### Rollout

1. Local multi-context development.
2. Password-protected/private Render preview with LiveKit development credentials.
3. Invite-only friend alpha after production embedding and two-network voice passes.
4. Eight-person capacity session and restore drill.
5. Public availability only after publisher permission, security review, and measured gate results.

Feature flags independently disable embedding and voice without disabling Houses. Database migrations are forward-only and applied at startup after a disk snapshot. Roll back application binaries only when their schema compatibility is documented.

### Out of scope

- Email/password or social accounts and cross-device recovery.
- Public House discovery, matchmaking, text chat, friends, notifications, moderation systems, payments, or leaderboards.
- Video, screen sharing, recording, transcription, or device-selection polish.
- Arbitrary embeds, multiple game providers, first-party game rules, score synchronization, or Codenames DOM inspection.
- Redis, horizontal Go scaling, self-hosted LiveKit/TURN, multi-region state, or zero-downtime active-room migration.
- Automatic detection or transfer of Codenames Admin.

### Operational assumptions

- Render and LiveKit accounts/credentials will be supplied during their milestones.
- The paid Render disk and managed LiveKit usage are acceptable MVP operating costs.
- A deploy may briefly interrupt WebSockets; durable configuration survives and clients reconnect.
- Houses are trusted friend groups, but all privileged actions remain server-authorized.
- House inactivity means no authenticated approved-member activity for 30 days.
- Publisher permission remains a launch requirement independent of the successful technical experiment.
