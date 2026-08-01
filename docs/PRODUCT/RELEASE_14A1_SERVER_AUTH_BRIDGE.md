# Release 14A.1 Server Auth Bridge

Release 14A.1 repairs the authenticated wager API bridge without redesigning login or registration.

## Root Cause

The browser Supabase client session existed and the Betting Workspace could display the connected account. That session lived in the client-side Supabase auth context and was forwarded only when workspace fetches explicitly added an Authorization header.

Opening `/api/user/wagers` directly did not include that bearer header and no server-readable auth cookie existed, so the server route correctly returned `AUTH_REQUIRED`.

## Strategy

Release 14A.1 keeps the existing bearer-token auth strategy and adds a same-origin server session bridge:

1. The workspace obtains the current Supabase access token through the existing browser session.
2. The workspace posts it to `/api/user/session-bridge`.
3. The bridge verifies the token server-side with Supabase `getUser`.
4. The bridge sets an httpOnly, secure, sameSite=lax same-origin cookie.
5. Wager APIs accept either Authorization bearer token or the verified bridge cookie.

The token is never rendered, logged, stored in wager rows, or accepted from user payload fields. `user_id` remains derived only from verified Supabase auth.

## Reconnect

Reconnect refreshes the browser session, re-establishes the bridge, retries `/api/user/wagers`, and clears stale sync errors on success. Local wagers remain preserved on failure.

## Boundaries

Release 14A.1 does not change prediction formulas, probabilities, Official Picks, Kelly logic, learning, settlement, scheduler, providers, model data, or `prediction_history`.
