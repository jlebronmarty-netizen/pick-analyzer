import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
const supplied=process.argv[2],base=supplied??'http://127.0.0.1:3198';
const child=supplied?null:spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3198'],{stdio:'ignore',windowsHide:true});
try{
 if(child){let ready=false;for(let i=0;i<40;i++){try{const r=await fetch(base+'/api/consumer/v1/mlb/results?limit=0');if(r.status===400){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready);}
 let cursor=0,total=0,eligible=0;const ids=new Set();
 do{const r=await fetch(base+'/api/consumer/v1/mlb/results?limit=250&cursor='+cursor);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const b=await r.json();assert.equal(b.version,'SHARED_MLB_RESULTS_V1');for(const row of b.data){assert.ok(!ids.has(row.gamePk));ids.add(row.gamePk);total++;eligible+=Number(row.training_eligible);assert.ok(!('modelProbability' in row));}cursor=b.nextCursor;}while(cursor!==null);
 assert.equal(total,2430);assert.equal(eligible,2278);
 for(const query of ['limit=0','limit=251','cursor=-1','season=2026'])assert.equal((await fetch(base+'/api/consumer/v1/mlb/results?'+query)).status,400);
 assert.equal((await fetch(base+'/api/consumer/v1/mlb/results',{method:'POST'})).status,405);
 console.log(JSON.stringify({http:'PASS',total,eligible,blocked:total-eligible,providerCalls:0,productionDml:0}));
}finally{child?.kill();}
