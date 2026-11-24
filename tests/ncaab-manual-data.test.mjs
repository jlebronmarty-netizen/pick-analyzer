import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNcaabManualDataReport,unavailableNcaabManualDataReport} from '../src/lib/ncaab-manual-data.ts';
import {ncaabArchiveUrl} from '../src/lib/ncaab-archived-evidence.ts';

const date='2026-11-24',readAt='2026-11-24T12:00:00Z';
const stat=(name,displayValue)=>({name,displayValue:String(displayValue)});
function rawGame({id='100',at='2026-11-24T18:00:00Z',home='11',away='22',state='pre',h=80,a=70,record='2-0',neutral=false,season=2027,
  homeStats=[],awayStats=[],homePeriods=[40,40],awayPeriods=[35,35]}={}) {
  const status={type:{state,name:state==='post'?'STATUS_FINAL':state==='in'?'STATUS_IN_PROGRESS':'STATUS_SCHEDULED',completed:state==='post'}};
  return{id,date:at,season:{year:season,type:2},status,competitions:[{id,date:at,timeValid:true,neutralSite:neutral,status,
    competitors:[{id:home,homeAway:'home',team:{id:home,displayName:'Team '+home,abbreviation:'T'+home,conferenceId:'7'},
      score:String(state==='pre'?0:h),records:[{type:'total',summary:record}],statistics:homeStats,
      ...(state==='post'?{linescores:homePeriods.map((v,i)=>({period:i+1,value:v}))}:{})},
    {id:away,homeAway:'away',team:{id:away,displayName:'Team '+away,abbreviation:'T'+away},score:String(state==='pre'?0:a),
      records:[{type:'total',summary:'0-2'}],statistics:awayStats,...(state==='post'?{linescores:awayPeriods.map((v,i)=>({period:i+1,value:v}))}:{})}]}]};
}
function receipt(sourceDay,events,{id='source-'+sourceDay,capturedAt=sourceDay+'T23:59:00Z'}={}) {
  return{id,captured_at:capturedAt,source_url:ncaabArchiveUrl(sourceDay),body:{events}};
}
function build(receipts,extra={}) {return buildNcaabManualDataReport({date,readAt,receipts,contexts:[],predictions:[],readComplete:true,...extra});}
function twoGameHistory() {
  return[
    receipt('2026-11-22',[rawGame({id:'101',at:'2026-11-22T18:00:00Z',state:'post',h:70,a:60,homePeriods:[30,40],awayPeriods:[25,35],record:'1-0',neutral:true,
      homeStats:[stat('fieldGoalsMade',10),stat('fieldGoalsAttempted',20),stat('threePointFieldGoalsMade',2),stat('threePointFieldGoalsAttempted',5),stat('rebounds',30)]})]),
    receipt('2026-11-23',[rawGame({id:'102',at:'2026-11-23T18:00:00Z',state:'post',h:80,a:70,record:'2-0',
      homeStats:[stat('fieldGoalsMade',32),stat('fieldGoalsAttempted',80),stat('threePointFieldGoalsMade',10),stat('threePointFieldGoalsAttempted',25),stat('rebounds',40)]})]),
    receipt(date,[rawGame({homeStats:[stat('points',999),stat('avgPoints',499.5),stat('fieldGoalsMade',999),stat('fieldGoalsAttempted',1000)],record:'2-0'})],{capturedAt:'2026-11-24T10:00:00Z'}),
  ];
}

test('season under ten has exact observed sample; season pregame statistics never enter game averages',()=>{
  const r=build(twoGameHistory()),t=r.teams.find(t=>t.id==='11');
  assert.equal(r.fixtures.length,1);assert.equal(r.coverage.archivedFinals,2);
  assert.equal(t.reportedRecord.overall,'2-0');assert.equal(t.archive.completeSeason,true);
  assert.equal(t.archive.pointsFor,75);assert.equal(t.last10.pointsAgainst,65);
  assert.equal(t.last10.coverage,'SEASON_UNDER_TEN');assert.equal(t.last10.complete,false);assert.equal(t.last10.sequenceVerified,true);assert.equal(t.last10.expectedGames,2);
  assert.equal(t.archive.stats.fieldGoalPct.value,.42);assert.equal(t.archive.stats.fieldGoalPct.games,2);
  assert.equal(t.archive.stats.threePointPct.value,.4);assert.equal(t.archive.stats.rebounds.value,35);
  assert.equal(t.archive.neutral.games,1);assert.equal(t.archive.home.games,1);assert.equal(t.archive.away.games,0);
  assert.equal(t.rest.daysOff,0);assert.equal(t.rest.verified,true);
  assert.equal(r.providerCalls,0);assert.equal(r.databaseWrites,0);assert.equal(r.predictionAdjustment,false);assert.equal(r.modelPromoted,false);
  assert.equal(r.fixtures[0].forecast,null);assert.equal(r.fixtures[0].markets.eligible,false);
});

test('record gaps are partial and never manufacture ten games or verified rest',()=>{
  const receipts=twoGameHistory();receipts[2].body.events[0].competitions[0].competitors[0].records[0].summary='4-0';
  const t=build(receipts).teams.find(t=>t.id==='11');
  assert.equal(t.last10.games,2);assert.equal(t.last10.expectedGames,4);assert.equal(t.archive.completeSeason,false);
  assert.equal(t.last10.coverage,'PARTIAL');assert.equal(t.last10.sequenceVerified,false);assert.equal(t.rest.daysOff,null);
});

test('ten rows need continuous independently archived dates, but a verified last10 can coexist with incomplete season',()=>{
  const receipts=Array.from({length:10},(_,i)=>{const d='2026-11-'+String(14+i);return receipt(d,[rawGame({id:String(200+i),at:d+'T18:00:00Z',state:'post',record:String(i+1)+'-0'})]);});
  receipts.push(receipt(date,[rawGame({record:'12-0'})],{capturedAt:'2026-11-24T10:00:00Z'}));
  let t=build(receipts).teams.find(t=>t.id==='11');
  assert.equal(t.archive.completeSeason,false);assert.equal(t.last10.complete,true);assert.equal(t.last10.coverage,'COMPLETE_TEN');
  const changed=structuredClone(receipts);changed[4].source_url=ncaabArchiveUrl('2026-11-13');
  t=build(changed).teams.find(t=>t.id==='11');assert.equal(t.last10.games,10);assert.equal(t.last10.complete,false);assert.equal(t.last10.sequenceVerified,false);
});

test('Puerto Rico dates handle cross-midnight slate and exclude every same-day final from history',()=>{
  const lateYesterday=rawGame({id:'301',at:'2026-11-24T04:30:00Z',state:'post'});
  const today=rawGame({id:'302',at:'2026-11-25T03:30:00Z'}),tomorrow=rawGame({id:'303',at:'2026-11-25T04:30:00Z'});
  const r=build([receipt('2026-11-23',[lateYesterday],{capturedAt:'2026-11-24T08:00:00Z'}),receipt(date,[today,tomorrow],{capturedAt:'2026-11-24T10:00:00Z'})]);
  assert.deepEqual(r.fixtures.map(g=>g.eventId),['espn:301','espn:302']);assert.equal(r.fixtures[0].state,'FINAL');assert.equal(r.fixtures[0].homeScore,80);
  assert.equal(r.fixtures[1].homeScore,null);assert.equal(r.coverage.archivedFinals,0);assert.equal(r.teams.find(t=>t.id==='11').last10.coverage,'NO_HISTORY');
});

function context({id='401',at='2026-11-02T18:00:00Z',capturedAt='2026-11-24T10:00:00Z',h=80,a=70}={}) {
  const e=rawGame({id,at,state:'post',h,a});
  return{event_id:'espn:'+id,provider_event_id:id,captured_at:capturedAt,updated_at:capturedAt,header:{id:e.id,season:e.season,competitions:e.competitions},
    teams:[{team:{id:'11'},homeAway:'home',statistics:[stat('fieldGoalsMade-fieldGoalsAttempted','25-50'),stat('totalRebounds',33),stat('totalTurnovers',9)]},
      {team:{id:'22'},homeAway:'away',statistics:[stat('fieldGoalsMade-fieldGoalsAttempted','20-50'),stat('totalRebounds',28),stat('totalTurnovers',12)]}]};
}
test('exact context can supplement a missing early date; its late capture does not make the game recent',()=>{
  const r=build([receipt(date,[rawGame({record:'1-0'})],{capturedAt:'2026-11-24T10:30:00Z'})],{contexts:[context()]}),t=r.teams.find(t=>t.id==='11');
  assert.equal(r.coverage.archivedFinals,1);assert.equal(t.archive.completeSeason,true);assert.equal(t.recentGames[0].date,'2026-11-02');
  assert.equal(t.recentGames[0].capturedAt,'2026-11-24T10:00:00.000Z');assert.equal(t.last10.stats.turnovers.value,9);assert.equal(t.last10.stats.turnovers.games,1);
  assert.equal(t.rest.daysOff,21);assert.ok(r.source.missingDates.includes('2026-11-02'));
});

test('future contexts are excluded, wrong identities cannot overlay and conflicting final scores are quarantined',()=>{
  const receipts=twoGameHistory();let r=build(receipts,{contexts:[context({capturedAt:'2026-11-24T13:00:00Z'})]});
  assert.equal(r.coverage.archivedFinals,2);
  const wrong=context({id:'102',at:'2026-11-23T18:00:00Z'});wrong.header.competitions[0].competitors[0].team.id='33';
  r=build(receipts,{contexts:[wrong]});assert.equal(r.coverage.archivedFinals,2);assert.equal(r.coverage.gamesWithDetailedStats,0);assert.ok(r.coverage.excludedEvents>0);
  r=build(receipts,{contexts:[context({id:'102',at:'2026-11-23T18:00:00Z',h:81})]});
  assert.equal(r.coverage.archivedFinals,1);assert.equal(r.teams.find(t=>t.id==='11').last10.sequenceVerified,false);
});

test('half scores use first two real periods, preserve overtime and reject inconsistent period totals',()=>{
  const r=build([receipt('2026-11-23',[rawGame({id:'501',at:'2026-11-23T18:00:00Z',state:'post',h:85,a:80,
    homePeriods:[35,35,15],awayPeriods:[30,40,10]})]),receipt(date,[rawGame({record:'1-0'})],{capturedAt:'2026-11-24T10:00:00Z'})]);
  const t=r.teams.find(t=>t.id==='11');assert.equal(t.last10.pointsFor,85);assert.equal(t.last10.periods[0].pointsFor,35);assert.equal(t.last10.periods[1].pointsFor,35);
  assert.equal(t.recentGames[0].periods[2].pointsFor,15);
  const bad=twoGameHistory();bad[0].body.events[0].competitions[0].competitors[0].linescores[0].value=100;
  const bt=build(bad).teams.find(t=>t.id==='11');assert.equal(bt.last10.periods[0].games,1);assert.equal(bt.recentGames[1].periods.length,0);
});

test('missing metrics remain null and incomplete or impossible shooting pairs never become zero',()=>{
  const receipts=twoGameHistory(),g=receipts[0].body.events[0];
  g.competitions[0].competitors[0].statistics=[stat('fieldGoalsMade',30),stat('fieldGoalsAttempted',20)];
  const t=build(receipts).teams.find(t=>t.id==='11');
  assert.equal(t.last10.stats.fieldGoalPct.games,1);assert.equal(t.last10.stats.fieldGoalPct.value,.4);
  assert.equal(t.last10.stats.freeThrowPct.value,null);assert.equal(t.last10.stats.freeThrowPct.games,0);assert.equal(t.last10.stats.turnovers.value,null);
  assert.equal(t.recentGames[1].stats.fieldGoalsMade,null);
});

test('latest malformed receipt cannot revive an earlier snapshot; tied sources and incomplete scans fail closed',()=>{
  const old=receipt(date,[rawGame()],{capturedAt:'2026-11-24T09:00:00Z'}),bad={...old,id:'bad',captured_at:'2026-11-24T10:00:00Z',body:null};
  assert.throws(()=>build([old,bad]),/INCOMPLETE_RECEIPT/);
  assert.throws(()=>build([old,{...old,id:'conflict'}]),/CONFLICTING_RECEIPTS/);
  assert.throws(()=>build([old],{readComplete:false}),/INCOMPLETE_SCAN/);
  const unavailable=unavailableNcaabManualDataReport({date,readAt,reason:'secret token here'});
  assert.equal(unavailable.status,'UNAVAILABLE');assert.equal(unavailable.coverage.readComplete,false);assert.ok(!JSON.stringify(unavailable).includes('secret'));
});

test('unsupported historical seed remains a visible gap; an unverified calendar never means an empty slate',()=>{
  const inputs=twoGameHistory();inputs.unshift({...receipt('2026-11-02',[]),body:{events:null}});
  const r=build(inputs);assert.equal(r.status,'PARTIAL');assert.ok(r.source.missingDates.includes('2026-11-02'));
  assert.equal(r.source.sourceDates.includes('2026-11-02'),false);assert.equal(r.coverage.archivedFinals,2);
  const absent=build([]);assert.equal(absent.status,'PARTIAL');assert.equal(absent.source.slateCapturedAt,null);
  assert.ok(absent.warnings.some(w=>w.includes('cobertura del día no está verificada')));
  const empty=build([receipt(date,[],{capturedAt:'2026-11-24T10:00:00Z'})]);assert.equal(empty.status,'EMPTY');assert.ok(empty.source.slateCapturedAt);
});

test('malformed games block affected-team sequence certification even with a matching record',()=>{
  const inputs=twoGameHistory(),bad=rawGame({id:'999',at:'2026-11-23T20:00:00Z',state:'post'});
  bad.competitions[0].competitors[0].team.id='333';inputs[1].body.events.push(bad);
  const team=build(inputs).teams.find(t=>t.id==='11');
  assert.equal(team.archive.games,2);assert.equal(team.archive.completeSeason,false);assert.equal(team.last10.sequenceVerified,false);
  assert.equal(team.last10.coverage,'PARTIAL');assert.equal(team.rest.verified,false);
});

test('re-reading an old scoreboard today cannot overwrite a newer represented season record',()=>{
  const receipts=twoGameHistory();receipts[0].captured_at='2026-11-24T11:00:00Z';
  assert.equal(build(receipts).teams.find(t=>t.id==='11').reportedRecord.overall,'2-0');
});

test('only exact saved pregame forecasts are copied; mismatched teams or late emissions stay absent',()=>{
  const receipts=twoGameHistory(),body={model:'EXISTING_EXPERIMENTAL',event_id:'espn:100',scheduled_at:'2026-11-24T18:00:00Z',created_at:'2026-11-24T11:00:00Z',
    home_id:'11',away_id:'22',state:'FORECAST',home_score:75,away_score:70,home_win_probability:.6,away_win_probability:.4,projected_total:145,projected_margin:5,predicted_winner:'11'};
  const row={event_id:body.event_id,scheduled_at:body.scheduled_at,created_at:body.created_at,body,source_id:'saved-source'};
  let r=build(receipts,{predictions:[row]});assert.equal(r.fixtures[0].forecast.homeProbability,.6);assert.equal(r.fixtures[0].forecast.model,'EXISTING_EXPERIMENTAL');
  assert.equal(r.fixtures[0].forecast.status,'EXPERIMENTAL');assert.equal(r.fixtures[0].markets.validatedProbability,null);
  r=build(receipts,{predictions:[{...row,body:{...body,away_id:'99'}}]});assert.equal(r.fixtures[0].forecast,null);
  r=build(receipts,{predictions:[{...row,created_at:'2026-11-24T19:00:00Z',body:{...body,created_at:'2026-11-24T19:00:00Z'}}]});assert.equal(r.fixtures[0].forecast,null);
});

test('previous seasons, invalid dates and contradictory team IDs do not contaminate current records',()=>{
  const receipts=twoGameHistory();receipts[0].body.events.push(rawGame({id:'600',season:2026,at:'2025-11-22T18:00:00Z',state:'post'}));
  const wrong=rawGame({id:'601',at:'2026-11-22T18:00:00Z',state:'post'});wrong.competitions[0].competitors[0].team.id='99';receipts[0].body.events.push(wrong);
  const r=build(receipts);assert.equal(r.coverage.archivedFinals,2);assert.equal(r.coverage.excludedEvents,2);
  assert.throws(()=>build(receipts,{date:'2026-02-30'}),/INVALID_DATE/);
});
