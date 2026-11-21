-- Proposed installation only. Apply in an approved transaction, never on application startup.
BEGIN;
CREATE SCHEMA nba_v2_shadow;
REVOKE ALL ON SCHEMA nba_v2_shadow FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA nba_v2_shadow TO service_role;

CREATE TABLE nba_v2_shadow.cycles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_hash text NOT NULL CHECK (model_hash ~ '^[0-9a-f]{64}$'),
  slot timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('freeze','settle','seed')),
  captured_at timestamptz NOT NULL,
  diagnostics jsonb NOT NULL,
  UNIQUE(model_hash,slot,kind)
);
CREATE TABLE nba_v2_shadow.forecasts (
  id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{64}$'),
  cycle_id bigint NOT NULL REFERENCES nba_v2_shadow.cycles,
  game_id bigint NOT NULL, tip timestamptz NOT NULL, record jsonb NOT NULL, benchmark jsonb
);
CREATE INDEX ON nba_v2_shadow.forecasts(game_id,tip);
CREATE TABLE nba_v2_shadow.judgments (
  cycle_id bigint NOT NULL REFERENCES nba_v2_shadow.cycles,
  forecast_id text NOT NULL REFERENCES nba_v2_shadow.forecasts,
  record jsonb NOT NULL, PRIMARY KEY(cycle_id,forecast_id)
);
CREATE INDEX ON nba_v2_shadow.judgments(forecast_id,cycle_id DESC);
CREATE TABLE nba_v2_shadow.reports (
  cycle_id bigint PRIMARY KEY REFERENCES nba_v2_shadow.cycles, report jsonb NOT NULL
);
GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA nba_v2_shadow TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA nba_v2_shadow TO service_role;
-- Invoker functions. The service account has no UPDATE or DELETE on these tables.
CREATE FUNCTION nba_v2_shadow.clock_time() RETURNS timestamptz LANGUAGE sql VOLATILE
SET search_path='' AS $$ SELECT clock_timestamp() $$;

CREATE FUNCTION public.nba_v2_shadow_commit(p_kind text,p_slot timestamptz,p_batch jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  t timestamptz;
  stamp timestamptz := (p_batch->>'at')::timestamptz;
  model text := p_batch->>'modelHash';
  rid bigint;
  item jsonb;
  f jsonb;
BEGIN
  IF model IS NULL OR model !~ '^[0-9a-f]{64}$' OR p_slot IS NULL OR p_kind NOT IN ('freeze','settle')
    OR date_trunc('minute',p_slot)<>p_slot OR NOT (CASE p_kind WHEN 'freeze' THEN
      to_char(p_slot AT TIME ZONE 'America/Puerto_Rico','HH24:MI') IN ('11:35','19:35')
      ELSE to_char(p_slot AT TIME ZONE 'America/Puerto_Rico','HH24:MI')='08:15' END)
  THEN RAISE EXCEPTION 'INVALID_V2_SLOT'; END IF;
  -- Serialize first-write wins for commitments across different slots for the same model.
  PERFORM pg_advisory_xact_lock(hashtextextended('nba_v2_shadow_'||model,0));
  SELECT id INTO rid FROM nba_v2_shadow.cycles WHERE model_hash=model AND slot=p_slot AND kind=p_kind;
  IF FOUND THEN RETURN rid; END IF;
  -- Read the server clock after acquiring the lock, including time spent waiting for a competing cycle.
  t := nba_v2_shadow.clock_time();
  IF stamp IS NULL OR stamp<p_slot OR stamp>t OR t>=p_slot+interval '21 minutes'
     OR jsonb_typeof(p_batch->'records') IS DISTINCT FROM 'array' OR jsonb_array_length(p_batch->'records')>5000
     OR jsonb_typeof(p_batch->'diagnostics') IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'INVALID_V2_BATCH_OR_CLOCK'; END IF;
  INSERT INTO nba_v2_shadow.cycles(model_hash,slot,kind,captured_at,diagnostics)
    VALUES(model,p_slot,p_kind,stamp,p_batch->'diagnostics') RETURNING id INTO rid;
  FOR item IN SELECT value FROM jsonb_array_elements(p_batch->'records') LOOP
    IF p_kind='freeze' THEN
      IF (item->>'modelHash'=model AND item->>'qualityStatus'='VALIDATED' AND item->>'contractVerified'='true'
        AND item->>'probabilityOrigin'='FROZEN_PROSPECTIVE_MODEL' AND item->>'classification'='VIGILAR'
        AND (item->>'probability')::numeric BETWEEN 0.000001 AND 0.999999
        AND (item->>'pushProbability')::numeric BETWEEN 0 AND 1 AND abs((item->>'americanOdds')::int)>=100
        AND item->>'quoteId'<>'' AND (item->>'trainedThrough')::timestamptz<(item->>'featuresAsOf')::timestamptz
        AND (item->>'quoteAt')::timestamptz<=(item->>'capturedAt')::timestamptz
        AND (item->>'capturedAt')::timestamptz<=(item->>'featuresAsOf')::timestamptz
        AND (item->>'featuresAsOf')::timestamptz BETWEEN stamp-interval '10 min' AND stamp
        AND (item->>'frozenAt')::timestamptz=stamp AND (item->>'decisionAt')::timestamptz=stamp
        AND t<(item->>'expiresAt')::timestamptz AND t<(item->>'gameStartAt')::timestamptz-interval '10 min') IS NOT TRUE
      THEN RAISE EXCEPTION 'INVALID_V2_FORECAST'; END IF;
      INSERT INTO nba_v2_shadow.forecasts VALUES(item->>'forecastId',rid,(item->>'gameId')::bigint,
        (item->>'gameStartAt')::timestamptz,item-'benchmark',item->'benchmark') ON CONFLICT(id) DO NOTHING;
    ELSE
      SELECT a.record INTO STRICT f FROM nba_v2_shadow.forecasts a
        JOIN nba_v2_shadow.cycles c ON c.id=a.cycle_id WHERE a.id=item->>'forecastId' AND c.model_hash=model;
      IF (f->>'gameStartAt')::timestamptz>=stamp OR
        (CASE WHEN item ? 'result' THEN item->>'result' IN ('win','loss','push') AND item->>'scope'='STATISTICAL_SETTLEMENT'
          AND item->>'snapshotId'<>'' AND jsonb_typeof(item->'actual')='number'
          AND (item->>'outcomeAt')::timestamptz>(f->>'gameStartAt')::timestamptz
          AND (item->>'outcomeAt')::timestamptz<=stamp
        ELSE item->>'reason' IN ('AWAITING_RECONCILED_FINAL','DISPUTED_OR_UNVERIFIED_COMPONENT') END) IS NOT TRUE
      THEN RAISE EXCEPTION 'INVALID_V2_JUDGMENT'; END IF;
      INSERT INTO nba_v2_shadow.judgments VALUES(rid,item->>'forecastId',item);
    END IF;
  END LOOP;
  RETURN rid;
END $$;

-- First attempt and least recently checked games first; revisit final records for seven days.
CREATE FUNCTION public.nba_v2_shadow_due(p_model text,p_at timestamptz)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH visits AS (
   SELECT f.game_id,f.id,f.record,f.tip,max(j.cycle_id) last_checked,
          (array_agg(j.record ? 'result' ORDER BY j.cycle_id DESC))[1] has_result
   FROM nba_v2_shadow.forecasts f JOIN nba_v2_shadow.cycles c ON c.id=f.cycle_id
   LEFT JOIN nba_v2_shadow.judgments j ON j.forecast_id=f.id
   WHERE c.model_hash=p_model AND f.tip<=p_at-interval '3 hours'
   GROUP BY f.id
 ), due AS (
   SELECT * FROM visits WHERE NOT coalesce(has_result,false) OR tip>=p_at-interval '7 days'
 ), page AS (
   SELECT game_id FROM due GROUP BY game_id ORDER BY min(coalesce(last_checked,0)),min(tip),game_id LIMIT 12
 )
 SELECT jsonb_build_object('gameId',game_id,'forecasts',jsonb_agg(record ORDER BY id))
 FROM due JOIN page USING(game_id) GROUP BY game_id ORDER BY game_id
$$;

-- Stable, keyset-paged metric input up to the committed settlement cycle.
CREATE FUNCTION public.nba_v2_shadow_page(p_cycle bigint,p_after text)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('cutoff',cutoff.captured_at,'forecast',CASE WHEN f.benchmark IS NULL THEN f.record ELSE f.record||jsonb_build_object('benchmark',f.benchmark) END,'observations',coalesce((
    SELECT jsonb_agg(jsonb_build_object('checkedAt',c.captured_at,'record',j.record) ORDER BY c.id)
    FROM nba_v2_shadow.judgments j JOIN nba_v2_shadow.cycles c ON c.id=j.cycle_id
    WHERE j.forecast_id=f.id AND c.id<=p_cycle),'[]'::jsonb))
 FROM nba_v2_shadow.cycles cutoff JOIN nba_v2_shadow.cycles seed ON seed.model_hash=cutoff.model_hash
 JOIN nba_v2_shadow.forecasts f ON f.cycle_id=seed.id
 WHERE cutoff.id=p_cycle AND cutoff.kind='settle' AND seed.id<=p_cycle AND f.id>p_after ORDER BY f.id LIMIT 100
$$;
CREATE FUNCTION public.nba_v2_shadow_existing(p_model text,p_kind text,p_slot timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',c.id,'diagnostics',c.diagnostics,'hasReport',r.cycle_id IS NOT NULL)
 FROM nba_v2_shadow.cycles c LEFT JOIN nba_v2_shadow.reports r ON r.cycle_id=c.id
 WHERE c.model_hash=p_model AND c.kind=p_kind AND c.slot=p_slot
$$;
CREATE FUNCTION public.nba_v2_shadow_cutoff(p_cycle bigint) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT captured_at FROM nba_v2_shadow.cycles WHERE id=p_cycle AND kind='settle'
$$;
CREATE FUNCTION public.nba_v2_shadow_report(p_cycle bigint,p_report jsonb) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  INSERT INTO nba_v2_shadow.reports
    SELECT id,p_report FROM nba_v2_shadow.cycles
    WHERE id=p_cycle AND kind='settle' AND jsonb_typeof(p_report)='object'
    ON CONFLICT DO NOTHING;
  RETURN EXISTS(SELECT FROM nba_v2_shadow.reports WHERE cycle_id=p_cycle);
END $$;
-- Preview reads the published report plus first freezes on the two latest game days since that report.
CREATE FUNCTION public.nba_v2_shadow_review(p_model text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH latest AS (
   SELECT c.id,c.captured_at,r.report FROM nba_v2_shadow.reports r
   JOIN nba_v2_shadow.cycles c ON c.id=r.cycle_id
   WHERE c.model_hash=p_model ORDER BY c.id DESC LIMIT 1
 ), capture AS (
   SELECT c.captured_at,c.diagnostics FROM nba_v2_shadow.cycles c WHERE c.model_hash=p_model
   AND c.kind IN ('freeze','seed') ORDER BY c.id DESC LIMIT 1
 ), fresh AS (
   SELECT f.record FROM nba_v2_shadow.forecasts f JOIN nba_v2_shadow.cycles c ON c.id=f.cycle_id,latest
   WHERE c.model_hash=p_model AND c.id>latest.id
 ), days AS (
   SELECT DISTINCT record->>'gameDay' AS day FROM fresh ORDER BY day DESC LIMIT 2
 )
 SELECT jsonb_build_object('report',latest.report,'capturedAt',greatest(latest.captured_at,capture.captured_at),
   'freezeAt',capture.captured_at,'exclusions',capture.diagnostics->'excluded',
   'newForecasts',coalesce((SELECT jsonb_agg(record ORDER BY record->>'forecastId') FROM fresh
      WHERE record->>'gameDay' IN (SELECT day FROM days)),'[]'::jsonb))
 FROM latest LEFT JOIN capture ON true
$$;
REVOKE ALL ON FUNCTION public.nba_v2_shadow_commit(text,timestamptz,jsonb), public.nba_v2_shadow_due(text,timestamptz),
  public.nba_v2_shadow_existing(text,text,timestamptz), public.nba_v2_shadow_cutoff(bigint), public.nba_v2_shadow_page(bigint,text),public.nba_v2_shadow_report(bigint,jsonb),public.nba_v2_shadow_review(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nba_v2_shadow_commit(text,timestamptz,jsonb), public.nba_v2_shadow_due(text,timestamptz),
  public.nba_v2_shadow_existing(text,text,timestamptz), public.nba_v2_shadow_cutoff(bigint), public.nba_v2_shadow_page(bigint,text),public.nba_v2_shadow_report(bigint,jsonb),public.nba_v2_shadow_review(text) TO service_role;
COMMIT;
