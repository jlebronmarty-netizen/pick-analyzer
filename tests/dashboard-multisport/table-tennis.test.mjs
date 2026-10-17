import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseTtReport,ttModelCohort,unavailableTt} from '../../src/lib/table-tennis-report.ts';
import {combinedDay,filterDayGames} from '../../src/lib/multisport-day.ts';
import TableTennisDashboard from '../../src/components/dashboard/TableTennisDashboard.tsx';
const now=Date.parse('2026-10-17T15:00:00Z');
// Synthetic accounting fixtures; never published as forecasts or performance.
const forecast=(extra={})=>({id:'f1',source:'pulsescore:netbet-prematch',source_match_id:'event-1',model:'TT_ML_V1',competition:'TT Elite Series',scheduled_at:'2026-10-17T12:00:00Z',captured_at:'2026-10-17T11:00:00Z',player_a:'Alpha',player_b:'Beta',player_a_key:'alpha',player_b_key:'beta',history_a:4,history_b:5,status:'FORECAST',reason:'elo_v1',probability_a:.8,probability_b:.2,projected_total:null,home_decimal_odds:null,away_decimal_odds:null,market_no_vig_a:null,market_no_vig_b:null,model_edge_pp_a:null,model_edge_pp_b:null,...extra});
const final=(extra={})=>({id:'r1',source:'pulsescore:tipsport',source_match_id:'result-1',competition:'TT Elite Series',scheduled_at:'2026-10-17T12:00:00Z',captured_at:'2026-10-17T13:00:00Z',player_a:'Alpha',player_b:'Beta',player_a_key:'alpha',player_b_key:'beta',sets_a:3,sets_b:0,set_points_a:[11,11,11],set_points_b:[6,7,8],total_points_final:54,winner_final:'A',settlement_source:'fixture',settlement_scraped_at:null,...extra});
const fixture=(forecasts=[forecast()],results=[final()])=>({schema:'TT_READ_BRIDGE_V1',status:'AVAILABLE',mode:'RESEARCH_SHADOW_ONLY',complete:true,readAt:new Date(now).toISOString(),providerCalls:0,databaseWrites:0,counts:{forecasts:forecasts.length,results:results.length},forecasts,results});
test('ML win/Brier/log loss and Totals errors use separate denominators',()=>{
 const f=forecast({id:'f2',model:'TT_TOTAL_V1',probability_a:null,probability_b:null,projected_total:60});
 const r=parseTtReport(fixture([forecast(),f]),now);const [ml,total]=r.metrics;
 assert.equal(ml.wins,1);assert.equal(ml.accuracy,1);assert.ok(Math.abs(ml.brier-.04)<1e-12);assert.ok(Math.abs(ml.logLoss+Math.log(.8))<1e-12);
 assert.equal(total.settled,1);assert.equal(total.mae,6);assert.equal(total.meanError,6);assert.equal(total.accuracy,null);assert.equal(total.wins,0);assert.equal(ttModelCohort(r).wins,1);
});
test('reversed final orientation preserves player identity and ML loss',()=>{
 const rev=final({player_a:'Beta',player_b:'Alpha',player_a_key:'beta',player_b_key:'alpha',sets_a:0,sets_b:3,set_points_a:[6,7,8],set_points_b:[11,11,11],winner_final:'B'});
 const r=parseTtReport(fixture([forecast({probability_a:.4,probability_b:.6})],[rev]),now);
 assert.equal(r.metrics[0].losses,1);assert.equal(r.observations[0].outcome,'LOSS');
});
test('duplicate/ambiguous result links and shared final stay unscored',()=>{
 const r=parseTtReport(fixture([forecast()],[final(),final({id:'r2',source_match_id:'result-2',scheduled_at:'2026-10-17T12:05:00Z'})]),now);
 assert.equal(r.observations[0].outcome,'AMBIGUOUS');assert.equal(r.metrics[0].settled,0);assert.equal(r.metrics[0].accuracy,null);
 const shared=parseTtReport(fixture([forecast(),forecast({id:'f2',source_match_id:'event-2',scheduled_at:'2026-10-17T12:05:00Z'})]),now);
 assert.ok(shared.observations.every(r=>r.outcome==='AMBIGUOUS'));
});
test('counts, duplicates, stale reads, late forecasts, final points and probability tampering fail closed',()=>{
 for(const mutate of [r=>r.counts.forecasts++,r=>r.forecasts.push(r.forecasts[0]),r=>r.readAt='2026-10-16T15:00:00Z',r=>r.forecasts[0].captured_at=r.forecasts[0].scheduled_at,r=>r.results[0].total_points_final=55,r=>r.forecasts[0].probability_b=.4,r=>r.complete=false,r=>r.providerCalls=1]){
  const r=fixture();mutate(r);assert.throws(()=>parseTtReport(r,now));
 }
});
test('abstentions/pending preserve null accuracy; unavailable is not zero',()=>{
 const r=parseTtReport(fixture([forecast({status:'ABSTAIN',reason:'insufficient_player_history',probability_a:null,probability_b:null})],[]),now);
 assert.equal(r.metrics[0].abstentions,1);assert.equal(r.metrics[0].pending,0);assert.equal(r.metrics[0].accuracy,null);assert.equal(ttModelCohort(unavailableTt()).available,false);
});
test('daily calendar deduplicates events across two models, never produces Official or current value',()=>{
 const r=parseTtReport(fixture([forecast(),forecast({id:'f2',model:'TT_TOTAL_V1',probability_a:null,probability_b:null,projected_total:60})]),now);
 const d=combinedDay({date:'2026-10-17',warnings:[],games:[],board:{rows:[]}},{status:'UNAVAILABLE',warning:'offline'},{status:'EMPTY',groups:[],entries:[]},undefined,undefined,r);
 assert.equal(d.games.length,1);assert.equal(d.selected.length,2);assert.equal(d.games[0].registered,2);assert.equal(d.games[0].official,0);assert.equal(d.edge.length,0);assert.equal(filterDayGames(d.games,'TABLE_TENNIS','Picks').length,1);
});
test('UI labels SHADOW and Totals non-W/L with separate model filters',()=>{
 const html=renderToStaticMarkup(React.createElement(TableTennisDashboard,{report:parseTtReport(fixture(),now)}));
 for(const text of ['RESEARCH / SHADOW','TT_ML_V1','TT_TOTAL_V1','MAE','No aplica','Modelo tenis de mesa','Estado tenis de mesa','sin Official Picks','±10 minutos'])assert.ok(html.includes(text),text);
});
