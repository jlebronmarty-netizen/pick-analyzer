# Authenticated API Session Bridge

The authenticated user wager APIs support two equivalent auth carriers:

- `Authorization: Bearer <supabase access token>` for programmatic workspace fetches.
- `pick_analyzer_user_access` httpOnly same-origin cookie established by `/api/user/session-bridge`.

Both paths verify the token server-side through Supabase before deriving `user_id`.

## Security Controls

- Tokens are not logged.
- Tokens are not rendered in UI.
- Tokens are not persisted in wager records.
- Client payload cannot override `user_id`.
- RLS remains active on `user_wagers` and `user_wager_legs`.
- Service-role credentials are not used for normal user wager requests.
- Unauthenticated requests continue to return HTTP 401 with `AUTH_REQUIRED`.

## Failure Categories

- `AUTH_REQUIRED`: no bearer token or bridge cookie.
- `SESSION_INVALID`: Supabase rejected the token during server verification.
- `SESSION_EXPIRED`: token resolved to no active user.
- `AUTH_VERIFICATION_FAILED`: bridge establishment failed safely.
