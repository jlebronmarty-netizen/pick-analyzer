import test from 'node:test';
import assert from 'node:assert/strict';
import {ncaafOutcome} from '../src/lib/edge-lab/ncaaf-ppg.mjs';

const frozen={
  sport:'NCAAF',event_id:'espn:401858521',market:'MONEYLINE',selection:'AWAY',
  scheduled_at:'2026-11-14T21:15:00Z',emitted_at:'2026-11-08T02:22:00Z',
  projection:-1,
  payload:{
    input:{event_id:'espn:401858521',season:2026,home_id:'127',away_id:'264',neutral_site:false,scheduled_at:'2026-11-14T21:15:00Z'},
    projection:{home_score:20,away_score:21,projected_margin:-1,projected_total:41}
  }
};
const verified={event_id:'espn:401858521',season:2026,home_id:'127',away_id:'264',
  neutral_site:false,status:'FINAL',outcome_validation:'PASS',scheduled_at:'2026-11-14T22:30:00Z',
  home_score:14,away_score:21,captured_at:'2026-11-15T03:00:00Z'};
test('exact ESPN event and verified 75m kickoff correction grade ML',()=>{
  const r=ncaafOutcome(frozen,verified);
  assert.equal(r.status,'W');assert.equal(r.final.event_id,frozen.event_id);
});
test('same-game verified 15m correction grades numeric markets without bets',()=>{
  const m=ncaafOutcome({...frozen,market:'POINT_MARGIN',projection:-1}, {...verified,scheduled_at:'2026-11-14T21:30:00Z'});
  const t=ncaafOutcome({...frozen,market:'TOTAL_POINTS',projection:41}, {...verified,scheduled_at:'2026-11-14T21:30:00Z'});
  assert.equal(m.status,'NUMERIC');assert.equal(m.actual,-7);
  assert.equal(m.absolute_error,6);assert.equal(t.status,'NUMERIC');assert.equal(t.actual,35);
});
test('exactly 120 minutes is maximum supported correction',()=>{
  assert.equal(ncaafOutcome(frozen,{...verified,scheduled_at:'2026-11-14T23:15:00Z'}).status,'W');
  assert.equal(ncaafOutcome(frozen,{...verified,scheduled_at:'2026-11-14T23:16:00Z'}).status,'DISPUTE');
});
test('moved kickoff earlier than forecast freezes must not be graded',()=>{
  const after={...frozen,emitted_at:'2026-11-14T21:00:00Z'};
  const earlier={...verified,scheduled_at:'2026-11-14T20:00:00Z',captured_at:'2026-11-14T23:00:00Z'};
  assert.equal(ncaafOutcome(after,earlier).status,'DISPUTE');
});
test('changes in teams, neutral-site, season, frozen input or event ID are disputes',()=>{
  for(const final of [
    {...verified,home_id:'999'}, {...verified,away_id:'999'}, {...verified,neutral_site:true},
    {...verified,season:2025}, {...verified,event_id:'espn:other'}
  ]) assert.equal(ncaafOutcome(frozen,final).status,'DISPUTE');
  assert.equal(ncaafOutcome({...frozen,payload:{...frozen.payload,input:{...frozen.payload.input,scheduled_at:'2026-11-14T22:00:00Z'}}},verified).status,'DISPUTE');
});
test('unverified, poststart and missing final evidence never count',()=>{
  assert.equal(ncaafOutcome(frozen,null).status,'PENDING');
  assert.equal(ncaafOutcome(frozen,{...verified,outcome_validation:'BAD'}).status,'NOT_VERIFIABLE');
  assert.equal(ncaafOutcome(frozen,{...verified,captured_at:'2026-11-14T21:15:00Z'}).status,'DISPUTE');
});
