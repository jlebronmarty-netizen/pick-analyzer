-- Apply together with storage-proposal.sql, in the same owner transaction.
-- A future SHADOW writer requires separate authorization and explicit grants.
REVOKE ALL ON ALL TABLES IN SCHEMA nba_v2_shadow FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA nba_v2_shadow TO service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA nba_v2_shadow FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.nba_v2_shadow_commit(text,timestamptz,jsonb),
 public.nba_v2_shadow_report(bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE nba_v2_shadow.observation_window (
 deployment_sha text PRIMARY KEY CHECK (deployment_sha ~ '^[0-9a-f]{40}$'),
 hostname text NOT NULL CHECK (hostname ~ '^pick-analyzer-[a-z0-9-]+\.vercel\.app$'),
 opened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 closed_at timestamptz,
 CHECK (expires_at > opened_at AND expires_at <= opened_at + interval '10 minutes')
);
REVOKE ALL ON nba_v2_shadow.observation_window FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON nba_v2_shadow.observation_window TO service_role;
ALTER TABLE nba_v2_shadow.observation_window ENABLE ROW LEVEL SECURITY;
CREATE POLICY observation_service_read ON nba_v2_shadow.observation_window FOR SELECT TO service_role USING (true);
CREATE FUNCTION public.nba_v2_shadow_observe_allowed(p_sha text,p_host text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT FROM nba_v2_shadow.observation_window WHERE deployment_sha=p_sha AND hostname=p_host
  AND closed_at IS NULL AND statement_timestamp()>=opened_at AND statement_timestamp()<expires_at)
$$;
REVOKE ALL ON FUNCTION public.nba_v2_shadow_observe_allowed(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nba_v2_shadow_observe_allowed(text,text) TO service_role;
