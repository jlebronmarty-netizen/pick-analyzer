import test from 'node:test';
import assert from 'node:assert/strict';
import {edition,eligible,phase,matches,prDay} from '../src/lib/cheat-sheets/jornada.mjs';
import {allowed} from '../src/app/ncaab-cheat-sheets/access.mjs';
const at=Date.parse('2026-11-28T01:00:00Z'), future=at+60000;
test('Medianoche PR y cortes de hoy explícitos e históricos',()=>{
 assert.deepEqual(edition('2026-11-27',at),edition(undefined,at));
 assert.equal(edition('2026-11-26',at).cutoff,'2026-11-26T17:00:00.000Z');
 assert.equal(prDay(Date.parse('2026-11-28T03:59:59Z')),'2026-11-27');
 assert.equal(prDay(Date.parse('2026-11-28T04:00:00Z')),'2026-11-28');
 assert.equal(edition('2026-02-30',at),null);
});
test('Inicio sin confirmar, final, en curso, aplazamiento y cancelación',()=>{
 for(const state of ['FUT','SCHEDULED','PREGAME']){
  const g={start:future,state};
  assert(eligible(g,at));assert.equal(phase(g,future),'unknown');
  assert(matches(g,'all',future));assert(!matches(g,'live',future));
 }
 for(const [state,expected] of [['CRIT','live'],['OFF','final'],['PPD','postponed'],['CANCELED','cancelled']])
  assert.equal(phase({state,start:at},at),expected);
 assert.equal(phase({state:'FUT',scheduleState:'PPD',start:future},at),'postponed');
});
test('Una baja por vigencia o inicio promueve a los siguientes antes del límite',()=>{
 const rows=Array.from({length:12},(_,i)=>({id:i,state:'PREGAME',start:i===0?future:future+1000,expiry:i===1?future:future+1000}));
 const rank=t=>rows.filter(g=>eligible(g,t,g.expiry)).slice(0,10).map(g=>g.id);
 assert.deepEqual(rank(at),[0,1,2,3,4,5,6,7,8,9]);assert.deepEqual(rank(future),[2,3,4,5,6,7,8,9,10,11]);
});
test('Interfaz NCAAB requiere entorno, host e identidad; el tracker es independiente',()=>{
 const headers=new Headers({host:'private.vercel.app','x-vercel-oidc-token':'test'});
 const env={VERCEL_ENV:'production',VERCEL_URL:'private.vercel.app',NCAAB_CHEAT_SHEETS_ENABLED:'true',NCAAB_CHEAT_TRACKER_ENABLED:'false'};
 assert(allowed(headers,env));assert(!allowed(headers,{...env,NCAAB_CHEAT_SHEETS_ENABLED:'false'}));
 for(const key of ['host','x-vercel-oidc-token']){const h=new Headers(headers);h.delete(key);assert(!allowed(h,env));}
});
test('El ranking compacto conserva inicio, estado y vencimiento hasta el navegador',async()=>{
 const {compactRank}=await import('../src/app/ncaab-cheat-sheets/evidence.mjs');
 const r=JSON.parse(JSON.stringify(compactRank({f:{eventId:"espn:1",state:"PREGAME",scheduledAt:new Date(future).toISOString(),markets:{}},q:{expiresAt:new Date(future-100).toISOString()},team:{name:"Equipo"}})));
 assert(eligible(r.f,at,r.q.expiresAt));assert(!eligible(r.f,future-100,r.q.expiresAt));
 assert.equal(edition('2026-11-26',at,'close').cutoff,'2026-11-27T03:59:59.999Z');
});
