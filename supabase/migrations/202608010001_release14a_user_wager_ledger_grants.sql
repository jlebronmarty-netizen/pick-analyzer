-- Release 14A User Wager Ledger Grants
--
-- Additive exposure repair only. Existing RLS policies remain the ownership
-- boundary; this migration does not touch prediction, settlement, learning,
-- scheduler, provider, performance, or model tables.

grant usage on schema public to authenticated;

grant select, insert, update, delete
  on table public.user_wagers
  to authenticated;

grant select, insert, update, delete
  on table public.user_wager_legs
  to authenticated;

notify pgrst, 'reload schema';
