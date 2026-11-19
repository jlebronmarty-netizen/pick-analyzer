import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sportsApiTtLeagueId,sportsApiTtFinals,ttSportsApiOutcome,ttSportsApiTargetDays,sportsApiTtPlayerMatches,sportsApiTtUniqueAssignments} from '../src/lib/edge-lab/tt-sportsapi-results.mjs';
import {sportsApiTtSupplement} from '../src/lib/edge-lab/tt-sportsapi-client.mjs';

const captured='2026-11-19T01:00:00Z',date='2026-11-18',league={id:42,name:'TT Elite Series'};
const game=(opts={})=>({
 id:701,sport:'table-tennis',league,status:{type:'finished'},winner:'home',
 startTime:'2026-11-18T17:00:00Z',home:{id:1,name:'Alpha One'},
 away:{id:2,name:'Beta Two'},homeScore:{current:3,periods:{period1:11,period2:11,period3:11}},
 awayScore:{current:0,periods:{period1:8,period2:9,period3:7}},...opts
});
const body=(games=[game()],day=date)=>({data:games,meta:{date:day,hasNextPage:false,count:games.length}});
const forecast=(market='MONEYLINE',details={})=>({
 id:'fc-'+market,sport:'TT',event_id:'netbet:1-701',status:market==='TOTAL_POINTS'?'PROJECTION':'FORECAST',
 market,scheduled_at:'2026-11-18T17:00:00Z',emitted_at:'2026-11-18T12:00:00Z',
 participant_a:'Alpha One',participant_b:'Beta Two',
 selection:market==='MONEYLINE'?'A':market==='SETS_ODD_EVEN'?'ODD':null,
 line:null,projection:58,...details
});
test('discover ONLY the exact free table-tennis league, not another sport or namesake',()=>{
 assert.equal(sportsApiTtLeagueId({data:[{id:42,type:'league',sport:'table-tennis',name:'TT Elite Series'}],meta:{hasNextPage:false}}),42);
 assert.equal(sportsApiTtLeagueId({data:[{id:33,type:'league',sport:'tennis',name:'TT Elite Series'}]}),null);
 assert.equal(sportsApiTtLeagueId({data:[{id:42,type:'league',sport:'table-tennis',name:'TT Elite Series'},{id:43,type:'league',sport:'table-tennis',name:'TT Elite Series'}]}),null);
});
test('normalize exact finished sets, all rally points and authentic total',()=>{
 const out=sportsApiTtFinals(body(),{leagueId:42,capturedAt:captured,requestedDay:date});
 assert.equal(out.verifiedCount,1);
 assert.equal(out.rows[0].setsA,3);assert.equal(out.rows[0].setsB,0);
 assert.equal(out.rows[0].pointsComplete,true);
 assert.equal(out.rows[0].totalPoints,57);
 assert.deepEqual(out.rows[0].setPoints,[[11,8],[11,9],[11,7]]);
});
test('finish without full period scores settles ML / sets, but leaves numeric total pending',()=>{
 const fixture=game({homeScore:{current:3,periods:{}},awayScore:{current:0,periods:{}}});
 const out=sportsApiTtFinals(body([fixture]),{leagueId:42,capturedAt:captured,requestedDay:date}).rows;
 assert.equal(out.length,1);assert.equal(out[0].pointsComplete,false);
 assert.equal(ttSportsApiOutcome(forecast(),out).status,'W');
 assert.equal(ttSportsApiOutcome(forecast('SETS_ODD_EVEN'),out).status,'W');
 assert.equal(ttSportsApiOutcome(forecast('TOTAL_POINTS'),out).status,'PENDING');
});
test('complete 3-0 final settles numeric total only with validated point sum',()=>{
 const rows=sportsApiTtFinals(body(),{leagueId:42,capturedAt:captured,requestedDay:date}).rows;
 const result=ttSportsApiOutcome(forecast('TOTAL_POINTS'),rows);
 assert.equal(result.status,'NUMERIC');assert.equal(result.actual,57);assert.equal(result.absolute_error,1);
});
test('winner selection works when provider reverses frozen player orientation',()=>{
 const reversed=game({
  home:{id:2,name:'Beta Two'},away:{id:1,name:'Alpha One'},winner:'home'
 });
 const rows=sportsApiTtFinals(body([reversed]),{leagueId:42,capturedAt:captured,requestedDay:date}).rows;
 assert.equal(ttSportsApiOutcome(forecast('MONEYLINE',{selection:'A'}),rows).status,'L');
 assert.equal(ttSportsApiOutcome(forecast('MONEYLINE',{selection:'B'}),rows).status,'W');
});
test('reject other leagues, live, wrong winner and invalid final scores',()=>{
 const out=sportsApiTtFinals(body([
  game({id:11,league:{id:42,name:'Other League'}}),
  game({id:12,status:{type:'inprogress'}}),
  game({id:13,winner:'away'}),
  game({id:14,homeScore:{current:2,periods:{}},awayScore:{current:2,periods:{}}})
 ]),{leagueId:42,capturedAt:captured,requestedDay:date});
 assert.equal(out.verifiedCount,0);
 assert.equal(out.excluded.WINNER_CONFLICT,1);
 assert.equal(out.excluded.INVALID_DECISIVE_SETS,1);
});
test('reject ambiguous same-name finals and pre-emission result',()=>{
 const games=sportsApiTtFinals(body([game(),game({id:702})]),{leagueId:42,capturedAt:captured,requestedDay:date}).rows;
 assert.equal(ttSportsApiOutcome(forecast(),games).status,'DISPUTE');
 assert.equal(ttSportsApiOutcome(forecast('MONEYLINE',{emitted_at:'2026-11-19T01:10:00Z'}),games.slice(0,1)).status,'PENDING');
});
test('reject wrong day or incomplete pagination; never invent a final',()=>{
 assert.throws(()=>sportsApiTtFinals({...body(),meta:{date,hasNextPage:true}},{leagueId:42,capturedAt:captured,requestedDay:date}));
 assert.equal(sportsApiTtFinals(body([game({startTime:'2026-11-17T17:00:00Z'})]),{leagueId:42,capturedAt:captured,requestedDay:date}).verifiedCount,0);
});
test('plan only unsettled past free-retention-window dates, dedupe markets',()=>{
 const rows=[forecast(),forecast('SETS_ODD_EVEN'),
  forecast('MONEYLINE',{id:'old',event_id:'netbet:old',scheduled_at:'2026-11-09T10:00:00Z'}),
  forecast('MONEYLINE',{id:'future',event_id:'netbet:future',scheduled_at:'2026-11-21T10:00:00Z'})];
 assert.deepEqual(ttSportsApiTargetDays(rows,[],'2026-11-19T02:00:00Z'),['2026-11-18']);
 assert.deepEqual(ttSportsApiTargetDays(rows,[{forecast_id:'fc-MONEYLINE'},{forecast_id:'fc-SETS_ODD_EVEN'}],'2026-11-19T02:00:00Z'),[]);
});
test('client makes max three free calls, no credential echoed in returned receipts',async()=>{
 const urls=[];
 const fakeFetch=async(url,options)=>{
  urls.push(url);assert.equal(options.headers.Authorization,'Bearer SECRET_TEST_TOKEN');
  return {ok:true,text:async()=>JSON.stringify(url.includes('/search')?
   {data:[{id:42,type:'league',sport:'table-tennis',name:'TT Elite Series'}],meta:{hasNextPage:false}}:body())};
 };
 const out=await sportsApiTtSupplement({key:'SECRET_TEST_TOKEN',forecasts:[forecast()],outcomes:[],
  now:'2026-11-19T02:00:00Z',fetchFn:fakeFetch});
 assert.equal(out.status,'RETRIEVED');
 assert.equal(out.calls,2);assert.equal(out.finals.length,1);
 assert.ok(!JSON.stringify(out).includes('SECRET_TEST_TOKEN'));
 assert.equal(urls[1],'https://api.sportsapi.app/v2/fixtures?date=2026-11-18&league=42');
});
test('free daily quota guard makes no calls if remaining allowance is zero',async()=>{
 let called=0;
 const r=await sportsApiTtSupplement({key:'SECRET_TEST_TOKEN',forecasts:[forecast()],outcomes:[],
  now:'2026-11-19T02:00:00Z',maxCalls:0,fetchFn:async()=>{called++;throw Error('MUST_NOT_CALL');}});
 assert.equal(r.status,'DAILY_CALL_CAP');assert.equal(r.calls,0);assert.equal(called,0);
});
test('one remaining call without pinned league id cannot waste discovery-only quota',async()=>{
 let called=0;
 const r=await sportsApiTtSupplement({key:'SECRET_TEST_TOKEN',forecasts:[forecast()],outcomes:[],
  now:'2026-11-19T02:00:00Z',maxCalls:1,fetchFn:async()=>{called++;throw Error('MUST_NOT_CALL');}});
 assert.equal(r.status,'INSUFFICIENT_CALL_BUDGET_FOR_DISCOVERY');assert.equal(called,0);
});
test('provider errors fail closed without retry or hidden extra calls',async()=>{
 const result=await sportsApiTtSupplement({key:'SECRET_TEST_TOKEN',forecasts:[forecast()],outcomes:[],
  now:'2026-11-19T02:00:00Z',fetchFn:async()=>({ok:false,status:429})});
 assert.equal(result.status,'UNAVAILABLE');assert.equal(result.calls,1);
 assert.equal(result.finals.length,0);
 assert.deepEqual(result.errors,['SPORTSAPI_TT_QUOTA_OR_RATE_LIMIT']);
});
test('source integration remains flag/key gated and keeps PulseScore prematch untouched',()=>{
 const service=fs.readFileSync('src/services/edge-lab-multi.service.mjs','utf8');
 assert.ok(service.includes("process.env.SPORTSAPI_TT_RESULTS_MODE??'OFF'"));
 assert.ok(service.includes('process.env.SPORTSAPI_TT_API_KEY'));
 assert.ok(service.includes("source:'SportsAPI.app v2 TT Elite Series (results only)'"));
 assert.ok(service.includes('const original=ttOutcome(f,history.finals)'));
 assert.ok(service.includes('if(original.status!==\'PENDING\')return original'));
 assert.ok(service.includes("paidRead(db,request,'prematch',1,summary)"));
 assert.ok(service.includes("if(sport==='MLB' && process.env.MLB_OFFSEASON_PAUSED==='true')"));
});

test('SportsAPI surname + initial matches only supported exact first-initial family name',()=>{
 assert.equal(sportsApiTtPlayerMatches('Szymon Brud','Brud S.'),true);
 assert.equal(sportsApiTtPlayerMatches('Brud Szymon','Brud S.'),true);
 assert.equal(sportsApiTtPlayerMatches('Miroslaw Lewczuk','Lewczuk M.'),true);
 assert.equal(sportsApiTtPlayerMatches('Łukasz Bladziak','Bladziak L.'),true);
 assert.equal(sportsApiTtPlayerMatches('Rafal Stapor','Stapor Rafał'),true);
 assert.equal(sportsApiTtPlayerMatches('Szymon Brud','Brud J.'),false);
 assert.equal(sportsApiTtPlayerMatches('Szymon Brud','B. S.'),false);
 assert.equal(sportsApiTtPlayerMatches('Szymon Brud','S.'),false);
 assert.equal(sportsApiTtPlayerMatches('Szymon Brud','Bru S.'),false);
});
test('SHADOW historical-type pair: NetBet full names vs SportsAPI Polish initials',()=>{
 const f=forecast('MONEYLINE',{
  event_id:'netbet:1-31605372',
  scheduled_at:'2026-11-18T20:15:00Z',
  emitted_at:'2026-11-18T18:00:00Z',
  participant_a:'Arkadiusz Mugowski',
  participant_b:'Szymon Brud',
  selection:'A'});
 const results=sportsApiTtFinals(body([game({
  id:1112241,startTime:'2026-11-18T20:15:00Z',
  home:{name:'Mugowski A.'},away:{name:'Brud S.'},
  homeScore:{current:3,periods:{period1:11,period2:11,period3:11}},
  awayScore:{current:0,periods:{period1:5,period2:9,period3:6}}
 })]),{leagueId:42,capturedAt:captured,requestedDay:date}).rows;
 assert.equal(results.length,1);
 assert.equal(ttSportsApiOutcome(f,results).status,'W');
 assert.equal(ttSportsApiOutcome({...f,market:'TOTAL_POINTS',status:'PROJECTION',projection:53},results).status,'NUMERIC');
});
test('two NetBet events with overlapping surname-initial pairs cannot use same final',()=>{
 const games=sportsApiTtFinals(body([game({home:{name:'Brud S.'},away:{name:'Mugowski A.'}})]),
  {leagueId:42,capturedAt:captured,requestedDay:date}).rows;
 const a=forecast('MONEYLINE',{participant_a:'Szymon Brud',participant_b:'Arkadiusz Mugowski'});
 const b={...a,id:'other',event_id:'netbet:other',participant_a:'Sebastian Brud'};
 const matches=sportsApiTtUniqueAssignments([a,b],games);
 assert.equal(matches.matchedEvents,0);
 assert.equal(matches.ambiguousEvents,2);
});
test('two SportsAPI matches at same time for one NetBet match remain unassigned',()=>{
 const two=sportsApiTtFinals(body([game({home:{name:'Brud S.'},away:{name:'Mugowski A.'}}),
  game({id:702,home:{name:'Brud S.'},away:{name:'Mugowski A.'}})]),
  {leagueId:42,capturedAt:captured,requestedDay:date}).rows;
 const a=forecast('MONEYLINE',{participant_a:'Szymon Brud',participant_b:'Arkadiusz Mugowski'});
 const result=sportsApiTtUniqueAssignments([a],two);
 assert.equal(result.matchedEvents,0);assert.equal(result.ambiguousEvents,1);
});
test('one unique provider final safely applies across exactly three markets of same frozen event',()=>{
 const rows=sportsApiTtFinals(body([game({home:{name:'Brud S.'},away:{name:'Mugowski A.'}})]),
  {leagueId:42,capturedAt:captured,requestedDay:date}).rows;
 const mk=(market)=>forecast(market,{participant_a:'Szymon Brud',participant_b:'Arkadiusz Mugowski'});
 const result=sportsApiTtUniqueAssignments(['MONEYLINE','SETS_ODD_EVEN','TOTAL_POINTS'].map(mk),rows);
 assert.equal(result.matchedEvents,1);
 for(const m of ['MONEYLINE','SETS_ODD_EVEN','TOTAL_POINTS'])assert.ok(['W','L','NUMERIC'].includes(
  ttSportsApiOutcome(mk(m),result.byEvent.get(mk(m).event_id)).status));
});
