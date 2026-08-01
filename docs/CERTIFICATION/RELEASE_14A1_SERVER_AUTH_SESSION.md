# Release 14A.1 Server Auth Session Certification

Status: PASS_LOCAL_PENDING_AUTHENTICATED_BROWSER_LIFECYCLE

Release 14A.1 adds a verified same-origin auth bridge for user wager APIs.

## Fixed

- Added `/api/user/session-bridge`.
- Wager APIs now accept verified bearer token or verified bridge cookie.
- Workspace establishes the bridge before remote ledger reads.
- Reconnect refreshes session, refreshes bridge and retries ledger read.
- User id remains derived from Supabase `getUser`.
- Unauthenticated requests remain blocked.

## Root Cause

The connected account was visible because the browser Supabase client had a client-side session. Direct API opens had no Authorization header and no server-readable cookie, so server auth had no session context and returned `AUTH_REQUIRED`.

## Model Isolation

- Prediction formulas changed: no.
- Probabilities changed: no.
- Official Picks changed: no.
- Kelly formulas changed: no.
- Learning changed: no.
- Settlement changed: no.
- Scheduler changed: no.
- Provider contracts changed: no.
- Prediction history changed: no.

## Production Gate

After deployment, a legitimate signed-in browser session must open the Betting Workspace or press Reconnect to establish the bridge, then verify GET, create, read, update, summary, export and archive.
