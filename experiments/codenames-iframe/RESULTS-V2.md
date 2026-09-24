# Codenames iframe feasibility result — V2

Test date: September 2, 2026

Overall status: **pass for the core localhost Chromium experiment**. Two isolated players used two ordinary iframes, joined the same fresh private Codenames Duet room, started a live match, exchanged a clue and a confirmed card action, retained separate private key views, and recovered after iframe unmount/remount and outer-page refresh.

This does not yet establish HTTPS/browser/mobile compatibility or publisher permission.

## Environment

- Parent origin: `http://127.0.0.1:8000`
- Wrapper: `iframe-test-v2.html`, served with Python's local HTTP server
- Targets: `https://codenames.game/` and newly created private `/r/...` routes (not recorded)
- Browser: headless Chromium 151.0.7922.34 with normal web security
- Identities: two isolated browser contexts using disposable names `RcadeA26` and `RcadeB26`
- Iframes: ordinary iframes with no `sandbox`, microphone, camera, or other permission attributes
- Final verification loaded normal images, fonts, styles, and scripts; it did not block provider resources

## Observed results

| Check | Result | Evidence |
| --- | --- | --- |
| Private room created inside iframe | Pass | Player A created a fresh room through the official visible UI; the outer wrapper stayed on localhost. |
| Two embedded independent players | Pass | Player B joined the exact room URL in an iframe in a separate browser context. Both players saw each other. |
| Role/side selection | Pass | A and B joined opposite Duet sides. The host's Start control became enabled. |
| Live match start | Pass | Both iframes displayed the same 25-word match and remained inside their wrappers. |
| Private information | Pass | Both clients had the same 25 words, while 14 of 25 private card-key colors differed between their Side A and Side B views in the final run. |
| A action reaches B | Pass | A submitted `ORBIT · 1`; B displayed that clue and changed to the card-guessing state. |
| B action reaches A | Pass | B selected a card; A's copy of that card displayed B's suggestion marker. B then confirmed the guess and the confirmation control cleared while both clients remained synchronized. |
| Iframe unmount/remount | Pass | B's iframe was removed completely and mounted again with the same room URL. No nickname prompt appeared; the participant and active match returned. |
| Outer-page refresh | Pass | The V2 wrapper restored the room URL from its own `sessionStorage`; the provider restored B's identity and active match without another nickname prompt. |
| Unexpected outer navigation | Pass | Neither wrapper navigated away during room creation, joining, gameplay, remount, or refresh. |

## Errors

The final run produced one unique console error in each profile: an HTTP 404. The local Python server log identified these requests as `/favicon.ico` on the localhost wrapper. No Codenames framing-policy, storage, script, WebSocket, or navigation error was observed in the completed run.

## What this proves

- The intended core experience—real Codenames gameplay inside Roomcade with two embedded users sharing one provider-owned match—is technically feasible in the tested localhost Chromium environment.
- Codenames can continue to own game authority and live synchronization. Roomcade does not need a Codenames game backend or move relay for this path.
- Removing and recreating the iframe can recover the current provider identity and match in the same browser context. Roomcade still needs to retain the room's external URL so it can remount it.

## Important boundary

The Playwright test runner could inspect the cross-origin frame because browser automation operates outside normal page JavaScript. Roomcade's own JavaScript still cannot read the Codenames DOM, player roles, card colors, scores, readiness, or match result because of the same-origin policy.

Therefore automatic score reporting, role synchronization, readiness detection, and Codenames-driven Roomcade UI remain **unverified/unavailable through an iframe alone**. Legitimate later options are a provider-supported API or `postMessage` contract, publisher cooperation, or explicit user-driven controls. Production DOM scraping or bypassing browser security is not a sound workaround.

## Still unknown

- A normal HTTPS preview and the eventual production origin/CSP
- Firefox and Safari, including their default tracking protections
- Physical iPhone Safari and Android Chrome
- Voice running beside the game, including microphone permission, mute, room switching, and teardown
- Long-duration reconnect behavior and provider session expiry
- Publisher permission for Roomcade's intended embedding use

These are separate follow-up validations. Their absence does not negate the localhost Chromium pass, but they should be resolved before claiming broad browser/mobile support or launch readiness.

## Reproduction

From this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
node run-v2.cjs
```

`run-v2.cjs` accepts `PLAYWRIGHT_CORE_PATH` and `CHROMIUM_PATH` when the local defaults do not exist. It creates disposable private rooms and does not print or retain their URLs.
