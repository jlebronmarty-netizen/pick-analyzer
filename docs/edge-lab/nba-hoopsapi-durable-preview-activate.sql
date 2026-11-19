-- Reviewed private Preview activation. Run only after the additive schema verifies.
-- This stable account label must be reused across deployments and key rotations.
-- App-only quota evidence, not a claim of total provider-account usage.
begin;
insert into public.nba_hoopsapi_accounts_v1(account_scope,enabled)
values ('pick-analyzer-hoopsapi-free-primary',false)
on conflict (account_scope) do nothing;

-- The imported UI response says 2026-11-18 17:57 AST, minute precision.
-- Charge at the upper end (21:58Z) so the rolling reservation does not expire early.
-- request_id is our observation identifier, never a purported provider request ID.
insert into public.nba_hoopsapi_attempts_v1(account_scope,request_id,reserved_at,dispatch_deadline,status,observed_evidence)
values ('pick-analyzer-hoopsapi-free-primary','20261118-2157-4000-8000-000000000001',
  '2026-11-18T21:58:00Z','2026-11-18T21:58:00Z','external_observed',
  '{"source":"user_pasted_private_preview_response","reported_receipt_minute":"2026-11-18T21:57Z","timestamp_precision":"minute","quota_anchor":"upper_bound_next_minute","raw_provider_response_available":false,"other_external_calls":"unknown"}'::jsonb)
on conflict (account_scope,request_id) do nothing;
update public.nba_hoopsapi_accounts_v1 set enabled=true
where account_scope='pick-analyzer-hoopsapi-free-primary';
-- Existing provider cooldowns are deliberately preserved.
select public.read_nba_hoopsapi_quota_v1('pick-analyzer-hoopsapi-free-primary');
commit;
