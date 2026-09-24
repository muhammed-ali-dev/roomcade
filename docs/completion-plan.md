# Hosted friends release

Target: a persistent HTTPS link where friends can request entry, receive approval,
share Codenames, use room-scoped voice, and recover from refreshes or disconnects.

1. Repair invitation delivery, repeated requests, authorization boundaries, room
   ordering, and game revision checks; add regression coverage.
2. Make room navigation follow server acknowledgement and handle reconnects,
   duplicate tabs, inaccessible Houses, and terminal invite states explicitly.
3. Preserve microphone mute preference and cancel stale voice connections;
   enforce media revocation on room changes and membership removal.
4. Exercise two-browser invitation, approval, room/game synchronization, removal,
   reload, and mobile layouts. Run frontend build, unit tests, Go race checks.
5. Prepare persistent Render deployment, configurable embedding fallback, and
   production configuration validation. Deploy when hosting access is available.
6. Verify the hosted invitation journey and LiveKit audio with separate clients.

External setup: hosting account/repository, LiveKit project credentials, and the
embedding permission prerequisite recorded in the original project documents.
Do not describe live voice or hosted deployment as verified until exercised.
