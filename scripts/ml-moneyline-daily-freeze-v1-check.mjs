import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  MLB_ML_HIGH_CONF_ROUTES,
  evaluateMoneylineHighConfidenceHomeV2,
  normalizedComponentScore,
} from '../src/lib/mlb-moneyline-high-confidence-v2.ts'

const read = (path) => readFile(path, 'utf8')
const [service, runtime, cronRoute, consumer, vercelText, migration, packageText] = await Promise.all([
  read('src/services/mlb-moneyline-forward-freeze.service.ts'),
  read('src/services/mlb-moneyline-forward-freeze-runtime.service.ts'),
  read('src/app/api/cron/mlb-statcast-daily/route.ts'),
  read('src/app/api/consumer/v1/mlb/moneyline-recommendations/route.ts'),
  read('vercel.json'),
  read('supabase/migrations/20260916161957_mlb_ml_forward_tracker_runtime_least_privilege_v1.sql'),
  read('package.json'),
])

assert.deepEqual(MLB_ML_HIGH_CONF_ROUTES, [
  { id: 'HC_HOME_R1_STARTER_TEAMPRIOR_LINEUP', teamPriorMin: 1.2, starterMin: 0.6, lineupMatchupMin: 0 },
  { id: 'HC_HOME_R2_STARTER_TEAMPRIOR_RECENT', teamPriorMin: 1.2, starterMin: 0.3, recentFormMin: 0.75 },
  { id: 'HC_HOME_R3_STARTER_TEAMPRIOR_HISTORY', teamPriorMin: 1.4, starterMin: 0.6, historyMin: -0.25 },
  { id: 'HC_HOME_R4_STARTER_TEAMPRIOR_HISTORY_STRICT', teamPriorMin: 1.45, starterMin: 0.25, historyMin: 0.25 },
])

const stats = new Map([
  ['f1', { mean: 10, sd: 2 }],
  ['f2', { mean: 20, sd: 4 }],
])
const component = { mean: 0.5, sd: 0.25 }
assert.equal(normalizedComponentScore([
  { featureName: 'f1', direction: 1, value: 12 },
  { featureName: 'f2', direction: -1, value: 16 },
], stats, component), 2, 'canonical directional-z transform drifted')
assert.equal(normalizedComponentScore([
  { featureName: 'f1', direction: 1, value: 12 },
  { featureName: 'f2', direction: -1, value: null },
], stats, component), 0, 'missing features must keep the declared feature-count denominator')

const routeCases = [
  [{ teamPrior2025: 1.2, starter: 0.6, recentForm: null, history: null, lineupMatchup: 0 }, 'HC_HOME_R1_STARTER_TEAMPRIOR_LINEUP'],
  [{ teamPrior2025: 1.2, starter: 0.3, recentForm: 0.75, history: null, lineupMatchup: null }, 'HC_HOME_R2_STARTER_TEAMPRIOR_RECENT'],
  [{ teamPrior2025: 1.4, starter: 0.6, recentForm: null, history: -0.25, lineupMatchup: null }, 'HC_HOME_R3_STARTER_TEAMPRIOR_HISTORY'],
  [{ teamPrior2025: 1.45, starter: 0.25, recentForm: null, history: 0.25, lineupMatchup: null }, 'HC_HOME_R4_STARTER_TEAMPRIOR_HISTORY_STRICT'],
]
for (const [input, routeId] of routeCases) {
  const result = evaluateMoneylineHighConfidenceHomeV2(input)
  assert.equal(result.pickStatus, 'PICK')
  assert.equal(result.routeId, routeId)
  assert.equal(result.recommendedSide, 'HOME')
  assert.equal(result.failClosed, false)
}

const incomplete = evaluateMoneylineHighConfidenceHomeV2({
  teamPrior2025: 1.2,
  starter: 0.6,
  recentForm: 0,
  history: -1,
  lineupMatchup: null,
})
assert.equal(incomplete.pickStatus, 'NO_PICK')
assert.equal(incomplete.failClosed, true)
assert.ok(incomplete.missingComponents.includes('lineup_matchup'))

const below = evaluateMoneylineHighConfidenceHomeV2({
  teamPrior2025: 1.19,
  starter: null,
  recentForm: null,
  history: null,
  lineupMatchup: null,
})
assert.equal(below.pickStatus, 'NO_PICK')
assert.equal(below.failClosed, false)
assert.equal(below.reason, 'TEAM_PRIOR_BELOW_ALL_ROUTE_MIN')

for (const marker of [
  "const TIME_ZONE = 'America/Puerto_Rico'",
  'const FREEZE_HOUR = 10',
  'const FREEZE_MINUTE = 45',
  ".lt('game_date', targetDate)",
  "event_id: `baseball_mlb:mlb:mlb_official:game:${game.gamePk}`",
  "data_status: 'FROZEN'",
  "source: 'MLB_OFFICIAL_PREGAME_PLUS_PRIOR_DATE_CANONICAL_HISTORY'",
  'officialPickWrites: 0',
  'apostarActive: false',
]) {
  assert.ok(service.includes(marker), `daily freeze service missing invariant: ${marker}`)
}

for (const forbidden of [
  ".from('pick2_mlb_official_picks')",
  'APOSTAR=true',
  'APOSTAR = true',
  'sportsdataio',
]) {
  assert.ok(!service.toLowerCase().includes(forbidden.toLowerCase()), `forbidden production dependency/write found: ${forbidden}`)
}

assert.ok(runtime.includes('runMlbMoneylineForwardFreeze'))
assert.ok(runtime.includes("MLB_OFFICIAL: mlbOfficialCalls"))
assert.ok(runtime.includes('suppliedReadiness ? 1 : 2'))
assert.ok(runtime.includes("status !== 'NOT_IN_FREEZE_WINDOW'"))

assert.ok(cronRoute.includes("runMlbMoneylineForwardFreeze({"))
assert.ok(cronRoute.includes('historyReadiness: {'))
assert.ok(cronRoute.includes('targetDate: readiness.targetDate'))
assert.ok(!cronRoute.includes("from '@/services/mlb-moneyline-forward-freeze.service'"), 'cron must use accounting wrapper')

assert.ok(consumer.includes("failClosedReason: 'FROZEN_FAIL_CLOSED_INPUT_GAP'"))
assert.ok(consumer.includes('(details as Record<string, unknown>).failClosed === true'))

const vercel = JSON.parse(vercelText)
assert.ok(Array.isArray(vercel.crons))
assert.ok(vercel.crons.some((entry) => entry.path === '/api/cron/mlb-statcast-daily' && entry.schedule === '45 14 * * *'), '10:45 America/Puerto_Rico = 14:45 UTC cron missing')

for (const table of [
  'mlb_ml_prior2025_team_v1',
  'mlb_ml_xyear_feature_stats_v1',
  'mlb_ml_xyear_component_stats_v1',
  'mlb_ml_xyear_team_game_v1',
  'mlb_ml_xyear_pitcher_game_v1',
  'mlb_ml_xyear_game_v1',
]) {
  assert.ok(migration.includes(`grant select on table public.${table} to service_role;`), `source table not SELECT-only: ${table}`)
}
assert.ok(migration.includes('revoke all privileges on table public.mlb_ml_forward_tracker_v1 from anon, authenticated, service_role;'))
assert.ok(migration.includes('grant select on table public.mlb_ml_forward_tracker_v1 to service_role;'))
assert.ok(migration.includes('grant insert ('))
assert.ok(migration.includes('grant update (actual_winner,result_status,graded_at,updated_at)'))
assert.ok(!migration.includes('grant update (pick_status'), 'predictive pick_status must never be update-granted')
assert.ok(!migration.includes('pick2_mlb_official_picks'))

const pkg = JSON.parse(packageText)
assert.equal(pkg.scripts.build, 'next build --webpack', 'temporary certification harness must not remain in production build')

console.log(JSON.stringify({
  status: 'PASS',
  contract: 'MLB_MONEYLINE_DAILY_FREEZE_V1',
  modelVersion: 'pregame_high_conf_home_v2',
  freezeTimePuertoRico: '10:45',
  freezeCronUtc: '45 14 * * *',
  canonicalComponentNormalization: 'direction*((value-mean)/sd);missing=0;denominator=declared_feature_count',
  officialPicksWrites: false,
  apostarActive: false,
  sportsbookCalls: 0,
  failClosed: true,
}, null, 2))
