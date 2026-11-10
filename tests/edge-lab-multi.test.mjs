import test from 'node:test';import assert from 'node:assert/strict';import {normalizeTtFinal,normalizeTtResults,canonicalTtHistory,ttForecasts,ttOutcome,parseMlbSchedule,mlbForecasts,mlbOutcome,multiMetrics} from '../src/lib/edge-lab/multisport.mjs';import {planTtRecovery} from '../src/lib/edge-lab/tt-pending-recovery.mjs';
const receipt='2026-11-04T20:00:00Z',base={sport:'table-tennis',league:'TT Elite Series',eventId:'x1',home:'One A',away:'Two B',startTime:'2026-11-03T10:00:00Z',score:{home:3,away:0},statistics:{sets:{home:[11,11,11],away:[8,9,7]}},settlement:{final:true,inPlay:false}};
test('TT complete final derives total and sets',()=>{const r=normalizeTtFinal(base,receipt);assert.equal(r.ok,true);assert.equal(r.row.totalPoints,57);assert.equal(r.row.setsA,3);});
test('TT rejects explicit nonfinal',()=>assert.equal(normalizeTtFinal({...base,settlement:{final:false}},receipt).ok,false));
test('TT rejects live',()=>assert.equal(normalizeTtFinal({...base,settlement:{inPlay:true}},receipt).ok,false));
test('TT rejects wrong competition',()=>assert.equal(normalizeTtFinal({...base,league:'Other'},receipt).reason,'OUT_OF_SCOPE'));
test('TT rejects contradictory score',()=>assert.equal(normalizeTtFinal({...base,score:{home:1,away:0}},receipt).reason,'SCORE_CONFLICT'));
test('TT rejects incomplete set',()=>assert.equal(normalizeTtFinal({...base,statistics:{sets:{home:[11,11,10],away:[8,9,9]}}},receipt).reason,'INCOMPLETE_SET'));
test('TT accepts proper deuce',()=>assert.equal(normalizeTtFinal({...base,statistics:{sets:{home:[13,11,11],away:[11,9,7]}}},receipt).ok,true));
test('TT rejects set after victory',()=>assert.equal(normalizeTtFinal({...base,statistics:{sets:{home:[11,11,11,11],away:[8,9,7,9]}}},receipt).reason,'INVALID_SET_SEQUENCE'));
test('TT future result rejected',()=>assert.equal(normalizeTtFinal({...base,startTime:'2026-11-05T20:00Z'},receipt).reason,'FUTURE_FINAL'));
test('TT missing body is failure not empty',()=>assert.throws(()=>normalizeTtResults({},receipt)));
test('TT empty valid list has explicit pagination',()=>{const p=normalizeTtResults({results:[],pagination:{hasNextPage:false}},receipt);assert.equal(p.received,0);assert.equal(p.paginationVerified,true);});
const finals=Array.from({length:3},(_,i)=>normalizeTtFinal({...base,eventId:'x'+i,startTime:`2026-11-0${i+1}T10:00Z`},receipt).row);
test('Repeated final deduplicated by content',()=>assert.equal(canonicalTtHistory([...finals,finals[0]]).finals.length,3));
test('Conflicting final versions excluded',()=>{const r=canonicalTtHistory([...finals,{...finals[0],contentDigest:'different',setsA:0,setsB:3}]);assert.equal(r.finals.length,2);assert.equal(r.conflicts.length,1);});
const event={eventId:'n1',home:'One A',away:'Two B',startTime:'2026-11-05T10:00Z',league:'TT Elite Series',gameStatus:'SCHEDULED',markets:[]};
test('TT cold start creates three abstentions',()=>assert.ok(ttForecasts({events:[event]},[],receipt,'s').rows.every(r=>r.status==='ABSTAIN')));
test('TT total without line is numeric projection',()=>{const r=ttForecasts({events:[event]},finals,receipt,'s').rows;assert.equal(r.length,3);assert.equal(r.find(x=>x.market==='TOTAL_POINTS').status,'PROJECTION');});
test('TT exact total preserves original line',()=>{const rows=ttForecasts({events:[{...event,markets:[{period:'FULL_TIME',canonicalMarket:'OVER_UNDER',line:60.5}]}]},finals,receipt,'s').rows;const r=rows.find(x=>x.market==='TOTAL_POINTS');assert.equal(r.line,60.5);assert.equal(r.selection,'UNDER');});
test('TT alternate totals not guessed',()=>{const rows=ttForecasts({events:[{...event,markets:[58.5,60.5].map(line=>({period:'FULL_TIME',canonicalMarket:'OVER_UNDER',line}))}]},finals,receipt,'s').rows;assert.equal(rows.find(x=>x.market==='TOTAL_POINTS').status,'PROJECTION');});
test('TT rejects duplicate upcoming identifiers',()=>assert.throws(()=>ttForecasts({events:[event,event]},finals,receipt,'s')));
test('TT already started excluded',()=>assert.equal(ttForecasts({events:[{...event,startTime:receipt}]},finals,receipt,'s').rows.length,0));
test('TT live flag excluded',()=>assert.equal(ttForecasts({events:[{...event,isLive:true}]},finals,receipt,'s').rows.length,0));
const f={event_id:'netbet:n1',participant_a:'One A',participant_b:'Two B',scheduled_at:'2026-11-05T10:00:00Z',emitted_at:receipt,market:'MONEYLINE',selection:'A',status:'FORECAST',payload:{}};
const result={...finals[0],sourceMatchId:'newfinal',scheduledAt:f.scheduled_at,capturedAt:'2026-11-05T11:00Z'};
test('TT cross-book unique match evaluates',()=>assert.equal(ttOutcome(f,[result]).status,'W'));
test('TT reversed participants handled',()=>assert.equal(ttOutcome(f,[{...result,playerA:'Two B',playerB:'One A',setsA:0,setsB:3}]).status,'W'));
test('TT ambiguous time match disputes',()=>assert.equal(ttOutcome(f,[result,{...result,sourceMatchId:'another'}]).status,'DISPUTE'));
test('TT final known before emission rejected',()=>assert.equal(ttOutcome(f,[{...result,capturedAt:receipt}]).status,'DISPUTE'));
test('TT exact integer push',()=>assert.equal(ttOutcome({...f,market:'TOTAL_POINTS',line:57,projection:55,selection:'UNDER'},[result]).status,'PUSH'));
test('TT unpriced numeric MAE not W',()=>{const r=ttOutcome({...f,market:'TOTAL_POINTS',status:'PROJECTION',line:null,projection:55,selection:null},[result]);assert.equal(r.status,'NUMERIC');assert.equal(r.absolute_error,2);});
const game={gamePk:1,gameDate:'2026-05-03T18:00Z',gameType:'R',teams:{home:{team:{id:1,name:'Home'},score:4},away:{team:{id:2,name:'Away'},score:2}},status:{abstractGameState:'Final',codedGameState:'F',startTimeTBD:false}};
const calendar=(...games)=>({totalGames:games.length,dates:[{games}]});
test('MLB postponement followed by final counts once',()=>{const p={...game,gameDate:'2026-05-02T18:00Z',status:{...game.status,codedGameState:'D'}};const r=parseMlbSchedule(calendar(p,game));assert.equal(r.length,1);assert.equal(r[0].code,'F');assert.equal(r[0].prior_schedule_versions.length,1);});
test('MLB exact duplicates count once',()=>assert.equal(parseMlbSchedule(calendar(game,game)).length,1));
test('MLB conflicting finals rejected',()=>assert.throws(()=>parseMlbSchedule(calendar(game,{...game,gameDate:'2026-05-04T18:00Z'}))));
test('MLB team identity conflict rejected',()=>assert.throws(()=>parseMlbSchedule(calendar(game,{...game,teams:{...game.teams,home:{team:{id:3,name:'Other'}}}}))));
test('MLB malformed list is not empty slate',()=>assert.throws(()=>parseMlbSchedule({})));
test('MLB total count mismatch rejected',()=>assert.throws(()=>parseMlbSchedule({...calendar(game),totalGames:2})));
test('MLB valid no-game window allowed',()=>assert.deepEqual(parseMlbSchedule({dates:[],totalGames:0}),[]));
const scheduled=parseMlbSchedule(calendar({...game,gameDate:'2026-11-05T18:00Z',status:{abstractGameState:'Preview',codedGameState:'S',startTimeTBD:false}}))[0];
const mlbHistory=Array.from({length:20},(_,i)=>({...parseMlbSchedule(calendar(game))[0],id:String(i+10)}));
test('MLB warmup creates abstentions',()=>assert.ok(mlbForecasts([scheduled],[],receipt,'s').rows.every(r=>r.status==='ABSTAIN')));
test('MLB three markets with exact original weights',()=>{const r=mlbForecasts([scheduled],mlbHistory,receipt,'s');assert.equal(r.rows.length,3);assert.equal(r.rows.filter(x=>x.status==='FORECAST').length,1);assert.equal(r.rows.filter(x=>x.status==='PROJECTION').length,2);assert.equal(r.rows.find(x=>x.market==='HOME_TEAM_RUNS').projection,4);});
test('MLB postseason never mixed with regular',()=>{const r=mlbForecasts([{...scheduled,gameType:'W'}],mlbHistory,receipt,'s');assert.equal(r.rows.length,0);assert.equal(r.skipped[0].reason,'UNVALIDATED_PHASE');});
test('MLB forecasts same ID on retry',()=>assert.deepEqual(mlbForecasts([scheduled],mlbHistory,receipt,'s').rows.map(x=>x.id),mlbForecasts([scheduled],mlbHistory,'2026-11-04T20:01Z','s').rows.map(x=>x.id)));
test('MLB numerical results are MAE not accuracy',()=>{const f=mlbForecasts([scheduled],mlbHistory,receipt,'s').rows.find(x=>x.market==='HOME_TEAM_RUNS');const r=mlbOutcome(f,{...scheduled,code:'F',home:{...scheduled.home,score:5},away:{...scheduled.away,score:2}});assert.equal(r.status,'NUMERIC');assert.equal(r.absolute_error,1);});
test('Metrics separate outcomes and projection errors',()=>{const base={sport:'TT',market:'TOTAL_POINTS',model_version:'v',phase:'p'};const r=multiMetrics([{...base,status:'FORECAST',outcome:{status:'W'}},{...base,status:'FORECAST',outcome:{status:'L'}},{...base,status:'PROJECTION',outcome:{status:'NUMERIC',absolute_error:2}},{...base,status:'ABSTAIN'}])[0];assert.equal(r.accuracy,.5);assert.equal(r.evaluable,2);assert.equal(r.mae,2);assert.equal(r.abstentions,1);});
test('Zero evaluables never returns a fixed percentage',()=>assert.equal(multiMetrics([{sport:'TT',market:'MONEYLINE',model_version:'v',phase:'p',status:'ABSTAIN'}])[0].accuracy,null));

test('TT recovery plans two oldest/fair overdue events and remembers multi-target attempts',()=>{
 const now=new Date('2026-11-10T12:00:00Z');
 const mk=(id,at,a,b)=>({id:id+'-ml',sport:'TT',event_id:id,status:'FORECAST',market:'MONEYLINE',scheduled_at:at,participant_a:a,participant_b:b});
 const forecasts=[
  mk('e1','2026-11-08T10:00:00Z','Alpha One','Beta Two'),
  mk('e2','2026-11-08T11:00:00Z','Gamma Three','Delta Four'),
  mk('e3','2026-11-08T12:00:00Z','Epsilon Five','Zeta Six'),
 ];
 const first=planTtRecovery(forecasts,[],[],[],now);
 assert.equal(first.targets.length,2);assert.deepEqual(first.targets.map(x=>x.event_id),['e1','e2']);
 const runs=[{sport:'TT',started_at:'2026-11-10T11:00:00Z',summary:{recoveries:[{event_id:'e1',next_page:2,next_side:'A'},{event_id:'e2',next_page:1,next_side:'B'}]}}];
 const next=planTtRecovery(forecasts,[],[],runs,now);
 assert.equal(next.targets.length,2);assert.equal(next.targets[0].event_id,'e3');
});
