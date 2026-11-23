import test from 'node:test';
import assert from 'node:assert/strict';
import {readNhlManualFeaturePages,buildNhlManualFeaturesReport,unavailableNhlManualFeaturesReport,nhlManualFeatureDate,nhlManualFeatureDayBounds,validNhlManualFeatureRow} from '../src/lib/nhl-manual-features.mjs';
import {manualFeature,manualRow} from './fixtures/nhl-manual-features.mjs';

const date='2026-11-23',cutoff='2026-11-23T18:00:00.000Z';
function database(pages) {
  const calls=[];
  const db={from(table){const page=calls.length;const call={table,filters:[],orders:[]};calls.push(call);const q={
    select(columns,options){call.select={columns,options};return q;},
    gte(k,v){call.filters.push(['gte',k,v]);return q;},lt(k,v){call.filters.push(['lt',k,v]);return q;},lte(k,v){call.filters.push(['lte',k,v]);return q;},
    order(k,o){call.orders.push([k,o]);return q;},range(a,b){call.range=[a,b];return q;},abortSignal(){return q;},
    then(resolve,reject){return Promise.resolve(pages[page]).then(resolve,reject);},
  };return q;}};return {db,calls};
}

test('day boundaries use Puerto Rico and reject impossible calendar dates',()=>{
  assert.equal(nhlManualFeatureDate('2026-11-24T02:00:00Z'),date);
  assert.deepEqual(nhlManualFeatureDayBounds(date),{from:'2026-11-23T04:00:00.000Z',to:'2026-11-24T04:00:00.000Z'});
  assert.throws(()=>nhlManualFeatureDayBounds('2026-02-30'),/INVALID_DATE/);
});

test('reader follows server-imposed page sizes and verifies counts before latest/event projection',async()=>{
  const first=manualRow(),later=manualRow({available:'2026-11-23T17:00:00Z',run:'manual-test-002'});
  const {db,calls}=database([{data:[first],count:2},{data:[later],count:2}]);
  const archive=await readNhlManualFeaturePages(db,{date,cutoff,pageSize:100});
  assert.deepEqual(calls.map(x=>x.range),[[0,99],[1,100]]);
  assert.ok(calls.every(x=>x.select.options.count==='exact'&&x.filters.some(([op,k,v])=>op==='lte'&&k==='inserted_at'&&v===cutoff)));
  const report=buildNhlManualFeaturesReport(archive);
  assert.equal(report.status,'READY');assert.equal(report.summary.snapshots,2);assert.equal(report.summary.games,1);
  assert.equal(report.fixtures[0].availableAsOf,later.available_as_of);
  assert.equal(report.fixtures[0].sourceGeneratedAt,first.feature_payload.available_as_of);
  assert.equal(report.fixtures[0].teams.away.goalie.status,'PROBABLE');assert.equal(report.summary.bothGoaliesConfirmed,0);
  assert.equal(report.predictionAdjustment,false);assert.equal(report.modelPromoted,false);
});

test('unavailable, empty, changed counts, truncated pages, duplicate rows and scan caps fail explicitly',async()=>{
  const row=manualRow();
  const cases=[
    [[{error:{code:'PGRST205'}}],'NOT_INSTALLED'],
    [[{error:{code:'42501',message:'secret internal error'}}],'READ_UNAVAILABLE'],
    [[{data:[row],count:null}],'COUNT_UNVERIFIED'],
    [[{data:[row],count:2},{data:[],count:3}],'SNAPSHOT_CHANGED_DURING_READ'],
    [[{data:[row],count:2},{data:[],count:2}],'INCOMPLETE_ARCHIVE_PAGE'],
    [[{data:[row,row],count:2}],'INVALID_OR_DUPLICATE_SNAPSHOT'],
    [[{data:[row],count:513}],'SOURCE_SCAN_CAPPED'],
  ];
  for(const [pages,code] of cases)await assert.rejects(readNhlManualFeaturePages(database(pages).db,{date,cutoff}),new RegExp(code));
  const empty=buildNhlManualFeaturesReport(await readNhlManualFeaturePages(database([{data:[],count:0}]).db,{date,cutoff}));
  assert.equal(empty.status,'EMPTY');assert.equal(empty.summary.games,0);
  const missing=unavailableNhlManualFeaturesReport('NOT_INSTALLED',{date,cutoff});
  assert.equal(missing.status,'NOT_INSTALLED');assert.equal(missing.summary,null);assert.deepEqual(missing.fixtures,[]);
});

test('rejects backdated persistence, future source captures, identity mismatches and promotion flags',()=>{
  assert.equal(validNhlManualFeatureRow(manualRow(),{date,cutoff}),true);
  const corrupt=[r=>{r.inserted_at='2026-11-23T17:00:00Z';},r=>{r.feature_payload.available_as_of='2026-11-23T17:00:00Z';},
    r=>{r.scheduled_at=r.available_as_of;},r=>{r.feature_payload.event_id='nhl:2026020999';},r=>{r.feature_payload.official_pick=true;},
    r=>{r.feature_payload.model_promoted=true;},r=>{r.feature_payload.forecast_probability=.6;},r=>{r.feature_payload.teams.home.abbrev='MIN';}];
  for(const change of corrupt){const row=manualRow();change(row);assert.equal(validNhlManualFeatureRow(row,{date,cutoff}),false);}
});

test('missing metrics stay null and started fixtures remain labelled historical without new forecasts',()=>{
  const f=manualFeature();f.teams.away.last10.shots_for_pg=null;f.teams.away.reported_goalie.name=null;
  const r=buildNhlManualFeaturesReport({rows:[manualRow({feature:f})],date,cutoff:'2026-11-24T01:00:00Z',evidence:{complete:true}});
  assert.equal(r.fixtures[0].teams.away.last10.shotsForPerGame,null);
  assert.equal(r.fixtures[0].teams.away.goalie.name,null);
  assert.equal(r.fixtures[0].phase,'HISTORICAL_SNAPSHOT');assert.equal(r.summary.pregameGames,0);
  assert.ok(!JSON.stringify(r).includes('forecast_probability'));
});
