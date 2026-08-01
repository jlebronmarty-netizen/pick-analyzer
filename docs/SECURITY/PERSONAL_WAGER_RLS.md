# Personal Wager RLS

Status: RELEASE 13 STRICT USER ISOLATION

## Policy Model

Release 13 uses Supabase RLS on:

- `public.user_wagers`
- `public.user_wager_legs`

Every normal user operation is performed through the authenticated user's bearer session, not the service role.

## user_wagers

Policies:

- `user_wagers_select_own`
- `user_wagers_insert_own`
- `user_wagers_update_own`
- `user_wagers_delete_own`

All policies require `auth.uid() = user_id`.

## user_wager_legs

Policies:

- `user_wager_legs_select_own`
- `user_wager_legs_insert_own`
- `user_wager_legs_update_own`
- `user_wager_legs_delete_own`

All policies require an owning `user_wagers` row where `user_wagers.user_id = auth.uid()`.

## Security Boundary

- Anonymous cross-user access is denied.
- Normal remote wager APIs require authentication.
- Wager rows cannot update prediction, settlement, learning or performance data.
- Exports are owner-scoped.
- Certification must not print credentials or session tokens.
