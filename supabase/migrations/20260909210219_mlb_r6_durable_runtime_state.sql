-- R6 PROPOSAL ONLY. Separate production DDL authorization is required.
-- No existing table, row, policy, privilege or business contract is modified.
-- No seed DML: migration does not initialize or reset the mission Odds ledger.
BEGIN;

CREATE TABLE public.pick2_mlb_runtime_state (
  scope_key text PRIMARY KEY CHECK (length(scope_key) BETWEEN 1 AND 160),
  state_kind text NOT NULL CHECK (state_kind IN ('MISSION', 'LEASE', 'RUN')),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  fence bigint NOT NULL DEFAULT 0 CHECK (fence >= 0),
  lease_holder uuid,
  lease_acquired_at timestamptz,
  lease_expires_at timestamptz,
  run_id text CHECK (run_id IS NULL OR run_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  package_sha text CHECK (package_sha IS NULL OR package_sha ~ '^[a-f0-9]{40}$'),
  run_date date,
  run_as_of timestamptz,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETE', 'BLOCKED', 'FAILED')),
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(checkpoint) = 'object' AND octet_length(checkpoint::text) <= 65536),
  dml_accounting jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(dml_accounting) = 'object' AND octet_length(dml_accounting::text) <= 16384),
  mlb_official_calls integer NOT NULL DEFAULT 0 CHECK (mlb_official_calls BETWEEN 0 AND 50),
  statcast_calls integer NOT NULL DEFAULT 0 CHECK (statcast_calls BETWEEN 0 AND 100),
  odds_calls integer NOT NULL DEFAULT 0 CHECK (odds_calls BETWEEN 0 AND 1),
  mission_odds_calls integer CHECK (mission_odds_calls BETWEEN 2 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pick2_mlb_runtime_scope_contract CHECK (
    (state_kind = 'MISSION' AND scope_key = 'MLB_OPERATIONAL_MISSION'
      AND mission_odds_calls IS NOT NULL AND run_id IS NULL)
    OR (state_kind = 'LEASE' AND scope_key = 'MLB_OPERATIONAL_GLOBAL'
      AND mission_odds_calls IS NULL)
    OR (state_kind = 'RUN' AND run_id IS NOT NULL AND scope_key = 'RUN:' || run_id
      AND package_sha IS NOT NULL AND run_date IS NOT NULL AND run_as_of IS NOT NULL
      AND mission_odds_calls IS NULL)
  ),
  CONSTRAINT pick2_mlb_runtime_lease_contract CHECK (
    (lease_holder IS NULL AND lease_acquired_at IS NULL AND lease_expires_at IS NULL)
    OR (state_kind = 'LEASE' AND lease_holder IS NOT NULL
      AND lease_acquired_at IS NOT NULL AND lease_expires_at IS NOT NULL
      AND lease_expires_at > lease_acquired_at
      AND lease_expires_at <= lease_acquired_at + interval '15 minutes')
  ),
  CONSTRAINT pick2_mlb_runtime_counter_scope CHECK (
    state_kind = 'RUN' OR (mlb_official_calls = 0 AND statcast_calls = 0 AND odds_calls = 0)
  )
);

ALTER TABLE public.pick2_mlb_runtime_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.pick2_mlb_runtime_state FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pick2_mlb_runtime_state TO service_role;

COMMENT ON TABLE public.pick2_mlb_runtime_state IS
  'Service-only R6 coordination state. Compact metadata and canonical evidence references only. No raw payloads, secrets or model outputs. Lease/checkpoint/provider reservations require fenced atomic transactions in the runtime adapter. Migration alone does not enable execution.';

COMMIT;
