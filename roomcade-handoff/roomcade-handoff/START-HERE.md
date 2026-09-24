# Roomcade — design-to-implementation handoff

This package captures the approved wireframe after the footer was removed, the fireside background was enabled in every room, and an illustrated ceiling extension filled the top gap in taller layouts. It is a design and interaction reference, not a working multiplayer application.

## Files

- `roomcade-wireframe.html`: standalone browser preview. Extract the ZIP and open this file in a modern desktop browser. Artwork is embedded; icons and some preview utilities load from public CDNs, so an internet connection is recommended.
- `roomcade-source.html`: editable HTML/CSS/JavaScript fragment, without the standalone preview wrapper. Prefer this for studying and porting the interface.
- `EXPERIMENT-PHASE-SUMMARY.md`: original user-supplied Codenames feasibility evidence, unchanged.
- `ARTWORK.md` and `assets/`: original room painting and generated ceiling-extension source, with notes for extending them later.

The standalone preview deliberately restricts network APIs and nested frames. These are preview restrictions, not Roomcade's proposed production security policy. Do not use its wrapper as the production app shell. Host-only design controls may not appear outside the conversation; normal prototype interactions are local.

## Prompt to give Codex

Read START-HERE.md, both original Markdown documents, and roomcade-source.html. Inspect roomcade-wireframe.html visually if your environment supports it. First make an implementation plan; do not start building yet. Use the final wireframe as the visual reference and the post-experiment plan as the behavior/architecture reference. Preserve the fireside art, top room tabs, game-first layout, people/voice beneath the game, neutral parchment controls, restrained honey accents, and absence of a footer. Do not redesign it into a Slack/Discord sidebar. Identify missing states and conflicts explicitly. Replace local simulations with authoritative backend behavior, managed voice, and the actual supported external-game integration. Include compatibility and permission gates, security, reconnect/race handling, tests, and phased acceptance criteria. Do not invent provider APIs or implement Codenames rules. Ask before changing a locked product decision or provisioning paid services.

## Product model

Roomcade is a private place for friends to hang out and play existing games together. The product hierarchy is House → rooms → one external game and room voice. A House is a logical application space, not a separate machine or server running on the user's device.

The post-experiment plan specifies up to eight members and one to four rooms per House, guest browser identity, host-approved invitations, and Codenames as the only MVP game. The earlier experiment summary called eight people an engineering test target; the subsequent plan adopts eight as a product cap. Keep that chronology explicit rather than presenting eight-player capacity as experimentally proven.

Roomcade owns membership, permissions, invitations, presence, room switching, voice, and the canonical game URL. Codenames owns its own identities, roles, rules, gameplay, and synchronization. Each user gets a separate iframe loading the same room URL—not a mirrored shared browser.

## Preserve the final design

- House selection and secondary administration in the top bar/menu; rooms as top tabs.
- The game is the dominant central surface. Keep its controls near it.
- Participants and opt-in voice controls sit directly beneath the game.
- Keep the original fireside artwork and subtle pauseable animation in every room, including newly created rooms and rooms in other Houses, whether empty or containing a game. Do not gate it on a particular room ID or name. The background is a 2D image with CSS animation overlays, not a real 3D engine. The backdrop selection and animation pause setting apply across rooms; Home and House overview remain separate views.
- Neutral parchment surfaces and espresso controls, with small honey accents. Avoid a yellow/brown tint across every surface.
- Keep scenery visible around the functional surfaces; do not cover it in dashboards, permanent control panels, or repeated cards.
- No footer. Accessible status announcements remain visually hidden.
- Preserve calm empty-room states and a useful House overview, without letting secondary navigation compete with the active game.
- Honor reduced-motion preferences and keep readable contrast, mobile layouts, keyboard controls, focus handling, and permission errors.

The HTML contains accumulated CSS from multiple iterations. Port the rendered final design into clean components and tokens; do not blindly copy every historical override. Embedded `petArt`, `roomArt`, and `ceilingArt` WebP data URLs are the runtime artwork sources and can be extracted into normal assets. Keep the original bottom-anchored room painting and its fire animation coordinates together. A separate ceiling layer fills only the exposed area above that painting; do not replace the lower room with the extended image, stretch the furniture, or lose the ceiling when content height changes. See ARTWORK.md.

## What is simulated

All sample Houses, members, invitations, approval decisions, room changes, game URL changes, coordinator/host permissions, and voice states run locally in memory. Refreshing resets them. There is no database, authentication, working shared invite service, realtime backend, microphone capture, LiveKit connection, or live Codenames match. The displayed board is illustrative and must not become a homegrown game implementation. The mockup demonstrates some workflows, not every production requirement.

Some status messages are screen-reader-only following footer removal. In production, decide which operations need visible inline confirmation or errors; do not assume an invisible announcement is sufficient for every action.

## Implementation direction

The supplied plan proposes React/TypeScript/Vite, Go with net/http and coder/websocket, SQLite, LiveKit Cloud, and a single Render service with a persistent disk. Treat that document as the detailed baseline, not this short summary. Recheck version availability and provider constraints at implementation time.

Important production work includes server-side authorization, guest-session cookies and CSRF protections, atomic capacity checks, canonical URL validation and revisions, durable storage, House-level command ordering, reconnect snapshots, multi-tab takeover, stale room-switch/media generation rejection, scoped voice tokens, participant removal, and lifecycle cleanup.

Keep House host, Roomcade game coordinator, and Codenames Admin distinct. Transferring Roomcade authority cannot transfer Codenames Admin. Never infer Codenames roles, scores, readiness, or match state from the iframe.

The experiment documents report successful local Chromium tests, not universal browser compatibility or publisher authorization. Production HTTPS/browser/storage tests and publisher permission remain gates. Do not bypass frame restrictions or browser security. Keep an external-open fallback that preserves room presence and voice when embedding is unavailable.

## Suggested implementation checkpoints

1. Recreate the visual shell with local fixtures, preserving the agreed layout and artwork.
2. Implement and test persisted guest identity, Houses, rooms, invitations, and authorization.
3. Connect authoritative realtime presence and room switching, including reconnect and multi-tab races.
4. Integrate the external-game URL lifecycle and test actual embedding/fallback in target environments.
5. Integrate managed voice with explicit opt-in, listener fallback, and stale audio cleanup.
6. Validate end-to-end multi-client flows, accessibility, responsive layouts, deployment recovery, and the original plan's remaining acceptance criteria.

These are handoff suggestions, not a replacement for the original plan or permission to deploy.

## What this iteration taught us

1. Separate visual identity from information architecture. Cozy colors did not solve a workplace-chat layout. Moving navigation and giving the game priority addressed the structural issue.
2. Translate references into principles, not replicas. The capybara reference suggested softness and friendliness; the final product uses its own artwork and House metaphor.
3. Let different layers do different jobs. Artwork supplies atmosphere; neutral controls supply clarity; accents supply emphasis.
4. Design around the user's moment. During play, the game, friends, and voice deserve priority. Administration can live in menus.
5. Turn vague feedback into a hypothesis. “Slack with a filter” suggested that both the layout and broad color treatment were wrong—not merely the exact hex values.
6. Remove before adding. The footer did not need to occupy a permanent visible row. Keep essential feedback accessible and visible where necessary.
7. Keep iteration small and inspectable. Change one coherent design decision, compare against the previous version, and validate the main interaction before broadening scope.
8. Distinguish preference from evidence. This design is promising and approved by its creator; it is not yet validated by usability testing.

Next useful test: give a friend the preview without explaining it. Ask them to find the current room, join voice, switch rooms, and find how to replace a game. Watch where they hesitate. Ask “What did you expect to happen?” rather than only “Does it look nice?” Separately test the complete first-time invite-to-play journey once it is implemented.

## Verification at export

The source's JavaScript syntax and local interactions were checked using a Node DOM stub, including existing rooms, an added room, another House, a newly created House, plain-background mode, and animation-pause persistence while switching rooms. Artwork equality against the preceding version was checked. This export was generated from that source; live backend integration and browser screenshot QA have not been performed for the export.
