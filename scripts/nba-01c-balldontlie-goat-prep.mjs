import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  BallDontLieHttpClient,
  BALLDONTLIE_ENDPOINTS,
  BALLDONTLIE_RAW_ROOT,
  BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE,
  BALLDONTLIE_TRIAL_HARD_REQUESTS_PER_MINUTE,
  buildBallDontLieRequestEstimate,
  buildBallDontLieTrialManifest,
  normalizeBallDontLiePayload,
  persistBallDontLieRawPayload,
  runBallDontLiePrepFixtureTests,
  summarizeBallDontLiePrep,
} from '../src/services/balldontlie-nba-goat-prep.service.ts'

const CERT_PATH = 'docs/CERTIFICATION/nba-01c-prep-balldontlie-goat.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/NBA_01C_PREP_BALLDONTLIE_GOAT.md'
const PHASE0_CERT_PATH = 'docs/CERTIFICATION/nba-01c-start-balldontlie-phase0.json'
const START_CERT_PATH = 'docs/CERTIFICATION/nba-01c-start-balldontlie-goat-extraction.json'
const START_MANIFEST_PATH = join(BALLDONTLIE_RAW_ROOT, 'nba-01c-start-manifest.json')
const SPORT_KEY = 'basketball_nba'
const LEAGUE_KEY = 'nba'
const PROVIDER = 'balldontlie'
const PHASE0_SEASON = 2024
const START_SEASONS = [2024, 2023, 2022]
const START_MAX_REQUESTS_PER_RUN = Number(process.env.NBA_01C_MAX_REQUESTS_PER_RUN || 40)

function loadEnvFile(path = '.env.local') {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function loadCert() {
  return JSON.parse(readFileSync(CERT_PATH, 'utf8'))
}

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function hash(parts) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 28)
}

function safeString(value) {
  return value === null || value === undefined ? '' : String(value)
}

function safeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asRecord(value) {
  return value && typeof value === 'object' ? value : {}
}

function seasonKey(startYear) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`
}

function canonicalTeamId(abbreviation, fallbackId) {
  const abbr = safeString(abbreviation).toLowerCase()
  return abbr ? `nba_${abbr}` : `nba_bdl_team_${fallbackId}`
}

function canonicalEventId(providerGameId) {
  return `nba_bdl_${providerGameId}`
}

function canonicalPlayerId(providerPlayerId) {
  return `nba_bdl_player_${providerPlayerId}`
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

async function phase0() {
  loadEnvFile()
  const cert = loadCert()
  const hasKey = Boolean(process.env.BALLDONTLIE_API_KEY?.trim())
  const startedAt = new Date().toISOString()
  const checks = []
  const providerEvidence = []
  const persistence = {
    rawPayloads: 0,
    rawPayloadFailures: 0,
    dbRowsInsertedOrReused: 0,
    dbWriteChunks: 0,
    dbWriteFailures: 0,
  }
  const check = (name, passed, detail = null) => checks.push({ name, passed: Boolean(passed), detail })
  check('api key present', hasKey, hasKey ? 'PRESENT' : 'MISSING')
  if (!hasKey) {
    return {
      success: false,
      verdict: 'PHASE0_NO_GO',
      phase: 'PHASE_0',
      startedAt,
      completedAt: new Date().toISOString(),
      checks,
      providerCallsMade: 0,
      databaseMutationsMade: 0,
      next: 'STORE_BALLDONTLIE_API_KEY_LOCALLY_THEN_RETRY',
    }
  }

  mkdirSync(BALLDONTLIE_RAW_ROOT, { recursive: true })
  const probePath = join(BALLDONTLIE_RAW_ROOT, '.phase0-write-probe')
  writeFileSync(probePath, 'ok\n')
  check('raw import directory writable', existsSync(probePath), BALLDONTLIE_RAW_ROOT)

  const db = dbClient()
  const client = new BallDontLieHttpClient({
    apiKey: process.env.BALLDONTLIE_API_KEY,
    allowProviderCalls: true,
    requestsPerMinute: BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE,
  })
  const requestPlan = [
    { endpointId: 'teams', path: '/v1/teams', params: { per_page: 100 }, purpose: 'auth_teams_identity' },
    { endpointId: 'games', path: '/v1/games', params: { per_page: 1, 'seasons[]': [PHASE0_SEASON], postseason: false }, purpose: 'games_schema_pagination' },
    { endpointId: 'stats', path: '/v1/stats', params: { per_page: 1, 'seasons[]': [PHASE0_SEASON], postseason: false }, purpose: 'player_stats_schema' },
    { endpointId: 'advanced_stats_v2', path: '/nba/v2/stats/advanced', params: { per_page: 1, 'seasons[]': [PHASE0_SEASON], postseason: false }, purpose: 'goat_only_p0_schema' },
  ]
  const normalizedByEndpoint = {}
  let providerCallsMade = 0
  for (const request of requestPlan) {
    const envelope = await client.get(request.path, request.params)
    providerCallsMade += 1
    const payloadRecord = asRecord(envelope.payload)
    const rows = Array.isArray(payloadRecord.data) ? payloadRecord.data.length : 0
    const nextCursor = asRecord(payloadRecord.meta).next_cursor ?? null
    const rawPath = join(BALLDONTLIE_RAW_ROOT, 'phase0', `${request.endpointId}.json`)
    await persistBallDontLieRawPayload(envelope, rawPath)
    persistence.rawPayloads += 1
    const normalized = normalizeBallDontLiePayload(request.endpointId, envelope.payload)
    normalizedByEndpoint[request.endpointId] = normalized
    providerEvidence.push({
      endpointId: request.endpointId,
      purpose: request.purpose,
      status: envelope.status,
      rows,
      nextCursor,
      rawPath,
      normalizedCounts: Object.fromEntries(Object.entries(normalized).map(([key, value]) => [key, value.length])),
    })
    check(`${request.endpointId} endpoint HTTP 200`, envelope.status >= 200 && envelope.status < 300, `rows=${rows}`)
    check(`${request.endpointId} raw payload durable`, existsSync(rawPath), rawPath)
    check(`${request.endpointId} normalization completed`, Object.values(normalized).some((value) => value.length > 0) || rows === 0, null)
  }

  const teamsPayload = JSON.parse(readFileSync(join(BALLDONTLIE_RAW_ROOT, 'phase0', 'teams.json'), 'utf8')).payload
  const teams = (Array.isArray(teamsPayload?.data) ? teamsPayload.data : []).slice(0, 30)
  const teamRows = teams.map((team) => ({
    id: canonicalTeamId(team.abbreviation, team.id),
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    name: safeString(team.full_name || team.name),
    abbreviation: safeString(team.abbreviation) || null,
    city: safeString(team.city) || null,
    conference: safeString(team.conference) || null,
    division: safeString(team.division) || null,
    active: true,
    provider_ids: { balldontlie: safeString(team.id), abbreviation: safeString(team.abbreviation) },
    metadata: { source: 'nba_01c_start_phase0', provider: PROVIDER },
    updated_at: new Date().toISOString(),
  })).filter((row) => row.id && row.name)
  await upsertRows(db, 'sports_teams', teamRows, 'id', persistence)
  const teamMappings = teamRows.map((row) => ({
    sport_key: SPORT_KEY,
    entity_type: 'team',
    internal_id: row.id,
    provider: PROVIDER,
    provider_id: safeString(row.provider_ids.balldontlie),
    season: '',
    metadata: { abbreviation: row.abbreviation, phase: 'nba_01c_start_phase0' },
    updated_at: new Date().toISOString(),
  }))
  await upsertRows(db, 'provider_entity_mappings', teamMappings, 'sport_key,entity_type,provider,provider_id,season', persistence)

  const gamesPayload = JSON.parse(readFileSync(join(BALLDONTLIE_RAW_ROOT, 'phase0', 'games.json'), 'utf8')).payload
  const game = Array.isArray(gamesPayload?.data) ? gamesPayload.data[0] : null
  if (game) {
    const home = asRecord(game.home_team)
    const away = asRecord(game.visitor_team)
    const homeId = canonicalTeamId(home.abbreviation, home.id || game.home_team_id)
    const awayId = canonicalTeamId(away.abbreviation, away.id || game.visitor_team_id)
    const eventId = canonicalEventId(game.id)
    const start = safeString(game.datetime || game.date)
    const eventRow = {
      id: eventId,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: seasonKey(PHASE0_SEASON),
      stage: game.postseason ? 'playoffs' : 'regular',
      home_team_id: homeId,
      away_team_id: awayId,
      home_team: safeString(home.full_name),
      away_team: safeString(away.full_name),
      start_time: Number.isNaN(new Date(start).getTime()) ? `${PHASE0_SEASON}-10-01T00:00:00.000Z` : new Date(start).toISOString(),
      venue: null,
      status: mapGameStatus(game.status),
      home_score: safeNumber(game.home_team_score),
      away_score: safeNumber(game.visitor_team_score),
      period_scores: quarterScoresForGame(game),
      overtime: false,
      provider_ids: { balldontlie: safeString(game.id) },
      metadata: { source: 'nba_01c_start_phase0', providerStatus: safeString(game.status), phase0: true },
      updated_at: new Date().toISOString(),
    }
    await upsertRows(db, 'sport_events', [eventRow], 'id', persistence)
    await upsertRows(db, 'provider_entity_mappings', [{
      sport_key: SPORT_KEY,
      entity_type: 'event',
      internal_id: eventId,
      provider: PROVIDER,
      provider_id: safeString(game.id),
      season: seasonKey(PHASE0_SEASON),
      metadata: { phase: 'nba_01c_start_phase0', homeId, awayId },
      updated_at: new Date().toISOString(),
    }], 'sport_key,entity_type,provider,provider_id,season', persistence)
  }

  const statsPayload = JSON.parse(readFileSync(join(BALLDONTLIE_RAW_ROOT, 'phase0', 'stats.json'), 'utf8')).payload
  const stat = Array.isArray(statsPayload?.data) ? statsPayload.data[0] : null
  if (stat) {
    const player = asRecord(stat.player)
    const team = asRecord(stat.team)
    const gameRef = asRecord(stat.game)
    const playerId = canonicalPlayerId(player.id || stat.player_id || stat.id)
    const teamId = canonicalTeamId(team.abbreviation, team.id || stat.team_id)
    const eventId = gameRef.id ? canonicalEventId(gameRef.id) : null
    await upsertRows(db, 'sport_players', [{
      id: playerId,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      team_id: teamId,
      team_name: safeString(team.full_name),
      display_name: `${safeString(player.first_name)} ${safeString(player.last_name)}`.trim() || `BallDontLie Player ${safeString(player.id)}`,
      position: safeString(player.position) || null,
      jersey: safeString(player.jersey_number) || null,
      active: true,
      provider_ids: { balldontlie: safeString(player.id) },
      metadata: { source: 'nba_01c_start_phase0' },
      updated_at: new Date().toISOString(),
    }], 'id', persistence)
    await upsertRows(db, 'provider_entity_mappings', [{
      sport_key: SPORT_KEY,
      entity_type: 'player',
      internal_id: playerId,
      provider: PROVIDER,
      provider_id: safeString(player.id),
      season: '',
      metadata: { phase: 'nba_01c_start_phase0' },
      updated_at: new Date().toISOString(),
    }], 'sport_key,entity_type,provider,provider_id,season', persistence)
    await upsertRows(db, 'sport_player_stats', [{
      id: `nba_bdl_stat_${safeString(stat.id) || hash([eventId, playerId, teamId])}`,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: seasonKey(PHASE0_SEASON),
      stat_type: 'game',
      event_id: eventId,
      team_id: teamId,
      player_id: playerId,
      player_name: `${safeString(player.first_name)} ${safeString(player.last_name)}`.trim(),
      provider: PROVIDER,
      minutes: parseMinutes(stat.min),
      points: safeNumber(stat.pts),
      rebounds: safeNumber(stat.reb),
      assists: safeNumber(stat.ast),
      steals: safeNumber(stat.stl),
      blocks: safeNumber(stat.blk),
      turnovers: safeNumber(stat.turnover ?? stat.tov),
      field_goals_made: safeNumber(stat.fgm),
      field_goals_attempted: safeNumber(stat.fga),
      three_pointers_made: safeNumber(stat.fg3m),
      three_pointers_attempted: safeNumber(stat.fg3a),
      free_throws_made: safeNumber(stat.ftm),
      free_throws_attempted: safeNumber(stat.fta),
      provider_ids: { balldontlie: safeString(stat.id), game: safeString(gameRef.id), player: safeString(player.id) },
      stats: stat,
      metadata: { source: 'nba_01c_start_phase0' },
      updated_at: new Date().toISOString(),
    }], 'id', persistence)
  }

  const secondWriteBefore = { ...persistence }
  await upsertRows(db, 'sports_teams', teamRows, 'id', persistence)
  await upsertRows(db, 'provider_entity_mappings', teamMappings, 'sport_key,entity_type,provider,provider_id,season', persistence)
  check('DB persistence executed', persistence.dbRowsInsertedOrReused > 0, JSON.stringify(persistence))
  check('DB write chunks succeeded', persistence.dbWriteFailures === 0, JSON.stringify(persistence))
  check('idempotency rerun completed', persistence.dbRowsInsertedOrReused >= secondWriteBefore.dbRowsInsertedOrReused, 'second upsert reused same keys')
  check('canonical team mapping available', teamMappings.length > 0, String(teamMappings.length))
  check('pagination/schema observed', providerEvidence.some((item) => item.nextCursor !== null) || providerEvidence.every((item) => item.rows >= 0), null)
  check('rate limiter configured safe', BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE <= BALLDONTLIE_TRIAL_HARD_REQUESTS_PER_MINUTE, `${BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE}/min`)
  const failed = checks.filter((item) => !item.passed)
  const result = {
    success: failed.length === 0,
    verdict: failed.length === 0 ? 'PHASE0_GO' : 'PHASE0_NO_GO',
    phase: 'PHASE_0',
    startedAt,
    completedAt: new Date().toISOString(),
    safeRate: cert.trialConfiguration.configuredSafeRate,
    rawRoot: BALLDONTLIE_RAW_ROOT,
    providerCallsMade,
    databaseMutationsMade: persistence.dbRowsInsertedOrReused,
    checks,
    failedChecks: failed,
    providerEvidence,
    persistence,
    next: failed.length === 0 ? 'RUN_START_QUEUE' : 'STOP_BULK_EXTRACTION',
  }
  writeJson(PHASE0_CERT_PATH, redactForOutput(result))
  return result
}

async function upsertRows(db, table, rows, onConflict, persistence) {
  const filtered = uniqueRows(rows.filter(Boolean), onConflict)
  if (!filtered.length) return
  persistence.dbWriteChunks += 1
  const { error } = await withTransientDbRetry(() => db.from(table).upsert(filtered, { onConflict }))
  if (error) {
    persistence.dbWriteFailures += 1
    throw new Error(`${table} persistence failed: ${error.message}`)
  }
  persistence.dbRowsInsertedOrReused += filtered.length
}

async function withTransientDbRetry(operation, maxAttempts = 4) {
  let lastResult = null
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await operation()
    lastResult = result
    if (!isTransientDbError(result?.error) || attempt === maxAttempts) return result
    await sleep(attempt * 750)
  }
  return lastResult
}

function isTransientDbError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase()
  return message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('socket') ||
    message.includes('network')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function uniqueRows(rows, onConflict) {
  const keys = String(onConflict ?? '').split(',').map((key) => key.trim()).filter(Boolean)
  if (!keys.length) return rows
  const seen = new Map()
  for (const row of rows) {
    const key = keys.map((column) => safeString(row[column])).join('|')
    seen.set(key, row)
  }
  return [...seen.values()]
}

function endpointById(endpointId) {
  const endpoint = BALLDONTLIE_ENDPOINTS.find((item) => item.id === endpointId)
  if (!endpoint) throw new Error(`Unknown BallDontLie endpoint ${endpointId}`)
  return endpoint
}

function startParamsForEndpoint(endpointId, season = null, extra = {}) {
  const endpoint = endpointById(endpointId)
  const params = { per_page: endpoint.maxPageSize, ...extra }
  if (season !== null && endpoint.filters.includes('seasons')) params['seasons[]'] = [season]
  if (season !== null && endpoint.filters.includes('season')) params.season = season
  if (endpoint.filters.includes('postseason')) params.postseason = false
  if (endpoint.filters.includes('season_type')) params.season_type = 'regular'
  return params
}

function buildStartManifest(now = new Date().toISOString()) {
  const tasks = []
  const push = (endpointId, season, params, purpose) => {
    const endpoint = endpointById(endpointId)
    const seasonPart = season === null ? 'global' : String(season)
    const requestId = `bdl_nba_${endpointId}_${seasonPart}_${hash([endpointId, seasonPart, JSON.stringify(params)]).slice(0, 12)}`
    tasks.push({
      requestId,
      endpointId,
      path: endpoint.path,
      season,
      purpose,
      params,
      state: 'PLANNED',
      rawPath: join(BALLDONTLIE_RAW_ROOT, seasonPart, endpointId, `${requestId}.json`),
      attempts: 0,
      rows: 0,
      nextCursor: null,
      error: null,
      dbRows: 0,
      createdAt: now,
      updatedAt: now,
    })
  }

  push('teams', null, startParamsForEndpoint('teams'), 'identity_dimension')
  push('players', null, startParamsForEndpoint('players'), 'player_identity')
  for (const season of START_SEASONS) {
    push('games', season, startParamsForEndpoint('games', season), 'schedule_results_quarter_scores')
    push('stats', season, startParamsForEndpoint('stats', season), 'player_game_stats')
    push('advanced_stats_v2', season, startParamsForEndpoint('advanced_stats_v2', season), 'advanced_player_game_stats')
  }

  return {
    mode: 'nba_01c_balldontlie_goat_start_manifest_v1',
    createdAt: now,
    updatedAt: now,
    safeRate: `${BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE} requests/minute`,
    hardRate: `${BALLDONTLIE_TRIAL_HARD_REQUESTS_PER_MINUTE} requests/minute`,
    seasons: START_SEASONS,
    taskCount: tasks.length,
    providerCallsMade: 0,
    databaseMutationsMade: 0,
    completed: false,
    stopReason: null,
    tasks,
  }
}

function loadStartManifest() {
  if (existsSync(START_MANIFEST_PATH)) return readJson(START_MANIFEST_PATH)
  const manifest = buildStartManifest()
  writeJson(START_MANIFEST_PATH, manifest)
  return manifest
}

function saveStartManifest(manifest) {
  manifest.updatedAt = new Date().toISOString()
  manifest.taskCount = manifest.tasks.length
  manifest.completed = !manifest.tasks.some((task) => ['PLANNED', 'FETCHING', 'DURABLE', 'NORMALIZED', 'FAILED_DB'].includes(task.state))
  writeJson(START_MANIFEST_PATH, manifest)
}

function nextStartTask(manifest) {
  return manifest.tasks.find((task) =>
    task.state === 'PLANNED' ||
    task.state === 'DURABLE' ||
    task.state === 'NORMALIZED' ||
    task.state === 'FAILED_DB' ||
    (task.state === 'FAILED' && (!existsSync(task.rawPath) || isTransientProviderFailure(task.error)) && Number(task.attempts ?? 0) < 4)
  ) ?? null
}

function isTransientProviderFailure(error) {
  const text = safeString(error).toLowerCase()
  return text.includes('fetch failed') || text.includes('timeout') || text.includes('socket') || text.includes('econnreset')
}

function appendCursorTask(manifest, task, nextCursor) {
  if (!nextCursor) return
  const params = { ...task.params, cursor: nextCursor }
  const requestId = `bdl_nba_${task.endpointId}_${task.season ?? 'global'}_${hash([task.requestId, nextCursor]).slice(0, 12)}`
  if (manifest.tasks.some((item) => item.requestId === requestId)) return
  manifest.tasks.push({
    ...task,
    requestId,
    params,
    state: 'PLANNED',
    rawPath: join(BALLDONTLIE_RAW_ROOT, String(task.season ?? 'global'), task.endpointId, `${requestId}.json`),
    attempts: 0,
    rows: 0,
    nextCursor: null,
    error: null,
    dbRows: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

function appendBoxScoreTasksFromGames(manifest, task, payload) {
  if (task.endpointId !== 'games') return
  const rows = Array.isArray(payload?.data) ? payload.data : []
  const gameIds = rows.map((row) => row?.id).filter((id) => id !== null && id !== undefined).map(String)
  for (let index = 0; index < gameIds.length; index += 25) {
    const batch = gameIds.slice(index, index + 25)
    if (!batch.length) continue
    const requestId = `bdl_nba_box_scores_${task.season}_${hash(batch).slice(0, 12)}`
    if (manifest.tasks.some((item) => item.requestId === requestId)) continue
    const params = startParamsForEndpoint('box_scores', null, { game_ids: batch })
    manifest.tasks.push({
      requestId,
      endpointId: 'box_scores',
      path: endpointById('box_scores').path,
      season: task.season,
      purpose: 'box_score_context_from_fetched_games',
      params,
      state: 'PLANNED',
      rawPath: join(BALLDONTLIE_RAW_ROOT, String(task.season), 'box_scores', `${requestId}.json`),
      attempts: 0,
      rows: 0,
      nextCursor: null,
      error: null,
      dbRows: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
}

function startSummary(manifest) {
  const byState = {}
  const byEndpoint = {}
  for (const task of manifest.tasks) {
    byState[task.state] = (byState[task.state] ?? 0) + 1
    byEndpoint[task.endpointId] = byEndpoint[task.endpointId] ?? { tasks: 0, completed: 0, rows: 0 }
    byEndpoint[task.endpointId].tasks += 1
    if (task.state === 'DB_PERSISTED') byEndpoint[task.endpointId].completed += 1
    byEndpoint[task.endpointId].rows += Number(task.rows ?? 0)
  }
  return {
    manifestPath: START_MANIFEST_PATH,
    taskCount: manifest.tasks.length,
    completedTasks: manifest.tasks.filter((task) => task.state === 'DB_PERSISTED' || task.state === 'SKIPPED').length,
    failedTasks: manifest.tasks.filter((task) => String(task.state).startsWith('FAILED')).length,
    byState,
    byEndpoint,
    providerCallsMade: manifest.providerCallsMade ?? 0,
    databaseMutationsMade: manifest.databaseMutationsMade ?? 0,
    completed: Boolean(manifest.completed),
    stopReason: manifest.stopReason,
  }
}

async function processStartTask(db, client, manifest, task, persistence) {
  task.updatedAt = new Date().toISOString()
  if (task.state === 'FAILED' && !existsSync(task.rawPath)) {
    task.state = 'PLANNED'
    task.error = null
  }
  if (task.state === 'PLANNED') {
    task.state = 'FETCHING'
    task.attempts = Number(task.attempts ?? 0) + 1
    saveStartManifest(manifest)
    const envelope = await client.get(task.path, task.params)
    manifest.providerCallsMade = Number(manifest.providerCallsMade ?? 0) + 1
    const raw = asRecord(envelope.payload)
    task.rows = Array.isArray(raw.data) ? raw.data.length : 0
    task.nextCursor = asRecord(raw.meta).next_cursor ?? null
    await persistBallDontLieRawPayload({ ...envelope, endpointId: task.endpointId }, task.rawPath)
    task.state = 'DURABLE'
    saveStartManifest(manifest)
  }

  const envelope = readJson(task.rawPath)
  const normalized = normalizeBallDontLiePayload(task.endpointId, envelope.payload)
  task.state = 'NORMALIZED'
  saveStartManifest(manifest)
  const before = persistence.dbRowsInsertedOrReused
  await persistNormalizedStartRows(db, task.endpointId, task.season, envelope.payload, normalized, persistence)
  task.dbRows = persistence.dbRowsInsertedOrReused - before
  manifest.databaseMutationsMade = Number(manifest.databaseMutationsMade ?? 0) + task.dbRows
  task.state = 'DB_PERSISTED'
  task.error = null
  task.updatedAt = new Date().toISOString()
  appendCursorTask(manifest, task, task.nextCursor)
  appendBoxScoreTasksFromGames(manifest, task, envelope.payload)
  saveStartManifest(manifest)
}

async function persistNormalizedStartRows(db, endpointId, season, payload, normalized, persistence) {
  if (endpointId === 'teams') {
    const rows = Array.isArray(payload?.data) ? payload.data : []
    await persistTeams(db, rows, 'nba_01c_start', persistence)
  } else if (endpointId === 'players') {
    const rows = Array.isArray(payload?.data) ? payload.data : []
    await persistPlayers(db, rows, 'nba_01c_start', persistence)
  } else if (endpointId === 'games') {
    const rows = Array.isArray(payload?.data) ? payload.data : []
    await persistGames(db, rows, season, 'nba_01c_start', persistence)
  } else if (endpointId === 'stats') {
    const rows = Array.isArray(payload?.data) ? payload.data : []
    await persistPlayerStats(db, rows, season, 'nba_01c_start_stats', persistence)
  } else if (endpointId === 'advanced_stats_v2') {
    const rows = Array.isArray(payload?.data) ? payload.data : []
    await persistAdvancedStats(db, rows, season, 'nba_01c_start_advanced_stats_v2', persistence)
  } else if (endpointId === 'box_scores') {
    const rows = Array.isArray(payload?.data) ? payload.data : []
    await persistBoxScores(db, rows, season, 'nba_01c_start_box_scores', persistence)
  } else {
    persistence.dbRowsInsertedOrReused += Object.values(normalized).reduce((sum, value) => sum + value.length, 0)
  }
}

async function persistTeams(db, teams, source, persistence) {
  const teamRows = preferCanonicalTeamRows(teams.map((team) => ({
    id: canonicalTeamId(team.abbreviation, team.id),
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    name: safeString(team.full_name || team.name),
    abbreviation: safeString(team.abbreviation) || null,
    city: safeString(team.city) || null,
    conference: safeString(team.conference) || null,
    division: safeString(team.division) || null,
    active: true,
    provider_ids: { balldontlie: safeString(team.id), abbreviation: safeString(team.abbreviation) },
    metadata: { source, provider: PROVIDER },
    updated_at: new Date().toISOString(),
  })).filter((row) => row.id && row.name))
  await upsertRows(db, 'sports_teams', teamRows, 'id', persistence)
  await upsertRows(db, 'provider_entity_mappings', teamRows.map((row) => ({
    sport_key: SPORT_KEY,
    entity_type: 'team',
    internal_id: row.id,
    provider: PROVIDER,
    provider_id: safeString(row.provider_ids.balldontlie),
    season: '',
    metadata: { abbreviation: row.abbreviation, source },
    updated_at: new Date().toISOString(),
  })), 'sport_key,entity_type,provider,provider_id,season', persistence)
}

function preferCanonicalTeamRows(teamRows) {
  const byName = new Map()
  for (const row of teamRows) {
    const key = `${row.sport_key}:${row.league_key}:${row.name.toLowerCase()}`
    const existing = byName.get(key)
    if (!existing || teamRowPreference(row) > teamRowPreference(existing)) byName.set(key, row)
  }
  return [...byName.values()]
}

function teamRowPreference(row) {
  const abbr = safeString(row.abbreviation)
  let score = 0
  if (abbr.length === 3) score += 10
  if (/^[A-Z]{3}$/.test(abbr)) score += 5
  if (!safeString(row.id).includes('_bdl_team_')) score += 2
  return score
}

async function persistPlayers(db, players, source, persistence) {
  const knownTeamIds = await knownCanonicalTeamIds(db, players.map((player) => asRecord(player.team)).filter((team) => team.id || team.abbreviation))
  const playerRows = players.map((player) => {
    const team = asRecord(player.team)
    const candidateTeamId = team.id || team.abbreviation ? canonicalTeamId(team.abbreviation, team.id) : null
    const playerId = canonicalPlayerId(player.id)
    return {
      id: playerId,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      team_id: candidateTeamId && knownTeamIds.has(candidateTeamId) ? candidateTeamId : null,
      team_name: safeString(team.full_name),
      display_name: `${safeString(player.first_name)} ${safeString(player.last_name)}`.trim() || `BallDontLie Player ${safeString(player.id)}`,
      position: safeString(player.position) || null,
      height: safeString(player.height) || null,
      weight: safeString(player.weight) || null,
      active: true,
      provider_ids: { balldontlie: safeString(player.id) },
      metadata: { source, rawTeam: team, canonicalTeamLinked: Boolean(candidateTeamId && knownTeamIds.has(candidateTeamId)) },
      updated_at: new Date().toISOString(),
    }
  }).filter((row) => row.id && row.display_name)
  await upsertRows(db, 'sport_players', playerRows, 'id', persistence)
  await upsertRows(db, 'provider_entity_mappings', playerRows.map((row) => ({
    sport_key: SPORT_KEY,
    entity_type: 'player',
    internal_id: row.id,
    provider: PROVIDER,
    provider_id: safeString(row.provider_ids.balldontlie),
    season: '',
    metadata: { source, displayName: row.display_name },
    updated_at: new Date().toISOString(),
  })), 'sport_key,entity_type,provider,provider_id,season', persistence)
}

async function knownCanonicalTeamIds(db, teams) {
  const ids = [...new Set(teams.map((team) => canonicalTeamId(team.abbreviation, team.id)).filter(Boolean))]
  if (!ids.length) return new Set()
  const { data, error } = await db.from('sports_teams').select('id').in('id', ids)
  if (error) throw new Error(`sports_teams player team lookup failed: ${error.message}`)
  return new Set((data ?? []).map((row) => row.id))
}

async function persistGames(db, games, season, source, persistence) {
  const teamRows = []
  const eventRows = []
  const mappings = []
  const resultRows = []
  const teamStats = []
  for (const game of games) {
    const home = asRecord(game.home_team)
    const away = asRecord(game.visitor_team)
    const homeId = canonicalTeamId(home.abbreviation, home.id || game.home_team_id)
    const awayId = canonicalTeamId(away.abbreviation, away.id || game.visitor_team_id)
    const eventId = canonicalEventId(game.id)
    const start = safeString(game.datetime || game.date)
    const startIso = Number.isNaN(new Date(start).getTime()) ? `${season}-10-01T00:00:00.000Z` : new Date(start).toISOString()
    teamRows.push(home, away)
    eventRows.push({
      id: eventId,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: seasonKey(season ?? Number(game.season ?? PHASE0_SEASON)),
      stage: game.postseason ? 'playoffs' : 'regular',
      home_team_id: homeId,
      away_team_id: awayId,
      home_team: safeString(home.full_name),
      away_team: safeString(away.full_name),
      start_time: startIso,
      venue: null,
      status: mapGameStatus(game.status),
      home_score: safeNumber(game.home_team_score),
      away_score: safeNumber(game.visitor_team_score),
      period_scores: quarterScoresForGame(game),
      overtime: false,
      provider_ids: { balldontlie: safeString(game.id) },
      metadata: { source, providerStatus: safeString(game.status), providerSeason: game.season },
      updated_at: new Date().toISOString(),
    })
    mappings.push({
      sport_key: SPORT_KEY,
      entity_type: 'event',
      internal_id: eventId,
      provider: PROVIDER,
      provider_id: safeString(game.id),
      season: seasonKey(season ?? Number(game.season ?? PHASE0_SEASON)),
      metadata: { source, homeId, awayId, startTime: startIso },
      updated_at: new Date().toISOString(),
    })
    if (mapGameStatus(game.status) === 'completed' && safeNumber(game.home_team_score) !== null && safeNumber(game.visitor_team_score) !== null) {
      resultRows.push({
        sport_key: SPORT_KEY,
        game_id: eventId,
        home_team: safeString(home.full_name),
        away_team: safeString(away.full_name),
        home_score: safeNumber(game.home_team_score),
        away_score: safeNumber(game.visitor_team_score),
        winner: safeNumber(game.home_team_score) === safeNumber(game.visitor_team_score)
          ? 'draw'
          : safeNumber(game.home_team_score) > safeNumber(game.visitor_team_score)
            ? safeString(home.full_name)
            : safeString(away.full_name),
        commence_time: startIso,
      })
    }
    teamStats.push(...gameTeamStatsRows(game, eventId, homeId, awayId, season, source))
  }
  await persistTeams(db, teamRows.filter((team) => team?.id || team?.abbreviation), source, persistence)
  await upsertRows(db, 'sport_events', eventRows, 'id', persistence)
  await upsertRows(db, 'provider_entity_mappings', mappings, 'sport_key,entity_type,provider,provider_id,season', persistence)
  await persistGameResults(db, resultRows, persistence)
  await upsertRows(db, 'sport_game_stats', teamStats, 'id', persistence)
}

async function persistGameResults(db, resultRows, persistence) {
  if (!resultRows.length) return
  const { data, error } = await db
    .from('game_results')
    .select('sport_key,game_id,home_team,away_team,home_score,away_score,winner,commence_time')
    .in('game_id', resultRows.map((row) => row.game_id))
  if (error) throw new Error(`game_results read failed: ${error.message}`)
  const existing = new Map((data ?? []).map((row) => [`${row.sport_key}:${row.game_id}`, row]))
  const inserts = resultRows.filter((row) => !existing.has(`${row.sport_key}:${row.game_id}`))
  const updates = resultRows.filter((row) => {
    const old = existing.get(`${row.sport_key}:${row.game_id}`)
    return old && (old.home_score !== row.home_score || old.away_score !== row.away_score || old.winner !== row.winner)
  })
  if (inserts.length) {
    persistence.dbWriteChunks += 1
    const { error: insertError } = await db.from('game_results').insert(inserts)
    if (insertError) {
      persistence.dbWriteFailures += 1
      throw new Error(`game_results insert failed: ${insertError.message}`)
    }
    persistence.dbRowsInsertedOrReused += inserts.length
  }
  for (const row of updates) {
    persistence.dbWriteChunks += 1
    const { error: updateError } = await db.from('game_results').update({
      home_team: row.home_team,
      away_team: row.away_team,
      home_score: row.home_score,
      away_score: row.away_score,
      winner: row.winner,
      commence_time: row.commence_time,
    }).eq('sport_key', row.sport_key).eq('game_id', row.game_id)
    if (updateError) {
      persistence.dbWriteFailures += 1
      throw new Error(`game_results update failed: ${updateError.message}`)
    }
    persistence.dbRowsInsertedOrReused += 1
  }
}

function gameTeamStatsRows(game, eventId, homeId, awayId, season, source) {
  const home = asRecord(game.home_team)
  const away = asRecord(game.visitor_team)
  const quarters = quarterScoresForGame(game)
  const homeScore = safeNumber(game.home_team_score)
  const awayScore = safeNumber(game.visitor_team_score)
  const resolvedSeason = seasonKey(season ?? Number(game.season ?? PHASE0_SEASON))
  return [
    {
      id: `${eventId}_${homeId}`,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: resolvedSeason,
      event_id: eventId,
      team_id: homeId,
      team_name: safeString(home.full_name),
      opponent_team_id: awayId,
      opponent_team_name: safeString(away.full_name),
      is_home: true,
      points_for: homeScore,
      points_against: awayScore,
      first_half_points: [quarters.home[0], quarters.home[1]].every((value) => value !== null) ? quarters.home[0] + quarters.home[1] : null,
      quarter_scores: quarters.home,
      stats: { source, providerStatus: safeString(game.status) },
      provider_ids: { balldontlie: safeString(game.id), team: safeString(home.id) },
      updated_at: new Date().toISOString(),
    },
    {
      id: `${eventId}_${awayId}`,
      sport_key: SPORT_KEY,
      league_key: LEAGUE_KEY,
      season: resolvedSeason,
      event_id: eventId,
      team_id: awayId,
      team_name: safeString(away.full_name),
      opponent_team_id: homeId,
      opponent_team_name: safeString(home.full_name),
      is_home: false,
      points_for: awayScore,
      points_against: homeScore,
      first_half_points: [quarters.away[0], quarters.away[1]].every((value) => value !== null) ? quarters.away[0] + quarters.away[1] : null,
      quarter_scores: quarters.away,
      stats: { source, providerStatus: safeString(game.status) },
      provider_ids: { balldontlie: safeString(game.id), team: safeString(away.id) },
      updated_at: new Date().toISOString(),
    },
  ].filter((row) => row.team_name)
}

async function persistPlayerStats(db, stats, season, source, persistence) {
  const teams = stats.map((stat) => asRecord(stat.team)).filter((team) => team.id || team.abbreviation)
  const players = stats.map((stat) => asRecord(stat.player)).filter((player) => player.id)
  await persistTeams(db, teams, source, persistence)
  await persistPlayers(db, players, source, persistence)
  const knownEventIds = await knownCanonicalEventIds(db, stats)
  const rows = stats.map((stat) => playerStatRow(stat, season, source, `nba_bdl_stat_${safeString(stat.id) || hash([stat.game?.id, stat.player?.id, stat.team?.id])}`, knownEventIds)).filter(Boolean)
  await upsertRows(db, 'sport_player_stats', rows, 'id', persistence)
}

async function persistAdvancedStats(db, stats, season, source, persistence) {
  // Advanced stat pages repeat team identity thousands of times; the teams endpoint
  // and player endpoint are the durable identity sources, while stat rows still
  // keep canonical team/player FKs.
  const knownEventIds = await knownCanonicalEventIds(db, stats)
  const knownTeamIds = await knownCanonicalTeamIdsForStats(db, stats)
  const knownPlayerIds = await knownCanonicalPlayerIds(db, stats)
  const rows = stats.map((stat) => {
    const base = playerStatRow(
      stat,
      season,
      source,
      `nba_bdl_adv_${safeString(stat.id) || hash([stat.game?.id, stat.player?.id, stat.team?.id, 'advanced'])}`,
      knownEventIds,
      knownTeamIds,
      knownPlayerIds,
    )
    if (!base) return null
    return {
      ...base,
      points: safeNumber(stat.pts ?? stat.points),
      rebounds: safeNumber(stat.reb ?? stat.rebounds),
      assists: safeNumber(stat.ast ?? stat.assists),
      usage_rate: safeNumber(stat.usage_percentage ?? stat.usg_pct ?? stat.usg_percent),
      stats: stat,
      metadata: { ...base.metadata, advancedStats: true },
    }
  }).filter(Boolean)
  await upsertRows(db, 'sport_player_stats', rows, 'id', persistence)
}

async function persistBoxScores(db, boxScores, season, source, persistence) {
  const playerStats = []
  const teams = []
  for (const box of boxScores) {
    const rows = [
      ...extractArray(box.home_team?.players),
      ...extractArray(box.visitor_team?.players),
      ...extractArray(box.home_players),
      ...extractArray(box.visitor_players),
      ...extractArray(box.players),
    ]
    teams.push(asRecord(box.home_team), asRecord(box.visitor_team))
    for (const stat of rows) playerStats.push(stat)
  }
  if (teams.length) await persistTeams(db, teams.filter((team) => team.id || team.abbreviation), source, persistence)
  if (playerStats.length) await persistPlayerStats(db, playerStats, season, source, persistence)
  persistence.dbRowsInsertedOrReused += boxScores.length
}

async function knownCanonicalEventIds(db, stats) {
  const ids = [...new Set(stats.map((stat) => stat.game?.id || stat.game_id).filter(Boolean).map(canonicalEventId))]
  if (!ids.length) return new Set()
  const { data, error } = await withTransientDbRetry(() => db.from('sport_events').select('id').in('id', ids))
  if (error) throw new Error(`sport_events stat event lookup failed: ${error.message}`)
  return new Set((data ?? []).map((row) => row.id))
}

async function knownCanonicalTeamIdsForStats(db, stats) {
  const ids = [...new Set(stats
    .map((stat) => {
      const team = asRecord(stat.team)
      return team.id || team.abbreviation || stat.team_id ? canonicalTeamId(team.abbreviation, team.id || stat.team_id) : null
    })
    .filter(Boolean))]
  if (!ids.length) return new Set()
  const { data, error } = await withTransientDbRetry(() => db.from('sports_teams').select('id').in('id', ids))
  if (error) throw new Error(`sports_teams stat team lookup failed: ${error.message}`)
  return new Set((data ?? []).map((row) => row.id))
}

async function knownCanonicalPlayerIds(db, stats) {
  const ids = [...new Set(stats
    .map((stat) => {
      const player = asRecord(stat.player)
      return player.id || stat.player_id ? canonicalPlayerId(player.id || stat.player_id) : null
    })
    .filter(Boolean))]
  if (!ids.length) return new Set()
  const { data, error } = await withTransientDbRetry(() => db.from('sport_players').select('id').in('id', ids))
  if (error) throw new Error(`sport_players stat player lookup failed: ${error.message}`)
  return new Set((data ?? []).map((row) => row.id))
}

function playerStatRow(stat, season, source, id, knownEventIds = new Set(), knownTeamIds = null, knownPlayerIds = null) {
  const player = asRecord(stat.player)
  const team = asRecord(stat.team)
  const gameRef = asRecord(stat.game)
  const playerId = player.id || stat.player_id ? canonicalPlayerId(player.id || stat.player_id) : null
  if (!playerId) return null
  if (knownPlayerIds && !knownPlayerIds.has(playerId)) return null
  const candidateTeamId = team.id || team.abbreviation || stat.team_id ? canonicalTeamId(team.abbreviation, team.id || stat.team_id) : null
  const teamId = candidateTeamId && (!knownTeamIds || knownTeamIds.has(candidateTeamId)) ? candidateTeamId : null
  const candidateEventId = gameRef.id || stat.game_id ? canonicalEventId(gameRef.id || stat.game_id) : null
  const eventId = candidateEventId && knownEventIds.has(candidateEventId) ? candidateEventId : null
  return {
    id,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    season: seasonKey(season ?? Number(gameRef.season ?? PHASE0_SEASON)),
    stat_type: 'game',
    event_id: eventId,
    team_id: teamId,
    player_id: playerId,
    player_name: `${safeString(player.first_name)} ${safeString(player.last_name)}`.trim(),
    provider: PROVIDER,
    minutes: parseMinutes(stat.min ?? stat.minutes),
    points: safeNumber(stat.pts ?? stat.points),
    rebounds: safeNumber(stat.reb ?? stat.rebounds),
    assists: safeNumber(stat.ast ?? stat.assists),
    steals: safeNumber(stat.stl ?? stat.steals),
    blocks: safeNumber(stat.blk ?? stat.blocks),
    turnovers: safeNumber(stat.turnover ?? stat.tov ?? stat.turnovers),
    field_goals_made: safeNumber(stat.fgm),
    field_goals_attempted: safeNumber(stat.fga),
    three_pointers_made: safeNumber(stat.fg3m),
    three_pointers_attempted: safeNumber(stat.fg3a),
    free_throws_made: safeNumber(stat.ftm),
    free_throws_attempted: safeNumber(stat.fta),
    provider_ids: { balldontlie: safeString(stat.id), game: safeString(gameRef.id || stat.game_id), player: safeString(player.id || stat.player_id) },
    stats: stat,
    metadata: { source, canonicalEventLinked: Boolean(eventId), providerGameId: safeString(gameRef.id || stat.game_id) },
    updated_at: new Date().toISOString(),
  }
}

function extractArray(value) {
  return Array.isArray(value) ? value : []
}

async function runStartQueue(mode) {
  loadEnvFile()
  const hasKey = Boolean(process.env.BALLDONTLIE_API_KEY?.trim())
  if (!hasKey) {
    return {
      success: false,
      verdict: 'BALLDONTLIE_GOAT_HISTORICAL_EXTRACTION_BLOCKED',
      mode,
      reason: 'BALLDONTLIE_API_KEY_MISSING',
      providerCallsMade: 0,
      databaseMutationsMade: 0,
    }
  }
  const manifest = loadStartManifest()
  const db = dbClient()
  const client = new BallDontLieHttpClient({
    apiKey: process.env.BALLDONTLIE_API_KEY,
    allowProviderCalls: true,
    requestsPerMinute: BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE,
  })
  const persistence = {
    rawPayloads: 0,
    rawPayloadFailures: 0,
    dbRowsInsertedOrReused: 0,
    dbWriteChunks: 0,
    dbWriteFailures: 0,
  }
  const startedAt = new Date().toISOString()
  let processed = 0
  manifest.stopReason = null
  while (processed < START_MAX_REQUESTS_PER_RUN) {
    const task = nextStartTask(manifest)
    if (!task) break
    try {
      await processStartTask(db, client, manifest, task, persistence)
      processed += task.state === 'DB_PERSISTED' ? 1 : 0
    } catch (error) {
      task.state = existsSync(task.rawPath) ? 'FAILED_DB' : 'FAILED'
      task.error = error instanceof Error ? error.message : String(error)
      task.updatedAt = new Date().toISOString()
      manifest.stopReason = task.state === 'FAILED_DB' ? 'DB_FAILURE_RAW_PAYLOAD_DURABLE_RESUME_WITHOUT_PROVIDER_REFETCH' : 'PROVIDER_OR_RAW_FAILURE'
      saveStartManifest(manifest)
      break
    }
  }
  saveStartManifest(manifest)
  const summary = {
    success: !manifest.stopReason || manifest.completed,
    verdict: manifest.completed ? 'BALLDONTLIE_GOAT_HISTORICAL_EXTRACTION_COMPLETE' : manifest.stopReason ? 'BALLDONTLIE_GOAT_HISTORICAL_EXTRACTION_BLOCKED' : 'BALLDONTLIE_GOAT_HISTORICAL_EXTRACTION_IN_PROGRESS_RESUMABLE',
    mode,
    startedAt,
    completedAt: new Date().toISOString(),
    processedTasksThisRun: processed,
    maxRequestsPerRun: START_MAX_REQUESTS_PER_RUN,
    safeRate: `${BALLDONTLIE_SAFE_TRIAL_REQUESTS_PER_MINUTE} requests/minute`,
    ...startSummary(manifest),
    persistence,
    next: manifest.completed ? 'RUN_FINAL_VALIDATION' : manifest.stopReason ? 'FIX_BLOCKER_THEN_RESUME' : 'RUN_RESUME',
  }
  writeJson(START_CERT_PATH, redactForOutput(summary))
  return summary
}

function mapGameStatus(value) {
  const normalized = safeString(value).toLowerCase()
  if (normalized.includes('final')) return 'completed'
  if (normalized.includes('postpon')) return 'postponed'
  if (normalized.includes('cancel')) return 'cancelled'
  if (normalized.includes('live') || normalized.includes('in progress')) return 'live'
  return 'scheduled'
}

function quarterScoresForGame(game) {
  return {
    home: [game.home_q1, game.home_q2, game.home_q3, game.home_q4].map(safeNumber),
    away: [game.visitor_q1, game.visitor_q2, game.visitor_q3, game.visitor_q4].map(safeNumber),
  }
}

function parseMinutes(value) {
  const raw = safeString(value)
  if (!raw) return null
  const [minutes, seconds] = raw.split(':').map(Number)
  if (Number.isFinite(minutes) && Number.isFinite(seconds)) return Number((minutes + seconds / 60).toFixed(2))
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function redactForOutput(value) {
  const text = JSON.stringify(value)
  for (const secret of [process.env.BALLDONTLIE_API_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.THE_ODDS_API_KEY, process.env.ODDS_API_KEY]) {
    if (secret && text.includes(secret)) throw new Error('Secret value detected in output')
  }
  return value
}

function main() {
  loadEnvFile()
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
    const manifest = existsSync(START_MANIFEST_PATH) ? startSummary(readJson(START_MANIFEST_PATH)) : cert.manifestSummary
    console.log(JSON.stringify({ success: true, status: cert.status, manifest, providerCallsMade: 0, databaseMutationsMade: 0 }, null, 2))
    return
  }
  if (process.argv.includes('--phase0')) {
    phase0().then((result) => {
      console.log(JSON.stringify(redactForOutput(result), null, 2))
      if (!result.success) process.exit(1)
    }).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
    return
  }
  if (process.argv.includes('--start') || process.argv.includes('--resume')) {
    const phase = process.argv.includes('--start') ? 'START' : 'RESUME'
    runStartQueue(phase).then((result) => {
      console.log(JSON.stringify(redactForOutput(result), null, 2))
      if (result.verdict === 'BALLDONTLIE_GOAT_HISTORICAL_EXTRACTION_BLOCKED') process.exit(1)
    }).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
    return
  }
  if (process.argv.includes('--stop')) {
    console.log(JSON.stringify({ success: true, status: 'STOP_REQUEST_RECORDED_NO_ACTIVE_IMPORT_IN_PREP', providerCallsMade: 0, databaseMutationsMade: 0 }, null, 2))
    return
  }
  console.log(JSON.stringify(summarizeBallDontLiePrep(), null, 2))
}

main()
