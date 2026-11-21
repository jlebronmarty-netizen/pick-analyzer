import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {latestArchivedFinal} from '../../../../src/lib/nba/decision-learning-core.mjs';
import {reconciledPeriods} from '../../../../src/lib/nba/decision-archived-final-core.mjs';
import {settleProbabilityFreeze} from '../../../../src/lib/nba/decision-shadow-v2.mjs';
const [folder,output]=process.argv.slice(2);
if(!output)throw Error('Expected archived extract directory and a new output path');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const batch=read('docs/research/nba-v2/forward-20261120.json'), outcomes=read('docs/research/nba-v2/outcomes-20261120.json');
const [schedule,ops,versions,pairs,hoopsGames]=['schedule','ops','versions','pairs','hoops-games'].map(n=>read(folder+'/v2-'+n+'.json'));
const asOf='2026-11-21T20:00:30Z',games={},benchmarks=[];
for(const f of batch.rows){
  const final=latestArchivedFinal(schedule,f.gameId,f.gameDay,asOf);
  assert.ok(final);assert.ok(schedule.every(s=>Date.parse(s.recorded_at)<=Date.parse(asOf)));
  const box=ops.filter(x=>x.provider_game_id===f.gameId),v=versions.filter(x=>Number(x.id)===f.gameId);
  assert.equal(box.length,1);assert.equal(v.length,1);assert.equal(v[0].versions,1);
  const g=final.game,p=reconciledPeriods(g);assert.ok(p);
  assert.equal(box[0].g.id,g.id);assert.equal(box[0].g.datetime,g.datetime);assert.equal(box[0].g.status_state,'final');
  assert.deepEqual(reconciledPeriods(box[0].g),p);
  const result=settleProbabilityFreeze(f,{game:g,sourceReceivedAt:final.receivedAt});
  const label=outcomes.outcomes.filter(x=>x.forecastId===f.forecastId);
  assert.deepEqual(label,[{...result,snapshotId:final.snapshotId}]);
  games[g.id]={home:g.home_team.full_name,away:g.visitor_team.full_name,tip:g.datetime,periods:p,snapshotId:final.snapshotId,
    sourceReceivedAt:final.receivedAt,boxReceivedAt:box[0].player_stats_captured_at,finalSnapshots:v[0].final_receipts,
    firstArchivedFinal:v[0].first_final,distinctScoreVersions:v[0].versions};
  const matched=pairs.filter(x=>x.offered.quote_id===f.quoteId);
  assert.equal(matched.length,1);const {offered:a,opposite:b,capture_id:capture,archived_at:archivedAt}=matched[0];
  assert.ok(a && b && a.quote_id!==b.quote_id);
  assert.equal(a.side,'over'); assert.equal(b.side,'under');
  assert.equal(a.provider_game_id,b.provider_game_id);
  const origin=hoopsGames.filter(x=>x.provider_game_id===a.provider_game_id);
  assert.equal(origin.length,1);assert.equal(origin[0].home_team,g.home_team.full_name);assert.equal(origin[0].away_team,g.visitor_team.full_name);
  assert.ok(origin[0].start_timezone_verified && Math.abs(Date.parse(origin[0].start_time)-Date.parse(f.gameStartAt))<=30*60000);
  assert.equal(a.american_odds_approx,f.americanOdds);
  for(const q of [a,b]){
    assert.equal(q.line,f.line);assert.equal(q.market,f.market);assert.equal(q.period,f.period);assert.equal(q.sportsbook,f.book);
    assert.equal(Date.parse(q.provider_updated_at),Date.parse(f.quoteAt));assert.equal(Date.parse(q.source_received_at),Date.parse(f.capturedAt));
    assert.ok(Date.parse(q.source_received_at)<=Date.parse(archivedAt)&&Date.parse(archivedAt)<=Date.parse(f.featuresAsOf));
    assert.ok(Number.isFinite(q.decimal_odds)&&q.decimal_odds>1);
  }
  const imp=1/a.decimal_odds;
  benchmarks.push({forecastId:f.forecastId,quoteId:f.quoteId,oppositeQuoteId:b.quote_id,captureId:capture,book:f.book,
    capturedAt:f.capturedAt,quoteAt:f.quoteAt,decimal:a.decimal_odds,oppositeDecimal:b.decimal_odds,
    probability:imp/(imp+1/b.decimal_odds),basis:'ARCHIVED_DECIMAL_PAIR'});
}
writeFileSync(output,JSON.stringify({asOf,modelHash:batch.modelHash,games,benchmarks},null,2)+'\n',{flag:'wx'});
