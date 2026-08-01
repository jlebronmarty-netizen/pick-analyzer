# Session Recovery

Release 14 adds user-visible session recovery for the Betting Workspace without changing authentication architecture.

## Cases

- Expired session: remote sync is blocked, local wagers are preserved, and the user is asked to sign in again.
- Invalid session: authenticated APIs return 401 and the workspace remains local-first.
- Lost connection: offline mode is displayed and local wagers remain editable.
- Reconnect: the workspace rechecks the active Supabase session and remote ledger.
- Multiple tabs: Supabase auth state changes are observed and the workspace refreshes session state.
- Browser refresh: local storage remains available before remote ledger checks complete.

## Security Controls

- Bearer tokens are passed only in Authorization headers.
- Tokens are not rendered, logged or written to documentation.
- Remote wager access remains protected by Supabase RLS.
- Summary and export use the same authenticated ownership boundary as create/read/update/archive.
- Service-role access is not used for normal user wager operations.
