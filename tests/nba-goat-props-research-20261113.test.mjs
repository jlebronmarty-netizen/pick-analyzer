import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeNbaPropStoredQuote,NBA_PROP_RESEARCH_MARKETS} from '../src/lib/nba/goat-props-core.mjs';
const q={market:'props',phase:'PREGAME',period:'FULL_GAME_LABEL_OT_UNVERIFIED',contract:'STRICT_GREATER_THAN',side:'over',statistic:'points',line:21.5,provider_game_id:123,player_id:999,source_received_at:'2026-11-12T22:00:00Z'};
const actual={game:{id:123,datetime:'2026-11-12T23:00:00Z',status_state:'final'},player:{id:999},min:'32:14',pts:24,reb:7,ast:10,fg3m:4};
test('Four supported player prop statistics must have explicit actual stat mappings',()=>assert.deepEqual(NBA_PROP_RESEARCH_MARKETS,['points','rebounds','assists','threes']));
test('Pregame points over is graded statistically without granting model accuracy or sportsbook settlement',()=>{
 const r=gradeNbaPropStoredQuote(q,actual);
 assert.equal(r.status,'STATISTICAL_COMPARISON');
 assert.equal(r.outcome,'win');
 assert.equal(r.actual,24);
 assert.equal(r.predictionAccuracy,false);
 assert.equal(r.sportsbookSettlement,false);
});
test('Strict over/under, a line push, and all four player stats',()=>{
 assert.equal(gradeNbaPropStoredQuote({...q,statistic:'rebounds',line:7.5},actual).outcome,'loss');
 assert.equal(gradeNbaPropStoredQuote({...q,statistic:'assists',line:10},actual).outcome,'push');
 assert.equal(gradeNbaPropStoredQuote({...q,statistic:'threes',side:'under',contract:'STRICT_LESS_THAN',line:4.5},actual).outcome,'win');
 assert.equal(gradeNbaPropStoredQuote({...q,statistic:'threes',line:4.5},actual).outcome,'loss');
});
test('Fail closed on identity mismatch, DNP, expired quote, unknown market, milestone, or in-play',()=>{
 for(const [quote,stats] of [
  [{...q,player_id:1000},actual],
  [q,{...actual,min:'0:00'}],
  [{...q,source_received_at:'2026-11-12T22:57:00Z'},actual],
  [{...q,statistic:'steals'},actual],
  [{...q,side:'yes',contract:'MILESTONE_AS_PUBLISHED'},actual],
  [{...q,phase:'IN_PLAY'},actual],
  [q,{...actual,game:{...actual.game,status_state:'scheduled'}}],
  [q,{...actual,player:{id:1000}}],
  [q,{...actual,pts:null}],
 ]) {
  const r=gradeNbaPropStoredQuote(quote,stats);
  assert.equal(r.status,'NOT_GRADED');
  assert.equal(r.sportsbookSettlement,false);
 }
});
