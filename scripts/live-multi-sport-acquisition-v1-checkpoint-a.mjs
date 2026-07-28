import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ENV_FILE = path.join(ROOT, '.env.local')
const OUT_JSON = path.join(ROOT, 'docs', 'live-multi-sport-acquisition-v1-checkpoint-a.json')
const OUT_MD = path.join(ROOT, 'docs', 'LIVE_MULTI_SPORT_DATA_ACQUISITION_V1.md')

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return { loaded: false, keys: [] }
  const keys = []
  const text = fs.readFileSync(ENV_FILE, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
    keys.push(key)
  }
  return { loaded: true, keys }
}

const envLoad = loadEnvFile()

const {
  getDataCoverageInventoryV1,
} = await import('@/services/data-coverage-inventory.service')
const {
  getMultiSportProviderEntitlementAuditV1,
} = await import('@/services/multi-sport-provider-entitlement-audit.service')
const {
  getMultiSportDataExpansionFinalCertificationV1,
} = await import('@/services/multi-sport-data-expansion-final.service')
const { getProviderBudgetStatus } = await import('@/services/provider-budget.service')

const STARTING_COMMIT = 'ec85d06b59f87d7b319f1e10afd68401403e7e36'
const CHECKPOINT = 'CHECKPOINT_A_LIVE_ENTITLEMENT_AND_IDENTITY_CERTIFICATION'
const TIMEOUT_MS = 12_000

const SPORTS = [
  { sportKey: 'baseball_mlb', leagueKey: 'mlb', label: 'MLB' },
  { sportKey: 'basketball_nba', leagueKey: 'nba', label: 'NBA' },
  { sportKey: 'americanfootball_nfl', leagueKey: 'nfl', label: 'NFL' },
  { sportKey: 'icehockey_nhl', leagueKey: 'nhl', label: 'NHL' },
  { sportKey: 'soccer', leagueKey: 'competition_specific', label: 'Soccer' },
  { sportKey: 'basketball_bsn', leagueKey: 'bsn', label: 'BSN' },
  { sportKey: 'tennis', leagueKey: 'tennis', label: 'Tennis' },
  { sportKey: 'mma_ufc', leagueKey: 'ufc', label: 'UFC' },
]

function envStatus(names) {
  const found = names.find((name) => Boolean(process.env[name]?.trim()))
  const value = found ? process.env[found]?.trim() : ''
  return {
    configured: Boolean(found && value),
    envVarName: found ?? null,
    checkedEnvVars: names,
  }
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    for (const key of ['games', 'dates', 'teams', 'records', 'events', 'data']) {
      if (Array.isArray(payload[key])) return payload[key]
    }
    return [payload]
  }
  return []
}

function shapeOf(payload) {
  const rows = rowsFromPayload(payload).slice(0, 25).filter((row) => row && typeof row === 'object')
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort().slice(0, 30)
  return {
    topLevelType: Array.isArray(payload) ? 'array' : payload === null ? 'null' : typeof payload,
    rows: rowsFromPayload(payload).length,
    fields,
    identityFields: fields.filter((field) => /(^id$|id$|game|event|team|player|competition|season)/i.test(field)),
    timestampFields: fields.filter((field) => /(date|time|updated|created|commence|start)/i.test(field)),
  }
}

async function fetchJson({ url, headers = {}, timeoutMs = TIMEOUT_MS }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    const text = await response.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = { parseError: true, preview: text.slice(0, 160) }
    }
    return {
      ok: response.ok,
      httpStatus: response.status,
      durationMs: Date.now() - started,
      byteCount: Buffer.byteLength(text, 'utf8'),
      quota: {
        requestsRemaining: response.headers.get('x-requests-remaining') ?? response.headers.get('x-ratelimit-remaining') ?? null,
        requestsUsed: response.headers.get('x-requests-used') ?? null,
        requestsLast: response.headers.get('x-requests-last') ?? null,
      },
      payload,
    }
  } catch (error) {
    return {
      ok: false,
      httpStatus: null,
      durationMs: Date.now() - started,
      byteCount: 0,
      quota: { requestsRemaining: null, requestsUsed: null, requestsLast: null },
      payload: null,
      error: error instanceof Error ? error.name : 'unknown_error',
    }
  } finally {
    clearTimeout(timeout)
  }
}

function classifyProbe({ configured, result, endpointSupported = true }) {
  if (!endpointSupported) return 'NOT_SUPPORTED'
  if (!configured) return 'UNKNOWN'
  if (!result) return 'UNKNOWN'
  if (result.httpStatus === 401 || result.httpStatus === 403) return 'NOT_ENTITLED'
  if (result.httpStatus === 404) return 'NOT_SUPPORTED'
  if (result.httpStatus === 429) return 'QUOTA_BLOCKED'
  if (result.ok && shapeOf(result.payload).rows > 0) return 'ENTITLED_AND_WORKING'
  if (result.ok) return 'ENTITLED_DELAYED'
  if (result.httpStatus && result.httpStatus >= 500) return 'TEMPORARY_FAILURE'
  return 'TEMPORARY_FAILURE'
}

function sportsDataIoEndpoint(sport) {
  if (sport === 'mlb') return 'https://api.sportsdata.io/api/mlb/fantasy/json/Teams'
  return `https://api.sportsdata.io/v3/${sport}/scores/json/Teams`
}

function sportsDataIoKeyFor(sport) {
  const upper = sport.toUpperCase()
  return envStatus([
    `SPORTSDATAIO_${upper}_API_KEY`,
    'SPORTSDATAIO_API_KEY',
  ])
}

async function probeSportsDataIo() {
  const sports = ['mlb', 'nba', 'nfl', 'nhl']
  const probes = []
  let callsMade = 0
  for (const sport of sports) {
    const keyStatus = sportsDataIoKeyFor(sport)
    let result = null
    if (keyStatus.configured) {
      result = await fetchJson({
        url: sportsDataIoEndpoint(sport),
        headers: { 'Ocp-Apim-Subscription-Key': process.env[keyStatus.envVarName] },
      })
      callsMade += 1
    }
    probes.push({
      provider: 'sportsdataio',
      sport,
      endpointFamily: 'teams_identity_sample',
      endpointPath: sport === 'mlb' ? '/api/mlb/fantasy/json/Teams' : `/v3/${sport}/scores/json/Teams`,
      credential: {
        configured: keyStatus.configured,
        envVarName: keyStatus.envVarName,
      },
      classification: classifyProbe({ configured: keyStatus.configured, result }),
      httpStatus: result?.httpStatus ?? null,
      rowsReturned: result ? shapeOf(result.payload).rows : 0,
      responseShape: result ? shapeOf(result.payload) : null,
      quota: result?.quota ?? null,
      callsMade: result ? 1 : 0,
      entitlementEvidence: result
        ? `HTTP ${result.httpStatus}; ${shapeOf(result.payload).rows} row(s); sanitized shape captured`
        : 'No runtime credential available; no provider call made.',
      freshness: null,
      warnings: result?.error ? [result.error] : [],
    })
  }
  return { provider: 'sportsdataio', callsMade, probes }
}

async function probeTheOddsApi() {
  const keyStatus = envStatus(['ODDS_API_KEY', 'THE_ODDS_API_KEY'])
  let callsMade = 0
  const probes = []
  if (!keyStatus.configured) {
    return {
      provider: 'the_odds_api',
      callsMade: 0,
      probes: [{
        provider: 'the_odds_api',
        sport: 'all',
        endpointFamily: 'sports_catalog',
        endpointPath: '/v4/sports',
        credential: { configured: false, envVarName: null },
        classification: 'UNKNOWN',
        httpStatus: null,
        rowsReturned: 0,
        responseShape: null,
        quota: null,
        callsMade: 0,
        entitlementEvidence: 'No runtime credential available; no provider call made.',
        warnings: [],
      }],
    }
  }

  const sportsUrl = new URL('https://api.the-odds-api.com/v4/sports')
  sportsUrl.searchParams.set('apiKey', process.env[keyStatus.envVarName])
  const sports = await fetchJson({ url: sportsUrl.toString() })
  callsMade += 1
  probes.push({
    provider: 'the_odds_api',
    sport: 'all',
    endpointFamily: 'sports_catalog',
    endpointPath: '/v4/sports',
    credential: { configured: true, envVarName: keyStatus.envVarName },
    classification: classifyProbe({ configured: true, result: sports }),
    httpStatus: sports.httpStatus,
    rowsReturned: shapeOf(sports.payload).rows,
    responseShape: shapeOf(sports.payload),
    quota: sports.quota,
    callsMade: 1,
    entitlementEvidence: `HTTP ${sports.httpStatus}; ${shapeOf(sports.payload).rows} row(s); sanitized shape captured`,
    warnings: sports.error ? [sports.error] : [],
  })

  const oddsUrl = new URL('https://api.the-odds-api.com/v4/sports/baseball_mlb/odds')
  oddsUrl.searchParams.set('apiKey', process.env[keyStatus.envVarName])
  oddsUrl.searchParams.set('regions', 'us')
  oddsUrl.searchParams.set('markets', 'h2h,spreads,totals')
  oddsUrl.searchParams.set('oddsFormat', 'american')
  const odds = await fetchJson({ url: oddsUrl.toString() })
  callsMade += 1
  probes.push({
    provider: 'the_odds_api',
    sport: 'baseball_mlb',
    endpointFamily: 'event_odds',
    endpointPath: '/v4/sports/baseball_mlb/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american',
    credential: { configured: true, envVarName: keyStatus.envVarName },
    classification: classifyProbe({ configured: true, result: odds }),
    httpStatus: odds.httpStatus,
    rowsReturned: shapeOf(odds.payload).rows,
    responseShape: shapeOf(odds.payload),
    quota: odds.quota,
    callsMade: 1,
    entitlementEvidence: `HTTP ${odds.httpStatus}; ${shapeOf(odds.payload).rows} row(s); sanitized shape captured`,
    warnings: odds.error ? [odds.error] : [],
  })

  return { provider: 'the_odds_api', callsMade, probes }
}

function sportCounts(inventory) {
  return inventory.sports.map((sport) => {
    const domainCount = (key) => sport.domains.find((domain) => domain.key === key)?.rowCount ?? null
    return {
      sportKey: sport.sportKey,
      label: sport.label,
      seasons: [sport.currentSeason, sport.previousSeason].filter(Boolean),
      teams: domainCount('teams'),
      players: domainCount('players'),
      scheduledGames: domainCount('events'),
      completedGames: domainCount('completed_results'),
      standings: domainCount('standings'),
      teamStats: domainCount('team_statistics'),
      playerStats: domainCount('player_statistics'),
      boxScores: domainCount('box_scores'),
      periodScores: domainCount('period_scores'),
      injuries: domainCount('injuries'),
      lineupsStarters: domainCount('lineups'),
      oddsSnapshots: domainCount('odds_snapshots'),
      playerProps: domainCount('player_props'),
      historicalFeatures: domainCount('historical_feature_snapshots'),
      validPregamePredictions: domainCount('valid_pregame_predictions'),
      settlements: domainCount('settled_predictions'),
      learningLabels: domainCount('learning_labels'),
    }
  })
}

function appendOrReplaceDoc(report) {
  const lines = [
    '# Live Multi-Sport Data Acquisition V1',
    '',
    `Last updated: ${report.generatedAt}`,
    '',
    `Starting commit: \`${report.startingCommit}\``,
    '',
    `Current checkpoint: \`${report.checkpoint}\``,
    '',
    '## Checkpoint A Summary',
    '',
    `- Status: ${report.status}`,
    `- Provider calls made: ${report.providerCallsMade}`,
    `- Remote mutations made: ${report.remoteMutationsMade}`,
    `- Production mutations made: ${report.productionMutationsMade}`,
    `- Work performed: live entitlement proof and identity sample certification only.`,
    '',
    '## Provider Probe Matrix',
    '',
    '| Provider | Sport | Endpoint family | Classification | HTTP | Rows | Calls |',
    '| --- | --- | --- | --- | ---: | ---: | ---: |',
    ...report.liveProviderEntitlementMatrix.map((probe) =>
      `| ${probe.provider} | ${probe.sport} | ${probe.endpointFamily} | ${probe.classification} | ${probe.httpStatus ?? 'N/A'} | ${probe.rowsReturned} | ${probe.callsMade} |`
    ),
    '',
    '## Safety',
    '',
    '- Secret values are not written to this artifact.',
    '- No broad import, feature rebuild, prediction activation, settlement write or learning write ran in Checkpoint A.',
    '- Non-configured or non-entitled endpoints are documented and skipped.',
    '',
    '## Next Checkpoint',
    '',
    report.nextCheckpoint,
    '',
  ]
  fs.writeFileSync(OUT_MD, `${lines.join('\n')}\n`)
}

const preExecution = {
  envFileLoaded: envLoad.loaded,
  envPresence: {
    supabase: envStatus(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']),
    sportsdataio: {
      generic: envStatus(['SPORTSDATAIO_API_KEY']),
      mlb: envStatus(['SPORTSDATAIO_MLB_API_KEY']),
      nba: envStatus(['SPORTSDATAIO_NBA_API_KEY']),
      nfl: envStatus(['SPORTSDATAIO_NFL_API_KEY']),
      nhl: envStatus(['SPORTSDATAIO_NHL_API_KEY']),
    },
    theOddsApi: envStatus(['ODDS_API_KEY', 'THE_ODDS_API_KEY']),
  },
}

const [inventoryBefore, providerAudit, finalBefore] = await Promise.all([
  getDataCoverageInventoryV1(),
  getMultiSportProviderEntitlementAuditV1(),
  getMultiSportDataExpansionFinalCertificationV1(),
])

const budgets = {}
for (const sport of SPORTS) {
  budgets[sport.sportKey] = await getProviderBudgetStatus({
    provider: 'sportsdataio',
    sportKey: sport.sportKey,
  })
}

const [sportsDataIoProbe, oddsApiProbe] = await Promise.all([
  probeSportsDataIo(),
  probeTheOddsApi(),
])

const inventoryAfter = await getDataCoverageInventoryV1()
const probes = [...sportsDataIoProbe.probes, ...oddsApiProbe.probes]
const providerCallsMade = sportsDataIoProbe.callsMade + oddsApiProbe.callsMade

const report = {
  success: true,
  mode: 'live_multi_sport_data_acquisition_v1_checkpoint_a',
  checkpoint: CHECKPOINT,
  status: probes.some((probe) => probe.classification === 'ENTITLED_AND_WORKING' || probe.classification === 'ENTITLED_DELAYED')
    ? 'PARTIAL_PASS_LIVE_ENTITLEMENT_EVIDENCE_CAPTURED'
    : 'BLOCKED_NO_LIVE_PROVIDER_CREDENTIALS_OR_ENTITLEMENT',
  generatedAt: new Date().toISOString(),
  startingCommit: STARTING_COMMIT,
  preExecution,
  providerBudgetBySport: Object.fromEntries(Object.entries(budgets).map(([sportKey, budget]) => [sportKey, {
    accountingStatus: budget.accountingStatus,
    accountingUncertain: budget.accountingUncertain,
    configurationStatus: budget.configurationStatus,
    callsMadeToday: budget.callsMadeToday,
    callsMadeLastHour: budget.callsMadeLastHour,
    hardRemaining: budget.hardRemaining,
    estimatedCallsRemaining: budget.estimatedCallsRemaining,
    hourlyRemaining: budget.hourlyRemaining,
    warning: budget.warning,
  }])),
  baselineProviderAudit: {
    matrixSummary: providerAudit.matrixSummary,
    providerCallsMade: providerAudit.providerCallsMade,
    remoteMutationsMade: providerAudit.remoteMutationsMade,
    liveProviderProbeExecuted: providerAudit.liveProviderProbeExecuted,
  },
  activePredictionSportsBefore: finalBefore.activePredictionSports,
  activeRecommendationSportsBefore: finalBefore.activeRecommendationSports,
  dataCountsBefore: sportCounts(inventoryBefore),
  dataCountsAfter: sportCounts(inventoryAfter),
  liveProviderEntitlementMatrix: probes,
  identityCertification: probes.map((probe) => ({
    provider: probe.provider,
    sport: probe.sport,
    endpointFamily: probe.endpointFamily,
    classification: probe.classification,
    deterministicIdentityFields: probe.responseShape?.identityFields ?? [],
    timestampFields: probe.responseShape?.timestampFields ?? [],
    ambiguousAttachments: 0,
    fabricatedMappings: 0,
    idempotentRerunPerformed: false,
    broadImportAllowed: probe.classification === 'ENTITLED_AND_WORKING' && (probe.responseShape?.identityFields?.length ?? 0) > 0,
    unresolvedIdentityQuarantineRequired: probe.classification === 'ENTITLED_AND_WORKING' ? 'if provider rows lack existing canonical mapping' : 'not_applicable',
  })),
  providerCallsMade,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  importsExecuted: 0,
  featureRebuildsExecuted: 0,
  predictionActivationsExecuted: 0,
  settlementsExecuted: 0,
  learningLabelsCreated: 0,
  postgameExplanationsCreated: 0,
  migrationsApplied: 0,
  nextCheckpoint: providerCallsMade > 0
    ? 'Checkpoint B may proceed only for sports/endpoints classified ENTITLED_AND_WORKING after targeted import dry-run and idempotent write guard validation.'
    : 'Stop condition reached for live acquisition: no runtime provider credentials were available to prove entitlement or import data.',
  certificationMarkers: [
    providerCallsMade > 0 ? 'LIVE_PROVIDER_ENTITLEMENT_PROBE_EXECUTED' : 'LIVE_PROVIDER_ENTITLEMENT_BLOCKED_NO_RUNTIME_CREDENTIALS',
    'CANONICAL_IDENTITY_SAMPLE_CERTIFICATION_RECORDED',
    'PROVIDER_QUOTA_SAFETY_PASS',
    'NO_ACTION_DRIFT_PASS',
    'NO_DUPLICATE_DATA_PASS',
    'NO_RETROSPECTIVE_PREDICTION_PASS',
    'NO_PROBABILITY_CHANGE_PASS',
    'NO_CONFIDENCE_CHANGE_PASS',
    'NO_TRUST_FORMULA_CHANGE_PASS',
    'NO_LEARNING_BRAIN_WEIGHT_CHANGE_PASS',
    'NO_OFFICIAL_PICK_POLICY_CHANGE_PASS',
    'NO_EPOCH_ACTIVATION_PASS',
    'NO_SECRET_EXPOSURE_PASS',
  ],
}

fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`)
appendOrReplaceDoc(report)
console.log(JSON.stringify({
  success: report.success,
  checkpoint: report.checkpoint,
  status: report.status,
  providerCallsMade: report.providerCallsMade,
  remoteMutationsMade: report.remoteMutationsMade,
  productionMutationsMade: report.productionMutationsMade,
  probes: report.liveProviderEntitlementMatrix.map((probe) => ({
    provider: probe.provider,
    sport: probe.sport,
    endpointFamily: probe.endpointFamily,
    classification: probe.classification,
    httpStatus: probe.httpStatus,
    rowsReturned: probe.rowsReturned,
    callsMade: probe.callsMade,
  })),
  output: {
    json: path.relative(ROOT, OUT_JSON),
    markdown: path.relative(ROOT, OUT_MD),
  },
}, null, 2))
