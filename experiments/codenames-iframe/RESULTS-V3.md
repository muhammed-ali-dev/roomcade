# Codenames iframe feasibility result — V3

Test date: September 2, 2026

Overall status: **pass for four-player Classic and provider-admin reconnect in localhost Chromium**.

Four isolated browser contexts used four ordinary iframes to join one newly created private Codenames Classic room. They occupied all four Classic roles, started one match, and displayed the same 25-word board. The private room URL was neither printed nor retained in this report.

## Environment

- Parent origin: `http://127.0.0.1:8000`
- Wrapper: `iframe-test-v2.html`
- Target: a fresh `https://codenames.game/r/...` private route
- Browser: headless Chromium 151.0.7922.34 with normal web security
- Clients: four isolated browser contexts and four ordinary iframes
- Requested disposable names: `RcadeA26` through `RcadeD26`
- Provider-displayed names: `Player0` through `Player3`

## Observed results

| Check | Result | Evidence |
| --- | --- | --- |
| Four embedded clients share one lobby | Pass | Every iframe displayed the same four provider identities. |
| Classic role assignment | Pass | The lobby exposed four role controls; one isolated client joined each role. |
| Provider game starter | Pass | Only the room creator displayed `Admin` and the enabled Start control. |
| Creator disconnects before start | Partial/risk found | Within eight seconds, the creator disappeared from all remaining clients. None of the other three received Admin or Start. The lobby itself remained available. |
| Creator rejoins before start | Pass | Reopening the same room in the creator's original browser context restored identity, Admin, and enabled Start without another nickname prompt. |
| Four-player Classic match | Pass | All four clients displayed 25 cards with the exact same sorted word set. |
| Admin disconnects during match | Pass with limitation | All three survivors retained the same active 25-word board. No survivor received Admin. |
| Admin rejoins during match | Pass | The original context returned without a nickname prompt and recovered its identity, Admin marker, and the exact active board. |
| Wrapper containment | Pass | Room creation and play remained in the ordinary iframe; the outer wrapper did not navigate away. |

## What actually worked

- Four people can participate through four separate Roomcade-style iframes in the same provider-owned Classic instance.
- Codenames synchronizes the lobby, roles, and match board; Roomcade does not need to relay gameplay.
- A transient creator/admin disconnect is recoverable when that person returns with the same provider storage context.
- A match already in progress survives the provider Admin leaving for at least the tested eight-second window.

## Product consequence

Roomcade needs one canonical game URL per room, but it should not invent a second “start game” authority. Codenames owns its Admin and Start controls.

The creator is currently a single point of coordination before match start: the tested provider did not transfer Admin or Start to another player. Because Roomcade JavaScript cannot inspect the cross-origin Codenames UI, it also cannot reliably detect or repair this automatically through the iframe alone. The practical MVP behavior is user-driven:

1. Label the person who supplied the shared URL as the **game coordinator**, separate from the House host.
2. Explain that the Codenames creator must start the match.
3. If that creator cannot return, let an authorized Roomcade user replace the room's canonical URL with a newly created lobby after confirmation.
4. Do not replace the URL merely because the coordinator temporarily disconnects; the same-context recovery worked.

## Errors and limitations

Each wrapper logged one generic 404 console error. This matches the already diagnosed localhost `/favicon.ico` request from V2; no framing-policy, storage, WebSocket, or outer-navigation failure was observed.

This run did not establish:

- Admin behavior after a long timeout or explicit in-game leave action
- Recovery from a different browser/device without the original provider storage
- An eight-player online capacity limit
- A fifth or late-joining player, spectator behavior, or a full clue/guess turn in Classic
- Four-room House orchestration, voice concurrency, HTTPS, Firefox, Safari, or mobile behavior
- Publisher permission for Roomcade's embedding use

## Reproduction

Serve the experiment directory, then run the script:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
node run-v3.cjs
```

`run-v3.cjs` accepts `WRAPPER_URL`, `PLAYWRIGHT_CORE_PATH`, and `CHROMIUM_PATH` overrides. It creates a disposable private lobby and redacts its route from output.

