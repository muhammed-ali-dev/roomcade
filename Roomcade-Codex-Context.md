# Roomcade — product and technical context for Codex

Use this document as context for a later planning request. It describes the product idea, candidate implementation choices, engineering goals, and decisions worth resolving. It is not an instruction to start coding immediately. When I ask for a plan, turn this into a concrete, scoped implementation plan grounded in the actual repository and available deployment environment.

## Current product decisions and first feasibility test — September 2, 2026

**Read this section first. It supersedes conflicting recommendations in the original concept notes below.**

### Updated product direction

- The hierarchy is **Roomcade → Houses → rooms → an existing game and room voice**. A House is the small shared space for one friend group. A House can have **up to 4 rooms**, with 3–4 as the intended normal shape, analogous to rooms in a normal house rather than an open-ended channel list.
- **House** replaces the earlier user-facing term **server**. Reserve “server” for backend infrastructure and processes so product spaces are not confused with deployment architecture. The browser can retain a lightweight House list while loading one active game and one active voice session. Decide separately whether browsing another room changes voice membership.
- Roomcade is intentionally for **small friend groups**, not large public communities or Discord-scale membership. Capacity, permissions, navigation, moderation, and load tests should optimize for that scope rather than introducing large-community machinery by default.
- The user wants to integrate real, existing games instead of inventing or implementing original games. The first feasibility candidate is the official **Codenames Online at https://codenames.game/**.
- The desired experience is playing the real game inside Roomcade, using an iframe where supported. Codenames continues to serve its own UI and own its game state. A player joining the same game URL directly on Codenames should participate in the same match as embedded players.
- A iframe is an embedding mechanism. It does not copy the game, grant access to its internal state, or require Roomcade to mirror moves through a second backend.
- Roomcade owns its House/room memberships, voice, invitations, and the mapping from a Roomcade room to an external game URL. For an external game, its provider owns gameplay authority. Earlier sections about implementing game rules, move validation, and game engines are optional future alternatives, not the current MVP direction.
- Automatic external-room creation, shared sign-on, score reporting, and role synchronization are unverified features. Start with the host manually creating a game and pasting its lobby URL. An iframe alone cannot provide those deeper integrations.
- The clickable wireframe explored server navigation, room creation/switching, a central game area, and voice controls. Its game and voice behavior were simulations. It did not demonstrate an actual Codenames integration.

### Evidence already collected; do not overstate it

**Executed iframe experiments on September 2, 2026 supersede the older unexecuted-browser note below.** Localhost Chromium V2 proved two isolated embedded Duet players could join one private match, exchange a clue and confirmed card action, retain distinct private key views, and recover after iframe remount and outer-page refresh. V3 proved four isolated embedded players could occupy all four Classic roles and see the same live 25-word board. In V3, closing the Codenames creator/admin before start removed that player but transferred neither Admin nor Start; reopening in the same browser context restored both. During a live match, the remaining three kept the same board when Admin disconnected, no Admin transfer was observed, and the original context recovered the match on return. Detailed evidence and reproduction steps are in `experiments/codenames-iframe/RESULTS-V2.md`, `RESULTS-V3.md`, and their runner scripts. HTTPS, other browsers/mobile, voice coexistence, eight-player behavior, long expiry, and publisher permission remain unverified.

**Canonical planning handoff:** `experiments/codenames-iframe/EXPERIMENT-PHASE-SUMMARY.md` consolidates all experiment evidence, product consequences, recovery policy, boundaries, unknowns, and the three remaining architecture-level validation gates. The standalone Codenames experiment phase is concluded; use that handoff when planning the full application rather than proposing more one-edge-case-at-a-time provider tests.

Direct HTTP checks on September 2, 2026 returned 200 responses for the Codenames homepage and one publicly documented game-room URL. The tested responses had no X-Frame-Options or Content-Security-Policy frame-ancestors restriction. A homepage request marked as an iframe navigation also returned 200. These observations are encouraging but do **not** prove browser rendering, session storage, connection establishment, or full multiplayer gameplay.

An older third-party response capture from March 2025 contained a frame-ancestors allowlist for specific embedding services. It is historical evidence, not a description of the currently observed responses. Policies could differ across routes or change again.

Before the later V1–V3 runs, the initially available browser runtime repeatedly failed to respond and the first browser test was environment-blocked. This is retained only as experiment history; it is not the current feasibility result. Publisher approval still has not been obtained.

No public official room-creation API or blanket third-party embedding permission was found. Technical compatibility and publisher permission must be tracked separately. Do not contact the publisher without explicit user authorization to send a message.

Sources:

- Official room-sharing instructions: https://codenames.game/
- Historical response headers, dated March 23, 2025: https://outagestats.com/en/is-site-down/codenames.game
- Gather's classic embedded-game guide: https://support.gather.town/articles/4156487779-playing-embedded-games — its Codenames link points to Netgames, so it is not direct verification of the official Codenames implementation.
- Publisher contact listing: https://codenamesapp.com/terms-and-conditions.html — support@czechgames.com.

### First experiment for Codex

Before designing a large integration layer, propose a small feasibility experiment. When authorized to execute it, build a minimal standalone HTML page that embeds the official game directly. No proxy, game reimplementation, custom transport, or Roomcade backend is needed for this experiment.

Use a newly created private test lobby controlled by the tester. Do not join someone else's room found in search results. If game-room creation or external actions require approval in the execution environment, follow those requirements and explain the exact blocked step.

A runnable baseline page follows. Save it as `iframe-test.html` in a dedicated experiment folder. The status text deliberately does not treat an iframe load event as proof of success. The form validates the provider before navigation and opens the original URL separately for comparison.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Roomcade — Codenames iframe test</title>
  <style>
    body { font: 16px system-ui, sans-serif; margin: 20px; }
    form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    input { flex: 1 1 320px; padding: 10px; font: inherit; min-width: 0; }
    button { padding: 10px; font: inherit; }
    iframe { width: 100%; height: 720px; border: 1px solid #aaa; }
    #status { min-height: 24px; }
  </style>
</head>
<body>
  <h1>Codenames iframe test</h1>
  <form id="join">
    <label for="url">Codenames URL</label>
    <input id="url" type="url" value="https://codenames.game/" required>
    <button type="submit">Load embed</button>
    <a id="direct" href="https://codenames.game/" target="_blank"
       rel="noopener noreferrer">Open directly</a>
  </form>
  <p id="status" role="status">Load the homepage, then a private test-room URL.</p>
  <iframe id="game" title="Official Codenames Online"></iframe>
  <script>
    const form = document.getElementById('join');
    const frame = document.getElementById('game');
    const status = document.getElementById('status');
    const direct = document.getElementById('direct');
    form.addEventListener('submit', event => {
      event.preventDefault();
      try {
        const url = new URL(document.getElementById('url').value);
        if (url.protocol !== 'https:' || url.hostname !== 'codenames.game' ||
            url.port || url.username || url.password) {
          throw new Error('Use an HTTPS URL on codenames.game.');
        }
        direct.href = url.href;
        frame.src = url.href;
        status.textContent = 'Navigation requested. Verify the visible game and console.';
      } catch (error) {
        status.textContent = error.message;
      }
    });
    frame.addEventListener('load', () => {
      if (!frame.hasAttribute('src')) return;
      status.textContent = 'A frame load event fired; this does not prove the game works.';
    });
  </script>
</body>
</html>
```

The baseline intentionally uses an ordinary iframe with no additional sandbox restrictions, to establish compatibility without self-inflicted iframe failures. Keep it in a dedicated test page with no sensitive Roomcade session. A later production design must decide the minimum compatible sandbox/permission policy and retest it. Do not remove provider restrictions, disable browser security, spoof an approved embedding origin, or proxy around a framing block.

Serve the experiment folder with `python3 -m http.server 8000 --bind 127.0.0.1`, then open `http://localhost:8000/iframe-test.html`. Use an actual HTTP origin rather than double-clicking a file URL. This server command is for local testing only; stop it when finished.

### Environment matrix

| Environment | What it establishes | Priority |
| --- | --- | --- |
| Localhost HTTP in normal desktop Chrome or Edge | Fast baseline for rendering and joining | First |
| Two separate browser profiles or supported isolated automation contexts | Independent identities can join the same private match | First |
| One embedded profile plus a second profile on the original Codenames URL | Embedded and direct users share a real match | First |
| A normal HTTPS preview page on a real origin | Cross-site framing, secure context, storage, and host policy in a realistic deployment | After local proof |
| Firefox and Safari, including normal tracking protection | Browser-specific session/storage behavior | After primary browser works |
| Actual iPhone Safari / Android Chrome | Touch, viewport, cookies, and later voice behavior | Before claiming mobile support |
| Eventual production domain with production CSP | Origin-dependent policies and final hosting configuration | Before launch |

Use a static preview host already available in the repository or environment. Sites, Vercel, Netlify, or GitHub Pages are possible hosting environments; do not assume access or pricing, and follow applicable deployment instructions. A temporary development tunnel is another option only if exposing the local test server is authorized and suitable. Match the user's existing setup before adding providers.

A chat-embedded visualization is **not** a valid primary test environment: its own host CSP may block the external game even when a regular website would allow it. Likewise, a browser automation/network failure does not establish that Codenames rejects embedding. If the available browser service is broken, report that limitation and leave an executable experiment for a working environment.

### Test sequence and acceptance criteria

1. Load the official homepage directly as a control. Confirm that it functions in the test browser and network.
2. Load it in the iframe. Record whether the real page renders and whether it navigates the outer page away unexpectedly. An iframe `load` event, HTTP 200, or a screenshot of a logo alone is not a pass.
3. Create a fresh private lobby through Codenames' normal UI and obtain its supported share URL. If the parent page cannot read an embedded URL because of the same-origin policy, copy the room's link through the game's visible share control. Do not scrape hidden state or invent a room-creation endpoint.
4. Load that exact URL in the embed for test player A. Open it directly in a separate browser profile for test player B. Use disposable, non-personal test nicknames.
5. Confirm both players are listed in the same room. Select roles and start a match through the visible game UI. Verify that appropriate roles see their own view, including hidden information only where the game permits it.
6. Perform an ordinary visible game action as A and confirm B receives it; perform an action available to B and confirm A receives it. Record screenshots or concise observations without publishing private lobby URLs or session credentials.
7. Repeat with both players embedded in separate profiles. Confirm this is the same shared match, not two unrelated instances.
8. Refresh the outer test page, reload the room URL, and observe identity/rejoin behavior. Simulate switching away by unmounting the iframe and back by mounting it again. Record whether a nickname/role must be selected again. Do not assume seamless reconnects.
9. Repeat the baseline on a normal HTTPS preview and the additional browsers above. Keep normal browser security/privacy defaults. Record unsupported combinations honestly rather than changing security settings to manufacture a pass.
10. Only after game embedding works, add Roomcade voice to the wrapper. Verify game interaction plus voice, mute, room switching, and teardown. The iframe should not receive microphone or camera permissions merely because Roomcade itself needs them.

A successful feasibility result requires two independent players interacting with the same live match through the embed. An initial one-embedded/one-direct test is useful evidence; the two-embedded test validates the intended Roomcade use case. Publisher permission remains a separate status even after technical success.

### Failure diagnosis

- **Refused to frame / frame-ancestors / X-Frame-Options:** identify the blocked response and exact policy. Stop there; publisher-supported embedding or domain approval is the path forward.
- **Parent CSP blocks frame-src:** adjust only the test page or Roomcade policy you control to allow the known game origin. This is different from overriding a provider restriction.
- **Blank frame without a clear error:** compare with the direct-page control; inspect ordinary console/network errors, script loading, blocked storage, and connection failures.
- **Works directly but not embedded:** check cross-site storage/cookie behavior, third-party restrictions, and frame-specific application behavior.
- **Two clients join different games:** verify the exact shared lobby URL and the game's normal join flow.
- **Game renders but identities are confusing:** use separate profiles; tabs in one profile may share provider storage. Do not assume a Roomcade account automatically becomes a Codenames player.
- **Cannot detect readiness or read scores:** the same-origin policy is expected. Use the game's supported SDK/message contract if one exists. Do not assume arbitrary postMessage calls will be handled.
- **Automation unavailable or blocked by the execution environment:** label the test as unexecuted/environment-blocked and preserve steps; do not label it provider failure.

Return a concise result with test date, parent origin, target route, browser/version, identities/profiles used, rendering, join, shared-state verification, refresh/rejoin, exact errors, and an overall status of pass / partial / fail / environment-blocked. Distinguish observed evidence from assumptions.

### Implications for the eventual Roomcade plan

- Because embedding worked in the completed Chromium experiments, prioritize House/room membership, a validated shared game URL, one active game iframe, and room voice. Avoid building a new Codenames backend.
- If embedding is blocked, preserve the external “Open game” path and report the mismatch with the intended in-site experience. Seek supported provider integration before promising an embedded catalog.
- If the user asks only for a plan, include this as the first bounded validation milestone and do not silently start a large implementation. If asked to test now in a working environment, execute the experiment and report evidence before expanding scope.

---

## Original concept notes — subject to the current decisions above

## 1. What is established versus proposed

Established context:

- The working name is **Roomcade**: room + arcade. Name, domain, and trademark availability have not been verified.
- I want to build a browser-based, multi-room arcade with integrated live voice and potentially video.
- Users should be able to create or join game rooms, play together, and move between rooms while the surrounding application stays open.
- The technical direction previously described is Go, WebSockets, WebRTC, Redis, and React.
- The project interests me as a real product and as a way to learn backend engineering, networking, real-time systems, and observability.
- I am now asking for concept and stack context. I will request an implementation plan separately.

Everything below that specifies a game, room hierarchy, capacity, authentication method, provider, database, visual style, or deployment target is a **recommendation or candidate decision**, not a requirement I have already approved. Choose sensible defaults in the plan and explain meaningful tradeoffs.

Keep this concept focused on people playing social browser games. AI agents, agent competitions, AI interview preparation, and coding sandboxes are separate possible project ideas; do not silently merge them into Roomcade.

## 2. Core pitch

Roomcade is a place where friends can open a link, enter a room, talk, and play quick browser games together. The room is the center of the experience. Games can change while the group hangs out, and people can move to another room to join a different group or activity.

A concise product description:

> A browser arcade where every room is a place to play and hang out.

The value is the combination of:

1. Low-friction entry through a shared link.
2. Lightweight games that work directly in the browser.
3. Voice integrated into the room.
4. A persistent app shell that makes joining, switching games, and changing rooms feel coherent.
5. Reliable shared state: everyone sees the correct players, game progress, and room membership.

The product should be enjoyable with a small group of friends. It does not need a large public community to be useful. The interface should lead with playing and hanging out; infrastructure details belong in documentation and diagnostics.

## 3. Builder context and project goals

I am a computer science student with an interest in systems, backend engineering, networking, observability, and real-time applications. I have operating systems experience and algorithm practice, but this project should help me strengthen actual application engineering and understand the systems I build.

Use a design that I can explain and operate as a solo developer. I want to understand such questions as:

- Why use WebSockets here, and what belongs in ordinary HTTP requests?
- How does a server keep multiple clients synchronized?
- How are game state and participant permissions validated?
- How does WebRTC signaling differ from media transport?
- What happens when someone changes rooms halfway through a connection attempt?
- What is authoritative state, and what can be reconstructed?
- What does Redis Pub/Sub solve, and what does it fail to guarantee?
- What changes when one backend process becomes several?
- How do I measure latency honestly and debug real connection failures?

Avoid choosing extra infrastructure solely to make the stack sound impressive. At the same time, do not move all interesting backend behavior into a black box if it defeats the learning objective.

## 4. Prior resume framing: design inspiration, not implementation evidence

An attached resume describes a project called “Multi-Tenant Arcade & Voice Platform” using Go, WebSockets, WebRTC, Redis, and React. Its bullets describe:

- Creating game rooms and switching live voice/video streams.
- A room-based WebRTC signaling service.
- A micro-frontend event bridge using postMessage for role-based game state without reloads.
- Redis Pub/Sub broadcasting room updates and a sub-20ms WebSocket latency result.

Treat these as intended capabilities to evaluate. The presence of a resume bullet does **not** establish that code exists, that the architecture is correct, or that the performance result has been measured. Inspect any repository before making claims about implementation status.

Do not invent benchmarks or design the product around an unverified number. If the finished architecture does not use micro-frontends, custom signaling, or Redis Pub/Sub, its documentation and future resume description should accurately reflect that.

Also distinguish **multiple rooms** from true **multi-tenancy**. A multi-room social app does not automatically need organization accounts, tenant billing, enterprise administration, or tenant-specific deployments. Room authorization and isolation are required; enterprise tenancy is a separate feature.

## 5. Likely audience and initial use cases

Primary audience: a small group of friends who want something quick to play while talking.

Possible later audiences: student clubs, small online communities, and casual remote social gatherings. These are expansion possibilities, not separate products to build immediately.

Representative sessions:

- Someone creates a room, shares the link in a group chat, and everyone joins using a display name.
- Two people start a game while others watch and talk.
- A finished match offers a rematch or a different game without sending the group to a separate site.
- A person moves to another room and starts hearing that room's conversation after the switch completes.
- Someone refreshes or briefly disconnects and can rejoin without duplicating themselves or corrupting the match.

## 6. Product structure and room model

Recommended initial structure: one application containing independent shareable rooms. A room contains participants, voice membership, and at most one active game session at a time.

Potential screens:

| Surface | Purpose |
| --- | --- |
| Home | Explain the idea, create a room, join by link or code |
| Room lobby | Show participants, game selection, readiness, and voice controls |
| Active game | Display the game while preserving participant and voice access |
| Match result | Show outcome, rematch, and return-to-lobby actions |
| Connection state | Explain reconnecting, unavailable room, full room, or denied access |

A directory of public rooms is optional. A private invite-first experience can be the initial product. A server/community containing many persistent rooms is another possible later hierarchy; do not introduce it automatically.

The default assumption should be that a person participates in one active room at a time. Opening multiple tabs requires a deliberate policy: either allow multiple connections for the same session while tracking one participant, or make a later connection replace the earlier one. Do not accidentally count every socket as a new person.

Proposed roles:

- **Host:** chooses a game, starts a match when allowed, and manages the room.
- **Player:** occupies a game slot and submits game actions.
- **Spectator:** watches the game and may join voice if permitted.

The host role and player role can overlap. Host status must not allow arbitrary mutation of authoritative game state. A host is a participant with specific permissions, not a trusted game server.

Define policies for host departure, empty-room expiry, full rooms, joining mid-match, and spectators taking a seat. For the first version, a temporary disconnect grace period followed by deterministic host transfer is a reasonable candidate.

## 7. Main user flows

### Create and invite

The creator enters a display name, creates a room, sees themselves in the lobby, and receives a shareable link. The interface makes it obvious how to invite friends. Voice activation requests microphone permission after a user action.

### Join

A joining user opens the link, enters a name if necessary, receives admission or a clear error, and gets a current room snapshot. They should not need to reconstruct room state from events they missed before joining.

### Start and play

The host selects a game. The server validates available slots and readiness before starting. Player inputs are submitted as intents. The server validates them against the current match and broadcasts the resulting state or event.

### Finish and replay

The server determines the outcome. All clients transition to the same result. Rematching creates a new match identity or otherwise resets state in a clearly versioned way so delayed actions from the old match cannot affect the new one.

### Change game

Players return to the room lobby or complete an explicit game-change flow. The room shell and voice experience remain available. React can support this without iframes; choosing a separate game runtime must have a concrete reason.

### Change room

The client requests entry to the destination room. The backend validates admission and coordinates membership transitions. Voice and game subscriptions follow the committed room membership. The UI must handle a failed destination join without leaving the participant in an unexplained half-connected state.

“Seamless” means no full-page reload and understandable transition behavior. It does not mean promising physically gapless media across independent connections. Make transition status visible when needed.

### Recover from disconnect

The client reconnects with bounded exponential backoff and jitter. The server validates the session, determines whether a seat can be restored, and returns a fresh snapshot. A socket reconnect is not proof that the old game or room still exists.

## 8. Game choices and scope

Build one complete multiplayer game before adding a catalog. Select games with short rounds, low art requirements, and rules that can be validated on the server.

| Candidate | Strength | Main complication |
| --- | --- | --- |
| Connect Four-style disc game | Simple authoritative turns, spectators, rematches | Only two active players |
| Original simultaneous-choice party game | More players and short rounds | Designing rules that are actually fun |
| Drawing and guessing | Naturally social and works with voice | Drawing transport, prompts, moderation, scoring |
| Reaction or timing game | Fits an arcade feel | Network fairness and timing disputes |
| Pong-like action game | Visually immediate and real time | Server ticks, prediction, interpolation, latency |

Recommended engineering starting point: a small turn-based game to validate room membership, action validation, reconnects, and results. A second game can demonstrate that the shared room infrastructure is reusable. If the first game must feel more exciting, propose a narrowly scoped original party game rather than starting with a large physics game.

Use original branding and assets or properly licensed assets. Do not copy another game's distinctive presentation. Existing generic mechanics can inspire the implementation, but choosing a familiar mechanic does not remove asset or naming checks.

A game module should define metadata, player limits, initial state, accepted actions, action validation, transitions, per-viewer state, and completion conditions. Keep the initial interface small. A universal game engine or third-party plugin marketplace is unnecessary.

## 9. Proposed MVP boundary

Recommended MVP:

- Create and join an invite room.
- Guest session with a display name.
- Participant list and host/player/spectator roles.
- One fully working authoritative multiplayer game.
- Match start, valid moves, result, and rematch.
- Room voice with mute/unmute and visible connection state.
- Room switching without a full-page reload.
- Reconnect behavior and empty-room cleanup.
- Basic host controls and room access enforcement.
- Structured logs and enough metrics to troubleshoot.
- A deployed version that two people on different networks can actually use.

Candidate later features:

- Video and device selection refinements.
- A second game, then a small curated catalog.
- Persistent accounts, match history, and optional leaderboards.
- Public room discovery and stronger moderation.
- Text chat, invitations, friend lists, and cosmetics.
- Horizontal scaling after state ownership is designed.

Keep payments, ranked matchmaking, tournaments, native mobile apps, an AI layer, and user-uploaded executable games outside the initial scope.

## 10. Candidate technology stack

Preferred starting direction, subject to repository and environment constraints:

| Layer | Candidate | Why / decision to make |
| --- | --- | --- |
| Browser app | React + TypeScript + Vite | Straightforward interactive client; little need for server-rendered game pages |
| Styling | Tailwind CSS or CSS modules | Choose one approach and keep a consistent component vocabulary |
| Browser state | React state plus a small store if useful | Separate authoritative room state from transient UI state |
| API and realtime server | Go | Explicit concurrency and a useful systems-learning surface |
| HTTP routing | Standard library or a small router | Avoid unnecessary framework machinery |
| Realtime app transport | WebSocket | Ordered messages per live connection for room/game updates |
| Serialization | Versioned JSON messages initially | Easy to inspect; validate before handling |
| Media | WebRTC via small peer mesh or an SFU service | Choose based on learning goals, participant cap, and deployment |
| Shared coordination | Redis when a demonstrated need exists | Pub/Sub fanout, ephemeral coordination, selected TTL data |
| Durable data | PostgreSQL when persistence is needed | Accounts, match summaries, and room metadata if retained |
| Local dependencies | Docker Compose | Reproducible Go/Redis/Postgres development when applicable |
| Observability | Structured logs and lightweight metrics first | Add distributed tracing when boundaries justify it |
| Browser testing | Playwright | Multiple isolated browser contexts to exercise multiplayer flows |

Next.js is a valid alternative if an existing repository uses it or the broader site needs its features. Avoid running a redundant Node backend for game authority when Go already owns that responsibility.

An all-TypeScript backend could reduce language switching and share message types more easily. Go remains the preferred candidate because learning backend concurrency and networking is part of the goal. Present that as a tradeoff rather than pretending only one stack can work.

Do not assume current library versions or provider capabilities from memory. Verify maintained packages and deployment support during planning. This brief does not pin versions or promise a provider's free tier.

## 11. Separate the application and media paths

There are two related systems:

**Application path:** browser to Go over HTTP/WebSocket for admission, presence, roles, game commands, snapshots, and errors.

**Media path:** WebRTC peer connections or an SFU for microphone/camera transport. A WebSocket can carry signaling messages, but ordinarily does not transport the actual voice/video packets.

Game and room authorization must also constrain media access. A client-provided room ID does not grant permission to receive another room's audio or relay signaling to arbitrary users.

If using an SFU provider, its SDK usually handles much of media signaling. Go issues scoped access tokens and enforces app policy; do not build a duplicate custom SDP signaling system just to match a resume bullet.

If implementing peer-to-peer signaling, Go routes offers, answers, and ICE candidates only between authorized participants. It does not need to understand or relay the media itself unless a separate media-server component is intentionally introduced.

## 12. WebRTC options

### Option A: small peer mesh

Good for learning signaling directly and keeping the prototype architecture tangible. Every participant connects to the other participants, so connection and upload demands grow with room size. Set an explicit, tested room cap; a small voice-first cap is an initial assumption, not a performance guarantee.

Plan for ICE, STUN, and TURN. A same-Wi-Fi demo is not sufficient proof of internet connectivity. TURN may be required when direct connections fail, and relay bandwidth has costs. Include deployment and credentials in the plan.

### Option B: SFU, such as LiveKit

Good when reliable group media and a quicker product path matter more than hand-building signaling. A selective forwarding unit receives published tracks and forwards them to subscribers, reducing the mesh upload burden. It introduces a service and operating/provider costs but can simplify room media lifecycle substantially.

Use server-issued, short-lived, room-scoped tokens. Decide how leaving or being removed revokes active media access; token expiry alone may not immediately end an existing session.

Recommended planning decision: choose one route for the first version. Voice-first is a reasonable default. Video can follow after joining, switching, cleanup, and external-network connectivity are reliable.

### Switching details for either route

Use a membership generation or transition identity to distinguish current media setup from obsolete work. Cancel or ignore old async callbacks, stop remote playback from the departed room, remove old subscriptions/peer connections, and prevent stale signaling from reconnecting the user to an old room.

Do not promise atomic transactions between app state and a third-party media service. Define staged transitions and compensating cleanup. Test switching while permission is pending, while ICE is connecting, and while a reconnect is in progress.

## 13. Go room state and concurrency

A strong single-instance candidate is a room manager with one serialized command loop per active room. Each room owns its participants and match state; commands are processed in order for that room.

Benefits: fewer shared-state races, deterministic game transitions, and a clear boundary for later room ownership. Costs: lifecycle management, bounded queues, careful cleanup, and preventing slow work from blocking the room loop.

Use one socket writer loop per connection and bounded outbound queues. A slow client must not block everyone else. Define when replaceable state updates can be coalesced and when the server disconnects a client that cannot keep up. Never silently drop critical commands while pretending they succeeded.

Cross-room movement involves more than one room loop. Define who coordinates it and how stale leave/join operations are rejected. Do not assume per-room serialization alone makes cross-room membership atomic.

Game timers should be server-owned. Turn-based games do not need a high-frequency tick loop. If an action game is later added, justify tick rate, interpolation, and reconciliation separately.

## 14. Redis and scaling

Redis is optional for the first single-process version. In-memory rooms can be a deliberate starting point if a process restart is allowed to end active matches and the UI handles it honestly.

Possible later Redis uses:

- Fanout of room updates between processes that own client connections.
- Ephemeral presence records with expiration.
- Rate-limit counters or short-lived coordination data.
- A directory mapping room IDs to authoritative backend owners.

Redis Pub/Sub is transient delivery. Disconnected subscribers miss messages; it is not a replay log, durable match store, or exactly-once command system. Reconnecting clients and backend subscribers need a recovery strategy, typically authoritative snapshots and versions.

The scaling question is **who owns and orders writes for a particular room?** If two servers independently process moves for the same match, Pub/Sub does not resolve the conflict.

Candidate evolution: one server first, then explicit room ownership and routing when more instances are necessary. Redis Streams, a durable event log, or stronger failover mechanisms should be introduced only when the recovery requirements justify them.

## 15. Data and protocol sketch

Conceptual entities:

- Session: server-issued guest/account identity and expiration.
- Participant: session identity plus display name and room role.
- Room: ID, access policy, host, members, lifecycle state, version.
- Match: ID, game type, participants, state, status, timestamps.
- Connection: socket identity, participant binding, last-seen time.
- Media membership: participant, room scope, transition generation.

Separate a participant from a network connection. A socket can disappear while the participant retains a seat during a grace period.

Candidate HTTP operations: create room, resolve invitation, obtain session, request media token, and health checks. Candidate WebSocket operations: join/leave, ready, select/start game, submit action, request snapshot, and heartbeat.

Example envelope, illustrative rather than a final schema:

```json
{
  "type": "game.action",
  "protocolVersion": 1,
  "requestId": "unique-command-id",
  "roomId": "room-id",
  "matchId": "match-id",
  "expectedStateVersion": 12,
  "payload": { "column": 3 }
}
```

The server derives actor identity from the authenticated session. It does not trust an actor ID or role supplied in the payload. Decide which commands need idempotency records, how long they are retained, and how version conflicts are returned. Not every interaction needs every envelope field.

Server outputs might include room snapshots, participant changes, match state, match completion, and structured errors. Snapshots should include a state version so clients can discard stale updates and recognize gaps.

If a game has hidden information, serialize state for the specific viewer. Hiding data in the frontend is insufficient if the payload already contains it.

## 16. Game modules, iframes, and postMessage

For first-party React games, ordinary component boundaries and shared typed interfaces are probably sufficient. Keeping the app shell mounted preserves room controls without page reloads.

Use iframe isolation only if it solves something concrete, such as independently built games or a different rendering runtime. If chosen, define a small versioned bridge for game-ready, configuration, player action, state updates, and teardown.

Validate message origins, the sending window, message shape, and current game session. Avoid wildcard origins for privileged messages. Apply appropriate iframe sandbox restrictions. Do not allow the embedded game to grant itself a host role or mutate authoritative state.

Embedding untrusted third-party code is a separate security problem and should stay outside the MVP. Even first-party client code remains untrusted by the server for gameplay decisions.

## 17. UX and visual direction

Candidate visual direction: playful, clean, slightly retro, with warm or bright accent colors and restrained arcade references. Prioritize readable controls and useful game space. A wall of neon, heavy CRT filters, or tiny pixel text should not make basic actions harder.

The main room surface should make the game dominant while keeping participants and microphone controls easy to reach. A compact participant strip or side panel is preferable to overwhelming a small game with empty dashboard panels.

Important states include: joining, full room, invalid invite, waiting for players, permission denied, microphone unavailable, reconnecting, host departed, match ended, and destination room unavailable.

Never require a microphone to enter or play. Provide keyboard-accessible controls, visible focus, readable contrast, reduced-motion support, and clear mute status. Account for browser autoplay restrictions when activating remote audio.

Desktop can be the initial development target, but joining and basic controls should remain usable on smaller screens. Do not promise full mobile-browser media support without testing it.

## 18. Authorization and basic abuse controls

Minimum practical safeguards:

- Unpredictable invite identifiers; room IDs are not a substitute for policy checks.
- Server-issued sessions and authorization on every privileged room/game operation.
- Room-scoped media permissions and signaling recipients.
- WebSocket origin checks and appropriate session/cookie handling.
- Limits on message size, command frequency, room creation, and connections.
- Plain-text or safely rendered names and chat content.
- Host removal controls if rooms can admit people beyond a trusted friend group.
- Expiring unused rooms and cleaning up disconnected resources.

Do not log raw tokens, unnecessary signaling payloads, or media contents. Voice/video recording is not part of the concept.

## 19. Observability and honest measurement

Start with structured logs that can connect a command to its room, match, connection, and result. Avoid putting high-cardinality room IDs into every metrics label; they are often better suited to logs or sampled traces.

Useful measurements:

- Active rooms, participants, and sockets.
- Join success/failure and time to receive an initial snapshot.
- Reconnect counts and successful seat restoration.
- Command queue depth, rejected actions, and processing duration.
- Slow-client disconnects and outbound queue pressure.
- Media connection success and time to usable audio.
- Resource usage and room cleanup behavior.

Distinguish server processing time from round-trip application latency and from media latency. Browser-to-server timestamps require clock assumptions for one-way measurements; browser round trips avoid that specific ambiguity.

Any performance claim should document workload, participant/room counts, deployment region, hardware, network conditions, message frequency, duration, and percentiles. “Sub-20ms” is not a valid result without those details. Set targets after measuring a baseline.

## 20. Tests that protect the actual behavior

Focus testing on:

- Legal/illegal moves, turns, completion, and rematch reset.
- Unauthorized host actions or cross-room game commands.
- Two players acting concurrently and duplicate command handling.
- Refresh, reconnect, and stale commands from a previous match.
- Host departure and empty-room cleanup.
- Slow sockets without room-wide stalls.
- Room switching with delayed signaling or old async callbacks.
- State filtering if a game contains private information.

Use multiple browser contexts for integration tests. WebRTC testing may use browser fake devices where supported, but still requires at least one real test across separate networks and a relay-path check. Run Go's race detector around concurrent room/socket code.

Load-test signaling/game traffic separately from media load. A large number of idle WebSockets is not evidence of supporting the same number of active voice/video users.

## 21. Deployment and operational assumptions

The Go server needs a host that supports long-lived WebSocket connections. The browser needs HTTPS for microphone/camera access outside local development. If media is self-hosted, confirm UDP/TURN reachability and relay configuration. If managed, verify costs and supported token/access flows.

Plan for reverse-proxy upgrades and idle timeouts, graceful shutdown, dependency outages, stale clients after deployment, and a compatible protocol-version policy. Decide explicitly whether active matches survive a restart; persistence and recovery are additional work, not automatic benefits of adding PostgreSQL.

If a repository is already present, inspect its instructions, architecture, and hosting configuration before choosing deployment tooling. Follow existing project constraints rather than replacing the stack by default.

## 22. What I want from the later plan

When I ask you to plan, please:

1. Inspect the existing repository, if any, and distinguish existing code from proposed work.
2. State the recommended product scope and assumptions.
3. Select one first game and one media approach with concise reasoning.
4. Recommend a specific stack and explain what can wait.
5. Define room state ownership, membership transitions, game authority, and reconnect behavior.
6. Describe component boundaries and a reasonable repository layout.
7. Break implementation into small end-to-end milestones with acceptance criteria.
8. Identify the highest-risk technical unknowns and early experiments that resolve them.
9. Explain meaningful tests and a real deployment/demo path.
10. Separate required functionality from optional polish and scaling work.

Ask only questions that materially change the design. For ordinary implementation choices, make a reasonable recommendation and state the assumption. Do not ask me to choose among dozens of libraries before proposing anything concrete.

The finished project should let a friend open a link, talk, play a complete game, switch rooms, and recover from an ordinary disconnect. Its architecture should be something I can explain honestly, with working code and measurements behind the claims.
