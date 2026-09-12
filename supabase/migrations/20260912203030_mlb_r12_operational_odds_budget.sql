-- R12: separate operational reservations. No historical counter is seeded or changed.
BEGIN;
CREATE TABLE public.pick2_mlb_odds_operational_requests (
  policy_version text NOT NULL DEFAULT 'MLB_ODDS_OPERATIONAL_BUDGET_V1',
  run_scope_key text NOT NULL,
  reservation_id text NOT NULL,
  operational_day date NOT NULL,
  daily_slot smallint NOT NULL,
  reserved_at timestamptz NOT NULL,
  response_at timestamptz,
  http_status smallint,
  credits_last integer,
  credits_used bigint,
  credits_remaining bigint,
  CONSTRAINT pick2_mlb_odds_operational_pk PRIMARY KEY (run_scope_key),
  CONSTRAINT pick2_mlb_odds_operational_reservation UNIQUE (reservation_id),
  CONSTRAINT pick2_mlb_odds_operational_daily_slot UNIQUE (operational_day,daily_slot),
  CONSTRAINT pick2_mlb_odds_operational_runtime_fk FOREIGN KEY (run_scope_key)
    REFERENCES public.pick2_mlb_runtime_state(scope_key) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT pick2_mlb_odds_operational_policy CHECK (policy_version='MLB_ODDS_OPERATIONAL_BUDGET_V1'),
  CONSTRAINT pick2_mlb_odds_operational_run CHECK (run_scope_key ~ '^RUN:[A-Za-z0-9_-]{1,100}$'),
  CONSTRAINT pick2_mlb_odds_operational_receipt CHECK (reservation_id ~ '^[a-f0-9]{64}$'),
  CONSTRAINT pick2_mlb_odds_operational_cap CHECK (daily_slot BETWEEN 1 AND 48),
  CONSTRAINT pick2_mlb_odds_operational_day CHECK (operational_day=(reserved_at AT TIME ZONE 'America/Puerto_Rico')::date),
  CONSTRAINT pick2_mlb_odds_operational_response CHECK (
    (response_at IS NULL AND http_status IS NULL AND credits_last IS NULL AND credits_used IS NULL AND credits_remaining IS NULL)
    OR (response_at IS NOT NULL AND response_at>=reserved_at AND http_status IS NOT NULL AND http_status BETWEEN 100 AND 599)),
  CONSTRAINT pick2_mlb_odds_operational_credits CHECK (
    (credits_last IS NULL OR credits_last>=0) AND (credits_used IS NULL OR credits_used>=0)
    AND (credits_remaining IS NULL OR credits_remaining>=0))
);
CREATE INDEX pick2_mlb_odds_operational_reserved_at ON public.pick2_mlb_odds_operational_requests(reserved_at DESC);
ALTER TABLE public.pick2_mlb_odds_operational_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pick2_mlb_odds_operational_requests FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.pick2_mlb_odds_operational_requests TO service_role;
GRANT UPDATE(response_at,http_status,credits_last,credits_used,credits_remaining)
  ON public.pick2_mlb_odds_operational_requests TO service_role;
-- No client policies. Existing service_role BYPASSRLS is required by preflight.
COMMIT;
