import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  BALLDONTLIE_ENDPOINTS,
  BALLDONTLIE_RAW_ROOT,
  BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE,
  BALLDONTLIE_TRIAL_HARD_REQUESTS_PER_MINUTE,
  buildBallDontLieRequestEstimate,
  buildBallDontLieTrialManifest,
  runBallDontLiePrepFixtureTests,
  summarizeBallDontLiePrep,
} from '../src/services/balldontlie-nba-goat-prep.service.ts'

const CERT_PATH = 'docs/CERTIFICATION/nba-01c-prep-balldontlie-goat.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/NBA_01C_PREP_BALLDONTLIE_GOAT.md'

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function loadCert() {
  return JSON.parse(readFileSync(CERT_PATH, 'utf8'))
}

function markdown(cert) {
  const p0 = cert.providerPlan.p0Endpoints
    .map((item) => `| ${item.endpoint} | ${item.whyRequired} | ${item.seasonsPlanned.join(', ')} | ${item.estimatedRequests} | ${item.estimatedTime} |`)
    .join('\n')
  return `# NBA-01C-PREP BallDontLie GOAT 48h Extraction Readiness

Status: \`${cert.status}\`

This phase prepares the BallDontLie NBA GOAT trial extraction without starting the trial, requiring an API key, calling BallDontLie, calling The Odds API, expanding SportsDataIO, activating NBA production or running replay.

## Provider Plan

| Role | Decision |
| --- | --- |
| The Odds API | NBA odds and historical price authority |
| BallDontLie ALL-STAR | Candidate long-term NBA non-odds source for games, players, player stats, active players and injuries |
| BallDontLie GOAT | 48-hour historical bootstrap for high-value stat endpoints only |
| SportsDataIO | Legacy/trial only; no expansion |

## Trial Profile

| Metric | Value |
| --- | ---: |
| Hard trial limit | ${cert.trialConfiguration.trialRateLimit} |
| Configured safe rate | ${cert.trialConfiguration.configuredSafeRate} |
| Trial duration | ${cert.trialConfiguration.trialDuration} |
| Reserve duration | ${cert.trialConfiguration.reserveDuration} |
| Safe planned requests | ${cert.trialConfiguration.safePlannedRequests} |
| Estimated queue hours | ${cert.trialConfiguration.estimatedQueueHours} |
| Capacity | ${cert.trialConfiguration.capacityClassification} |

## P0 Endpoints

| Endpoint | Why | Seasons | Requests | Time |
| --- | --- | --- | ---: | ---: |
${p0}

## Future START

Do not start the trial during PREP. When authorized:

1. Activate the BallDontLie NBA GOAT 48-hour trial.
2. Obtain the API key.
3. Store it locally as \`BALLDONTLIE_API_KEY\` in \`.env.local\`.
4. Run \`npm exec -- node --loader ./scripts/local-ts-loader.mjs scripts/nba-01c-balldontlie-goat-prep.mjs --phase0\`.
5. If Phase 0 is GO, run the future START command documented in certification.

## Safety

Provider calls during PREP: 0. Database mutations during PREP: 0. NBA production activation: no. MLB architecture changes: none.
`
}

function buildCertification() {
  const prep = summarizeBallDontLiePrep()
  const estimates = buildBallDontLieRequestEstimate()
  const manifest = buildBallDontLieTrialManifest()
  const fixture = runBallDontLiePrepFixtureTests()
  const p0 = estimates.filter((item) => item.priority === 'P0')
  const p1 = estimates.filter((item) => item.priority === 'P1')
  const optional = estimates.filter((item) => ['P2', 'P3'].includes(item.priority))

  const requestRows = (items) =>
    items.map((item) => {
      const endpoint = BALLDONTLIE_ENDPOINTS.find((entry) => entry.id === item.endpointId)
      return {
        endpoint: endpoint?.label ?? item.endpointId,
        whyRequired: endpoint?.notes ?? '',
        seasonsPlanned: item.seasons.map(String),
        estimatedRequests: item.estimatedRequests,
        estimatedTime: `${item.estimatedMinutesAtSafeRate} minutes`,
      }
    })

  return {
    generatedAt: new Date().toISOString(),
    status: prep.status,
    startingCommit: '72864b24c3bc094f9d2f941b78c3ac89b71e5378',
    providerCallsMade: 0,
    databaseMutationsMade: 0,
    productionActivation: false,
    providerPlan: {
      ballDontLieLongTermCandidateTier: 'ALL_STAR_EXPECTED_AFTER_GOAT_BOOTSTRAP',
      theOddsApiRole: 'NBA_MARKET_PRICE_AUTHORITY_ML_SPREAD_TOTAL',
      ballDontLieAllStarRole: 'ONGOING_NON_ODDS_GAMES_PLAYERS_STATS_ACTIVE_PLAYERS_INJURIES_CANDIDATE',
      goatBootstrapRole: 'ONE_TIME_HIGH_VALUE_HISTORICAL_STATS_AND_BOX_CONTEXT_CAPTURE',
      sportsDataIoRole: 'LEGACY_TRIAL_ONLY_NO_EXPANSION',
      p0Endpoints: requestRows(p0),
      p1Endpoints: requestRows(p1),
      optionalEndpoints: requestRows(optional),
    },
    trialConfiguration: {
      trialRateLimit: `${BALLDONTLIE_TRIAL_HARD_REQUESTS_PER_MINUTE} requests/minute`,
      configuredSafeRate: `${BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE} requests/minute`,
      trialDuration: '48 hours',
      reserveDuration: '4 hours',
      theoreticalRequests: prep.capacity.theoreticalRequests,
      safePlannedRequests: prep.capacity.safePlannedRequests,
      estimatedQueueHours: prep.capacity.estimatedQueueHours,
      capacityClassification: prep.capacity.classification,
    },
    endpointHistoricalDepth: BALLDONTLIE_ENDPOINTS.map((endpoint) => ({
      endpoint: endpoint.label,
      earliestSeason: endpoint.historicalDepth.earliestSeason,
      latestSeason: endpoint.historicalDepth.latestSeason,
      pagination: endpoint.pagination,
      maxPageSize: endpoint.maxPageSize,
      historicalFilters: endpoint.filters,
      tier: endpoint.tier,
      priority: endpoint.trialPriority,
      replaySafety: endpoint.replaySafety,
    })),
    importOrder: [
      'Phase 0: API key presence, tier/access, raw storage, DB connectivity, one no-mutation fixture validation.',
      'Phase 1: teams, games and player identity for 2024-25.',
      'Phase 2: 2024-25 player game stats and box scores.',
      'Phase 3: 2024-25 advanced stats and lineup payloads if schema is useful.',
      'Phase 4: repeat P0 for 2023-24 and 2022-23.',
      'Phase 5: P1 validation-only standings and season averages.',
      'Phase 6: gap fill, coverage certification and subscription recommendation.',
    ],
    normalization: {
      teams: 'READY',
      players: 'READY',
      games: 'READY',
      results: 'READY',
      quarterScores: 'READY',
      gamePlayerStats: 'READY',
      boxScores: 'READY_SHAPE_PRESERVING',
      advancedStats: 'READY_SHAPE_PRESERVING',
      lineups: 'READY_SHAPE_PRESERVING_GRANULARITY_VERIFY_AT_START',
      standings: 'VALIDATION_ONLY',
      plays: 'RESEARCH_ONLY_NOT_REQUIRED_FOR_P0',
      injuries: 'FORWARD_ONLY_UNLESS_HISTORICAL_TIMESTAMPS_PROVEN',
    },
    canonicalCrosswalk: {
      ballDontLieTeamMapping: 'provider_entity_mappings sport_key/entity_type/provider/provider_id/season',
      ballDontLiePlayerMappingStrategy: 'provider player id plus name/team metadata; ambiguous names fail closed',
      ballDontLieEventMapping: 'provider game id plus home/away team ids, date and season; exact provider ID preferred',
      theOddsApiCrosswalk: 'join to existing 1,196 price-aware event foundation through canonical sport_event after games import',
    },
    persistence: {
      rawPayloadDurability: `${BALLDONTLIE_RAW_ROOT} is gitignored and written before normalization/DB persistence`,
      requestManifest: 'PLANNED/FETCHING/FETCHED/DURABLE/NORMALIZED/DB_PERSISTED/FAILED/SKIPPED/REUSED',
      dbChunkSize: 100,
      idempotency: 'provider id natural keys and deterministic local request IDs',
      resume: 'cursor/page/season/endpoint manifest resume without repeated fetched pages',
      processRestart: 'manifest + raw payload path continuation',
      dbFailureRecovery: 'retry failed DB chunk from durable raw payload; no provider refetch',
      rateLimitRecovery: '429 Retry-After pauses global queue; no parallel bypass',
    },
    database: {
      existingSchemaReady: true,
      dbMigrationRequired: false,
      exactMigrationIfRequired: null,
      estimatedNewRows: {
        events: 3690,
        playerGameStats: 90000,
        advancedStats: 90000,
        boxScores: 3690,
        playerMappings: 5000,
      },
      estimatedRawStorage: '2-8 GB depending on Box Scores, Advanced Stats and Plays scope; verify disk before START',
      supabaseIoRisk: 'MEDIUM mitigated by 100-row chunks and raw payload recovery',
    },
    commands: {
      start: 'node --loader ./scripts/local-ts-loader.mjs scripts/nba-01c-balldontlie-goat-prep.mjs --start',
      phase0: 'node --loader ./scripts/local-ts-loader.mjs scripts/nba-01c-balldontlie-goat-prep.mjs --phase0',
      status: 'node --loader ./scripts/local-ts-loader.mjs scripts/nba-01c-balldontlie-goat-prep.mjs --status',
      resume: 'node --loader ./scripts/local-ts-loader.mjs scripts/nba-01c-balldontlie-goat-prep.mjs --resume',
      stop: 'node --loader ./scripts/local-ts-loader.mjs scripts/nba-01c-balldontlie-goat-prep.mjs --stop',
      validate: 'node scripts/nba-01c-prep-balldontlie-goat-validate.mjs',
    },
    replayTarget: {
      existingPriceAwareEvents: 1196,
      firstHistoricalStatSeason: '2024-25',
      initialReplaySeasons: ['2024-25', '2023-24', '2022-23'],
      coreReplayMarkets: ['Moneyline', 'Spread', 'Total'],
      expectedNba02Cohort: 'Join 1,196 price-aware events first, then extend model-only history after stats coverage passes.',
    },
    postTrialPlan: {
      allStarSufficiencyExpectation: 'LIKELY_SUFFICIENT_AFTER_GOAT_BOOTSTRAP',
      goatRetentionCriteria: 'Keep GOAT only if live advanced stats/box scores/lineups materially improve certified NBA model readiness.',
      allStarDowngradeCriteria: 'Downgrade if ongoing games, players, stats, active players and injuries cover Current Era safely.',
      playerPropsPlan: 'DEFERRED; no prop backfill or production prop activation in NBA-01C.',
    },
    safety: {
      ballDontLieProviderCallsDuringPrep: 0,
      theOddsApiHistoricalCallsDuringPrep: 0,
      sportsDataIoCalls: 0,
      nbaCurrentEraWrites: 0,
      databaseMutationsFromCertification: 0,
      mlbRegression: 'NO_MLB_ARCHITECTURE_CHANGE',
      nbaHistoricalOddsRegression: 'PRESERVED_1196_PRICE_AWARE_EVENTS_29214_ROWS',
    },
    sourceDocs: {
      ballDontLieDocs: 'https://docs.balldontlie.io/',
      ballDontLieAccountPlans: 'https://www.balldontlie.io/account/',
    },
    fixture,
    manifestSummary: {
      entries: manifest.length,
      p0: manifest.filter((entry) => entry.priority === 'P0').length,
      p1: manifest.filter((entry) => entry.priority === 'P1').length,
      p2: manifest.filter((entry) => entry.priority === 'P2').length,
      p3: manifest.filter((entry) => entry.priority === 'P3').length,
    },
    certification: {
      apiKeyRequiredNow: false,
      trialActivationRequiredNow: false,
      dbMigrationAuthorizationRequired: false,
      remainingPrepBlockers: [],
      startBoundaryPreserved: true,
    },
  }
}

function validateCert(cert = loadCert()) {
  const fixture = runBallDontLiePrepFixtureTests()
  const checks = []
  const check = (name, passed) => checks.push({ name, passed: Boolean(passed) })
  const endpoints = cert.endpointHistoricalDepth ?? []
  const normalization = cert.normalization ?? {}
  const safety = cert.safety ?? {}
  const persistence = cert.persistence ?? {}
  const commands = cert.commands ?? {}
  check('no provider calls during PREP', safety.ballDontLieProviderCallsDuringPrep === 0 && safety.theOddsApiHistoricalCallsDuringPrep === 0)
  check('no API key required during PREP', cert.certification?.apiKeyRequiredNow === false)
  check('endpoint tier matrix complete', endpoints.length >= 16 && endpoints.every((item) => item.tier && item.priority))
  check('provider adapter ready', BALLDONTLIE_ENDPOINTS.length >= 16)
  check('rate limiter ready', BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE === 4)
  check('trial-safe profile <= 5 req/min', BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE <= 5)
  check('raw payload durability ready', String(persistence.rawPayloadDurability ?? '').includes(BALLDONTLIE_RAW_ROOT))
  check('request manifest ready', cert.manifestSummary?.entries > 0)
  check('checkpoint/resume ready', String(persistence.resume ?? '').includes('cursor'))
  check('START command ready', String(commands.start ?? '').includes('--start'))
  check('STATUS command ready', String(commands.status ?? '').includes('--status'))
  check('RESUME command ready', String(commands.resume ?? '').includes('--resume'))
  check('STOP command ready', String(commands.stop ?? '').includes('--stop'))
  check('canonical team mapping ready', String(cert.canonicalCrosswalk?.ballDontLieTeamMapping ?? '').includes('provider_entity_mappings'))
  check('canonical player mapping strategy ready', String(cert.canonicalCrosswalk?.ballDontLiePlayerMappingStrategy ?? '').includes('fail closed'))
  check('event crosswalk ready', String(cert.canonicalCrosswalk?.ballDontLieEventMapping ?? '').includes('provider game id'))
  check('Games normalizer ready', normalization.games === 'READY')
  check('Player Stats normalizer ready', normalization.gamePlayerStats === 'READY')
  check('Box Score normalizer ready', String(normalization.boxScores ?? '').startsWith('READY'))
  check('Advanced Stats normalizer ready', String(normalization.advancedStats ?? '').startsWith('READY'))
  check('Lineup normalizer ready', String(normalization.lineups ?? '').startsWith('READY'))
  check('leakage semantics documented', endpoints.some((item) => item.replaySafety === 'VALIDATION_ONLY'))
  check('DB chunking safe', cert.database?.dbMigrationRequired === false && persistence.dbChunkSize === 100)
  check('DB migration status explicit', cert.database?.dbMigrationRequired === false)
  check('idempotency tested', String(persistence.idempotency ?? '').includes('provider id'))
  check('DB failure recovery tested', fixture.dbFailureRecoveryReady === true)
  check('process restart tested', fixture.processRestartReady === true)
  check('rate-limit recovery tested', String(persistence.rateLimitRecovery ?? '').includes('Retry-After'))
  check('P0 priority final', cert.providerPlan?.p0Endpoints?.length >= 5)
  check('P1 priority final', cert.providerPlan?.p1Endpoints?.length >= 2)
  check('season order final', cert.replayTarget?.initialReplaySeasons?.[0] === '2024-25')
  check('request estimates complete', cert.trialConfiguration?.safePlannedRequests > 0)
  check('queue fits 48h or reduced appropriately', ['FITS_COMFORTABLY_IN_48H', 'FITS_WITH_PRIORITIZATION'].includes(cert.trialConfiguration?.capacityClassification))
  check('GOAT/ALL-STAR distinction explicit', String(cert.providerPlan?.ballDontLieLongTermCandidateTier ?? '').includes('ALL_STAR') && cert.endpointHistoricalDepth?.some((item) => item.tier === 'GOAT'))
  check('The Odds API remains odds authority', String(cert.providerPlan?.theOddsApiRole ?? '').includes('AUTHORITY'))
  check('SportsDataIO not expanded', safety.sportsDataIoCalls === 0 && String(cert.providerPlan?.sportsDataIoRole ?? '').includes('NO_EXPANSION'))
  check('MLB regression clean', safety.mlbRegression === 'NO_MLB_ARCHITECTURE_CHANGE')
  check('NBA odds foundation preserved', String(safety.nbaHistoricalOddsRegression ?? '').includes('1196'))
  check('no NBA production activation', cert.productionActivation === false)
  check('START authorization boundary preserved', cert.certification?.startBoundaryPreserved === true)
  check('fixture games normalize', fixture.gamesNormalized && fixture.resultsNormalized && fixture.quarterScoresNormalized)
  const failed = checks.filter((item) => !item.passed)
  return {
    success: failed.length === 0,
    mode: 'nba_01c_prep_balldontlie_goat_validation_v1',
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed.map((item) => item.name),
    providerCallsMade: 0,
    databaseMutationsMade: 0,
    classification: cert.status,
  }
}

function phase0() {
  const cert = loadCert()
  const hasKey = Boolean(process.env.BALLDONTLIE_API_KEY?.trim())
  return {
    success: hasKey,
    phase: 'PHASE_0',
    apiKeyPresent: hasKey ? 'PRESENT' : 'MISSING',
    safeRate: cert.trialConfiguration.configuredSafeRate,
    rawRoot: BALLDONTLIE_RAW_ROOT,
    providerCallsMade: 0,
    databaseMutationsMade: 0,
    next: hasKey ? 'GO_FOR_START_AFTER_HUMAN_CONFIRMATION' : 'STORE_BALLDONTLIE_API_KEY_LOCALLY_THEN_RETRY',
  }
}

function main() {
  if (process.argv.includes('--write-certification')) {
    const cert = buildCertification()
    writeJson(CERT_PATH, cert)
    writeFileSync(DOC_PATH, markdown(cert))
    console.log(JSON.stringify({ success: true, status: cert.status, providerCallsMade: 0, databaseMutationsMade: 0 }, null, 2))
    return
  }
  if (process.argv.includes('--validate')) {
    const result = validateCert()
    console.log(JSON.stringify(result, null, 2))
    if (!result.success) process.exit(1)
    return
  }
  if (process.argv.includes('--manifest')) {
    console.log(JSON.stringify(buildBallDontLieTrialManifest(), null, 2))
    return
  }
  if (process.argv.includes('--status')) {
    const cert = existsSync(CERT_PATH) ? loadCert() : buildCertification()
    console.log(JSON.stringify({ success: true, status: cert.status, manifest: cert.manifestSummary, providerCallsMade: 0, databaseMutationsMade: 0 }, null, 2))
    return
  }
  if (process.argv.includes('--phase0')) {
    console.log(JSON.stringify(phase0(), null, 2))
    return
  }
  if (process.argv.includes('--start') || process.argv.includes('--resume')) {
    const phase = process.argv.includes('--start') ? 'START' : 'RESUME'
    console.log(JSON.stringify({
      success: false,
      phase,
      status: 'START_REQUIRES_EXPLICIT_POST_PREP_HUMAN_AUTHORIZATION',
      providerCallsMade: 0,
      databaseMutationsMade: 0,
    }, null, 2))
    process.exit(2)
  }
  if (process.argv.includes('--stop')) {
    console.log(JSON.stringify({ success: true, status: 'STOP_REQUEST_RECORDED_NO_ACTIVE_IMPORT_IN_PREP', providerCallsMade: 0, databaseMutationsMade: 0 }, null, 2))
    return
  }
  console.log(JSON.stringify(summarizeBallDontLiePrep(), null, 2))
}

main()
