import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHoopsNbaList} from '../src/lib/nba/hoopsapi-preview-core.mjs';
import {getHoopsPreviewStatus, captureHoopsPreviewDurably, readHoopsPreviewState, HOOPS_API_PREVIEW_URL} from '../src/services/nba-hoopsapi-preview.service.mjs';
const sample = {games: [
  {game_id: 101, competition: 'NBA', home: 'Home A', away: 'Away B', start_time: '2026-11-19T00:00:00Z',
   updated_at: '2026-11-18T20:00:00Z', periods: {
     q1: {fanduel: {spread: {line: -1.5, home: 1.9, away: 1.9}, total: {line: 55.5, over: 1.87, under: 1.95},
       team_total_home: {line: 28.5, over: 1.91, under: 1.91}}, pinnacle: {total: {line: 56, over: 1.9, under: 1.9}}},
     h1: {fanduel: {total: {line: 113.5, over: 1.95, under: 1.85}}},
     ft: {fanduel: {moneyline: {home: 1.5, away: 2.6}}},
   }},
  {game_id: 102, competition: 'NBA', home: 'Home C', away: 'Away D',
   periods: {q1: {pinnacle: {total: {line: 51.5, over: 1.8, under: 2}}}}},
]};
test('normalize quarter/half quotes and exact spread orientation; no cross-book fallback', () => {
  const out = normalizeHoopsNbaList(sample, '2026-11-18T21:00:00Z');
  assert.equal(out.coverage.nba_games, 2);
  assert.equal(out.coverage.missing_fanduel_games, 1);
  assert.equal(out.coverage.normalized_quote_sides, 10);
  assert.equal(out.coverage.period_quote_sides.q1, 6);
  assert.equal(out.coverage.period_quote_sides.h1, 2);
  assert.equal(out.coverage.period_quote_sides.ft, 2);
  const away = out.quotes.find(q => q.market === 'spread' && q.side === 'away');
  assert.equal(away.line, 1.5);
  assert.equal(away.home_handicap_line, -1.5);
  assert.equal(away.regional_price_verified, false);
  assert.equal(out.quotes.some(q => q.model_probability !== null || q.recommendation !== null || q.sportsbook !== 'FanDuel'), false);
});
test('missing FanDuel is zero-quote, never invented', () => {
  const out = normalizeHoopsNbaList({games: [sample.games[1]]});
  assert.equal(out.status, 'NO_FANDUEL_QUOTES_OBSERVED');
  assert.equal(out.coverage.missing_fanduel_games, 1);
  assert.equal(out.coverage.normalized_quote_sides, 0);
});
test('bad response rejected and missing side remains missing', () => {
  assert.throws(() => normalizeHoopsNbaList({games: null}), /INVALID/);
  const out = normalizeHoopsNbaList({games: [{game_id: 1, home: 'A', away: 'B', competition: 'NBA',
    periods: {q1: {fanduel: {total: {line: 51.5, over: 1, under: 1.9}}}}}]});
  assert.equal(out.coverage.normalized_quote_sides, 1);
  assert.equal(out.coverage.rejected_selection_sides, 1);
  assert.equal(out.quotes[0].side, 'under');
});

function ledger() {
  const attempts = new Map(), captures = new Map();
  let ms = Date.parse('2026-11-18T22:00:00Z'), blockedUntil = 0;
  const clock = () => ms;
  const used = () => [...attempts.values()].filter(a => a.at > ms - 86400000);
  return {
    attempts, captures, clock, advance: delta => { ms += delta; },
    status: async () => ({enabled:true,cap:10,charged_attempts_24h:used().length,remaining_app_reservations:10-used().length,
      blocked_until:blockedUntil>ms?new Date(blockedUntil).toISOString():null,uncertain_or_in_flight:used().some(a=>a.status==='dispatched')}),
    claim: async (scope, id) => {
      const previous = attempts.get(id);
      if (previous) return {status:'ALREADY_CLAIMED',attempt_id:id,capture_id:captures.has(id)?id:null};
      if (blockedUntil > ms) return {status:'ACCOUNT_COOLDOWN'};
      if (used().some(a=>['reserved','dispatched'].includes(a.status))) return {status:'REQUEST_IN_PROGRESS_OR_UNCERTAIN'};
      if (used().length >= 10) return {status:'APP_QUOTA_EXHAUSTED'};
      attempts.set(id,{at:ms,status:'reserved'}); return {status:'RESERVED',attempt_id:id};
    },
    dispatch: async (scope,id) => {
      const attempt=attempts.get(id);
      if(attempt?.status!=='reserved') return {status:'DISPATCH_DENIED'};
      attempt.status='dispatched'; return {status:'DISPATCH_GRANTED'};
    },
    complete: async (scope,id,evidence) => {
      captures.set(id,{...evidence.normalized,raw:evidence.raw,response_sha256:evidence.sha256,capture_persisted:true,capture_id:id});
      attempts.get(id).status='succeeded'; return {status:'ARCHIVED',capture_id:id};
    },
    fail: async (scope,id,failure) => {
      attempts.get(id).status='failed'; attempts.get(id).failure=failure;
      if(failure.code==='PROVIDER_429')blockedUntil=ms+(failure.retrySeconds??86400)*1000;
      return {status:'FAILURE_RECORDED'};
    },
    capture: async (scope,id) => captures.get(id) ?? null,
    latest: async () => [...captures.values()].at(-1) ?? null,
  };
}
const requestId = index => '00000000-0000-4000-8000-' + String(index).padStart(12,'0');
const ok = () => new Response(JSON.stringify(sample),{status:200,headers:{'content-type':'application/json'}});
const base = {key:'fixture_private_key',accountScope:'free-primary'};
const invoke = (store,index,fetcher=async()=>ok()) => captureHoopsPreviewDurably({...base,store,requestId:requestId(index),fetcher,now:()=>new Date(store.clock()).toISOString()});

test('GET status and archive recovery make zero provider calls or writes', async () => {
  const store=ledger();
  const status=getHoopsPreviewStatus({VERCEL_ENV:'preview',HOOPS_API_KEY:'configured'});
  assert.equal(status.enabled,true); assert.equal(status.capture_configured,false);
  assert.equal(status.provider_calls_made,0); assert.equal(status.database_writes,0);
  assert.equal(status.automatic_schedule_enabled,false);
  const out=await readHoopsPreviewState({store,accountScope:'free-primary',env:{
    VERCEL_ENV:'preview',HOOPS_API_KEY:'configured',HOOPS_API_DURABLE_ENABLED:'true',HOOPS_API_ACCOUNT_SCOPE:'free-primary'}});
  assert.equal(out.capture_enabled,true); assert.equal(out.capture,null); assert.equal(store.attempts.size,0);
});

test('persist exact evidence, receipt time, identity and recover completed idempotent request', async () => {
  const store=ledger(); let calls=0;
  const fetcher=async(url,options)=>{
    calls++; assert.equal(url,HOOPS_API_PREVIEW_URL); assert.equal(options.redirect,'error');
    store.advance(2000); return ok();
  };
  const out=await invoke(store,1,fetcher);
  assert.equal(out.capture_persisted,true); assert.equal(calls,1);
  assert.equal(out.captured_at,'2026-11-18T22:00:02.000Z');
  assert.equal(JSON.parse(store.captures.get(requestId(1)).raw).games.length,2);
  const replay=await invoke(store,1,fetcher);
  assert.equal(replay.provider_calls_made,0); assert.equal(replay.request_replayed,true); assert.equal(calls,1);
});

test('concurrent identical and distinct requests never dispatch a second in-flight provider request', async () => {
  for(const duplicate of [true,false]){
    const store=ledger(); let calls=0,release;
    const waiting=new Promise(resolve=>{release=resolve;});
    const fetcher=async()=>{calls++;await waiting;return ok();};
    const first=invoke(store,1,fetcher);
    await new Promise(resolve=>setImmediate(resolve));
    const second=await invoke(store,duplicate?1:2,fetcher);
    assert.equal(second.provider_calls_made,0); assert.equal(calls,1);
    release(); assert.equal((await first).capture_persisted,true);
  }
});

test('ten failures consume ten rolling reservations; eleventh blocked, expiry allows a new call', async () => {
  const store=ledger(); let calls=0;
  const fetcher=async()=>{calls++;throw new Error('untrusted transport detail');};
  for(let i=1;i<=10;i++)assert.equal((await invoke(store,i,fetcher)).failure_recorded,true);
  assert.equal((await invoke(store,11,fetcher)).status,'APP_QUOTA_EXHAUSTED'); assert.equal(calls,10);
  store.advance(86400001);
  assert.equal((await invoke(store,12,fetcher)).provider_calls_made,1);assert.equal(calls,11);
});

test('claim or dispatch DB uncertainty prevents any provider call', async () => {
  for(const method of ['claim','dispatch']){
    const store=ledger(); store[method]=async()=>{throw new Error('database details are private');}; let calls=0;
    const out=await invoke(store,1,async()=>{calls++;return ok();});
    assert.equal(calls,0); assert.equal(out.provider_calls_made,0);
    assert.equal(JSON.stringify(out).includes('database details'),false);
  }
});

test('archive failure preserves downloadable normalized result and blocks another request', async () => {
  const store=ledger(); store.complete=async()=>{throw new Error('write failed');}; let calls=0;
  const fetcher=async()=>{calls++;return ok();};
  const out=await invoke(store,1,fetcher);
  assert.equal(out.status,'HOOPSAPI_ARCHIVE_UNCONFIRMED');assert.equal(out.capture_persisted,false);
  assert.equal(out.quotes.length,10);assert.equal(store.attempts.get(requestId(1)).status,'dispatched');
  assert.equal((await invoke(store,2,fetcher)).provider_calls_made,0);assert.equal(calls,1);
});

test('lost success acknowledgement can be recovered without provider retry', async () => {
  const store=ledger(),complete=store.complete;let calls=0;
  store.complete=async(...args)=>{await complete(...args);throw new Error('ack lost');};
  const fetcher=async()=>{calls++;return ok();};
  assert.equal((await invoke(store,1,fetcher)).capture_persisted,false);
  assert.equal((await store.latest()).capture_persisted,true);
  assert.equal((await invoke(store,1,fetcher)).request_replayed,true);assert.equal(calls,1);
});

test('429 applies cooldown, is charged, has no retry and does not retain provider error body', async () => {
  const store=ledger(); let calls=0;
  const fetcher=async()=>{calls++;return new Response('private-provider-detail',{status:429,headers:{'retry-after':'3600'}});};
  const out=await invoke(store,1,fetcher);
  assert.equal(out.status,'HOOPSAPI_RATE_LIMITED');assert.equal(out.automatic_retry,false);
  assert.equal(store.attempts.get(requestId(1)).failure.retrySeconds,3600);
  assert.equal((await invoke(store,2,fetcher)).status,'ACCOUNT_COOLDOWN');assert.equal(calls,1);
  assert.equal(JSON.stringify(out).includes('private-provider-detail'),false);
});

test('invalid identity, oversized response and credential echo fail closed without archiving', async () => {
  for(const body of ['not-json','x'.repeat(2000001),JSON.stringify({token:base.key,games:[]})]){
    const store=ledger();
    const out=await invoke(store,1,async()=>new Response(body,{status:200}));
    assert.equal(out.capture_persisted,false);assert.equal(out.failure_recorded,true);assert.equal(store.captures.size,0);
    assert.equal(JSON.stringify(out).includes(base.key),false);
  }
  const store=ledger();let calls=0;
  const out=await captureHoopsPreviewDurably({...base,store,requestId:'bad',fetcher:async()=>{calls++;return ok();}});
  assert.equal(out.provider_calls_made,0);assert.equal(calls,0);
});

