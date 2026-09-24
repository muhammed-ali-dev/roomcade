# Roomcade operations

## Deployment

1. Create a LiveKit Cloud project and keep its URL, API key, and API secret outside the repository.
2. Create the Render service from `render.yaml`.
3. Set `ALLOWED_ORIGINS` to the exact production HTTPS origin.
4. Add the LiveKit values and configure its webhook target as `https://<roomcade-origin>/api/v1/livekit/webhook`.
5. Verify `/readyz`, authenticated `/metrics`, guest-session creation, realtime reconnect, and the unconfigured/configured voice state.
6. Do not open a public alpha until Codenames embedding permission is recorded.

## SQLite backup

Render disk snapshots are the primary infrastructure backup. Before a release that changes persistence:

1. Stop application writes or deploy a maintenance instance against a copied disk.
2. Run `PRAGMA wal_checkpoint(TRUNCATE);` against `/var/data/roomcade.db`.
3. Create a Render disk snapshot and record its timestamp with the release identifier.
4. Confirm the snapshot is visible before deployment.

Never copy only the main database file while an unchecked WAL is active.

## Restore drill

1. Restore the snapshot to a separate persistent disk or private service.
2. Boot Roomcade with `DATABASE_PATH` pointing at the restored file.
3. Confirm `/readyz` succeeds and inspect `PRAGMA integrity_check;` for `ok`.
4. Open an existing House in a browser session copied only for the drill, confirm its rooms and canonical game revisions, then exercise one reversible room rename.
5. Delete the private drill service after recording the outcome. Never point two Roomcade writers at one SQLite disk.

## Incident behavior

- A process restart drops WebSockets; browsers reconnect and receive complete snapshots.
- Missing LiveKit credentials disable only voice.
- If Codenames blocks embedding, members use “Open in another window” while House presence and voice remain active.
- If the current House host disconnects, connected members see the old host during the 30-second grace period; authority then transfers to the longest-tenured connected member.
- Database readiness failure removes the instance from service through `/readyz`.

Logs must never include guest cookies, raw invite tokens, canonical lobby URLs, or LiveKit credentials.
