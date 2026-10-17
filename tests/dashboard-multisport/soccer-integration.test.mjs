import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseSoccerReport,validSoccerShadow,currentSoccerEdge,soccerModelCohort} from '../../src/lib/soccer-shadow-report.ts';
import {combinedDay,filterDayGames} from '../../src/lib/multisport-day.ts';
import SoccerDashboard from '../../src/components/dashboard/SoccerDashboard.tsx';
const now=new Date('2026-10-16T03:00:00Z');
const fixture=()=>({...JSON.parse(fs.readFileSync(new URL('./fixtures/soccer-shadow.json',import.meta.url),'utf8')),status:'AVAILABLE',readAt:now.toISOString(),providerCalls:0,databaseWrites:0});
const report=()=>parseSoccerReport(fixture(),now);
const slate=(r,date='2026-10-16')=>combinedDay({date,warnings:[],games:[],board:{rows:[]}}, {status:'UNAVAILABLE',warning:'offline'}, {status:'EMPTY',groups:[],entries:[]},undefined,r);
function promoted(){const r=fixture();r.events=r.events.slice(0,1);r.missingQuotes=[];r.scheduledFixtures=1;const e=r.events[0];e.warmupComplete=true;e.warmupEvidence={homeHomeGames:5,awayAwayGames:5,leagueGames:78,asOf:e.quoteCapturedAt,latestHistoryDate:'2026-10-15'};e.qualificationStatus=e.bucket='STRONG';r.metrics.pending=1;return r;}
test('seven real quoted projections remain blocked; high raw edges create no valid picks',()=>{
 const r=report();assert.equal(r.events.length,7);assert.equal(r.missingQuotes.length,3);assert.ok(r.events.some(e=>e.rawSelectedEdgePp>18));assert.ok(r.events.every(e=>!validSoccerShadow(e)&&!currentSoccerEdge(e,r.readAt)));assert.equal(r.metrics.accuracy,null);assert.equal(r.metrics.roiPct,null);assert.equal(soccerModelCohort(r).pending,0);
 const d=slate(r);assert.equal(d.games.length,1);assert.equal(d.selected.length,0);assert.equal(d.edge.length,0);assert.equal(d.games[0].official,0);assert.equal(filterDayGames(d.games,'SOCCER','Picks').length,0);
});
test('tampered quotes, complements, metrics, duplicate events, late entry and bypassed warmup fail closed',()=>{
 const mutations=[r=>r.events[0].over25Decimal=3,r=>r.events[0].modelOver25=.5,r=>r.metrics.roiPct=0,r=>{r.events.push(r.events[0]);r.scheduledFixtures++},r=>r.events[0].quoteCapturedAt=r.events[0].kickoffUtc,r=>{r.events[0].bucket='STRONG';r.events[0].qualificationStatus='STRONG'},r=>r.events[0].warmupComplete=true];
 for(const mutate of mutations){const r=fixture();mutate(r);assert.throws(()=>parseSoccerReport(r,now));}
});
test('valid gate can accept future published STRONG but stale price is excluded from current ranking',()=>{
 const r=parseSoccerReport(promoted(),now);assert.equal(validSoccerShadow(r.events[0]),true);assert.equal(slate(r).selected.length,1);assert.equal(slate(r).games[0].official,0);assert.equal(slate(r).edge.length,0);assert.equal(slate(r).selected[0].decimalOdds,r.events[0].under25Decimal);
 const bad=promoted();bad.events[0].warmupEvidence.homeHomeGames=4;assert.throws(()=>parseSoccerReport(bad,now));
 const late=promoted();late.events[0].warmupEvidence.latestHistoryDate='2026-10-16';assert.throws(()=>parseSoccerReport(late,now));
});
test('fresh future qualified price can enter informational edge without official promotion',()=>{
 const r=promoted(),e=r.events[0];e.quoteLastUpdated='2026-10-16T02:17:30Z';const p=parseSoccerReport(r,now);assert.equal(currentSoccerEdge(p.events[0],p.readAt),true);assert.equal(slate(p).edge.length,1);assert.equal(slate(p).games[0].official,0);
});
test('only qualified frozen selections enter outcome and ROI accounting; malformed settlement is rejected',()=>{
 const r=promoted();r.readAt='2026-10-16T22:00:00Z';r.capturedAt=r.readAt;r.events[0].settlement={homeGoals:1,awayGoals:0,result:'WIN',profitUnits:r.events[0].under25Decimal-1,settledAt:r.readAt,observedAt:r.readAt,final:true,source:'test-final-evidence'};
 r.metrics={...r.metrics,wins:1,pending:0,accuracy:1,profitUnits:r.events[0].under25Decimal-1,roiPct:100*(r.events[0].under25Decimal-1)};
 assert.equal(parseSoccerReport(r,new Date(r.readAt)).metrics.wins,1);
 r.events[0].settlement.profitUnits=1;assert.throws(()=>parseSoccerReport(r,new Date(r.readAt)));
});
test('Soccer UI labels research, raw diagnostics, delayed prices and unavailable metrics',()=>{
 const html=renderToStaticMarkup(React.createElement(SoccerDashboard,{report:report()}));
 for(const x of ['SOCCER_POISSON_V0','INSUFFICIENT_HISTORY','Diagnóstico solamente','Sin edges vigentes','18.45 pp','Affiliate #23','LaLiga','Sin picks válidos liquidados'])assert.ok(html.includes(x),x);
 assert.ok(!html.includes('>STRONG ·'));
});
