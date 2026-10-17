import test from 'node:test';
import assert from 'node:assert/strict';
import {outcomeNumber,parsePendingOfficialEvidence,pendingPropBlocker,standardRunlineOutcome,pendingReasonLabel} from '../../src/lib/mlb-pending-outcome.ts';
const proof={capturedAt:'2026-10-17T21:00:00Z',scheduleSha256:'a'.repeat(64),boxscoreSha256:'b'.repeat(64)};
const schedule=(status={statusCode:'F',codedGameState:'F',detailedState:'Final'})=>({dates:[{games:[{gamePk:849811,season:'2026',officialDate:'2026-10-14',status,teams:{home:{team:{id:119},score:2},away:{team:{id:158},score:6}}}]}]});
const box=()=>({teams:{
  home:{team:{id:119,abbreviation:'LAD'},players:{ID1:{person:{id:1},stats:{batting:{plateAppearances:0,doubles:0,baseOnBalls:0}}}}},
  away:{team:{id:158,abbreviation:'MIL'},players:{ID2:{person:{id:2},stats:{batting:{plateAppearances:4,doubles:1,baseOnBalls:0}}}}}
}});
test('missing numeric data never becomes a zero or an inferred under win',()=>{
  for(const v of [null,undefined,'',false,true,NaN,Infinity]) assert.equal(outcomeNumber(v),null);
  assert.equal(outcomeNumber(0),0);assert.equal(outcomeNumber('0'),0);
  const b=box(); delete b.teams.home.players.ID1.stats.batting.doubles;
  assert.equal(parsePendingOfficialEvidence(849811,schedule(),b,proof).players['1'].doubles,null);
});
test('official evidence checks exact game and both team identities',()=>{
  assert.throws(()=>parsePendingOfficialEvidence(42,schedule(),box(),proof),/IDENTITY/);
  const b=box();b.teams.home.team.id=1;assert.throws(()=>parsePendingOfficialEvidence(849811,schedule(),b,proof),/IDENTITY/);
});
test('postponement is not a final result even when abstract state says Final',()=>{
  const e=parsePendingOfficialEvidence(849811,schedule({statusCode:'DR',codedGameState:'D',abstractGameState:'Final',detailedState:'Postponed'}),box(),proof);
  assert.equal(e.final,false);assert.equal(pendingPropBlocker(e,1,'2026-10-14'),'POSTPONED_CONTRACT_REVIEW');
  assert.equal(standardRunlineOutcome(e,{gamePk:849811,targetDate:'2026-10-14',homeTeam:'LAD',awayTeam:'MIL',dogSide:'AWAY'}),null);
});
test('a rescheduled final supersedes its postponed schedule entry without counting either twice',()=>{
  const s=schedule();const g=structuredClone(s.dates[0].games[0]);g.status={statusCode:'DR',codedGameState:'D',detailedState:'Postponed'};
  s.dates.unshift({games:[g]});
  assert.equal(parsePendingOfficialEvidence(849811,s,box(),proof).final,true);
  s.dates.push(structuredClone(s.dates[1]));
  assert.throws(()=>parsePendingOfficialEvidence(849811,s,box(),proof),/AMBIGUOUS/);
});
test('no boxscore entry and zero PA need contract review, not WIN or VOID',()=>{
  const e=parsePendingOfficialEvidence(849811,schedule(),box(),proof);
  assert.equal(pendingPropBlocker(e,1,'2026-10-14'),'ZERO_PA_CONTRACT_REVIEW');
  assert.equal(pendingPropBlocker(e,3,'2026-10-14'),'PLAYER_NOT_IN_FINAL_BOXSCORE_CONTRACT_REVIEW');
  assert.equal(pendingPropBlocker(e,2,'2026-10-14'),'EXACT_OUTCOME_NOT_AVAILABLE');
  assert.match(pendingReasonLabel(pendingPropBlocker(e,3,'2026-10-14')),/contrato/);
});
test('runline respects frozen direction, exact identity/date and observed final margin',()=>{
  const e=parsePendingOfficialEvidence(849811,schedule(),box(),proof);
  const f={gamePk:849811,targetDate:'2026-10-14',homeTeam:'LAD',awayTeam:'MIL',dogSide:'AWAY'};
  assert.equal(standardRunlineOutcome(e,f).result,'WIN');assert.equal(standardRunlineOutcome(e,f).actualValue,4);
  assert.equal(standardRunlineOutcome(e,{...f,dogSide:'HOME'}).result,'LOSS');
  for(const bad of [{gamePk:1},{targetDate:'2026-10-15'},{homeTeam:'MIL'},{dogSide:'UNKNOWN'}]) assert.equal(standardRunlineOutcome(e,{...f,...bad}),null);
  assert.equal(standardRunlineOutcome({...e,homeScore:null},f),null);
  assert.equal(standardRunlineOutcome({...e,homeScore:6},f),null);
});
