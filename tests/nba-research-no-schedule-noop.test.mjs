import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('src/services/nba-goat-research-capture.service.ts','utf8');
const cron=readFileSync('src/app/api/cron/nba-current-era-shadow/route.ts','utf8');

test('no upcoming fresh schedule is a documented no-provider-call no-op rather than failed capture',()=>{
  assert.match(source,/if\(!games\.length\)\{summary\.noop_reason='NO_FRESH_UPCOMING_SCHEDULE';summary\.eligible_games=0;\}/);
  assert.doesNotMatch(source,/summary\.errors\.push\('NO_FRESH_UPCOMING_SCHEDULE'\)/);
  assert.match(source,/for\(const game of games\)\{/);
  assert.match(source,/const status=summary\.errors\.length\?/);
  assert.match(source,/:'completed'/);
});
test('real failures and provider request budget still remain fail closed',()=>{
  assert.match(source,/catch\(e\)\{summary\.errors\.push\(/);
  assert.match(source,/NBA_RESEARCH_REQUEST_BUDGET_EXHAUSTED/);
  assert.match(source,/provider_calls:0/);
  assert.match(source,/MAX_REQUESTS=16/);
  assert.match(source,/NO_FRESH_UPCOMING_SCHEDULE/);
});
test('does not alter existing NBA GOAT cron or live model stages',()=>{
  assert.match(cron,/captureNbaResearchData\(\{mode:'props'\}\)/);
  assert.match(cron,/runNbaGoatShadowScheduler/);
  assert.match(cron,/reconcileNbaGoatShadowResults/);
});
