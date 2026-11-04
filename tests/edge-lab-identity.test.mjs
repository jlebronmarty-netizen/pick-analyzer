import test from 'node:test';import assert from 'node:assert/strict';
import {resolveTeam,forecastRows,boundedGet} from '../src/lib/edge-lab/sources.mjs';
const history=Array.from({length:20},(_,i)=>({date:'2026-11-01',homeTeam:i%2?'Espanol':'La Coruna',awayTeam:i%2?'La Coruna':'Espanol',homeGoals:2,awayGoals:1}));
const now=new Date('2026-11-04T20:00:00Z');const event={id:'401882813',home:'Espanyol',away:'Deportivo',home_id:'88',away_id:'90',scheduled_at:'2026-11-07T15:15:00Z',state:'pre',status:'STATUS_SCHEDULED',time_valid:true,completed:false};const source={season:'2026/27',received_at:now.toISOString(),history_digest:'a'.repeat(64)};
test('Verified ESPN LaLiga alias maps to Football-Data',()=>assert.equal(resolveTeam(['La Coruna'],'Deportivo'),'La Coruna'));
test('Confirmed team 90 may be projected',()=>assert.equal(forecastRows([event],history,now,source).rows.length,2));
test('Same label wrong identifier is not guessed',()=>{const r=forecastRows([{...event,away_id:'999'}],history,now,source);assert.equal(r.rows.length,0);assert.equal(r.skipped[0].reason,'TEAM_ID_CONFLICT');});
test('Canonical history host accepted',async()=>assert.equal(await boundedGet('https://football-data.co.uk/mmz4281/2627/SP1.csv',async()=>new Response('ok')),'ok'));
test('Unexpected redirect remains blocked',async()=>assert.rejects(()=>boundedGet('https://football-data.co.uk/test',async()=>new Response('',{status:302,headers:{location:'https://other.invalid'}}))));
