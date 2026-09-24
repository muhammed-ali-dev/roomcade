# Roomcade Codenames feasibility — V3 test plan

Date: September 2, 2026

## Goal

Find the practical boundary of the iframe-based Codenames integration for a small Roomcade House. Keep provider behavior, Roomcade orchestration, voice capacity, and backend capacity as separate questions so one result is not mistaken for another.

## Product model under test

- One House belongs to one small friend group.
- A House has at most four rooms.
- Each room has at most one server-authoritative active external-game URL.
- Each person gets an independent iframe pointed at that same URL; the provider, not Roomcade, owns the match.
- House host, room/game coordinator, and Codenames Admin are distinct roles.

## Safety and scope

- Create only disposable private Codenames rooms through the visible official UI.
- Do not retain or print private room URLs.
- Keep provider tests bounded to four players first and eight players only after the four-player case passes.
- Do not scrape Codenames in production, bypass browser controls, or infer that Playwright frame inspection is available to Roomcade JavaScript.
- Run Roomcade connection/load simulations locally rather than using a third-party game as a load target.

## Test layers

### P1 — Four-player Classic and admin lifecycle (completed)

Use four isolated Chromium contexts and four ordinary iframes.

1. Player A creates a private room; B, C, and D join its exact URL.
2. Confirm all four clients see the same four-player lobby.
3. Select Classic and assign enough players to both teams/roles to enable Start.
4. Record which client has the provider's Admin and Start controls.
5. Close A's page before start, wait for provider presence handling, and record whether Admin/Start transfers and whether the lobby survives.
6. Reopen A in the same browser context and record identity/admin recovery.
7. Start the match and confirm all four see the same 25-word board.
8. Close the provider Admin during the match; verify the remaining three retain the same active board.
9. Rejoin the Admin and verify the active match and identity recover.

Pass means four independent embedded clients share a Classic match and admin departure does not destroy the lobby/match. Admin transfer itself is an observation, not a prerequisite: Roomcade must not promise provider-admin reassignment unless observed.

### P2 — Bounded eight-player Classic (deferred into production embedding gate)

Do not run this as another standalone micro-experiment. Combine it later with the full application's HTTPS/browser/device embedding gate. Repeat the shared-lobby, roles, start, board, one clue, and one guess checks with a bounded larger group and record client performance and provider errors. The official tabletop range is `4–8+`, but no official online hard cap has been established.

### H1 — Four-room House orchestration (Roomcade/local)

Model one House with four rooms and reject a fifth. Give each room an independent versioned `activeGameUrl`. Verify simultaneous URL updates do not overwrite another room, stale compare-and-swap updates fail, switching unmounts the old iframe, and an expired URL can be replaced without losing House membership.

Run two simultaneous matches in different rooms and confirm no URL or participant-state leakage. Browser navigation between rooms must not grant Roomcade access to the cross-origin game state.

### H2 — House lifecycle edge cases (Roomcade/local)

- House host disconnects briefly, reconnects, or leaves permanently.
- Room/game coordinator leaves while provider Admin remains.
- Provider Admin leaves while House host remains.
- Two authorized users try to replace the shared URL concurrently.
- A member opens multiple tabs; count membership once and define which tab owns voice.
- Last person leaves a room; clean up ephemeral presence and voice while preserving durable room configuration.
- Failed room switch leaves the user in a coherent old or new state, never both voice sessions.

### V1 — Voice alongside the iframe (later browser test)

Test 2, 4, 6, and 8 people. Measure microphone permission behavior, mute, reconnect, room switching, teardown, upload bandwidth, CPU, packet loss, jitter, and TURN usage. Confirm the Codenames iframe receives no microphone/camera permission. Treat mesh voice's quadratic peer-connection growth as a separate capacity boundary from Codenames.

### L1 — Backend connection simulation (later, no Codenames traffic)

Exercise 10 Houses × 4 rooms × up to 8 connected friends per House with joins, presence heartbeats, room switches, host transfer, URL revisions, disconnect/reconnect, and empty-room cleanup. This is an engineering target for measurement, not a final product membership limit.

## Evidence format

For every run record date, parent origin, browser/version, isolated identity count, route type without the private URL, milestone results, unique console/page errors, timings, and overall pass/partial/fail/environment-blocked status. Clearly separate observed facts from product policy and untested assumptions.
