-- NBA HoopsAPI: additive atomic auto-capture quota gate.
-- Safe on existing data; does not touch official prediction/model tables.
BEGIN;
ALTER TABLE public.nba_hoopsapi_attempts_v1
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual'
  CHECK (origin IN ('manual','scheduled','external_observed'));
UPDATE public.nba_hoopsapi_attempts_v1 SET origin='external_observed'
  WHERE status='external_observed' AND origin <> 'external_observed';

CREATE OR REPLACE FUNCTION public.claim_nba_hoopsapi_scheduled_capture_v1(p_account text,p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE a public.nba_hoopsapi_accounts_v1;
        prior public.nba_hoopsapi_attempts_v1;
        n integer; per_day integer; t timestamptz; v_id uuid;
BEGIN
  -- Existing account row serializes concurrent manual and automated claims.
  SELECT * INTO a FROM public.nba_hoopsapi_accounts_v1 WHERE account_scope=p_account FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','ACCOUNT_NOT_CONFIGURED'); END IF;
  t:=clock_timestamp();
  SELECT * INTO prior FROM public.nba_hoopsapi_attempts_v1
    WHERE account_scope=p_account AND request_id=p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status','ALREADY_CLAIMED','attempt_id',prior.attempt_id,
      'attempt_status',prior.status,'capture_id',
      (SELECT capture_id FROM public.nba_hoopsapi_captures_v1 WHERE attempt_id=prior.attempt_id));
  END IF;
  IF NOT a.enabled THEN RETURN jsonb_build_object('status','CAPTURE_DISABLED'); END IF;
  IF a.blocked_until>t THEN RETURN jsonb_build_object('status','ACCOUNT_COOLDOWN','retry_at',a.blocked_until); END IF;
  IF EXISTS (SELECT 1 FROM public.nba_hoopsapi_attempts_v1 WHERE account_scope=p_account
    AND ((status='reserved' AND dispatch_deadline>t) OR
         (status='dispatched' AND dispatched_at>t-interval '24 hours'))) THEN
    RETURN jsonb_build_object('status','REQUEST_IN_PROGRESS_OR_UNCERTAIN');
  END IF;

  SELECT count(*) INTO n FROM public.nba_hoopsapi_attempts_v1
    WHERE account_scope=p_account AND coalesce(dispatched_at,reserved_at)>t-interval '24 hours';
  -- Fail closed: two of the provider's ten allowances remain unavailable to the scheduler.
  -- No read-check/write race: account row is locked through the reservation insert.
  IF n >= a.request_cap-2 THEN
    RETURN jsonb_build_object('status','SCHEDULED_RESERVE_FLOOR','charged_attempts_24h',n,'cap',a.request_cap);
  END IF;
  SELECT count(*) INTO per_day FROM public.nba_hoopsapi_attempts_v1
    WHERE account_scope=p_account AND origin='scheduled'
      AND (reserved_at AT TIME ZONE 'America/Puerto_Rico')::date =
          (t AT TIME ZONE 'America/Puerto_Rico')::date;
  IF per_day>=3 THEN
    RETURN jsonb_build_object('status','SCHEDULED_DAILY_CAP','scheduled_attempts_today',per_day);
  END IF;
  INSERT INTO public.nba_hoopsapi_attempts_v1
    (account_scope,request_id,reserved_at,dispatch_deadline,status,origin)
    VALUES(p_account,p_request_id,t,t+interval '15 seconds','reserved','scheduled')
    RETURNING attempt_id INTO v_id;
  RETURN jsonb_build_object('status','RESERVED','attempt_id',v_id,'charged_attempts_24h',n+1,'cap',a.request_cap);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_nba_hoopsapi_scheduled_capture_v1(text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_nba_hoopsapi_scheduled_capture_v1(text,uuid) TO service_role;
COMMIT;
