# Authenticated Ledger Workflow

The Betting Workspace supports a safe local-to-remote wager workflow.

## Unauthenticated

The workspace displays Local Only Mode, explains that wagers are stored in browser local storage, and provides a clear Sign In action. Local wagers remain usable while unauthenticated.

## Authenticated

The workspace displays connected account state, remote ledger availability, last sync, remote row count and unsynced local count.

## Migration

Before syncing local wagers, the user sees a migration preview:

- number of unsynced wagers;
- failed wagers that will retry;
- duplicate/idempotent wagers already protected;
- confirmation that local copies are retained until remote success.

Sync uses the existing `clientCreatedId` idempotency key. Duplicate remote rows are reported as duplicate ignored instead of creating a second wager.

## Lifecycle

Authenticated lifecycle uses the Release 13 user wager APIs:

- Create: `POST /api/user/wagers`.
- Read: `GET /api/user/wagers`.
- Update: `PATCH /api/user/wagers/[id]`.
- Archive: `PATCH /api/user/wagers/[id]` with archive state.
- Summary: `GET /api/user/wagers/summary`.
- Export: `GET /api/user/wagers/export`.

Local data remains the first recovery layer. Remote failures mark the affected wager as sync failed and never delete the local copy.
