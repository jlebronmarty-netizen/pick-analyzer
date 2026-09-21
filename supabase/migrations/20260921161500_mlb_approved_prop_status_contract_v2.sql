begin;

alter table public.mlb_approved_prop_daily_v1
  drop constraint if exists mlb_approved_prop_daily_v1_status_chk;

alter table public.mlb_approved_prop_daily_v1
  add constraint mlb_approved_prop_daily_v1_status_chk
  check (
    status = any (array[
      'QUALIFIES_MARKET_VERIFIED'::text,
      'MODEL_QUALIFIES_MARKET_NOT_VERIFIED'::text,
      'MODEL_QUALIFIES_MARKET_NOT_AVAILABLE'::text,
      'MARKET_AVAILABLE_REQUIRED_LINE_NOT_AVAILABLE'::text,
      'NO_EVALUABLE_IDENTITY'::text,
      'NO_EVALUABLE_PREGAME_LINEAGE'::text,
      'NO_EVALUABLE'::text,
      'NO_PLAY'::text,
      'RUNTIME_PARITY_NOT_CERTIFIED'::text
    ])
  );

comment on constraint mlb_approved_prop_daily_v1_status_chk on public.mlb_approved_prop_daily_v1 is
  'Approved-prop real-line status contract v2. Preserves legacy MODEL_QUALIFIES_MARKET_NOT_VERIFIED while allowing exact-line availability and identity/lineage blockers.';

commit;
