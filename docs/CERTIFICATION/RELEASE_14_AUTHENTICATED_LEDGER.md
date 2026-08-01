# Release 14 Authenticated Ledger Certification

Release 14 improves the account session and authenticated ledger experience while preserving model, prediction, settlement, scheduler and provider behavior.

Status: PASS_LOCAL_PENDING_AUTHENTICATED_PRODUCTION_LIFECYCLE

## Scope

- Audited existing auth entry points and Supabase session infrastructure.
- Added account and remote-ledger state to the Betting Workspace.
- Added local-to-remote migration preview and explicit confirmation.
- Added reconnect and offline/expired-session handling.
- Added remote update and archive attempts for synced wagers.
- Preserved local wagers until remote success.

## Protected Boundaries

- Prediction formulas changed: no.
- Official Picks changed: no.
- Kelly logic changed: no.
- Learning changed: no.
- Scheduler changed: no.
- Settlement changed: no.
- Provider contracts changed: no.
- Login/register protected files changed by Release 14: no.

## Release 13 Upgrade Gate

Release 13 can be upgraded from CONDITIONAL PASS to PASS only after a real signed-in production session verifies create, read, update, archive, summary, export, migration and duplicate protection.

If no legitimate signed-in browser session is available, Release 14 remains implementation-certified and Release 13 remains conditional on authenticated production evidence.
