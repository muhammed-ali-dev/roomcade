# Roomcade external-game experiment phase — final handoff

Date concluded: September 2, 2026

Status: **The Codenames iframe experiment phase is complete. The core approach is feasible in the tested environment, and Roomcade can move into full-application planning.**

## Executive conclusion

Roomcade can give each person an ordinary iframe pointed at the same private Codenames room URL. Codenames then supplies the real game UI, game authority, and live synchronization. Roomcade does not need to implement Codenames rules, copy its state, or relay moves.

This was verified with both two-player Duet and four-player Classic matches in isolated Chromium browser contexts. The outer Roomcade-style wrapper remained loaded throughout. The remaining uncertainties are broad product/architecture gates—production browsers and HTTPS, voice capacity, Roomcade's own real-time backend, and publisher permission—not reasons to continue testing individual Codenames edge cases before planning the app.

## Product model carried into planning

- The hierarchy is **Roomcade → Houses → rooms → one active game and room voice**.
- A House is a private space for a small friend group, not a large public community.
- A House has at most **four rooms**, with three or four as the normal shape.
- “Server” means backend infrastructure only; it is not a user-facing Roomcade space.
- Each room has at most one server-authoritative canonical external-game URL.
- Each participant gets an independent iframe pointed at that same URL.
- External providers own gameplay state, rules, roles, results, and provider-specific administration.
- Roomcade owns Houses, room membership, invitations, presence, voice, permissions, and the canonical URL mapping.
- Eight concurrently connected friends per House is a useful initial engineering test target, not yet a proven or permanent membership limit.

## What was built

| Artifact | Purpose |
| --- | --- |
| `iframe-test.html` | Minimal ordinary-iframe feasibility page. |
| `iframe-test-v2.html` | Interactive visual wrapper with validated URL input, Mount, Reload, Unmount, event log, and `sessionStorage` recovery. |
| `run-v2.cjs` | Two-client Duet gameplay and remount/refresh automation. |
| `run-v3.cjs` | Four-client Classic and provider-admin departure/rejoin automation. |
| `RESULTS.md` | Initial experiment notes. |
| `RESULTS-V2.md` | Detailed two-player gameplay findings. |
| `RESULTS-V3.md` | Detailed four-player/admin-lifecycle findings. |
| `TEST-PLAN-V3.md` | Broader risk-based test matrix for later milestones. |

## Verified evidence

### Embedding and containment

- The official Codenames homepage and fresh private-room routes rendered in ordinary iframes on a localhost HTTP parent in Chromium 151.0.7922.34 with normal web security.
- Room creation, joining, gameplay, iframe remount, and wrapper refresh did not navigate the outer page away.
- No provider framing-policy, storage, WebSocket, or script failure was observed in the completed runs.
- The repeated generic 404 was identified in V2 as the localhost wrapper's missing `/favicon.ico`, not a Codenames resource.

### Shared multiplayer instance

- Two isolated embedded clients joined one newly created private Duet lobby.
- Four isolated embedded clients joined one newly created private Classic lobby.
- All four Classic clients saw the same four provider identities, filled all four role positions, and loaded the exact same 25-word board.
- Therefore, users do not share one iframe or browser session. They have separate iframes connected to the same provider-owned match through the canonical room URL.

### Live gameplay

- In Duet, the two players retained different valid private key views while sharing the same word board.
- One player submitted the clue `ORBIT · 1`; the other received it and entered the guessing state.
- The second player selected a card; the first received the suggestion marker. Confirmation synchronized across both clients.
- Codenames, rather than Roomcade, successfully supplied gameplay authority and synchronization.

### Recovery

- Removing and recreating an iframe in the same browser context restored the provider identity and active Duet match.
- Refreshing the outer wrapper restored its canonical URL from Roomcade-owned `sessionStorage`; Codenames restored its own identity and match.
- In Classic, the creator/admin could close the page and later recover identity, Admin, Start, and the active match by returning in the same browser context without another nickname prompt.

### Provider Admin behavior

- The Codenames room creator displayed Admin and was the only client with Start.
- When the creator closed before match start, they disappeared from the other clients within the tested eight-second window.
- Codenames transferred neither Admin nor Start to the three remaining clients.
- When the original context returned, Admin and Start returned with it.
- When Admin closed during a live match, the other three retained the same active board, but none received Admin.
- When the original context returned, it recovered Admin and the same active board.
- The run proved match-state survival during the tested absence, but did not prove every future clue/guess can be completed when a required gameplay-role occupant is absent.

### Provider identity behavior

- Isolated contexts behaved as independent players.
- Codenames did not reliably preserve the disposable nicknames entered by automation; in V3 it displayed `Player0` through `Player3`.
- A Roomcade account identity must therefore not be assumed to equal a Codenames identity.

## Technical boundary

Playwright could inspect cross-origin frames because browser automation operates outside normal page JavaScript. Roomcade JavaScript cannot inspect the Codenames DOM because of the browser same-origin policy.

An iframe alone does not let Roomcade reliably read or control:

- Provider Admin or player identity
- Team/role selections
- Lobby readiness or Start availability
- Clues, guesses, cards, scores, results, or match completion
- Whether a match is stuck

Roomcade must not use production DOM scraping, disable browser security, proxy around provider restrictions, or pretend that automation access exists in the application. Deeper automatic integration would require a provider-supported API, supported `postMessage` contract, or publisher cooperation. User-driven controls and recovery are acceptable for the MVP.

## Host, coordinator, and provider Admin policy

These are separate concepts even when one friend initially holds all three:

- **House host:** Roomcade authority for the friend group's House.
- **Game coordinator:** Roomcade authority allowed to set or replace a room's canonical game URL.
- **Codenames Admin:** Provider-owned authority attached to the Codenames creator/session.

Adopt this recovery behavior:

1. If the Roomcade House host disconnects, Roomcade transfers or temporarily delegates its own coordination according to the future presence policy.
2. If the Codenames Admin disappears before start, keep the lobby through a reconnect grace period. If the person cannot return, an authorized Roomcade user may confirm replacement of the canonical URL with a newly created lobby.
3. If the Codenames Admin disappears during a match, preserve the current iframe URL and let the remaining players continue.
4. If players determine that the provider match is stuck, expose a confirmed **Replace game** action.
5. “Replace game” abandons the old URL from Roomcade's perspective; Roomcade cannot delete or transfer the provider's lobby.
6. Do not automatically replace an active match on a transient disconnect.

Roomcade may infer that its own member disconnected, but cannot verify the provider's internal Admin state through the iframe. Recovery UI should describe what users can do rather than claim knowledge of hidden provider state.

## Security and URL rules

- Initially accept only exact HTTPS URLs on `codenames.game`, with no username, password, custom port, or deceptive subdomain.
- Store one canonical URL plus a revision/version per Roomcade room.
- Only authorized Roomcade roles may replace it.
- Use compare-and-swap or an equivalent revision check so simultaneous replacements cannot silently overwrite each other.
- Require confirmation when replacing a possibly active match.
- Broadcast canonical URL changes to room members and ignore stale client updates.
- Use an ordinary iframe for compatibility until a production sandbox/permission policy is deliberately designed and retested.
- Do not grant the game iframe microphone or camera access merely because Roomcade voice needs microphone permission.

## Capacity findings

- Verified online iframe participation: two-player Duet and four-player Classic.
- The official tabletop descriptions observed during research were Classic `4+`/`4–8+` and Duet `2+`; they do not establish a hard hosted-online lobby limit.
- No official hard maximum for `codenames.game` online rooms was found.
- Roomcade should not hammer a third-party provider to discover a breaking point.
- Roomcade's practical capacity will likely be constrained first by its voice topology, client device performance, and its own realtime infrastructure—not by the iframe mechanism itself.

## Known unknowns

- Normal HTTPS preview and final production origin/CSP
- Firefox and Safari with normal privacy protections
- Physical iPhone Safari and Android Chrome
- Voice running beside the iframe
- Mesh versus SFU voice capacity
- Long-duration provider session/lobby expiry
- Different-device provider recovery
- Explicit provider leave behavior versus closing a page
- Eight-player and late-join/spectator behavior
- Publisher permission for Roomcade's intended embedding use

Publisher permission is independent from technical feasibility. Do not contact the publisher without explicit user authorization.

## Validation strategy from here

Do not continue one-Codenames-edge-case-at-a-time testing. Move into full-application planning and include only three architectural validation gates in its milestones:

1. **Production embedding gate:** HTTPS, major desktop browsers, physical mobile devices, and a bounded larger friend group.
2. **Voice gate:** 2/4/6/8 people using voice while a game runs; measure permission behavior, CPU, upload bandwidth, packet loss, jitter, TURN usage, room switching, mute, reconnect, and teardown. This decides mesh versus SFU.
3. **Roomcade realtime gate:** locally exercise multiple four-room Houses, presence, reconnect, host transfer, versioned URL changes, concurrent room switching, and cleanup without directing load at Codenames.

Other edge cases receive explicit product fallbacks and normal automated tests during implementation. They do not block architecture planning.

## Full-application planning handoff

The next plan should be grounded in the actual repository and deployment environment and cover:

1. MVP scope and end-to-end user flows
2. Repository and deployment audit
3. House, room, membership, presence, and canonical-game data models
4. Guest/user identity, invitations, and permissions
5. Host delegation/transfer and reconnect semantics
6. Versioned external-game URL lifecycle and iframe recovery UX
7. Voice architecture and room-switch semantics
8. API, realtime transport, persistence, and cleanup
9. Security, CSP, URL validation, abuse limits, and provider boundaries
10. Observability, automated testing, load testing, and the three validation gates
11. Incremental implementation milestones with acceptance criteria
12. Deployment and launch-readiness work, including publisher permission

The full plan should use the experiment evidence rather than reopening already answered feasibility questions. It should preserve fallbacks for opaque provider behavior and avoid building a Codenames backend.

