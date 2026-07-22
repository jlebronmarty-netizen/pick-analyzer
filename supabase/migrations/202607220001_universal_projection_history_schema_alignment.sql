-- Align production universal_projection_history with the v1 projection contract.
-- Additive only: no row deletion, no column removal, no destructive type changes.
-- Existing rows remain valid because all added columns are nullable.

alter table universal_projection_history
  add column if not exists squared_error numeric,
  add column if not exists identity_confidence numeric,
  add column if not exists internal_player_id text,
  add column if not exists model_version text,
  add column if not exists participation_status text,
  add column if not exists projection_origin text,
  add column if not exists provider_player_id text,
  add column if not exists rank_score numeric,
  add column if not exists rank_tier text,
  add column if not exists starter_status text,
  add column if not exists unit text,
  add column if not exists validity_status text,
  add column if not exists invalidation_reason text;

create index if not exists universal_projection_history_model_idx
  on universal_projection_history (sport_key, model_version, generated_at desc);

create index if not exists universal_projection_history_rank_idx
  on universal_projection_history (sport_key, rank_tier, rank_score desc);

-- Rollback approach:
-- If rollback is ever required, leave these nullable columns in place and roll back
-- application reads/writes first. Dropping columns is intentionally not included
-- because projection history is an audit table and the migration is additive.
