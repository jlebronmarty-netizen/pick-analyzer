do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'prediction_history_unique_pick'
  ) then
    alter table prediction_history
      drop constraint prediction_history_unique_pick;
  end if;
end;
$$;

drop index if exists prediction_history_unique_pick;
