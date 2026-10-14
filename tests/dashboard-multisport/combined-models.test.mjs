import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mlbModelCohorts,displayedModelTotal,nhlModelCohort,OFFICIAL_MLB_MODEL} from '../../src/lib/sport-model-overview.ts';
import {combinedDay,filterDayGames} from '../../src/lib/multisport-day.ts';
import SportModelOverview from '../../src/components/dashboard/SportModelOverview.tsx';
import MultisportDayView from '../../src/components/dashboard/MultisportDayView.tsx';
const research=()=>({status:'AVAILABLE',groups:[{model:'research-a',engine:'PICK_ANALYZER',phase:'REGULAR_SEASON',wins:90,losses:10,pushes:1,voids:1,open:5},{model:'research-a',engine:'PICK_ANALYZER',phase:'POSTSEASON',wins:2,losses:0,pushes:0,voids:0,open:0}],entries:[]});
const official=()=>({status:'STORED_SETTLEMENTS',summary:{wins:1,losses:9,pushes:0,voids:0,modelVersions:[OFFICIAL_MLB_MODEL],dateFrom:'2026-09-05',dateTo:'2026-09-20'},ledger:{pendingUniqueSelections:2}});
const view=()=>({date:'2026-10-14',warnings:[],games:[],board:{rows:[]}});
const nhl=()=>({status:'AVAILABLE',readAt:'2026-10-14T16:00:00Z',health:{status:'PASS',latestRunAt:'2026-10-14T15:30:00Z'},summary:{wins:1,losses:1,pending:1,pushes:0,voids:0,accuracyPct:50},history:[{id:'p',eventId:'1',scheduledAt:'2026-10-14T20:00:00Z',status:'ACTIVE',model:'DRATINGS_PUBLIC_V1',eventName:'AAA @ BBB',direction:'BBB ML',modelProbability:0.6,edgePp:5,odds:-146,sportsbook:'Circa'}],forecasts:[{id:'f',eventId:'1',eventName:'AAA @ BBB',scheduledAt:'2026-10-14T20:00:00Z',capturedAt:'2026-10-14T15:30:00Z',away:'AAA',home:'BBB',awayProbability:0.4,homeProbability:0.6,awayOdds:140,homeOdds:-156,awayEdgePp:-4,homeEdgePp:4}],games:[{eventId:'1',eventName:'AAA @ BBB',scheduledAt:'2026-10-14T20:00:00Z',status:'SCHEDULED',away:'AAA',home:'BBB'},{eventId:'2',eventName:'CCC @ DDD',scheduledAt:'2026-10-14T21:00:00Z',status:'SCHEDULED',away:'CCC',home:'DDD'}]});
test('sport accuracy weights settled model outcomes, keeps phases separate and does not add formula views',()=>{
 const r=research();r.entries=[{id:'same-view-record'}];const [regular,post]=mlbModelCohorts(r,official());
 assert.equal(regular.wins,91);assert.equal(regular.losses,19);assert.equal(regular.pending,7);assert.equal(regular.models,2);assert.equal(regular.accuracy,91/110);
 assert.equal(post.accuracy,1);assert.equal(post.wins,2);assert.equal(post.models,1);
});
test('unknown official model/year, overlapping master cohort or missing source blocks the complete total',()=>{
 for(const o of [null,{...official(),summary:{...official().summary,modelVersions:['unknown']}},{...official(),summary:{...official().summary,dateTo:'2027-01-01'}}])assert.equal(mlbModelCohorts(research(),o)[0].available,false);
 const r=research();r.groups[0].model=OFFICIAL_MLB_MODEL;assert.equal(mlbModelCohorts(r,official())[0].accuracy,null);
 const [c]=mlbModelCohorts({...research(),status:'UNAVAILABLE'},official());assert.equal(displayedModelTotal([c]).available,false);
});
test('global total is descriptive W/L accounting and NHL unknown model identity is retained',()=>{
 const n=nhl();n.history[0].model=null;assert.equal(nhlModelCohort(n).models,null);
 const c=mlbModelCohorts(research(),official())[0],t=displayedModelTotal([c,nhlModelCohort(n)]);
 assert.equal(t.accuracy,92/112);assert.equal(t.wins,92);assert.equal(displayedModelTotal([c,nhlModelCohort({status:'UNAVAILABLE',warning:'offline'})]).accuracy,null);
});
test('calendar includes unmodeled NHL game, sorts starts and filters sports without creating official picks',()=>{
 const d=combinedDay(view(),nhl(),{status:'EMPTY',groups:[],entries:[]});
 assert.equal(d.games.length,2);assert.equal(d.games[1].analyzed,false);assert.equal(filterDayGames(d.games,'NHL','Waiting').length,1);
 assert.equal(filterDayGames(d.games,'MLB','All').length,0);assert.equal(filterDayGames(d.games,'NHL','Picks').length,1);
 assert.equal(d.games.reduce((s,g)=>s+g.official,0),0);assert.equal(d.selected[0].odds,-146);assert.equal(d.edge[0].odds,-156);
});
test('missing calendar is not inferred from forecasts; stale/started source cannot create current NHL edge',()=>{
 const n=nhl();delete n.games;const d=combinedDay(view(),n,{status:'EMPTY',groups:[]});assert.equal(d.games.length,0);assert.match(d.warnings.join(),/calendario completo/);
 const started={...nhl(),readAt:'2026-10-14T22:00:00Z'};assert.equal(combinedDay(view(),started,{status:'EMPTY',groups:[]}).edge.length,0);
 const stale={...nhl(),readAt:'2026-10-14T18:00:00Z'};const s=combinedDay(view(),stale,{status:'EMPTY',groups:[]});assert.equal(filterDayGames(s.games,'NHL','No Edge').length,0);assert.equal(filterDayGames(s.games,'NHL','Waiting').length,2);
 assert.equal(filterDayGames(combinedDay(view(),started,{status:'EMPTY',groups:[]}).games,'ALL','Waiting').length,0);
});
test('research projection keeps its units and phase and never fabricates odds or probability',()=>{
 const r=research();r.groups[0].key='g';r.entries=[{id:'e',groupKey:'g',date:'2026-10-14',gamePk:1,selection:'Doubles under 0.5',projection:0.16,result:'OPEN'}];
 const d=combinedDay(view(),nhl(),r),p=d.selected.find(p=>p.key==='MLB:research:e');assert.equal(p.modelProbability,null);assert.equal(p.odds,null);assert.equal(p.projection,0.16);assert.match(p.classification,/REGULAR_SEASON/);
});
test('MLB formula observations enter the combined Picks filter without becoming official NHL or MLB picks',()=>{
 const v=view();v.games=[{gamePk:1,scheduledAt:'2026-10-14T20:30:00Z',home:'HOME',away:'AWAY',analysisAvailable:false,status:'Preview',reason:'MISSING_STARTER'}];
 const r=research();r.groups[0].key='g';r.entries=[{id:'e',groupKey:'g',date:v.date,gamePk:1,selection:'Under 0.5',projection:0.16,result:'OPEN'}];
 const d=combinedDay(v,nhl(),r),mlb=d.games.find(g=>g.sport==='MLB');assert.equal(d.games.length,3);assert.equal(mlb.registered,1);assert.equal(mlb.official,0);assert.equal(mlb.analyzed,true);assert.equal(filterDayGames(d.games,'MLB','Picks').length,1);assert.equal(d.selected.find(p=>p.sport==='MLB').matchup,'AWAY at HOME');
});
test('sport card links open engine hubs and unknown sports have no invented percentages',()=>{
 const html=renderToStaticMarkup(React.createElement(SportModelOverview,{cards:[{key:'mlb',label:'MLB',href:'/mlb/overview',classification:'Research + production',cohorts:mlbModelCohorts(research(),official())},{key:'nhl',label:'NHL',href:'/nhl',classification:'MODEL_ONLY',cohorts:[nhlModelCohort(nhl())]},{key:'nba',label:'NBA',href:'/sports-center/nba',classification:'Foundation',cohorts:[]}]}));
 for(const s of ['82.73%','href="/mlb/overview"','href="/nhl"','MODEL_ONLY','Playoffs','Resultados no conectados'])assert.ok(html.includes(s),s);
});
test('combined rendered slate preserves missing NHL forecast and original/current prices separately',()=>{
 const mlb=view(),day=combinedDay(mlb,nhl(),{status:'EMPTY',groups:[]});
 const html=renderToStaticMarkup(React.createElement(MultisportDayView,{day,mlb}));
 for(const s of ['Partidos combinados de hoy','CCC @ DDD','Análisis pendiente','MODEL_ONLY','-146','-156','60.00%','Sin pronóstico/precio pareado'])assert.ok(html.includes(s),s);
});
