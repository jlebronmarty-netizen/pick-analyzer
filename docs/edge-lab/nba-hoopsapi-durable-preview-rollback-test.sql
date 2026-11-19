-- Run after migration. All fixture data is rolled back; no provider calls.
begin;
do $$
declare a text := 'test-hoopsapi-'||replace(gen_random_uuid()::text,'-','');
  req uuid := gen_random_uuid(); id uuid; c uuid; v jsonb; t timestamptz; raw text := '{"games":[]}';
  normalized jsonb; digest text; i integer; caught boolean;
begin
  insert into public.nba_hoopsapi_accounts_v1(account_scope,enabled) values(a,true);
  v:=public.claim_nba_hoopsapi_capture_v1(a,req);
  if v->>'status'<>'RESERVED' then raise exception 'TEST_RESERVATION_FAILED'; end if;
  id:=(v->>'attempt_id')::uuid;
  v:=public.claim_nba_hoopsapi_capture_v1(a,req);
  if v->>'status'<>'ALREADY_CLAIMED' then raise exception 'TEST_DEDUP_FAILED'; end if;
  v:=public.claim_nba_hoopsapi_capture_v1(a,gen_random_uuid());
  if v->>'status'<>'REQUEST_IN_PROGRESS_OR_UNCERTAIN' then raise exception 'TEST_CONCURRENT_GUARD_FAILED'; end if;
  v:=public.dispatch_nba_hoopsapi_capture_v1(a,id);
  if v->>'status'<>'DISPATCH_GRANTED' then raise exception 'TEST_DISPATCH_FAILED'; end if;
  v:=public.dispatch_nba_hoopsapi_capture_v1(a,id);
  if v->>'status'<>'DISPATCH_DENIED' then raise exception 'TEST_DUP_DISPATCH_FAILED'; end if;
  t:=clock_timestamp();
  normalized:=jsonb_build_object('provider','hoopsapi','capture_version','NBA_HOOPSAPI_DURABLE_PREVIEW_V2',
    'captured_at',t,'games','[]'::jsonb,'quotes','[]'::jsonb,'coverage',jsonb_build_object('normalized_quote_sides',0));
  digest:=encode(sha256(convert_to(raw,'UTF8')),'hex');
  caught:=false;
  begin
    perform public.complete_nba_hoopsapi_capture_v1(a,id,t,raw,repeat('0',64),normalized);
  exception when others then caught:=true; end;
  if not caught then raise exception 'TEST_BAD_HASH_ACCEPTED'; end if;
  v:=public.complete_nba_hoopsapi_capture_v1(a,id,t,raw,digest,normalized);
  if v->>'status'<>'ARCHIVED' then raise exception 'TEST_ARCHIVE_FAILED'; end if;
  c:=(v->>'capture_id')::uuid;
  v:=public.complete_nba_hoopsapi_capture_v1(a,id,t,raw,digest,normalized);
  if (v->>'capture_id')::uuid<>c then raise exception 'TEST_ARCHIVE_IDEMPOTENCY_FAILED'; end if;
  if (select raw_response from public.nba_hoopsapi_captures_v1 where capture_id=c)<>raw then raise exception 'TEST_RAW_NOT_PRESERVED'; end if;
  caught:=false;
  begin update public.nba_hoopsapi_captures_v1 set raw_response='{}' where capture_id=c;
  exception when others then caught:=true; end;
  if not caught then raise exception 'TEST_IMMUTABILITY_FAILED'; end if;
  v:=public.claim_nba_hoopsapi_capture_v1(a,req);
  if (v->>'capture_id')::uuid<>c then raise exception 'TEST_REPLAY_RECOVERY_FAILED'; end if;
  -- A failed request remains charged. Nine more failures reach ten attempts.
  for i in 2..10 loop
    v:=public.claim_nba_hoopsapi_capture_v1(a,gen_random_uuid());
    if v->>'status'<>'RESERVED' then raise exception 'TEST_SEQUENTIAL_RESERVATION_FAILED'; end if;
    id:=(v->>'attempt_id')::uuid;
    perform public.dispatch_nba_hoopsapi_capture_v1(a,id);
    perform public.fail_nba_hoopsapi_capture_v1(a,id,'TRANSPORT_UNKNOWN',null,null);
  end loop;
  v:=public.claim_nba_hoopsapi_capture_v1(a,gen_random_uuid());
  if v->>'status'<>'APP_QUOTA_EXHAUSTED' then raise exception 'TEST_ELEVENTH_NOT_BLOCKED'; end if;
  -- Simulate expired historical reservations in this rolled-back fixture only.
  update public.nba_hoopsapi_attempts_v1 set reserved_at=clock_timestamp()-interval '25 hours',
    dispatched_at=clock_timestamp()-interval '25 hours' where account_scope=a;
  v:=public.claim_nba_hoopsapi_capture_v1(a,gen_random_uuid());
  if v->>'status'<>'RESERVED' then raise exception 'TEST_ROLLING_WINDOW_EXPIRY_FAILED'; end if;
  id:=(v->>'attempt_id')::uuid; perform public.dispatch_nba_hoopsapi_capture_v1(a,id);
  perform public.fail_nba_hoopsapi_capture_v1(a,id,'PROVIDER_429',429,3600);
  v:=public.claim_nba_hoopsapi_capture_v1(a,gen_random_uuid());
  if v->>'status'<>'ACCOUNT_COOLDOWN' then raise exception 'TEST_PROVIDER_429_COOLDOWN_FAILED'; end if;
  -- Anonymous/authenticated execution and archive mutations must not be granted.
  if has_function_privilege('anon','public.claim_nba_hoopsapi_capture_v1(text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.claim_nba_hoopsapi_capture_v1(text,uuid)','EXECUTE')
     or has_table_privilege('anon','public.nba_hoopsapi_captures_v1','SELECT')
     or has_table_privilege('authenticated','public.nba_hoopsapi_captures_v1','SELECT')
     or has_table_privilege('service_role','public.nba_hoopsapi_captures_v1','UPDATE') then raise exception 'TEST_PRIVILEGES_FAILED'; end if;
  raise notice 'HOOPSAPI_DURABLE_DB_CONTRACT_TEST_PASS';
end;
$$;
select 'HOOPSAPI_DURABLE_DB_CONTRACT_TEST_PASS' as result;
rollback;
