import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync('vercel.json','utf8'));
const core=readFileSync('src/app/api/nba/goat/season-core-batch/route.ts','utf8');
const materializer=readFileSync('src/app/api/nba/goat/materialize-props-research/route.ts','utf8');
test('daily GOAT schedules are uniquely named, timezone-local and isolated',()=>{
 const names=['nba-goat-core-daily-research','nba-goat-compact-daily-research','nba-goat-advanced-retry-research'];
 assert.deepEqual(Object.keys(config.schedules).sort(),[...names].sort());
 for(const name of names){
  const x=config.schedules[name];
  assert.equal(x.timezone,'America/Puerto_Rico');
  assert.equal(x.requestMethod,'POST');
  assert.ok(x.path.startsWith('/api/nba/goat/'));
 }
 assert.equal(config.schedules[names[0]].path,'/api/nba/goat/season-core-batch');
 assert.equal(config.schedules[names[1]].path,'/api/nba/goat/materialize-props-research');
});
test('schedule handlers require the private custom research environment and auth',()=>{
 for(const source of [core,materializer]){
  assert.match(source,/VERCEL_TARGET_ENV==='goat-research'/);
  assert.match(source,/VERCEL_ENV==='preview'/);
  assert.match(source,/ce-vssschedulename/);
  assert.match(source,/com\.vercel\.schedule\.v1beta/);
  assert.match(source,/authorization/);
  assert.match(source,/process\.env\.CRON_SECRET/);
 }
 assert.match(core,/const callCap=scheduled\?20:CALL_CAP/);
 assert.match(core,/if\(calls>=callCap\)/);
 assert.match(materializer,/GAME_CAP=10/);
});
test('legacy NBA production cron remains unchanged and no new legacy cron exists',()=>{
 const nba=config.crons.filter(r=>r.path==='/api/cron/nba-current-era-shadow');
 assert.equal(nba.length,1);
 assert.equal(nba[0].schedule,'*/30 * * * *');
 assert.equal(config.crons.length,10);
});
