begin;

alter table public.pick2_game_predictions
  alter column feature_snapshot_id drop not null;

commit;
