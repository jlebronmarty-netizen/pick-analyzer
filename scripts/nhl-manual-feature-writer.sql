-- Bind values, never interpolate JSON into SQL.
-- $1: source_run_id; $2: SHA-256 of the exact published dataset bytes;
-- $3: JSON.stringify(dataset.featuresSnapshot), unchanged canonical payloads.
-- Execute as the database SQL owner. service_role intentionally has SELECT only.
select event_id, status, available_as_of, inserted_at
from public.append_nhl_manual_feature_snapshots_v1($1::text, $2::text, $3::jsonb);
