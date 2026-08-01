# Release 14A Authenticated Wager Recovery Certification

Status: PASS_LOCAL_PENDING_PRODUCTION_GRANT_APPLICATION_AND_AUTHENTICATED_LIFECYCLE

Release 14A repairs the bounded runtime defects found during the authenticated wager lifecycle test.

## Fixed

- Canonical American odds parsing for user-entered odds.
- Canonical positive stake parsing.
- Payout and max-loss/risk calculation alignment.
- Save path uses canonical odds, line and stake.
- Authenticated `sync-pending` saves attempt remote sync.
- Reconnect refreshes the Supabase session before retrying the remote ledger.
- Remote ledger errors are safely categorized.
- Additive production grant/schema-cache migration is created.

## Production Database Evidence

Read-only production probe:

- `user_wagers`: exists.
- `user_wager_legs`: exists.
- REST visibility before Release 14A migration: `PGRST205`.

Conclusion: the Release 13 table migration existed, but the authenticated REST path was unavailable until grants/schema reload are applied.

## Model Isolation

- Prediction formulas changed: no.
- Model probabilities changed: no.
- Official Picks changed: no.
- Kelly formulas changed: no.
- Learning changed: no.
- Settlement changed: no.
- Scheduler changed: no.
- Provider contracts changed: no.
- Prediction history changed: no.

## Remaining Production Gate

The additive SQL migration must be applied to production Supabase before the authenticated lifecycle can fully pass. After it is applied, verify create, read, update, summary, export and archive with a legitimate signed-in session.
