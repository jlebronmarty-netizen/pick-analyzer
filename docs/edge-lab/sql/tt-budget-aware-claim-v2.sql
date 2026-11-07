-- TT_BUDGET_AWARE_CLAIM_V2. Existing signature, privileges, limits and schedules retained.
CREATE OR REPLACE FUNCTION public.edge_lab_multi_claim_v1(p_sport text, p_run uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
 v_now timestamptz := now();
 v_month text; v_day text; v_used integer := 0; v_cap integer := 240;
 v_daily jsonb := '{}'::jsonb; v_day_used integer := 0; v_retry timestamptz;
 n integer;
BEGIN
 IF p_sport IS NULL OR p_sport NOT IN ('TT','MLB','NCAAF') THEN RAISE EXCEPTION 'INVALID_SPORT'; END IF;
 IF p_run IS NULL THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 IF p_sport = 'TT' THEN
  -- Serialize TT claims without blocking another active claimant.
  PERFORM 1 FROM public.edge_lab_multi_locks_v1
   WHERE sport='TT' AND lease_until<v_now AND next_due<=v_now
   FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN false; END IF;
  v_month := to_char(timezone('UTC',v_now),'YYYY-MM');
  v_day := to_char(timezone('UTC',v_now),'YYYY-MM-DD');
  SELECT used,cap,daily INTO v_used,v_cap,v_daily
   FROM public.edge_lab_tt_request_budget_v1 WHERE month=v_month FOR UPDATE;
  IF NOT FOUND THEN v_used:=0;v_cap:=240;v_daily:='{}'::jsonb; END IF;
  IF v_used IS NULL OR v_cap IS NULL OR v_used<0 OR v_cap<0
   OR v_daily IS NULL OR jsonb_typeof(v_daily)<>'object' THEN
   RAISE EXCEPTION 'INVALID_TT_BUDGET';
  END IF;
  IF v_daily ? v_day THEN
   IF jsonb_typeof(v_daily->v_day)<>'number' OR (v_daily->>v_day)!~'^[0-9]+$'
    THEN RAISE EXCEPTION 'INVALID_TT_BUDGET'; END IF;
   v_day_used := (v_daily->>v_day)::integer;
  END IF;
  IF v_day_used>v_used THEN RAISE EXCEPTION 'INVALID_TT_BUDGET'; END IF;
  -- A full collector cycle can use three attempts. Do not start a partial-funded cycle.
  IF v_cap::bigint-v_used<3 THEN
   v_retry := (date_trunc('month',timezone('UTC',v_now))+interval '1 month') AT TIME ZONE 'UTC';
  ELSIF 9::bigint-v_day_used<3 THEN
   v_retry := (date_trunc('day',timezone('UTC',v_now))+interval '1 day') AT TIME ZONE 'UTC';
  END IF;
  IF v_retry IS NOT NULL THEN
   UPDATE public.edge_lab_multi_locks_v1 SET next_due=v_retry WHERE sport='TT';
   RETURN false; -- No run, lease, budget consumption or provider request was created.
  END IF;
 END IF;
 UPDATE public.edge_lab_multi_locks_v1
 SET run_id=p_run,lease_until=v_now+interval '9 minutes',
     next_due=v_now+CASE WHEN p_sport='TT' THEN interval '8 hours' ELSE interval '12 hours' END
 WHERE sport=p_sport AND lease_until<v_now AND next_due<=v_now;
 GET DIAGNOSTICS n=ROW_COUNT;IF n=0 THEN RETURN false;END IF;
 UPDATE public.edge_lab_multi_runs_v1 SET status='FAILED',finished_at=v_now,
  summary=jsonb_build_object('error','PREVIOUS_LEASE_EXPIRED')
 WHERE sport=p_sport AND status='RUNNING' AND started_at<v_now-interval '9 minutes';
 INSERT INTO public.edge_lab_multi_runs_v1(id,sport,status) VALUES(p_run,p_sport,'RUNNING');
 RETURN true;
END $function$;
