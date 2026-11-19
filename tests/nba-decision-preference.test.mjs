import test from 'node:test';
import assert from 'node:assert/strict';
import {rankNbaPreferredSides,NBA_PREFERRED_SIDE_VERSION} from '../src/lib/nba/decision-preference-core.mjs';

const now='2026-11-19T19:00:00Z',future='2026-11-20T01:00:00Z';
function row(overrides={}){
 return {id:'base',gameId:21718143,matchup:'Golden State Warriors @ Memphis Grizzlies',
  startsAt:future,period:'h1',market:'total',label:'Over',selection:'Over',
  quoteId:'quote-present-123456',quoteFreshness:'RECENT',source:'HoopsAPI',
  capturedAt:'2026-11-19T18:30:00Z',odds:-110,line:109.5,projection:112.69,
  advantage:3.19,sample:14,l5:112,l10:113.1,playerId:null,statistic:null,
  probability:null,expectedValue:null,classification:'VIGILAR',...overrides};
}
test('Screenshot example: one 1H spread side, one total side, and close ML omitted as PASAR',()=>{
 const rows={ml:[],spread:[],total:[],props:[],periods:[
  row({id:'mhome',market:'moneyline',label:'Memphis Grizzlies',selection:'Memphis Grizzlies',line:null,projection:1.11,advantage:null,odds:-176}),
  row({id:'maway',market:'moneyline',label:'Golden State Warriors',selection:'Golden State Warriors',line:null,projection:-1.11,advantage:null,odds:142}),
  row({id:'shome',market:'spread',label:'Memphis Grizzlies',selection:'Memphis Grizzlies',line:-3.5,projection:1.11,advantage:-2.39,odds:-105}),
  row({id:'saway',market:'spread',label:'Golden State Warriors',selection:'Golden State Warriors',line:3.5,projection:-1.11,advantage:2.39,odds:-115}),
  row({id:'over',market:'total',label:'Over',selection:'Over',line:109.5,projection:112.69,advantage:3.19,odds:-110}),
  row({id:'under',market:'total',label:'Under',selection:'Under',line:109.5,projection:112.69,advantage:-3.19,odds:-110}),
 ]};
 const before=structuredClone(rows);
 const result=rankNbaPreferredSides(rows,now);
 assert.deepEqual(rows,before,'raw quotes must remain unchanged for SHADOW freeze and audit');
 assert.equal(result.version,NBA_PREFERRED_SIDE_VERSION);
 assert.equal(result.rows.periods.length,2);
 assert.deepEqual(new Set(result.rows.periods.map(x=>x.id)),new Set(['saway','over']));
 assert.equal(result.rows.periods.some(x=>x.market==='moneyline'),false);
 assert.equal(result.summary.withNoPreferredContract,1);
 assert.equal(result.summary.evaluatedSides,6);
 assert.equal(result.summary.discardedSides,4);
 for(const lead of result.rows.periods){
  assert.equal(lead.classification,'VIGILAR');
  assert.equal(lead.probability,null);
  assert.equal(lead.expectedValue,null);
  assert.equal(lead.preference.evidenceScope,'DESCRIPTIVE_SHADOW_NOT_PROBABILITY');
  assert.ok(lead.preference.favorableCount>=2);
 }
});
test('groups prop alternatives by player and stat, never shows both over and under',()=>{
 const r=row({id:'a',gameId:12,market:'props',period:'ft',
  playerName:'Ejemplo',playerId:99,statistic:'rebounds',label:'Ejemplo · rebounds OVER',
  selection:'Over',line:7.5,projection:9.3,advantage:1.8,sample:10,l5:9.8,l10:9.0,hit5:4,hit10:7,
  minutesL5:31.2,minutesL10:31.6});
 const candidates=[
  r,
  {...r,id:'other',label:'Ejemplo · rebounds UNDER',selection:'Under',
   quoteId:'quote-other-1234',advantage:-1.8},
  {...r,id:'alternate',line:6.5,quoteId:'quote-alternate-1234',advantage:2.8,odds:-950},
  {...r,id:'points',statistic:'points',line:18.5,projection:20.7,advantage:2.2,
   quoteId:'quote-points-1234',label:'Ejemplo · points OVER'}
 ];
 const out=rankNbaPreferredSides({props:candidates},now);
 assert.equal(out.rows.props.length,2,'only one side per player and stat');
 assert.equal(out.rows.props.filter(x=>x.statistic==='rebounds').length,1);
 assert.equal(out.rows.props.find(x=>x.statistic==='rebounds').id,'a');
 assert.equal(out.top25.every(x=>x.probability===null),true);
});
test('a candidate without positive evidence, a stale line, a post-start game, and missing IDs are omitted',()=>{
 const stale=row({id:'stale',quoteFreshness:'STALE_OR_FUTURE',advantage:20});
 const after=row({id:'after',startsAt:'2026-11-19T18:00:00Z',advantage:20});
 const missing=row({id:'missing',quoteId:null,advantage:20});
 const unsupportedPlayer=row({id:'identity',market:'props',period:'ft',playerId:null,statistic:'rebounds',
   playerName:'Jugador ID 9',label:'Jugador ID 9 · rebounds OVER',advantage:20});
 const weak=row({id:'weak',advantage:.05});
 const out=rankNbaPreferredSides({periods:[stale,after,missing,unsupportedPlayer,weak]},now);
 assert.equal(out.rows.periods.length,0);
 assert.equal(out.top25.length,0);
 assert.equal(out.summary.withNoPreferredContract,2);
});
test('ranking is deterministic, descending by favorable conditions; no forced Top 25 filler',()=>{
 const raw=Array.from({length:12},(_,i)=>row({id:'item'+i,gameId:i+1,quoteId:'quote-'+i,
   advantage:1.7+(i%5),line:120+i,projection:121.7+i+(i%5),l5:126+i,l10:125+i,period:'q1',sample:5+i%8,
   capturedAt:'2026-11-19T18:30:00Z'}));
 const rows={periods:raw};
 const out=rankNbaPreferredSides(rows,now);
 assert.ok(out.top25.length<25);
 assert.equal(out.rows.periods.length,raw.length);
 assert.deepEqual(out,rankNbaPreferredSides(rows,now));
 for(let i=1;i<out.rows.periods.length;i++){
  assert.ok(out.rows.periods[i-1].preference.sortIndex>=out.rows.periods[i].preference.sortIndex);
 }
 assert.ok(out.rows.periods.every(r=>r.preference.modelProbability===null));
});
test('different period or market is a different contract; ambiguous double-sided positives pick one',()=>{
 const a=row({id:'left',market:'spread',line:-2.5,projection:5,advantage:2.5,selection:'Memphis Grizzlies',label:'Memphis Grizzlies'});
 const b=row({id:'right',market:'spread',line:2.5,projection:4,advantage:6.5,selection:'Golden State Warriors',label:'Golden State Warriors',quoteId:'quote-other-1234'});
 const c=row({id:'new-period',market:'spread',period:'q3',line:-2.5,projection:5,advantage:2.5,selection:'Memphis Grizzlies',label:'Memphis Grizzlies',quoteId:'quote-q3-1234'});
 const out=rankNbaPreferredSides({periods:[a,b,c]},now);
 assert.equal(out.rows.periods.length,2);
 assert.ok(out.rows.periods.some(r=>r.id==='right'));
 assert.ok(out.rows.periods.some(r=>r.id==='new-period'));
});
