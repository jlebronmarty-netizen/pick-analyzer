import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeNbaScheduleGames,upcomingNbaScheduleGames} from '../src/lib/nba/goat-schedule-core.mjs';
import {nbaGoatDerivedContext,nbaGoatQuoteChecks} from '../src/lib/nba/goat-provider-policy.mjs';

const now='2026-11-13T23:05:00Z';
const event={id:'bdl_nba_21718095',sport_key:'basketball_nba',league_key:'nba',season:'2026-27',home_team:'Indiana Pacers',away_team:'New York Knicks',status:'scheduled',start_time:'2026-11-14T00:00:00Z'};
const game={id:21718095,datetime:event.start_time,season:2026,home_team:{id:1,full_name:event.home_team},visitor_team:{id:2,full_name:event.away_team},status_state:'scheduled',postponed:false,postseason:false,ist_stage:'East Group B'};
const quote={id:'q',event_id:event.id,provider:'balldontlie',sportsbook:'fanduel',market:'moneyline',outcome:event.home_team,price:-130,line:null,provider_timestamp:'2026-11-13T23:00:00Z',metadata:{module:'NBA_MARKET_DATA_V1',quote_id:'q',snapshot_id:'s',phase:'PREGAME',source_received_at:'2026-11-13T23:00:05Z',contract:'WINNER',period:'FULL_GAME_LABEL_OT_UNVERIFIED'}};
const current={snapshot_id:'today',source_received_at:'2026-11-13T23:00:17.274Z',payload:{data:{games:[game]}}};
const previous={snapshot_id:'yesterday',source_received_at:'2026-11-13T23:00:17.601Z',payload:{data:{games:[{...game,id:21718091,datetime:'2026-11-13T00:00:00Z',status_state:'final',ist_stage:null}]}}};

test('Newest archive write from yesterday never hides a valid future game from today',()=>{
 const m=mergeNbaScheduleGames([previous,current]);
 assert.equal(m.get(game.id).snapshotId,'today');
 const future=upcomingNbaScheduleGames([previous,current],Date.parse(now));
 assert.deepEqual(future.map(x=>x.game.id),[game.id]);
 assert.equal(future[0].sourceReceivedAt,current.source_received_at);
});

test('Latest evidence is chosen independently for each game and future no-ops are read only',()=>{
 const older={...current,snapshot_id:'older',source_received_at:'2026-11-13T22:59:00Z'};
 assert.equal(mergeNbaScheduleGames([older,current]).get(game.id).snapshotId,'today');
 assert.deepEqual(upcomingNbaScheduleGames([previous],Date.parse(now)),[]);
 assert.deepEqual(upcomingNbaScheduleGames([current],Date.parse('2026-11-14T00:00:00Z')),[]);
});

test('2026 NBA Cup Group Play is regular-season evidence, without relaxing quote checks',()=>{
 const context=nbaGoatDerivedContext(event,quote,game,current.source_received_at,now);
 assert.equal(context.seasonPhaseVerified,true);
 assert.equal(context.contractScopeVerified,true);
 assert.equal(context.seasonPhaseEvidence.regularSeasonStage,'NBA_CUP_GROUP_PLAY');
 assert.equal(context.seasonPhaseEvidence.istStage,'East Group B');
 assert.equal(nbaGoatQuoteChecks(event,quote,now,context).writeEligible,true);
});

test('NBA Cup Championship, ambiguous stages, postseason and changed identity fail closed',()=>{
 for(const changed of [
  {...game,ist_stage:'Championship'},
  {...game,ist_stage:'group'},
  {...game,ist_stage:'TBD'},
  {...game,postseason:true},
  {...game,home_team:{full_name:'Other Team'}},
 ]){
  const c=nbaGoatDerivedContext(event,quote,changed,current.source_received_at,now);
  assert.equal(c.seasonPhaseVerified,false);
  assert.equal(nbaGoatQuoteChecks(event,quote,now,c).writeEligible,false);
 }
});

test('Stale schedule fails even when valid Cup Group Play game and price exist',()=>{
 const c=nbaGoatDerivedContext(event,quote,game,'2026-11-13T21:00:00Z',now);
 assert.equal(c.seasonPhaseVerified,false);
});
