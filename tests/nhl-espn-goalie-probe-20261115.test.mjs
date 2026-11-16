import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('ESPN goalie schema investigation can only run in preview, with one free call and no writes',()=>{
 const code=fs.readFileSync('src/app/api/nhl/espn-goalie-schema-probe/route.ts','utf8');
 assert.match(code,/process\.env\.VERCEL_ENV!=='preview'/);
 assert.match(code,/site\.api\.espn\.com\/apis\/site\/v2\/sports\/hockey\/nhl\/scoreboard/);
 assert.match(code,/providerCalls:1,databaseWrites:0/);
 assert.match(code,/Post-start JSON is NOT proof of pregame goalie confirmation/);
 assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(code));
 assert.equal((fs.readFileSync('vercel.json','utf8').match(/\/api\/cron\/nhl-free/g)||[]).length,1);
});
