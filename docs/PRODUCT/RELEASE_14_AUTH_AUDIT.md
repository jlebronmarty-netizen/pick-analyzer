# Release 14 Authentication UX Audit

Release 14 audits the existing account flow and improves the authenticated personal wager workflow without redesigning authentication.

## Existing Entry Points

- `/login`: existing Supabase password sign-in page.
- `/register`: existing Supabase account creation page.
- `/betting-workbench`: authenticated ledger consumer and local-only fallback surface.

`src/app/login/page.tsx` and `src/app/register/page.tsx` were protected unrelated dirty files before Release 14 and were not modified.

## Existing Session Infrastructure

- Browser Supabase client: `src/lib/supabase.ts`.
- User wager request authentication: `authenticateUserWagerRequest` in `src/services/user-wager-ledger.service.ts`.
- User wager APIs require bearer tokens from the active Supabase session.
- Normal user wager APIs use the public Supabase client with RLS, not service-role shortcuts.

## Session Persistence And Refresh

The browser client owns Supabase session persistence and token refresh. Release 14 adds workspace-level session observation through `supabase.auth.getSession()` and `supabase.auth.onAuthStateChange()`.

The workspace now reports:

- Local Only Mode.
- Remote Ledger Active.
- Sync pending.
- Syncing.
- Synced.
- Sync failed.
- Offline mode.
- Session recovery needed.
- Duplicate ignored.

## Logout And Recovery

Logout remains owned by the existing auth surfaces. The Betting Workspace now provides Sign In and Reconnect actions so an expired or missing session does not hide local wagers.

## Security Boundary

Release 14 does not inspect, log, render or persist bearer tokens. API authorization, ownership and export/summary isolation remain enforced by the Release 13 RLS-backed APIs.
