import test from 'node:test';
import assert from 'node:assert/strict';
import {
 NBA_PERIOD_RESEARCH_PERIODS,NBA_PERIOD_RESEARCH_CANDIDATES,
 normalizePeriodResearchHistory,createHistoricalPeriodRows,runNbaPeriodBacktest,
 scoreHistoricalPeriodRow,periodErrorMetrics,pairedHoldoutErrorInterval,
} from '../src/lib/nba/period-research-core.mjs';
function game(date,index,homeId=1,awayId=2) {
 const h=[27+index%5,24+index%7,31-index%3,25+index%5],
       a=[24+index%3,29+index%5,27+index%2,28+index%4];
 const ot=index===39?{home_ot1:8,visitor_ot1:7}:{};
 return {game:{id:100000+index,date,datetime:date+'T23:00:00.000Z',
  status_state:'final',home_team:{id:homeId},visitor_team:{id:awayId},
  home_q1:h[0],home_q2:h[1],home_q3:h[2],home_q4:h[3],
  visitor_q1:a[0],visitor_q2:a[1],visitor_q3:a[2],visitor_q4:a[3],
  ...ot,home_team_score:h.reduce((x,y)=>x+y,0)+(ot.home_ot1??0),
  visitor_team_score:a.reduce((x,y)=>x+y,0)+(ot.visitor_ot1??0)}};
}
const day=offset=>new Date(Date.UTC(2026,9,20+offset)).toISOString().slice(0,10);
function sample(){
 const g=[];let index=0;
 for(let d=0;d<29;d++)for(let pair=0;pair<7;pair++){
  const home=2*pair+1,away=2*pair+2;
  g.push(game(day(d),index++,d%2?away:home,d%2?home:away));
 }
 return g;
}
test('rejects malformed, duplicate and score-inconsistent finals',()=>{
 const valid=game(day(0),0);
 assert.equal(normalizePeriodResearchHistory([valid]).length,1);
 assert.throws(()=>normalizePeriodResearchHistory([valid,valid]),/DUPLICATE/);
 const wrong=structuredClone(valid);wrong.game.home_team_score+=1;
 assert.throws(()=>normalizePeriodResearchHistory([wrong]),/INVALID/);
 const missing=structuredClone(valid);delete missing.game.home_q3;
 assert.throws(()=>normalizePeriodResearchHistory([missing]),/INVALID/);
 const notFinal=structuredClone(valid);notFinal.game.status_state='scheduled';
 assert.throws(()=>normalizePeriodResearchHistory([notFinal]),/INVALID/);
});
test('same-day results never become pregame features even when two games share teams',()=>{
 let rows=[];for(let i=0;i<5;i++)rows.push(game(day(i),i,1,2));
 rows.push(game(day(5),50,1,2),game(day(5),51,1,2));
 const norm=normalizePeriodResearchHistory(rows),studies=createHistoricalPeriodRows(norm);
 const q1=studies.filter(r=>r.period==='q1');
 assert.equal(q1.length,2);
 assert.equal(q1[0].home.priorOwnGames,5);
 assert.equal(q1[1].home.priorOwnGames,5);
 assert.equal(q1[0].home.offense5,q1[1].home.offense5);
 assert.equal(q1[0].actualHome!==q1[1].actualHome,true);
});
test('quarter excludes OT; second half and full-time include OT',()=>{
 const games=[];for(let i=0;i<5;i++)games.push(game(day(i),i,1,2));
 const extra=game(day(5),39,1,2);games.push(extra);
 const rows=createHistoricalPeriodRows(normalizePeriodResearchHistory(games));
 const lookup=Object.fromEntries(rows.map(x=>[x.period,x]));
 assert.equal(lookup.q4.actualHome,extra.game.home_q4);
 assert.equal(lookup.h2.actualHome,extra.game.home_q3+extra.game.home_q4+8);
 assert.equal(lookup.h2.actualAway,extra.game.visitor_q3+extra.game.visitor_q4+7);
 assert.equal(lookup.ft.actualHome,extra.game.home_team_score);
 assert.equal(lookup.h1.actualHome,extra.game.home_q1+extra.game.home_q2);
 assert.equal(lookup.ft.actualHome,lookup.h1.actualHome+lookup.h2.actualHome);
});
test('backtest is chronological and tests all seven periods on independent split',()=>{
 const all=sample();
 const result=runNbaPeriodBacktest(all);
 assert.equal(result.source.games,203);
 assert.equal(result.source.all_final_period_scores_verified,true);
 assert.equal(result.candidate_count,13);
 assert.equal(result.splits.holdout_start,'2026-11-12');
 assert.equal(result.source.provider_calls,0);
 assert.equal(result.source.database_writes,0);
 assert.equal(result.promotion.eligible,false);
 assert.equal(result.status,'RETROSPECTIVE_EXPLORATORY');
 for(const p of NBA_PERIOD_RESEARCH_PERIODS) {
  const period=result.periods[p];
  assert.equal(period.holdout_n,42);
  assert.equal(period.development_n,56);
  assert.ok(period.baseline_holdout.total_mae>=0);
  assert.ok(period.candidate_holdout.spread_mae>=0);
  assert.equal(period.paired_holdout.paired_n,42);
  assert.ok(period.paired_holdout.lower<=period.paired_holdout.upper);
 }
});
test('candidate metrics reproduce exact error formula and paired CI is deterministic',()=>{
 const q1=createHistoricalPeriodRows(normalizePeriodResearchHistory(sample())).filter(x=>x.period==='q1');
 const baseline=NBA_PERIOD_RESEARCH_CANDIDATES[0],challenger=NBA_PERIOD_RESEARCH_CANDIDATES[2];
 const row=q1[0],scored=scoreHistoricalPeriodRow(row,baseline);
 assert.ok(Math.abs(scored.totalError-Math.abs(scored.home+scored.away-row.actualHome-row.actualAway))<1e-9);
 const a=periodErrorMetrics(q1,baseline);
 assert.equal(a.n,q1.length);
 assert.ok(a.team_mae>=0);
 const x=pairedHoldoutErrorInterval(q1,challenger,baseline);
 const y=pairedHoldoutErrorInterval(q1,challenger,baseline);
 assert.deepEqual(x,y);
 assert.ok(x.lower<=x.delta_total_mae&&x.delta_total_mae<=x.upper);
});
test('short history is not certified as an independent validation cohort',()=>{
 const few=[];for(let i=0;i<7;i++)few.push(game(day(i),i,1,2));
 const result=runNbaPeriodBacktest(few);
 assert.equal(result.status,'INSUFFICIENT_CHRONOLOGICAL_HOLDOUT');
 assert.equal(result.promotion.eligible,false);
});
