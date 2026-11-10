import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { operationalDailyPicks } from '../../src/lib/operational-daily-picks.ts'
import MultisportDayView from '../../src/components/dashboard/MultisportDayView.tsx'
import {combinedDay} from '../../src/lib/multisport-day.ts'
import { TodayContent } from '../../src/components/pick2/MlbTodayContent.tsx'
const row=(id,extra={})=>({game_pk:1,game_date:'2026-10-14',start_time:'2026-10-14T22:00:00Z',home_team:'Home',away_team:'Away',side:'HOME',market:'MONEYLINE',status:'VALUE_CANDIDATE',opportunity_status:'VALUE_CANDIDATE',prediction_id:'prediction',value_evaluation_id:id,official_pick_identity:null,model_probability:0.62,consensus_edge:0.07,unit_ev:0.15,american_odds:-110,bookmaker_name:'Stored book',best_book:'book',blocker_codes:[],risk_flags:[],reason_codes:[],why:[],risk_explanation:[],blocker_explanation:[],factor_edge:[],market_freshness:'FRESH',...extra})
const view=(rows,extra={})=>({date:'2026-10-14',asOf:'2026-10-14T12:00:00Z',warnings:[],games:[{gamePk:1,scheduledAt:'2026-10-14T22:00:00Z',gameStatus:'READY',status:'Preview',home:'Home',away:'Away',analysisAvailable:true}],board:{rows},...extra})
test('homepage uses Pick 2 canonical rows with explicit fraction-to-percent conversions',()=>{
 const r=operationalDailyPicks(view([row('v')]))
 assert.equal(r.official.data.length,0);assert.equal(r.edge.data[0].modelProbability,62)
 assert.ok(Math.abs(r.edge.data[0].edgePercentagePoints-7)<1e-10);assert.equal(r.edge.data[0].expectedValuePercent,15)
})
test('persisted official picks stay recorded while current blockers exclude their edge ranking',()=>{
 const r=operationalDailyPicks(view([row('v',{opportunity_status:'OFFICIAL_PICK',official_pick_identity:'pick-1',blocker_codes:['MARKET_NOT_FRESH']})]))
 assert.equal(r.official.data.length,1);assert.match(r.official.data[0].availability,/blocked/);assert.equal(r.edge.data.length,0)
})
test('blocked, started, stale and future-date rows cannot become highest-edge opportunities',()=>{
 const r=operationalDailyPicks(view([row('a',{status:'BLOCKED',opportunity_status:'BLOCKED'}),row('b',{market_freshness:'STALE'}),row('c',{start_time:'2026-10-15T12:00:00Z'})]))
 assert.equal(r.edge.data.length,0)
 assert.equal(operationalDailyPicks(view([row('a')],{games:[{gamePk:1,gameStatus:'STARTED'}]})).edge.data.length,0)
 assert.equal(operationalDailyPicks(view([],{games:[]})).official.status,'UNAVAILABLE')
})
test('homepage retains model overview above a combined connected-sports calendar',()=>{
 const v=view([row('v')]);const day=combinedDay(v,{status:'UNAVAILABLE',warning:'NHL: fuente no disponible'}, {status:'EMPTY',groups:[],entries:[]});
 const html=renderToStaticMarkup(React.createElement(TodayContent,{view:v,performance:React.createElement('div',null,'Model overview'),calendar:React.createElement(MultisportDayView,{day,mlb:v})}))
 for(const text of ['Picks y rendimiento de hoy.','Model overview','Mayor edge del día','62.00%','7.00 pp','href="/mlb-value-board"','Partidos combinados de hoy','NHL: fuente no disponible'])assert.ok(html.includes(text),text)
 assert.ok(html.indexOf('Model overview')<html.indexOf('Calendario de todos los deportes'))
})

test('free tennis tours and NFL appear as time-sorted shadow selections without affecting Official Picks or edge',()=>{
 const report=(league,id,at)=>{
  const e={id,start:at,a:{id:'1',name:league+' Alpha'},b:{id:'2',name:league+' Beta'},state:'PRE',quote:null};
  return {league,status:'AVAILABLE',upcoming:[e],rows:[{forecast:{event:e,league,probabilityA:.61,selectedId:'1'},outcome:'OPEN',price:null}]};
 };
 const v=view([],{games:[]});
 const reports=[report('NFL','1','2026-10-14T23:00:00.000Z'),report('ATP','1','2026-10-14T21:00:00.000Z'),report('WTA','1','2026-10-14T22:00:00.000Z')];
 const day=combinedDay(v,{status:'UNAVAILABLE'},{status:'EMPTY',groups:[],entries:[]},undefined,undefined,undefined,undefined,reports);
 assert.deepEqual(day.games.map(g=>g.key),['ATP:1','WTA:1','NFL:1']);
 assert.deepEqual(day.games.map(g=>g.official),[0,0,0]);
 assert.deepEqual(day.selected.map(p=>p.classification),['NFL · SHADOW','ATP · SHADOW','WTA · SHADOW']);
 assert.ok(day.selected.every(p=>p.modelProbability===61&&p.odds===null));
 assert.equal(day.edge.length,0);
 const html=renderToStaticMarkup(React.createElement(MultisportDayView,{day,mlb:v}));
 assert.match(html,/Ganador proyectado: ATP Alpha/);
 assert.match(html,/href="\/sports-shadow\/tennis"/);
});
