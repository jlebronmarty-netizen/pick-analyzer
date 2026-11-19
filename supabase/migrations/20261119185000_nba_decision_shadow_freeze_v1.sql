-- NBA Decision Board prospective SHADOW evidence, additive; no official model writes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.nba_decision_shadow_forecasts_v1(
  forecast_id text PRIMARY KEY CHECK (forecast_id ~ '^[0-9a-f]{64}$'),
  model_version text NOT NULL CHECK (length(model_version) BETWEEN 8 AND 100),
  decision_at timestamptz NOT NULL,
  game_id bigint NOT NULL CHECK (game_id>0),
  game_start_at timestamptz NOT NULL,
  game_date_local date NOT NULL,
  market text NOT NULL CHECK (market IN ('moneyline','spread','total','props','team_total_home','team_total_away')),
  period text NOT NULL CHECK (period IN ('ft','q1','q2','q3','q4','h1','h2')),
  side text NOT NULL CHECK (side IN ('home','away','over','under')),
  statistic text,
  player_id bigint,
  line numeric(9,3),
  american_odds integer CHECK (american_odds IS NULL OR abs(american_odds)>=100),
  quote_id text NOT NULL CHECK (length(quote_id) BETWEEN 8 AND 256),
  quote_source text NOT NULL CHECK (quote_source IN ('GOAT','HoopsAPI')),
  quote_captured_at timestamptz NOT NULL,
  projection numeric(9,3) NOT NULL,
  l5 numeric(9,3),
  l10 numeric(9,3),
  historical_n integer NOT NULL CHECK (historical_n>=5),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  inserted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT nba_decision_forecast_pregame CHECK (decision_at <= game_start_at - interval '10 minutes'),
  CONSTRAINT nba_decision_forecast_quote_precheck CHECK (quote_captured_at <= decision_at + interval '2 minutes'),
  CONSTRAINT nba_decision_forecast_source_line CHECK (
    (market='moneyline' AND line IS NULL) OR (market<>'moneyline' AND line IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS nba_decision_shadow_forecasts_day_market_idx
  ON public.nba_decision_shadow_forecasts_v1 (game_date_local,market,period,model_version);
CREATE INDEX IF NOT EXISTS nba_decision_shadow_forecasts_pending_idx
  ON public.nba_decision_shadow_forecasts_v1 (game_start_at,game_id);
CREATE TABLE IF NOT EXISTS public.nba_decision_shadow_outcomes_v1(
  forecast_id text PRIMARY KEY REFERENCES public.nba_decision_shadow_forecasts_v1(forecast_id),
  actual numeric(9,3) NOT NULL,
  absolute_error numeric(9,3) NOT NULL CHECK (absolute_error>=0),
  statistical_result text NOT NULL CHECK (statistical_result IN ('win','loss','push')),
  result_source text NOT NULL CHECK (result_source IN ('BALLDONTLIE_FINAL_ARCHIVE','GOAT_PLAYER_STATS')),
  source_received_at timestamptz NOT NULL,
  settled_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS nba_decision_shadow_outcomes_settled_idx
  ON public.nba_decision_shadow_outcomes_v1 (settled_at);

ALTER TABLE public.nba_decision_shadow_forecasts_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nba_decision_shadow_outcomes_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nba_decision_shadow_forecasts_v1,public.nba_decision_shadow_outcomes_v1
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.nba_decision_shadow_forecasts_v1,public.nba_decision_shadow_outcomes_v1 TO service_role;

CREATE OR REPLACE FUNCTION public.reject_nba_decision_shadow_mutation_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_NBA_DECISION_SHADOW'; END;
$$;
DROP TRIGGER IF EXISTS nba_decision_forecast_append_only_v1 ON public.nba_decision_shadow_forecasts_v1;
CREATE TRIGGER nba_decision_forecast_append_only_v1
  BEFORE UPDATE OR DELETE ON public.nba_decision_shadow_forecasts_v1
  FOR EACH ROW EXECUTE FUNCTION public.reject_nba_decision_shadow_mutation_v1();
DROP TRIGGER IF EXISTS nba_decision_outcome_append_only_v1 ON public.nba_decision_shadow_outcomes_v1;
CREATE TRIGGER nba_decision_outcome_append_only_v1
  BEFORE UPDATE OR DELETE ON public.nba_decision_shadow_outcomes_v1
  FOR EACH ROW EXECUTE FUNCTION public.reject_nba_decision_shadow_mutation_v1();
REVOKE EXECUTE ON FUNCTION public.reject_nba_decision_shadow_mutation_v1()
  FROM PUBLIC,anon,authenticated,service_role;
COMMIT;