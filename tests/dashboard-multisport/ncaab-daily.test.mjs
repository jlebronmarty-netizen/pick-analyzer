import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {predictNcaab,reconcileNcaab,ncaabMetrics} from '../../src/lib/ncaab-live.ts';
import {normalizeNcaab} from '../../src/services/ncaab-daily.service.ts';
const original=JSON.parse(fs.readFileSync('src/data/ncaab-original-73.json','utf8'));
const profile=JSON.parse(fs.readFileSync('src/data/ncaab-profile-2027.json','utf8'));
const schedule=f=>({event_id:f.event_id,home_id:f.home_id,away_id:f.away_id,home_name:f.home_name,away_name:f.away_name,scheduled_at:f.scheduled_at,season_ending_year:2027,phase:'REGULAR',status:'SCHEDULED',time_verified:true,neutral_site:false,captured_at:f.created_at});
test('hosting port reproduces all 73 frozen scores, winners and probabilities',()=>{
 for(const f of original.forecasts){
  const h=profile.teams[f.home_id],a=profile.teams[f.away_id];const pace=(h.estimated_possessions+a.estimated_possessions)/2;
  const neutral=Math.abs(f.home_score-pace*(profile.league_efficiency+h.offense_effect+a.defense_allowed_effect)/100)<1e-8;
  const r=predictNcaab({...schedule(f),neutral_site:neutral},f.created_at);
  assert.equal(r.state,'FORECAST',f.event_id);assert.equal(r.predicted_winner,f.predicted_winner);
  for(const k of ['home_score','away_score','projected_total','projected_margin','home_win_probability','away_win_probability'])assert.ok(Math.abs(r[k]-f[k])<1e-11,`${f.event_id} ${k}`);
 }
});
test('gates reject live, stale, unknown venue, missing team and wrong season',()=>{
 const f=original.forecasts[0],base=schedule(f);
 for(const patch of [{status:'LIVE'},{captured_at:'2026-10-01T00:00:00Z'},{neutral_site:null},{home_id:'unknown'},{season_ending_year:2028},{time_verified:false},{phase:'POSTSEASON'}])assert.equal(predictNcaab({...base,...patch},f.created_at).state,'ABSTAIN');
 assert.equal(predictNcaab(base,f.scheduled_at).state,'ABSTAIN');
});
const f=original.forecasts[0];
const final={event_id:f.event_id,home_id:f.home_id,away_id:f.away_id,scheduled_at:f.scheduled_at,home_score:80,away_score:60,captured_at:'2026-11-03T23:00:00Z',status:'FINAL'};
test('duplicate finals do not duplicate denominator; corrections and changed tip require review',()=>{
 const row=reconcileNcaab(f,[final,final]);assert.equal(row.settlement.outcome,'WIN');assert.equal(ncaabMetrics([row]).winnerDenominator,1);
 for(const change of [{scheduled_at:'2026-11-03T01:00:00Z'},{home_id:f.away_id},{home_score:81}]){
  const reviewed=reconcileNcaab(f,[final,{...final,...change}]);assert.equal(reviewed.review_required,true);assert.equal(ncaabMetrics([reviewed]).winnerDenominator,0);
 }
 assert.equal(reconcileNcaab(f,[]).settlement,null);
});
test('normalizer never infers verified tip or venue and accepts finals only with both scores',()=>{
 const e={id:'1234',date:'2026-11-04T00:00:00Z',season:{year:2027,type:2},status:{type:{state:'pre',name:'STATUS_SCHEDULED',completed:false}},competitions:[{date:'2026-11-04T00:00:00Z',competitors:[{id:'1',homeAway:'home',team:{displayName:'H'}},{id:'2',homeAway:'away',team:{displayName:'A'}}]}]};
 const {schedule:s,final:result}=normalizeNcaab(e,'2026-11-03T22:00:00Z');assert.equal(s.time_verified,false);assert.equal(s.neutral_site,null);assert.equal(result,null);
 assert.equal(predictNcaab(s,'2026-11-03T22:00:00Z').reason,'UNVERIFIED_TIP');
});
