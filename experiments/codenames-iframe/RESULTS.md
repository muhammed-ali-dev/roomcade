# Codenames iframe feasibility result

> This V1 result is superseded for the localhost Chromium path by [RESULTS-V2.md](./RESULTS-V2.md), which completed a two-embedded-player live match test.

Test date: September 2, 2026

Overall status: **partial**. The official game rendered in the iframe and an embedded player and a direct-site player joined the same newly created private lobby. A live match and the intended two-embedded-player case were not completed, so this is not a full feasibility pass.

## Environment

- Parent origin: `http://127.0.0.1:8000`
- Wrapper: `iframe-test.html`, served with Python's local HTTP server
- Targets: `https://codenames.game/` and a newly created private `/r/...` room URL (not recorded)
- Browser: headless Chromium 151.0.7922.34
- Identities: two isolated browser contexts; test nicknames `RoomcadeA` and `RoomcadeB` (the provider assigned `Player1` to the second context on some repeat attempts)
- Iframe: ordinary iframe with no `sandbox` or permission attributes

## Observed results

| Check | Result | Evidence |
| --- | --- | --- |
| Direct homepage control | Pass | HTTP 200, title `Codenames Online`, and the complete interactive homepage text rendered. |
| Homepage in iframe | Pass | The real homepage rendered with its nickname field and `ENTER GAME` control. The iframe URL was the official HTTPS origin. |
| Outer-page navigation | Pass | The wrapper remained on localhost after loading the game and creating a room. |
| Private room creation in iframe | Pass | Player A entered a disposable nickname through the visible official UI and the iframe navigated to a fresh `/r/...` room. |
| One embedded plus one direct player | Pass | A second isolated context opened that exact room URL directly and joined. Each context displayed both participants in the same lobby. |
| Roles and match start | Not completed | Later repeat runs became extremely slow or timed out before the nickname UI became ready. |
| Bidirectional game actions | Not completed | No match was started, so no card/clue action was claimed as verified. |
| Two embedded players | Not completed | The second-context iframe case was not reached. |
| Refresh/rejoin and unmount/remount | Not completed | Not reached. |
| HTTPS preview and browser/mobile matrix | Not run | The repository has no configured preview host, and localhost was the required first test. |

## Errors and limitations

- No `Refused to frame`, `frame-ancestors`, `X-Frame-Options`, cross-site storage, or outer-navigation error was observed during the successful render and shared-lobby run.
- The browser logged HTTP 404 errors during successful runs. The local server log identified these as missing `/favicon.ico` requests from the wrapper, not failed Codenames resources.
- After the successful shared-lobby observation, later runs experienced long live-page delays and readiness timeouts: the document body or nickname control sometimes did not become available within 30–120 seconds. A contemporaneous direct HTTP control still returned 200 with the homepage document. These timeouts are an execution-environment/live-loading limitation, not evidence that Codenames rejected the iframe.
- No private lobby URL, session data, or credentials were retained.
- Technical behavior does not establish publisher permission to embed the game.

## Reproduction

From this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/iframe-test.html` in a normal desktop Chrome or Edge profile. Finish the remaining acceptance checks with two separate profiles before treating Codenames embedding as fully feasible for Roomcade.
