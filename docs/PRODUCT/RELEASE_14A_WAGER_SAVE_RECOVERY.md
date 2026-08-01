# Release 14A Wager Save Recovery

Release 14A repairs the authenticated wager-save path exposed by real production use.

## Root Cause

The workspace accepted raw draft strings but did not have a canonical wager-input parser. The happy path worked for simple numeric strings, but production use exposed that validation, payout, risk and save payloads could disagree because American odds, line and stake parsing were scattered through raw `Number()` calls.

Release 14A creates `src/lib/wager-input-normalization.ts` and routes the draft editor, ticket summary and save payload through the same parsing policy:

- `151` normalizes to canonical `+151`.
- `+151` remains `+151`.
- `-110` remains `-110`.
- zero and sub-100 American odds are rejected.
- `25` is stored as numeric stake `25`.
- blank, zero, negative and NaN stakes remain invalid.

## Lifecycle Repair

For valid drafts:

- payout and max-loss/risk calculations use canonical numeric odds and stake;
- Save User Wager is enabled only after valid price and stake are present;
- local save occurs before any remote sync attempt;
- failed remote sync preserves the local wager;
- authenticated `sync-pending` mode now attempts remote sync for new saves;
- duplicate retry remains controlled by `clientCreatedId`.

## Remote Ledger Root Cause

Read-only production schema probing showed:

- `user_wagers` exists.
- `user_wager_legs` exists.
- Supabase REST returned `PGRST205` for direct table reads, indicating the tables were not visible in the REST schema cache/role exposure path.

The Release 13 migration existed, but production REST access was not usable for authenticated API operations. Release 14A adds additive migration `202608010001_release14a_user_wager_ledger_grants.sql` to grant table access to `authenticated` while preserving existing RLS policies and notifying PostgREST to reload schema.

This migration does not touch prediction, settlement, learning, scheduler, provider, performance or model tables.

## Error Contract

Remote ledger failures now return safe categories:

- `AUTH_REQUIRED`
- `SESSION_EXPIRED`
- `SESSION_REFRESH_FAILED`
- `LEDGER_TABLE_UNAVAILABLE`
- `RLS_DENIED`
- `VALIDATION_FAILED`
- `REMOTE_SYNC_FAILED`
- `UNKNOWN_REMOTE_ERROR`

The UI displays the safe category and message without exposing cookies, tokens, SQL or credentials.
