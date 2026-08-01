# Release 13 Wager Ledger Audit

Status: RELEASE 13 IMPLEMENTED

## Scope

Release 13 adds a canonical remote ledger for wagers explicitly entered by the user. The ledger is separate from `prediction_history`, model settlement, learning labels, calibration, Official Picks, scheduler tasks, provider adapters and performance metrics.

## Existing Auth And Ownership

- Browser authentication uses the existing Supabase client in `src/lib/supabase.ts`.
- Server-only operational database work uses `src/lib/supabase-admin.ts`, but Release 13 user wager APIs do not use service-role access for normal operations.
- The canonical ownership field for personal wagers is `user_id`, referencing `auth.users(id)`.
- Remote persistence requires an authenticated Supabase bearer session.
- Anonymous users remain supported through the Release 12 local browser-storage workflow.
- `src/app/login/page.tsx` and `src/app/register/page.tsx` were already dirty before Release 13 and remain unrelated.

## Existing Wager State

Release 12 stored user-entered wagers in browser storage under `pick-analyzer-release12-user-wagers-v1`. That local workflow remains available and is not deleted after sync. Remote sync uses the local wager id as `client_created_id` for idempotency.

## Safety Findings

- No existing equivalent canonical remote wager schema was found.
- No existing user-owned wager API was found.
- User wager results cannot safely prove model settlement because sportsbook lines and prices may differ from canonical prediction rows.
- Automatic personal wager settlement is therefore not enabled in Release 13.

## Release 13 Decision

Create additive tables `user_wagers` and `user_wager_legs`, strict RLS policies, authenticated APIs, local-to-remote sync, personal analytics and export. Keep model and prediction systems unchanged.
