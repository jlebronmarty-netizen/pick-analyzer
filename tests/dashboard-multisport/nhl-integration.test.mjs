import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseNhlReport, unavailableNhlReport } from '../../src/lib/nhl-external-report.ts';
import { nhlOpportunities, filterNhlHistory, nhlDate } from '../../src/lib/nhl-view.ts';
import NhlDashboard from '../../src/components/dashboard/NhlDashboard.tsx';
import NhlHomepageSummary from '../../src/components/dashboard/NhlHomepageSummary.tsx';
import { summarizeOfficialSports } from '../../src/lib/official-performance-overview.ts';
const at='2026-10-14T16:00:00Z';
const pick=(id,outcome,profit)=>({id,eventId:id,eventName:'AAA @ BBB',scheduledAt:'2026-10-13T20:00:00Z',createdAt:'2026-10-13T15:00:00Z',direction:'AAA ML',odds:150,modelProbability:0.6,edgePp:5,tier:'LEAN',quality:'INSUFFICIENT',classification:'MODEL_ONLY',status:'SETTLED',locked:true,sportsbook:'Circa',model:'DRATINGS_PUBLIC_V1',settlement:{outcome,profitUnits:profit,result:'AAA 3 - BBB 1',settledAt:'2026-10-13T23:00:00Z'}});
const fixture=()=>({schema:'NHL_READ_BRIDGE_V1',status:'AVAILABLE',sport:'NHL',classification:'MODEL_ONLY',source:'SPORTS_EDGE_HUB',readAt:at,date:'2026-10-14',health:{status:'PASS',issues:[],latestRunAt:'2026-10-14T15:30:00Z',runStatus:'PARTIAL',coverage:1,eligible:2},summary:{settled:2,wins:1,losses:1,pushes:0,voids:0,pending:0,accuracyPct:50,profitUnits:0.5,roiPct:25,staked:2},history:[pick('1','WIN',1.5),pick('2','LOSS',-1)],forecasts:[{id:'f',eventId:'e',eventName:'AAA @ BBB',scheduledAt:'2026-10-14T20:00:00Z',capturedAt:'2026-10-14T15:30:00Z',away:'AAA',home:'BBB',awayProbability:0.6,homeProbability:0.4,awayOdds:150,homeOdds:-170,awayEdgePp:5,homeEdgePp:-5,model:'DRATINGS_PUBLIC_V1',sportsbook:'CIRCA'}],providerCalls:0,databaseWrites:0,warning:'External model only'});
test('live contract strips unknown fields, preserves fractional probabilities and validates complete totals',()=>{
 const input={...fixture(),secret:'do not forward'};const r=parseNhlReport(input,new Date(at));
 assert.equal(r.history[0].modelProbability,0.6);assert.equal(r.summary.accuracyPct,50);assert.equal(r.secret,undefined);
 for(const bad of [{...fixture(),summary:{...fixture().summary,wins:2}},{...fixture(),classification:'MODEL_CERTIFIED'},{...fixture(),history:[...fixture().history,fixture().history[0]]},{...fixture(),readAt:'2026-10-14T14:00:00Z'}])assert.throws(()=>parseNhlReport(bad,new Date(at)));
});
test('stale, started or unhealthy forecasts cannot enter current edge ranking',()=>{
 const r=fixture();assert.equal(nhlOpportunities(r).length,1);
 for(const change of [{...r,health:{...r.health,status:'ATTENTION'}},{...r,forecasts:[{...r.forecasts[0],capturedAt:'2026-10-14T14:00:00Z'}]},{...r,forecasts:[{...r.forecasts[0],scheduledAt:'2026-10-14T15:59:00Z'}]}])assert.deepEqual(nhlOpportunities(change),[]);
});
test('date/outcome filtering uses PR date and never changes complete-cohort summary',()=>{
 const r=fixture();assert.equal(nhlDate('2026-10-14T02:00:00Z'),'2026-10-13');
 assert.equal(filterNhlHistory(r,'2026-10-13','LOSS').length,1);assert.equal(filterNhlHistory(r,'2026-10-14','ALL').length,0);assert.equal(r.summary.accuracyPct,50);
});
test('NHL cards and history render distinct MODEL_ONLY scope with prices, results and coverage',()=>{
 const r=parseNhlReport(fixture(),new Date(at));const html=renderToStaticMarkup(React.createElement(NhlDashboard,{report:r}));
 for(const text of ['MODEL_ONLY','50.00%','25.00%','0.50u','Historial y settlement','Pronósticos del día','60.00%','WIN','LOSS','1/2'])assert.ok(html.includes(text),text);
 assert.ok(html.includes('no un registro de apuestas reales'));
 const teaser=renderToStaticMarkup(React.createElement(NhlHomepageSummary,{report:r}));assert.ok(teaser.includes('separados del accuracy oficial general'));
});
test('source failure displays no fake accuracy, profit, historical fallback or recommendations',()=>{
 const r=unavailableNhlReport(),html=renderToStaticMarkup(React.createElement(NhlDashboard,{report:r}));assert.ok(html.includes('no está disponible'));assert.ok(!html.includes('50.00%'));assert.ok(!html.includes('0.00u'));
});
test('NHL MODEL_ONLY results do not change official all-sport accuracy',()=>{
 const sports=[{key:'mlb',label:'MLB',readiness:'Production',connected:true,available:true,wins:19,losses:23,pushes:0,voids:0,pending:0},{key:'nhl',label:'NHL',readiness:'MODEL_ONLY',connected:false,available:false,wins:null,losses:null,pushes:null,voids:null,pending:null}];
 assert.equal(summarizeOfficialSports(sports).accuracy,19/42);
});
test('additive NHL calendar validates unique date-scoped games and matches forecast identities',()=>{
 const r=fixture();r.games=[{eventId:'e',eventName:'AAA @ BBB',scheduledAt:'2026-10-14T20:00:00Z',status:'SCHEDULED',away:'AAA',home:'BBB'}];assert.equal(parseNhlReport(r,new Date(at)).games.length,1);
 for(const games of [[...r.games,...r.games],[{...r.games[0],scheduledAt:'2026-10-13T20:00:00Z'}],[{...r.games[0],home:'WRONG'}],[]])assert.throws(()=>parseNhlReport({...r,games},new Date(at)));
});
