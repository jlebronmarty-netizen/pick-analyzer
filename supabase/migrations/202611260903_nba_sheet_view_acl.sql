-- Limit these invoker views to non-delegable SELECT for the tracker reader.
-- RESTRICT (the default) preserves downstream grants by failing if any need review.
revoke all privileges on table
  public.nba_sheet_accuracy_v1, public.nba_sheet_performance_v1,
  public.nba_sheet_pending_v1, public.nba_sheet_pending_games_v1
from public, anon, authenticated, service_role restrict;
grant select on table
  public.nba_sheet_accuracy_v1, public.nba_sheet_performance_v1,
  public.nba_sheet_pending_v1, public.nba_sheet_pending_games_v1
to service_role;

-- Verify effective privileges, including grants through role membership.
do $$
declare
  view_id regclass;
  reader text;
  privilege_name text;
  expected boolean;
begin
  foreach view_id in array array[
    'public.nba_sheet_accuracy_v1'::regclass, 'public.nba_sheet_performance_v1'::regclass,
    'public.nba_sheet_pending_v1'::regclass, 'public.nba_sheet_pending_games_v1'::regclass
  ] loop
    if not exists (select 1 from pg_class where oid=view_id and relkind='v'
                   and reloptions @> array['security_invoker=true']) then
      raise exception 'Missing invoker protection on %', view_id;
    end if;
    foreach reader in array array['service_role','anon','authenticated'] loop
      foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
        expected := reader='service_role' and privilege_name='SELECT';
        if has_table_privilege(reader,view_id,privilege_name) <> expected or
           has_table_privilege(reader,view_id,privilege_name || ' WITH GRANT OPTION') then
          raise exception 'Unexpected table privilege for % on % (%)', reader,view_id,privilege_name;
        end if;
        if privilege_name in ('SELECT','INSERT','UPDATE','REFERENCES') then
          if has_any_column_privilege(reader,view_id,privilege_name) <> expected or
             has_any_column_privilege(reader,view_id,privilege_name || ' WITH GRANT OPTION') then
            raise exception 'Unexpected column privilege for % on % (%)', reader,view_id,privilege_name;
          end if;
        end if;
      end loop;
    end loop;
  end loop;
end $$;
