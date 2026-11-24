import test from 'node:test';
import assert from 'node:assert/strict';
import {actualPropValue,gradeFrozenProp,summarizeVerifiedGrades} from '../src/lib/nba/nba-props-settlement-shadow.mjs';
const d={playerId:7,providerGameId:20,market:'points_rebounds_assists',side:'over',line:30.5,americanOdds:-110,
  contract:'STRICT_GREATER_THAN',period:'FULL_GAME_LABEL_OT_UNVERIFIED',
  frozenAt:'2026-11-17T23:00:00Z',gameStartAt:'2026-11-18T00:00:00Z',quoteCapturedAt:'2026-11-17T22:59:00Z'};
const f={player_id:7,provider_game_id:20,pts:22,reb:8,ast:6,fg3m:3,minutes_played:33,
  final_verified:true,source_captured_at:'2026-11-18T03:00:00Z'};
const verified={fullGameOtRuleVerified:true,dnpVoidRuleVerified:true,bookRegionVerified:true};
test('combined stats use the same actual game, not independent averages',()=>{
 assert.equal(actualPropValue(f,'points_rebounds_assists'),36);
 assert.equal(actualPropValue({...f,ast:null},'points_rebounds_assists'),null);
});
test('defaults fail closed until bookmaker rules and region are verified',()=>{
 assert.equal(gradeFrozenProp(d,f).status,'UNSETTLED');
 assert.equal(gradeFrozenProp(d,f).reason,'OVERTIME_RULE_UNVERIFIED');
});
test('settlement with independently verified rules',()=>{
 let g=gradeFrozenProp(d,f,verified);assert.equal(g.outcome,'WIN');assert.ok(g.netUnits>0);
 assert.equal(gradeFrozenProp({...d,side:'under',contract:'STRICT_LESS_THAN'},f,verified).outcome,'LOSS');
 assert.equal(gradeFrozenProp({...d,line:36},f,verified).outcome,'PUSH');
});
test('identity, cutoff, DNP and incomplete final prevent grading',()=>{
 assert.equal(gradeFrozenProp({...d,playerId:8},f,verified).reason,'IDENTITY_MISMATCH');
 assert.equal(gradeFrozenProp({...d,frozenAt:'2026-11-18T00:00:00Z'},f,verified).reason,'TIMESTAMP_OR_PREGAME_CUTOFF_INVALID');
 assert.equal(gradeFrozenProp(d,{...f,dnp:true,minutes_played:0},verified).reason,'DNP_REQUIRES_CONTRACT_VERIFICATION');
 assert.equal(gradeFrozenProp(d,{...f,final_verified:false},verified).reason,'FINAL_NOT_VERIFIED');
});
test('coverage explicitly excludes unverified outcomes from ROI',()=>{
 const a=gradeFrozenProp(d,f,verified),b=gradeFrozenProp(d,f);
 const s=summarizeVerifiedGrades([a,b]);
 assert.equal(s.total,2);assert.equal(s.unsettled,1);assert.equal(s.wins,1);
 assert.equal(s.gradedWinRate,1);
});
