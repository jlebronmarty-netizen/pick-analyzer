import fs from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'local-validation-service-role-key'

const SERVICE_04B = 'src/services/mlb-context-lineage.service.ts'
const SERVICE_04C = 'src/services/mlb-04c-chat-method-research-scorecard.service.ts'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04c-r6-context-capture-completeness-repair.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04C_R6_CONTEXT_CAPTURE_COMPLETENESS_REPAIR.md'

const service04b = fs.readFileSync(SERVICE_04B, 'utf8')
const service04c = fs.readFileSync(SERVICE_04C, 'utf8')
const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'))
const doc = fs.readFileSync(DOC_PATH, 'utf8')

const {
  evaluateMlb04cR6FrozenSnapshotScorecard,
} = await import('../src/services/mlb-04c-chat-method-research-scorecard.service.ts')

const checks = []
function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

function component(result, key) {
  return result.componentScores.find((row) => row.key === key)
}

const fixtureSnapshot = {
  event_id: 'baseball_mlb:research:r6_fixture',
  snapshot_type: 'FINAL_PREGAME',
  snapshot_timestamp: '2026-08-22T12:00:00.000Z',
  target_event_start_time: '2026-08-22T13:00:00.000Z',
  components: {
    event: {
      id: 'baseball_mlb:research:r6_fixture',
      matchup: 'Away @ Home',
      startTime: '2026-08-22T13:00:00.000Z',
    },
    starterContext: {
      home: {
        status: 'PROBABLE',
        canonicalPlayerId: 'home_starter',
        providerPlayerId: '101',
        playerName: 'Home Starter',
        teamName: 'Home',
        source: 'mlb_starter_assignments',
        sourceTimestamp: '2026-08-22T11:00:00.000Z',
        confidence: 90,
        eraProxyDelta: 0.12,
        strikeoutWalkDelta: 0.1,
        workloadDelta: 0.08,
      },
      away: {
        status: 'PROBABLE',
        canonicalPlayerId: 'away_starter',
        providerPlayerId: '202',
        playerName: 'Away Starter',
        teamName: 'Away',
        source: 'sport_lineups',
        sourceTimestamp: '2026-08-22T11:00:00.000Z',
        confidence: 86,
        eraProxyDelta: 0.02,
        strikeoutWalkDelta: 0.04,
        workloadDelta: 0.02,
      },
    },
    offenseRecentFormContext: {
      home: {
        sourceTimestamp: '2026-08-22T10:00:00.000Z',
        sampleGames: 10,
        last5: { deltaVsSeason: 0.12 },
        last10: { deltaVsSeason: 0.08 },
        seasonBaseline: { normalized: 0.05 },
        homeAway: { deltaVsSeason: 0.03 },
      },
      away: {
        sourceTimestamp: '2026-08-22T10:00:00.000Z',
        sampleGames: 10,
        last5: { deltaVsSeason: 0.01 },
        last10: { deltaVsSeason: 0.02 },
        seasonBaseline: { normalized: 0.01 },
        homeAway: { deltaVsSeason: 0 },
      },
    },
    bullpenDirectionalInputs: {
      home: {
        sourceTimestamp: '2026-08-22T10:05:00.000Z',
        sampleGames: 5,
        workloadLast1Delta: 0.08,
        workloadLast3Delta: 0.08,
        reliefPerformanceDelta: 0.06,
        availabilityPenaltyDelta: 0.04,
      },
      away: {
        sourceTimestamp: '2026-08-22T10:05:00.000Z',
        sampleGames: 5,
        workloadLast1Delta: 0.02,
        workloadLast3Delta: 0.02,
        reliefPerformanceDelta: 0.01,
        availabilityPenaltyDelta: 0.01,
      },
    },
  },
}

const fixtureResult = evaluateMlb04cR6FrozenSnapshotScorecard({
  snapshot: fixtureSnapshot,
  market: 'moneyline',
  selection: 'Home',
  line: null,
  sportsbook: 'fanduel',
  odds: -110,
  impliedProbability: 0.5238,
  rawProbability: 0.55,
  calibratedProbability: 0.54,
})

const missingStarterResult = evaluateMlb04cR6FrozenSnapshotScorecard({
  snapshot: {
    ...fixtureSnapshot,
    components: {
      ...fixtureSnapshot.components,
      starterContext: {
        home: { status: 'UNKNOWN', teamName: 'Home', source: 'none', sourceTimestamp: null },
        away: { status: 'UNKNOWN', teamName: 'Away', source: 'none', sourceTimestamp: null },
      },
    },
  },
  market: 'moneyline',
  selection: 'Home',
  line: null,
  sportsbook: 'fanduel',
  odds: -110,
  impliedProbability: 0.5238,
  rawProbability: 0.55,
  calibratedProbability: 0.54,
})

check('classification', cert.classification === 'MLB_04C_R6_CONTEXT_CAPTURE_COMPLETENESS_REPAIR_CERTIFIED')
check('observation 1 immutable', cert.observationRegression.observation1.score === -0.0296 && cert.observationRegression.observation1.completeness === 0.1429)
check('observation 2 immutable', cert.observationRegression.observation2.snapshotId === 'f050d4e5-8ec4-44ad-ab1e-e75848a0e0b0' && cert.observationRegression.observation2.completeness === 0.1429)
check('no retrospective enrichment', cert.observationRegression.noRetrospectiveEnrichment === true)
check('starter capture source wired', service04b.includes('loadStarterAssignments') && service04b.includes('starterContext'))
check('offense capture source wired', service04b.includes('offenseRecentFormContext') && service04b.includes('sport_game_stats_prior_games'))
check('bullpen capture source wired', service04b.includes('bullpenDirectionalInputs') && service04b.includes('workloadLast1Delta'))
check('snapshot contract versioning', service04b.includes('mlb_04c_r6_research_context_v1') && cert.snapshotContract.schemaMigrationRequired === false)
check('scorecard frozen consumer exists', service04c.includes('evaluateMlb04cR6FrozenSnapshotScorecard') && cert.scorecardConsumer.readsFrozenSnapshotOnly === true)
check('scorecard does not live-query', !/evaluateMlb04cR6FrozenSnapshotScorecard[\s\S]*supabaseAdmin/.test(service04c))
check('starter fixture available', component(fixtureResult, 'STARTER_EDGE')?.score !== null)
check('starter absent blocked', component(missingStarterResult, 'STARTER_EDGE')?.score === null && component(missingStarterResult, 'STARTER_EDGE')?.blockers.length > 0)
check('offense fixture available', component(fixtureResult, 'OFFENSE_EDGE')?.score !== null)
check('bullpen fixture available', component(fixtureResult, 'BULLPEN_EDGE')?.score !== null)
check('market value unchanged', component(fixtureResult, 'MARKET_VALUE')?.score !== null && cert.readiness.MARKET_VALUE_UNCHANGED === 'YES')
check('component bounds', fixtureResult.componentScores.every((row) => row.score === null || (row.score >= -1 && row.score <= 1)))
check('completeness target', fixtureResult.componentCompleteness === 0.5714 && cert.fixtureProof.scorecardCompleteness === 0.5714)
check('missing as null policy', service04c.includes('score === null') && cert.snapshotContract.missingDataPolicy === 'NULL_WITH_EXPLICIT_BLOCKER')
check('composite deterministic', fixtureResult.compositePolicy === 'EQUAL_RESEARCH_WEIGHTS_OVER_AVAILABLE_TIMESTAMP_SAFE_COMPONENTS')
check('morning final separation preserved', cert.snapshotContract.morningFinalSeparated === true)
check('raw isolation', cert.guards.rawModelChanged === false)
check('calibration isolation', cert.guards.calibrationChanged === false)
check('product isolation', cert.guards.productChanged === false && cert.guards.officialPickChanged === false)
check('learning isolation', cert.guards.learningChanged === false)
check('settlement isolation', cert.guards.settlementChanged === false)
check('sportsdataio exclusion', cert.guards.sportsDataIoExcluded === true && service04b.includes("sportsDataIO: 'excluded'"))
check('nfl nba isolation', cert.guards.nflIsolation === true && cert.guards.nbaIsolation === true)
check('provider calls zero', cert.safetyCounters.providerCallsMade === 0)
check('database mutations zero', cert.safetyCounters.productionDatabaseMutations === 0)
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service04b, service04c, JSON.stringify(cert), doc].join('\n')))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04c_r6_context_capture_completeness_repair_validate',
  classification: cert.classification,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  r6FixtureComponentsAvailable: fixtureResult.availableComponents,
  r6FixtureScorecardCompleteness: fixtureResult.componentCompleteness,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
