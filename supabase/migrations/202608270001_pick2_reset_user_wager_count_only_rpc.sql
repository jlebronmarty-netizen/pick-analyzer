-- PICK-2.0-RESET-01R2 User Wager Count-Only RPC
--
-- Additive inventory helper only. This function returns aggregate row counts
-- for the user-owned wager tables without exposing row payloads, identifiers,
-- user IDs, timestamps, stakes, odds, selections, sportsbook, notes or results.
-- RLS policies remain unchanged.

create or replace function public.pick2_reset_inventory_user_wager_counts()
returns table (
  user_wagers_count bigint,
  user_wager_legs_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.user_wagers)::bigint as user_wagers_count,
    (select count(*) from public.user_wager_legs)::bigint as user_wager_legs_count;
$$;

revoke all on function public.pick2_reset_inventory_user_wager_counts() from public;
revoke all on function public.pick2_reset_inventory_user_wager_counts() from anon;
revoke all on function public.pick2_reset_inventory_user_wager_counts() from authenticated;
grant execute on function public.pick2_reset_inventory_user_wager_counts() to service_role;

comment on function public.pick2_reset_inventory_user_wager_counts() is
  'PICK-2.0-RESET-01R2 count-only inventory helper. Returns only global user_wagers and user_wager_legs row counts for reset planning.';
