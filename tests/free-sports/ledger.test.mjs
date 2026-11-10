import assert from 'node:assert/strict';
import test from 'node:test';
import {issueForecasts,resolve,metrics} from '../../src/lib/free-sports/model.ts';
import {parseEspn,parseBsn} from '../../src/lib/free-sports/sources.ts';

const now='2026-11-10T12:00:00.000Z',start='2026-11-12T12:00:00.000Z';
const a={id:'1',name:'Home Team'},b={id:'2',name:'Away Team'};
const fixture={id:'401',start,a,b,state:'PRE',winner:null,reason:null,quote:{book:'DraftKings',a:-125,b:110,capturedAt:now}};
const final=(day,i)=>({...fixture,id:String(i),start:'2026-11-0'+day+'T12:00:00.000Z',state:'FINAL',winner:a.id,quote:null});
const facts=[final(4,1),final(5,2),final(6,3)];
const prediction=()=>issueForecasts('NFL',[...facts,fixture],now,now)[0];
test('only known prior UTC dates enter the pregame model; no insufficient or in-play forecasts',()=>{
 const today={...final(6,4),start:'2026-11-10T09:00:00.000Z',winner:b.id};
 const next={...final(6,5),start:'2026-11-11T09:00:00.000Z',winner:b.id};
 const f=prediction();
 assert.ok(f.probabilityA>.5);
 assert.equal(f.priorA,3);
 assert.deepEqual(issueForecasts('NFL',[...facts,today,next,fixture],now,now),[f]);
 assert.deepEqual(issueForecasts('NFL',[...facts.slice(0,2),fixture],now,now),[]);
 assert.deepEqual(issueForecasts('NFL',[...facts,{...fixture,state:'LIVE'}],now,now),[]);
 assert.deepEqual(issueForecasts('NFL',[...facts,{...fixture,start:now}],now,now),[]);
});
test('settlement is ID based; pricing is frozen; contradictory/rescheduled results require review',()=>{
 const f=prediction(),played='2026-11-13T12:00:00.000Z';
 const obs={event_id:'401',start_at:start,a_id:b.id,b_id:a.id,outcome:a.id,observed_at:played};
 const win=resolve(f,[obs],played);
 const loss=resolve({...f,event:{...f.event,quote:null}},[{...obs,outcome:b.id}],played);
 assert.equal(win.outcome,'WIN');
 assert.ok(Math.abs(win.profit-.8)<1e-12);
 assert.equal(loss.outcome,'LOSS');
 assert.equal(loss.profit,null);
 const stats=metrics([win,loss]);
 assert.equal(stats.accuracy,50);
 assert.equal(stats.priced,1);
 assert.ok(Math.abs(stats.roi-80)<1e-9);
 assert.equal(metrics([loss]).roi,null);
 assert.equal(resolve(f,[{...obs,observed_at:'2026-11-01T00:00:00.000Z'}],played).outcome,'AWAITING_RESULT');
 assert.equal(resolve(f,[{...obs,start_at:played}],played).outcome,'REVIEW');
 assert.equal(resolve(f,[obs,{...obs,outcome:b.id}],played).outcome,'REVIEW');
 assert.equal(resolve(f,[{...obs,outcome:'TIE'}],played).outcome,'EXCLUDED');
 assert.equal(resolve({...f,event:{...f.event,quote:{...f.event.quote,capturedAt:played}}},[obs],played).profit,null);
});
test('ESPN prices require the exact pregame NFL two-way event/side pair',()=>{
 const team=(p,homeAway)=>({id:p.id,team:{id:p.id,displayName:p.name},homeAway,score:p===a?'20':'12'});
 const offer=(odds,betSide)=>({odds,link:{tracking:{tags:{gameId:401,betSide}}}});
 const status={type:{name:'STATUS_SCHEDULED',completed:false,state:'pre'}};
 const odds={provider:{id:'100',name:'Draft Kings'},homeTeamOdds:{team:{id:a.id}},awayTeamOdds:{team:{id:b.id}},moneyline:{displayName:'Moneyline',home:{close:offer('-125','home')},away:{close:offer('+110','away')}}};
 const comp={id:'401',date:start,timeValid:true,status,competitors:[team(a,'home'),team(b,'away')],odds:[odds]};
 const parse=(c,season={year:2026,type:2})=>parseEspn({events:[{id:'401',season,competitions:[c]}]},'NFL',now,2026);
 assert.deepEqual(parse(comp)[0].quote,fixture.quote);
 assert.equal(parse({...comp,odds:[{...odds,awayTeamOdds:{team:{id:'88'}}}]})[0].quote,null);
 assert.equal(parse({...comp,date:'2026-11-09T12:00:00.000Z',status:{type:{name:'STATUS_FINAL',completed:true,state:'post'}}})[0].quote,null);
 assert.deepEqual(parse(comp,{year:2026,type:3}),[]);
 assert.deepEqual(parse({...comp,timeValid:false}),[]);
});
test('tennis retirements do not become decisive; BSN requires explicit pregame provenance',()=>{
 const c={id:'401',date:'2026-11-08T12:00:00.000Z',timeValid:true,status:{type:{name:'STATUS_RETIRED',completed:true,state:'post'}},
  competitors:[{id:'1',athlete:{fullName:'Player One'},winner:true},{id:'2',athlete:{fullName:'Player Two'},winner:false}]};
 const rows=parseEspn({events:[{id:'3-2026',groupings:[{grouping:{slug:'mens-singles'},competitions:[c]}]}]},'ATP',now,2026);
 assert.equal(rows[0].state,'EXCLUDED');
 assert.equal(rows[0].winner,null);
 const bsn={id:'bsn_1',start_time:start,home_team_id:'home',away_team_id:'away',home_team:'Home',away_team:'Away',status:'scheduled',home_score:null,away_score:null,metadata:null};
 assert.deepEqual(parseBsn([bsn],now),[]);
 assert.equal(parseBsn([{...bsn,metadata:{free_shadow_attestation:{source:'operator_attested_csv',capturedAt:now,reference:'verified.csv'}}}],now)[0].state,'PRE');
});
