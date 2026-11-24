import test from 'node:test';
import assert from 'node:assert/strict';
import {nbaManualAccess} from '../src/lib/nba/manual-access.mjs';
const host='pick-analyzer-private.vercel.app';
const prod={VERCEL_ENV:'production',NBA_DECISION_BOARD_ENABLED:'true',VERCEL_URL:host};
const request=(hostname=host,token=true,headerHost=hostname)=>new Request('https://'+hostname+'/api/nba/manual-data',{headers:{host:headerHost,...(token?{'x-vercel-oidc-token':'fixture-not-a-real-token'}:{})}});
test('production never serves manual archive on public alias or spoofed host',()=>{
 assert.equal(nbaManualAccess(request('pick-analyzer.vercel.app'),prod)?.status,404);
 assert.equal(nbaManualAccess(request('pick-analyzer.vercel.app',true,host),prod)?.status,404);
 assert.equal(nbaManualAccess(request(host,true,'pick-analyzer.vercel.app'),prod)?.status,404);
});
test('private production deployment requires Vercel auth header and enabled board',()=>{
 assert.equal(nbaManualAccess(request(host,false),prod)?.status,401);
 assert.equal(nbaManualAccess(request(),{...prod,NBA_DECISION_BOARD_ENABLED:'false'})?.status,404);
 assert.equal(nbaManualAccess(request(),prod),null);
});
test('preview requires auth, development disabled',()=>{
 assert.equal(nbaManualAccess(request(host,false),{VERCEL_ENV:'preview'})?.status,401);
 assert.equal(nbaManualAccess(request(),{VERCEL_ENV:'preview'}),null);
 assert.equal(nbaManualAccess(request(),{VERCEL_ENV:'development'})?.status,404);
});
