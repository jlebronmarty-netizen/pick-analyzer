revoke all on public.nhl_free_quote_observations_v1 from public,anon,authenticated,service_role;
grant select,insert on public.nhl_free_quote_observations_v1 to service_role;
revoke all on public.nhl_free_latest_quotes_v1 from public,anon,authenticated,service_role;
grant select on public.nhl_free_latest_quotes_v1 to service_role;
