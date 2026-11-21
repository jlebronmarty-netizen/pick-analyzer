import test from 'node:test';
import assert from 'node:assert/strict';
import {operatorHost,observationTransport} from '../src/lib/nba/decision-observe-v2.mjs';
import {planReadOnlyBatch,runDaily} from '../scripts/research/nba-v2/daily/runner.mjs';
import {makeBoard,model,at} from './fixtures/nba-v2-cycle.mjs';

test('operator audit requires the private production deployment and a dormant scheduled adapter',()=>{
  const env={VERCEL_URL:'pick-analyzer-test.vercel.app',VERCEL_ENV:'production',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40)};
  const request=(host=env.VERCEL_URL,token='platform',search='')=>new Request('https://'+host+'/api/operations/nba-v2-observe'+search,{headers:{host,'x-vercel-oidc-token':token}});
  assert.ok(operatorHost(request(),env));
  for(const [req,cfg] of [[request(),{...env,NBA_DECISION_V2_MODE:'shadow'}],[request(),{...env,VERCEL_ENV:'preview'}],[request('pick-analyzer.vercel.app'),env],[request(env.VERCEL_URL,''),env],[request(env.VERCEL_URL,'platform','?run=1'),env]]){
    assert.equal(operatorHost(req,cfg),false);
  }
});
test('observer transport meters actual response bytes and only reaches permitted archive reads',async()=>{
  const base='https://example.supabase.co',io=observationTransport(base,async()=>new Response('á'));
  for(const [method,path] of [['GET','/rest/v1/nba_game_context_v2'],['GET','/storage/v1/object/authenticated/archive/file'],['POST','/rest/v1/rpc/nba_v2_shadow_due']]){
    assert.equal(await (await io.fetch(base+path,{method})).text(),'á');
  }
  for(const [url,method] of [[base+'/rest/v1/rpc/nba_v2_shadow_commit','POST'],[base+'/rest/v1/rpc/nba_v2_shadow_commit','GET'],[base+'/rest/v1/x','PATCH'],['https://elsewhere.example/rest/v1/games','GET']]){
    await assert.rejects(io.fetch(url,{method}),/OBSERVATION_READ_BOUNDARY/);
  }
  assert.deepEqual(io.metrics,{requests:3,restReads:1,storageReads:1,rpcReads:1,responseBytes:6,httpErrors:0});
});
test('read-only planning at operator time leaves all scheduled slot enforcement in place',async()=>{
  const board=makeBoard(),now=new Date(Date.parse(at)+2*3600000).toISOString();
  const dry=await planReadOnlyBatch({kind:'settle',model,at:now,port:{due:async()=>[]}});
  assert.equal(dry.at,now);assert.equal(dry.records.length,0);
  for(const write of [true,false]) await assert.rejects(runDaily({kind:'settle',model,clock:()=>now,write}),/OUTSIDE_EXISTING_NBA_SLOT/);
  const freeze=await planReadOnlyBatch({kind:'freeze',model,at,board});assert.equal(freeze.records.length,1);
});
