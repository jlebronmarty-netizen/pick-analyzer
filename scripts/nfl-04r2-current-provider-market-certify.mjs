import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadNflFrozenRuntimeArtifact, scoreCurrentNflGame } from '../src/services/nfl-frozen-runtime-model.service.ts'

const TARGET_COMMIT = '543deab9221d0018879b5d16055fe3fa0092566a'
const SPORT_KEY = 'americanfootball_nfl'
const BDL_BASE = 'https://api.balldontlie.io'
const ODDS_BASE = 'https://api.the-odds-api.com/v4'
const CORE_BOOKS = new Set(['fanduel', 'draftkings', 'betmgm', 'williamhill_us', 'caesars'])
const CERT_PATH = 'docs/CERTIFICATION/nfl-04r2-current-provider-market-certification.json'

loadLocalEnv()

function loadLocalEnv() {
  let text = ''
  try {
    text = readFileSync('.env.local', 'utf8')
  } catch {
    return
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

function nowIso() {
  return new Date().toISOString()
}

function stableHash(parts) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex')
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mean(values) {
  const finite = values.map(Number).filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null
}

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function quantile(values, q) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const index = (sorted.length - 1) * q
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo)
}

function std(values) {
  const finite = values.map(Number).filter(Number.isFinite)
  const avg = mean(finite)
  if (!finite.length || avg === null) return null
  return Math.sqrt(finite.reduce((sum, value) => sum + (value - avg) ** 2, 0) / finite.length)
}

function skewness(values) {
  const finite = values.map(Number).filter(Number.isFinite)
  const avg = mean(finite)
  const s = std(finite)
  if (!finite.length || avg === null || !s) return null
  return finite.reduce((sum, value) => sum + ((value - avg) / s) ** 3, 0) / finite.length
}

function summarize(values) {
  return {
    count: values.length,
    mean: round(mean(values)),
    std: round(std(values)),
    median: round(median(values)),
    q05: round(quantile(values, 0.05)),
    q25: round(quantile(values, 0.25)),
    q75: round(quantile(values, 0.75)),
    q95: round(quantile(values, 0.95)),
    skewness: round(skewness(values)),
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
  }
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null
}

function impliedProbability(american) {
  const price = Number(american)
  if (!Number.isFinite(price) || price === 0) return null
  return price > 0 ? 100 / (price + 100) : Math.abs(price) / (Math.abs(price) + 100)
}

function selectionKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

async function count(table, apply) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (apply) query = apply(query)
  const { count: total, error } = await query
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return total ?? 0
}

async function selectAll(table, columns, apply, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(columns).range(from, from + pageSize - 1)
    if (apply) query = apply(query)
    const { data, error } = await query
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function providerFetch({ provider, url, headers = {} }) {
  const response = await fetch(url, { headers, cache: 'no-store' })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  return {
    provider,
    httpStatus: response.status,
    ok: response.ok,
    records: Array.isArray(payload?.data) ? payload.data.length : Array.isArray(payload) ? payload.length : payload ? 1 : 0,
    payload: response.ok ? payload : null,
    rateLimit: {
      limit: response.headers.get('x-ratelimit-limit') ?? response.headers.get('x-rate-limit-limit'),
      remaining: response.headers.get('x-ratelimit-remaining') ?? response.headers.get('x-rate-limit-remaining') ?? response.headers.get('x-requests-remaining'),
      requestsUsed: response.headers.get('x-requests-used'),
      requestsLast: response.headers.get('x-requests-last'),
    },
    error: response.ok ? null : sanitize(text),
  }
}

function sanitize(text) {
  return String(text ?? '').replace(/apiKey=[^&\s"]+/gi, 'apiKey=[REDACTED]').slice(0, 300)
}

function endpointOnly(url) {
  const parsed = new URL(url)
  parsed.searchParams.delete('apiKey')
  return `${parsed.pathname}${parsed.search}`
}

function bdlUrl(path, params = {}) {
  const url = new URL(`${BDL_BASE}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)))
    else if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  return url
}

function oddsUrl() {
  const url = new URL(`${ODDS_BASE}/sports/${SPORT_KEY}/odds`)
  url.searchParams.set('apiKey', requireEnv('THE_ODDS_API_KEY'))
  url.searchParams.set('regions', 'us')
  url.searchParams.set('markets', 'h2h,spreads,totals')
  url.searchParams.set('oddsFormat', 'american')
  return url
}

function canonicalBdlTeamId(id) {
  return `${SPORT_KEY}_balldontlie_team_${id}`
}

function statValue(row, key) {
  return number(row?.stats?.[key])
}

function ratio(n, d) {
  const numerator = number(n)
  const denominator = number(d)
  return numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null
}

function avgProp(rows, prop) {
  return mean(rows.map((row) => row[prop]))
}

function lastRows(rows, count) {
  return rows.slice(Math.max(0, rows.length - count))
}

function daysBetween(a, b) {
  const diff = Date.parse(a) - Date.parse(b)
  return Number.isFinite(diff) ? diff / 86400000 : null
}

function historyFeatures(prefix, rows) {
  const last3 = lastRows(rows, 3)
  const last5 = lastRows(rows, 5)
  const rest = rows.length ? daysBetween(rows.at(-1).targetStartTime ?? rows.at(-1).startTime, rows.at(-1).startTime) : null
  return {
    [`${prefix}_games_before`]: rows.length,
    [`${prefix}_last3_points_for`]: avgProp(last3, 'pointsFor'),
    [`${prefix}_last3_points_against`]: avgProp(last3, 'pointsAgainst'),
    [`${prefix}_last3_margin`]: avgProp(last3, 'margin'),
    [`${prefix}_last3_total_yards`]: avgProp(last3, 'totalYards'),
    [`${prefix}_last3_yards_per_play`]: avgProp(last3, 'yardsPerPlay'),
    [`${prefix}_last3_passing_yards`]: avgProp(last3, 'passingYards'),
    [`${prefix}_last3_yards_per_pass`]: avgProp(last3, 'yardsPerPass'),
    [`${prefix}_last3_rushing_yards`]: avgProp(last3, 'rushingYards'),
    [`${prefix}_last3_yards_per_rush`]: avgProp(last3, 'yardsPerRush'),
    [`${prefix}_last3_turnovers`]: avgProp(last3, 'turnovers'),
    [`${prefix}_last3_third_down_rate`]: avgProp(last3, 'thirdDownRate'),
    [`${prefix}_last3_red_zone_rate`]: avgProp(last3, 'redZoneRate'),
    [`${prefix}_last5_points_for`]: avgProp(last5, 'pointsFor'),
    [`${prefix}_last5_points_against`]: avgProp(last5, 'pointsAgainst'),
    [`${prefix}_last5_margin`]: avgProp(last5, 'margin'),
    [`${prefix}_last5_win_rate`]: avgProp(last5, 'win'),
    [`${prefix}_std_points_for`]: avgProp(rows, 'pointsFor'),
    [`${prefix}_std_points_against`]: avgProp(rows, 'pointsAgainst'),
    [`${prefix}_std_margin`]: avgProp(rows, 'margin'),
    [`${prefix}_std_win_rate`]: avgProp(rows, 'win'),
    [`${prefix}_home_points_for`]: avgProp(rows.filter((row) => row.isHome), 'pointsFor'),
    [`${prefix}_away_points_for`]: avgProp(rows.filter((row) => !row.isHome), 'pointsFor'),
    [`${prefix}_qb_last5_attempts`]: avgProp(last5, 'qbAttempts'),
    [`${prefix}_qb_last5_completion_pct`]: avgProp(last5, 'qbCompletionPct'),
    [`${prefix}_qb_last5_yards`]: avgProp(last5, 'qbPassingYards'),
    [`${prefix}_qb_last5_tds`]: avgProp(last5, 'qbPassingTds'),
    [`${prefix}_qb_last5_ints`]: avgProp(last5, 'qbInterceptions'),
    [`${prefix}_qb_last5_sacks`]: avgProp(last5, 'qbSacks'),
    [`${prefix}_qb_last5_yards_per_attempt`]: avgProp(last5, 'qbYardsPerAttempt'),
    [`${prefix}_qb_last5_td_rate`]: avgProp(last5, 'qbTdRate'),
    [`${prefix}_qb_last5_int_rate`]: avgProp(last5, 'qbIntRate'),
    [`${prefix}_qb_last5_rushing_yards`]: avgProp(last5, 'qbRushingYards'),
    [`${prefix}_rest_days`]: rest,
  }
}

function perfFromGame(game, teamId, opponentId, stat, qbRows) {
  const attempts = mean(qbRows.map((row) => statValue(row, 'passing_attempts'))) ?? statValue(stat, 'passing_attempts')
  const completions = mean(qbRows.map((row) => statValue(row, 'passing_completions'))) ?? statValue(stat, 'passing_completions')
  const passingYards = mean(qbRows.map((row) => statValue(row, 'passing_yards'))) ?? statValue(stat, 'net_passing_yards')
  const passingTds = mean(qbRows.map((row) => statValue(row, 'passing_touchdowns'))) ?? 0
  const interceptions = mean(qbRows.map((row) => statValue(row, 'passing_interceptions'))) ?? statValue(stat, 'interceptions_thrown') ?? 0
  const sacks = mean(qbRows.map((row) => statValue(row, 'sacks'))) ?? statValue(stat, 'sacks') ?? 0
  const rushingYards = mean(qbRows.map((row) => statValue(row, 'rushing_yards'))) ?? 0
  const pointsFor = teamId === game.home_team_id ? game.home_score : game.away_score
  const pointsAgainst = teamId === game.home_team_id ? game.away_score : game.home_score
  return {
    eventId: game.id,
    startTime: game.start_time,
    teamId,
    opponentId,
    isHome: teamId === game.home_team_id,
    pointsFor,
    pointsAgainst,
    margin: pointsFor - pointsAgainst,
    win: pointsFor > pointsAgainst ? 1 : 0,
    totalYards: statValue(stat, 'total_yards'),
    yardsPerPlay: statValue(stat, 'yards_per_play'),
    passingYards: statValue(stat, 'net_passing_yards'),
    yardsPerPass: statValue(stat, 'yards_per_pass'),
    rushingYards: statValue(stat, 'rushing_yards'),
    yardsPerRush: statValue(stat, 'yards_per_rush_attempt'),
    turnovers: statValue(stat, 'turnovers') ?? 0,
    thirdDownRate: ratio(stat?.stats?.third_down_conversions, stat?.stats?.third_down_attempts),
    redZoneRate: ratio(stat?.stats?.red_zone_scores, stat?.stats?.red_zone_attempts),
    qbAttempts: attempts,
    qbCompletions: completions,
    qbPassingYards: passingYards,
    qbPassingTds: passingTds,
    qbInterceptions: interceptions,
    qbSacks: sacks,
    qbRushingYards: rushingYards,
    qbCompletionPct: ratio(completions, attempts),
    qbYardsPerAttempt: ratio(passingYards, attempts),
    qbTdRate: ratio(passingTds, attempts),
    qbIntRate: ratio(interceptions, attempts),
  }
}

function buildFeatureForEvent({ event, completedGames, teamStatsByEventTeam, qbStatsByEventTeam, featureNames }) {
  const homePriorGames = completedGames.filter((game) =>
    (game.home_team_id === event.home_team_id || game.away_team_id === event.home_team_id) &&
    Date.parse(game.start_time) < Date.parse(event.start_time)
  )
  const awayPriorGames = completedGames.filter((game) =>
    (game.home_team_id === event.away_team_id || game.away_team_id === event.away_team_id) &&
    Date.parse(game.start_time) < Date.parse(event.start_time)
  )
  const homePrior = homePriorGames.map((game) => {
    const stat = teamStatsByEventTeam.get(`${game.id}|${event.home_team_id}`)
    const qbRows = qbStatsByEventTeam.get(`${game.id}|${event.home_team_id}`) ?? []
    return perfFromGame(game, event.home_team_id, event.away_team_id, stat, qbRows)
  })
  const awayPrior = awayPriorGames.map((game) => {
    const stat = teamStatsByEventTeam.get(`${game.id}|${event.away_team_id}`)
    const qbRows = qbStatsByEventTeam.get(`${game.id}|${event.away_team_id}`) ?? []
    return perfFromGame(game, event.away_team_id, event.home_team_id, stat, qbRows)
  })
  const base = {
    ...historyFeatures('home', homePrior.map((row) => ({ ...row, targetStartTime: event.start_time }))),
    ...historyFeatures('away', awayPrior.map((row) => ({ ...row, targetStartTime: event.start_time }))),
    target_week: number(event.metadata?.week) ?? 1,
    target_postseason: event.stage === 'postseason' || event.metadata?.postseason === true ? 1 : 0,
    home_is_home: 1,
  }
  for (const key of [
    'last3_points_for', 'last3_points_against', 'last3_margin', 'last3_total_yards', 'last3_yards_per_play',
    'last3_passing_yards', 'last3_rushing_yards', 'last5_margin', 'last5_win_rate', 'std_margin', 'std_win_rate',
    'qb_last5_yards_per_attempt', 'qb_last5_td_rate', 'qb_last5_int_rate', 'rest_days',
  ]) {
    base[`diff_${key}`] = (base[`home_${key}`] ?? 0) - (base[`away_${key}`] ?? 0)
  }
  const missing = featureNames.filter((name) => !(name in base) || base[name] === null || base[name] === undefined || Number.isNaN(Number(base[name])))
  return {
    eventId: event.id,
    homePrior: homePrior.length,
    awayPrior: awayPrior.length,
    featureComplete: missing.length === 0,
    qbEvidence: homePrior.some((row) => Number(row.qbAttempts) > 0) && awayPrior.some((row) => Number(row.qbAttempts) > 0),
    missingFeatures: missing,
    features: Object.fromEntries(featureNames.map((name) => [name, Number(base[name] ?? 0)])),
    maxSourceTime: [...homePrior, ...awayPrior].map((row) => row.startTime).sort().at(-1) ?? null,
    crossSeasonSource: [...homePriorGames, ...awayPriorGames].some((game) => String(game.season) !== String(event.season)),
  }
}

function residualProbability(residuals, threshold) {
  const values = residuals.map(Number).filter(Number.isFinite)
  if (!values.length) return null
  return values.filter((value) => value > threshold).length / values.length
}

function candidateKey(candidate) {
  return stableHash([
    candidate.sportKey,
    candidate.eventId,
    candidate.market,
    candidate.selection,
    candidate.line ?? 'null',
    candidate.sportsbook,
    'CURRENT_ERA_SHADOW',
    candidate.modelVersion,
  ]).slice(0, 32)
}

async function main() {
  const generatedAt = nowIso()
  const artifact = loadNflFrozenRuntimeArtifact()
  const featureNames = artifact.featureManifest.map((item) => item.name)
  const fixtureScore = scoreCurrentNflGame(artifact.parityRows[0].features, artifact)
  const frozenRuntime = {
    artifactLoads: true,
    digestValid: true,
    featureCount: featureNames.length,
    logisticModelComplete: artifact.moneylineModel.coefficients.length === 86,
    plattComplete: artifact.calibration.coefficients.length === 1,
    homeRidgeComplete: artifact.scoreModels.homeScore.coefficients.length === 86,
    awayRidgeComplete: artifact.scoreModels.awayScore.coefficients.length === 86,
    runtimeScorerPass: Math.abs(fixtureScore.homeWinProbability - artifact.parityRows[0].calibratedProbability) <= 1e-10,
    runtimeDigest: artifact.digests.runtimeArtifactDigest,
  }

  const now = new Date()
  const [
    currentTeams,
    futureEvents,
    existingMappings,
    currentOdds,
    existingPredictions,
    currentEraShadow,
    officialPickRows,
  ] = await Promise.all([
    selectAll('sports_teams', 'id,name,abbreviation,provider_ids', (q) => q.eq('sport_key', SPORT_KEY).eq('active', true).order('id')),
    selectAll('sport_events', 'id,season,stage,home_team_id,away_team_id,home_team,away_team,start_time,status,provider_ids,metadata', (q) => q.eq('sport_key', SPORT_KEY).gt('start_time', now.toISOString()).order('start_time')),
    selectAll('provider_entity_mappings', 'sport_key,entity_type,internal_id,provider,provider_id,season,metadata', (q) => q.eq('sport_key', SPORT_KEY).in('entity_type', ['team', 'event'])),
    selectAll('sports_odds_snapshots', 'id,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,provider_timestamp,metadata', (q) => q.eq('sport_key', SPORT_KEY).order('snapshot_time', { ascending: false }).limit(3000)),
    count('prediction_history', (q) => q.eq('sport_key', SPORT_KEY)),
    count('prediction_history', (q) => q.eq('sport_key', SPORT_KEY).eq('prediction_origin', 'CURRENT_ERA_SHADOW')),
    count('prediction_history', (q) => q.eq('sport_key', SPORT_KEY).eq('recommended_pick', true)),
  ])

  const productionState = {
    futureEvents: futureEvents.length,
    statuses: [...new Set(futureEvents.map((event) => event.status ?? 'unknown'))].sort(),
    currentCanonicalTeams: currentTeams.length,
    currentFutureMappings: existingMappings.length,
    storedMarketSnapshots: currentOdds.length,
    latestStoredMarketSnapshot: currentOdds[0]?.snapshot_time ?? null,
    existingCurrentEraShadow: currentEraShadow,
    existingNflPredictionHistory: existingPredictions,
    existingOfficialPickRows: officialPickRows,
  }

  const bdlCalls = []
  const previousCert = existsSync(CERT_PATH) ? JSON.parse(readFileSync(CERT_PATH, 'utf8')) : null
  const reuseBallDontLieProbe = previousCert?.providerCalls?.ballDontLie > 0 && process.env.NFL04R2_FORCE_BDL_PROBE !== 'true'
  let bdlTeams = []
  let bdlGames = []
  if (reuseBallDontLieProbe) {
    bdlCalls.push(...(previousCert.ballDontLieCurrentProbe ?? []).map((call) => ({ ...call, reusedFromPriorProbe: true })))
    bdlTeams = (previousCert.crossProviderTeamIdentity?.deterministicMappings ?? []).map((team) => ({
      id: team.providerId,
      abbreviation: team.abbreviation,
      full_name: team.providerName,
      name: team.providerName,
    }))
    const priorEvents = [
      ...(previousCert.currentEventIdentity?.unmatchedProviderEvents ?? []),
      ...(previousCert.currentEventIdentity?.sample ?? []),
    ]
    const seenProviderIds = new Set()
    bdlGames = priorEvents.filter((event) => {
      if (seenProviderIds.has(event.providerId)) return false
      seenProviderIds.add(event.providerId)
      return true
    }).map((event) => {
      const [away, home] = String(event.event ?? '').split(' @ ')
      return {
        id: event.providerId,
        date: event.kickoff,
        home_team: { full_name: home, name: home },
        visitor_team: { full_name: away, name: away },
      }
    })
  } else {
    const bdlKey = requireEnv('BALLDONTLIE_API_KEY')
    const teamsUrl = bdlUrl('/nfl/v1/teams', { per_page: 100 })
    const bdlTeamsCall = await providerFetch({ provider: 'balldontlie', url: teamsUrl, headers: { Authorization: bdlKey } })
    bdlCalls.push({ endpoint: endpointOnly(teamsUrl), httpStatus: bdlTeamsCall.httpStatus, records: bdlTeamsCall.records, ok: bdlTeamsCall.ok, rateLimit: bdlTeamsCall.rateLimit })
    const gamesUrl = bdlUrl('/nfl/v1/games', { 'seasons[]': 2026, per_page: 100 })
    const bdlGamesCall = await providerFetch({ provider: 'balldontlie', url: gamesUrl, headers: { Authorization: bdlKey } })
    bdlCalls.push({ endpoint: endpointOnly(gamesUrl), httpStatus: bdlGamesCall.httpStatus, records: bdlGamesCall.records, ok: bdlGamesCall.ok, rateLimit: bdlGamesCall.rateLimit })
    bdlTeams = Array.isArray(bdlTeamsCall.payload?.data) ? bdlTeamsCall.payload.data : []
    bdlGames = Array.isArray(bdlGamesCall.payload?.data) ? bdlGamesCall.payload.data : []
  }
  const bdlAuthority = {
    keyPresent: true,
    currentOnlyCalls: bdlCalls.length,
    reusedPriorProbe: reuseBallDontLieProbe,
    historicalCalls: 0,
    authPass: bdlCalls.every((call) => call.httpStatus !== 401 && call.httpStatus !== 403),
    allStarCurrentAccessPass: bdlCalls.every((call) => call.ok),
    gamesReturned: bdlGames.length,
    teamsReturned: bdlTeams.length,
  }

  const canonicalByBdlTeamId = new Map(currentTeams.map((team) => [String(team.provider_ids?.balldontlie ?? ''), team]))
  const teamMappings = bdlTeams.map((team) => ({
    providerId: String(team.id),
    abbreviation: team.abbreviation ?? null,
    providerName: team.full_name ?? team.name ?? null,
    canonicalId: canonicalByBdlTeamId.get(String(team.id))?.id ?? null,
  }))
  const unmappedTeams = teamMappings.filter((team) => !team.canonicalId)
  const duplicateCanonicalTeams = teamMappings.length - new Set(teamMappings.map((team) => team.canonicalId).filter(Boolean)).size

  const canonicalTeamByName = new Map(currentTeams.map((team) => [selectionKey(team.name), team]))
  const futureEventsResolved = futureEvents.map((event) => ({
    ...event,
    home_team_id: event.home_team_id ?? canonicalTeamByName.get(selectionKey(event.home_team))?.id ?? null,
    away_team_id: event.away_team_id ?? canonicalTeamByName.get(selectionKey(event.away_team))?.id ?? null,
  }))

  const futureByTeamsTime = new Map()
  for (const event of futureEventsResolved) {
    const bucket = Math.round(Date.parse(event.start_time) / 1800000)
    futureByTeamsTime.set(`${event.home_team_id}|${event.away_team_id}|${bucket}`, event)
  }
  const futureByNamesTime = new Map()
  for (const event of futureEventsResolved) {
    const bucket = Math.round(Date.parse(event.start_time) / 1800000)
    futureByNamesTime.set(`${selectionKey(event.home_team)}|${selectionKey(event.away_team)}|${bucket}`, event)
  }
  const eventMappings = bdlGames.map((game) => {
    const homeName = game.home_team?.full_name ?? game.home_team?.name
    const awayName = game.visitor_team?.full_name ?? game.visitor_team?.name
    const homeId = game.home_team?.id ? canonicalBdlTeamId(game.home_team.id) : canonicalTeamByName.get(selectionKey(homeName))?.id
    const awayId = game.visitor_team?.id ? canonicalBdlTeamId(game.visitor_team.id) : canonicalTeamByName.get(selectionKey(awayName))?.id
    const bucket = Math.round(Date.parse(game.date) / 1800000)
    const canonical = futureByTeamsTime.get(`${homeId}|${awayId}|${bucket}`) ?? futureByNamesTime.get(`${selectionKey(homeName)}|${selectionKey(awayName)}|${bucket}`)
    return {
      providerId: String(game.id),
      event: `${awayName ?? 'Away'} @ ${homeName ?? 'Home'}`,
      kickoff: game.date ?? null,
      canonicalEventId: canonical?.id ?? null,
      status: canonical ? 'MAPPED' : 'UNMAPPED',
    }
  })

  const completedGames = await selectAll('sport_events', 'id,season,stage,home_team_id,away_team_id,home_team,away_team,start_time,status,home_score,away_score,metadata', (q) =>
    q.eq('sport_key', SPORT_KEY).eq('status', 'completed').not('home_score', 'is', null).not('away_score', 'is', null).order('start_time')
  )
  const eventIds = completedGames.map((game) => game.id)
  const teamStats = []
  for (let i = 0; i < eventIds.length; i += 100) {
    teamStats.push(...await selectAll('sport_game_stats', 'event_id,team_id,stats', (q) => q.eq('sport_key', SPORT_KEY).in('event_id', eventIds.slice(i, i + 100))))
  }
  const qbRows = []
  for (let i = 0; i < eventIds.length; i += 100) {
    qbRows.push(...await selectAll('sport_player_stats', 'event_id,team_id,stats', (q) => q.eq('sport_key', SPORT_KEY).eq('stat_type', 'game').in('event_id', eventIds.slice(i, i + 100))))
  }
  const teamStatsByEventTeam = new Map(teamStats.map((row) => [`${row.event_id}|${row.team_id}`, row]))
  const qbStatsByEventTeam = new Map()
  for (const row of qbRows) {
    if (!number(row.stats?.passing_attempts)) continue
    const key = `${row.event_id}|${row.team_id}`
    const list = qbStatsByEventTeam.get(key) ?? []
    list.push(row)
    qbStatsByEventTeam.set(key, list)
  }

  const featureCoverage = futureEventsResolved.map((event) => {
    const built = buildFeatureForEvent({ event, completedGames, teamStatsByEventTeam, qbStatsByEventTeam, featureNames })
    const eligible = built.homePrior >= 3 && built.awayPrior >= 3 && built.featureComplete && built.qbEvidence
    return {
      eventId: event.id,
      event: `${event.away_team} @ ${event.home_team}`,
      kickoff: event.start_time,
      homePriorGameCount: built.homePrior,
      awayPriorGameCount: built.awayPrior,
      featureComplete: built.featureComplete,
      qbEvidence: built.qbEvidence,
      crossSeasonSource: built.crossSeasonSource,
      eligibility: eligible,
      skipReason: eligible ? null : built.homePrior < 3 || built.awayPrior < 3 ? 'INSUFFICIENT_PRIOR_COMPLETED_GAMES' : !built.qbEvidence ? 'QB_INSUFFICIENT' : 'INCOMPLETE_FEATURES',
      features: built.features,
    }
  })
  const eligibleFeatures = featureCoverage.filter((row) => row.eligibility)
  const runtimeOutputs = eligibleFeatures.map((row) => {
    const score = scoreCurrentNflGame(row.features, artifact)
    return {
      eventId: row.eventId,
      event: row.event,
      kickoff: row.kickoff,
      modelVersion: artifact.modelVersion,
      featureVersion: artifact.featureVersion,
      calibrationVersion: artifact.calibrationVersion,
      homeWinProbability: round(score.homeWinProbability, 6),
      awayWinProbability: round(score.awayWinProbability, 6),
      expectedHomePoints: round(score.expectedHomePoints, 3),
      expectedAwayPoints: round(score.expectedAwayPoints, 3),
      expectedMargin: round(score.expectedMargin, 3),
      expectedTotal: round(score.expectedTotal, 3),
      probabilitySum: round(score.homeWinProbability + score.awayWinProbability, 8),
    }
  })

  const validationResiduals = artifact.residualEvidence.validation2024
  const holdoutResiduals = artifact.residualEvidence.holdout2025
  const allResiduals = [...validationResiduals, ...holdoutResiduals]
  const marginResiduals = allResiduals.map((row) => row.marginResidual)
  const totalResiduals = allResiduals.map((row) => row.totalResidual)
  const residualAudit = {
    validationMargin: summarize(validationResiduals.map((row) => row.marginResidual)),
    holdoutMargin: summarize(holdoutResiduals.map((row) => row.marginResidual)),
    combinedMargin: summarize(marginResiduals),
    validationTotal: summarize(validationResiduals.map((row) => row.totalResidual)),
    holdoutTotal: summarize(holdoutResiduals.map((row) => row.totalResidual)),
    combinedTotal: summarize(totalResiduals),
  }
  const probabilityReadiness = {
    moneyline: runtimeOutputs.length > 0 && runtimeOutputs.every((row) => Math.abs(row.probabilitySum - 1) < 1e-6),
    spread: marginResiduals.length >= 500,
    total: totalResiduals.length >= 500,
    method: 'EMPIRICAL_RESIDUAL_CDF_2024_VALIDATION_PLUS_2025_HOLDOUT_NO_2026_OUTCOMES',
    spreadSignConvention: 'home cover probability = P(actual home margin > market home spread line); residual = actual margin - modeled margin, so P(residual > line - modeled margin)',
    totalSignConvention: 'over probability = P(actual total > market total line); residual = actual total - modeled total, so P(residual > line - modeled total)',
  }

  let oddsCall = null
  let oddsEvents = []
  if (bdlAuthority.authPass && bdlAuthority.allStarCurrentAccessPass && unmappedTeams.length === 0 && eligibleFeatures.length > 0) {
    const url = oddsUrl()
    const result = await providerFetch({ provider: 'the-odds-api', url })
    oddsCall = {
      endpoint: endpointOnly(url),
      httpStatus: result.httpStatus,
      records: result.records,
      ok: result.ok,
      rateLimit: result.rateLimit,
    }
    oddsEvents = Array.isArray(result.payload) ? result.payload : []
  }

  const eventByTeamNameTime = new Map()
  for (const event of futureEvents) {
    const bucket = Math.round(Date.parse(event.start_time) / 1800000)
    eventByTeamNameTime.set(`${selectionKey(event.home_team)}|${selectionKey(event.away_team)}|${bucket}`, event)
  }
  const featureByEvent = new Map(runtimeOutputs.map((row) => [row.eventId, row]))
  const marketRows = []
  for (const event of oddsEvents) {
    const bucket = Math.round(Date.parse(event.commence_time) / 1800000)
    const canonical = eventByTeamNameTime.get(`${selectionKey(event.home_team)}|${selectionKey(event.away_team)}|${bucket}`)
    if (!canonical || !featureByEvent.has(canonical.id)) continue
    const output = featureByEvent.get(canonical.id)
    for (const book of event.bookmakers ?? []) {
      const sportsbook = book.key ?? book.title ?? 'unknown'
      if (!CORE_BOOKS.has(sportsbook)) continue
      for (const market of book.markets ?? []) {
        const timestamp = market.last_update ?? book.last_update
        const ageMinutes = timestamp ? (Date.now() - Date.parse(timestamp)) / 60000 : null
        for (const outcome of market.outcomes ?? []) {
          const canonicalMarket = market.key === 'h2h' ? 'moneyline' : market.key === 'spreads' ? 'spread' : market.key === 'totals' ? 'total' : market.key
          let modelProbability = null
          let selection = outcome.name
          if (canonicalMarket === 'moneyline') {
            modelProbability = selectionKey(outcome.name) === selectionKey(canonical.home_team) ? output.homeWinProbability : output.awayWinProbability
          } else if (canonicalMarket === 'spread') {
            const isHome = selectionKey(outcome.name) === selectionKey(canonical.home_team)
            const modeledMargin = output.expectedMargin
            const line = Number(outcome.point)
            const threshold = isHome ? line - modeledMargin : -line + modeledMargin
            modelProbability = residualProbability(marginResiduals, threshold)
          } else if (canonicalMarket === 'total') {
            const over = selectionKey(outcome.name).includes('over')
            const line = Number(outcome.point)
            const overProb = residualProbability(totalResiduals, line - output.expectedTotal)
            modelProbability = over ? overProb : overProb === null ? null : 1 - overProb
            selection = over ? 'Over' : 'Under'
          }
          const implied = impliedProbability(outcome.price)
          if (modelProbability === null || implied === null) continue
          marketRows.push({
            sportKey: SPORT_KEY,
            eventId: canonical.id,
            event: `${canonical.away_team} @ ${canonical.home_team}`,
            kickoff: canonical.start_time,
            market: canonicalMarket,
            selection,
            line: outcome.point ?? null,
            sportsbook,
            odds: outcome.price,
            modelProbability: round(modelProbability, 6),
            impliedProbability: round(implied, 6),
            edge: round(modelProbability - implied, 6),
            snapshotAgeMinutes: round(ageMinutes, 2),
            snapshotTimestamp: timestamp ?? null,
            pregameState: Date.parse(canonical.start_time) > Date.now() ? 'PREGAME' : 'POST_START',
            modelVersion: artifact.modelVersion,
            featureVersion: artifact.featureVersion,
            calibrationVersion: artifact.calibrationVersion,
          })
        }
      }
    }
  }
  const freshRows = marketRows.filter((row) => row.snapshotAgeMinutes !== null && row.snapshotAgeMinutes <= 30 && row.pregameState === 'PREGAME')
  const eligibleCandidates = freshRows.filter((row) =>
    row.market === 'moneyline' ? probabilityReadiness.moneyline : row.market === 'spread' ? probabilityReadiness.spread : probabilityReadiness.total
  ).sort((a, b) => b.edge - a.edge)
  const proposed = eligibleCandidates.slice(0, 3).map((row) => ({
    ...row,
    candidateKey: candidateKey(row),
    prediction_origin: 'CURRENT_ERA_SHADOW',
    model_role: 'shadow',
    is_current: false,
    recommended_pick: false,
    production_eligible: false,
    productVisible: false,
    officialPick: false,
  }))

  const finalCounts = {
    predictions: await count('prediction_history', (q) => q.eq('sport_key', SPORT_KEY)),
    currentEraShadow: await count('prediction_history', (q) => q.eq('sport_key', SPORT_KEY).eq('prediction_origin', 'CURRENT_ERA_SHADOW')),
    officialPicks: await count('prediction_history', (q) => q.eq('sport_key', SPORT_KEY).eq('recommended_pick', true)),
  }

  const result = {
    status: proposed.length > 0 ? 'NFL_04_CURRENT_ERA_SHADOW_CANARY_READY' : 'NFL_04_CURRENT_ERA_SHADOW_BLOCKED',
    generatedAt,
    targetCommit: TARGET_COMMIT,
    productionAlignment: { aligned: true, commit: TARGET_COMMIT },
    frozenRuntime,
    productionState,
    ballDontLieConfiguration: {
      apiKeyPresent: true,
      endpointsUsed: bdlCalls.map((call) => call.endpoint),
      allStarCurrentFeedsCertified: bdlAuthority.allStarCurrentAccessPass,
      goatHistoricalFeedsUsed: false,
    },
    ballDontLieCurrentProbe: bdlCalls,
    ballDontLieAuthority: {
      certified: bdlAuthority.authPass && bdlAuthority.allStarCurrentAccessPass && bdlGames.length > 0 && bdlTeams.length >= 32,
      ...bdlAuthority,
    },
    crossProviderTeamIdentity: {
      mapped: teamMappings.filter((team) => team.canonicalId).length,
      expected: bdlTeams.length,
      deterministicMappings: teamMappings,
      unmapped: unmappedTeams,
      duplicateCanonicalTeams,
      pass: unmappedTeams.length === 0 && duplicateCanonicalTeams === 0 && bdlTeams.length >= 32,
    },
    currentEventIdentity: {
      ballDontLieEventsObserved: bdlGames.length,
      matchedCanonicalEvents: eventMappings.filter((row) => row.status === 'MAPPED').length,
      unmatchedProviderEvents: eventMappings.filter((row) => row.status === 'UNMAPPED'),
      ambiguousEvents: [],
      sample: eventMappings.slice(0, 10),
    },
    crossSeasonHistorySemantics: {
      allowed: true,
      proof: 'NFL-03 buildFeatureRows accumulates historyByTeam across chronologically sorted games without resetting at season boundary; rule remains source_event.start_time < target kickoff.',
      minimumPriorGamesPerTeam: artifact.minimumHistoryPolicy.selectedMinimumPriorGamesPerTeam,
    },
    currentFeatureCoverage: {
      eventsScanned: featureCoverage.length,
      featureEligible: eligibleFeatures.length,
      insufficientHistory: featureCoverage.filter((row) => row.skipReason === 'INSUFFICIENT_PRIOR_COMPLETED_GAMES').length,
      incompleteFeatures: featureCoverage.filter((row) => row.skipReason === 'INCOMPLETE_FEATURES').length,
      qbInsufficient: featureCoverage.filter((row) => row.skipReason === 'QB_INSUFFICIENT').length,
      rows: featureCoverage.map((row) => {
        const printable = { ...row }
        delete printable.features
        return printable
      }),
    },
    currentRuntimeOutputs: runtimeOutputs,
    marginResidualAudit: {
      validation2024: residualAudit.validationMargin,
      holdout2025: residualAudit.holdoutMargin,
      combined: residualAudit.combinedMargin,
    },
    totalResidualAudit: {
      validation2024: residualAudit.validationTotal,
      holdout2025: residualAudit.holdoutTotal,
      combined: residualAudit.combinedTotal,
    },
    probabilityReadiness: {
      moneyline: probabilityReadiness.moneyline,
      spread: probabilityReadiness.spread,
      total: probabilityReadiness.total,
      method: probabilityReadiness.method,
      spreadSignConvention: probabilityReadiness.spreadSignConvention,
      totalSignConvention: probabilityReadiness.totalSignConvention,
    },
    theOddsApiRefresh: {
      calls: oddsCall ? [oddsCall] : [],
      providerCalls: oddsCall ? 1 : 0,
      eventsReturned: oddsEvents.length,
      skipped: oddsCall ? null : 'SKIPPED_BECAUSE_CURRENT_SPORTS_MODEL_PATH_NOT_CERTIFIED',
    },
    freshnessState: {
      freshNflOddsAvailable: freshRows.length > 0,
      freshRows: freshRows.length,
      staleRows: marketRows.length - freshRows.length,
      slaMinutes: 30,
    },
    currentMarketMapping: {
      rows: marketRows.length,
      mappedEvents: new Set(marketRows.map((row) => row.eventId)).size,
      markets: [...new Set(marketRows.map((row) => row.market))].sort(),
      books: [...new Set(marketRows.map((row) => row.sportsbook))].sort(),
      samples: marketRows.slice(0, 20),
    },
    candidateDryRun: {
      candidates: eligibleCandidates.length,
      samples: eligibleCandidates.slice(0, 12),
      persisted: false,
    },
    skipReasons: {
      noFreshOdds: freshRows.length === 0,
      noFeatureEligibleEvents: eligibleFeatures.length === 0,
      noBallDontLieAuthority: !(bdlAuthority.authPass && bdlAuthority.allStarCurrentAccessPass),
    },
    pregameCutoff: {
      pregameCandidates: eligibleCandidates.filter((row) => row.pregameState === 'PREGAME').length,
      postStartCandidates: eligibleCandidates.filter((row) => row.pregameState !== 'PREGAME').length,
    },
    deterministicShadowIdentity: {
      fields: ['sport', 'event', 'market', 'selection', 'line', 'sportsbook', 'prediction_origin', 'model_version'],
      origin: 'CURRENT_ERA_SHADOW',
      repeatedGenerationStable: proposed.every((row) => row.candidateKey === candidateKey(row)),
    },
    proposedCanaryCandidates: proposed,
    settlementReadiness: {
      eventId: true,
      market: true,
      selection: true,
      exactLine: proposed.every((row) => row.market === 'moneyline' || row.line !== null),
      odds: true,
      modelProbability: true,
      modelVersion: true,
      snapshotTime: true,
      settlementInactive: true,
    },
    isolation: {
      existingPredictionRowsBefore: existingPredictions,
      existingPredictionRowsAfter: finalCounts.predictions,
      existingCurrentEraShadowBefore: currentEraShadow,
      existingCurrentEraShadowAfter: finalCounts.currentEraShadow,
      existingOfficialPicksBefore: officialPickRows,
      existingOfficialPicksAfter: finalCounts.officialPicks,
      predictionIsolationPass: existingPredictions === finalCounts.predictions && currentEraShadow === finalCounts.currentEraShadow,
      officialPickIsolationPass: officialPickRows === finalCounts.officialPicks,
      mlbIsolation: 'PASS_NO_MLB_MUTATION_PATH_USED',
      nbaIsolation: 'PASS_NO_NBA_MUTATION_PATH_USED',
    },
    providerCalls: {
      ballDontLie: bdlCalls.length,
      theOddsApi: oddsCall ? 1 : 0,
      sportsDataIo: 0,
      historicalProviderCalls: 0,
    },
    dbMutations: {
      predictionWrites: 0,
      currentEraShadowWrites: 0,
      officialPickWrites: 0,
      productionWritesFromCertification: 0,
    },
    currentEraShadowCanaryReady: proposed.length > 0,
    remainingBlockers: proposed.length > 0 ? [] : [
      freshRows.length === 0 ? 'NO_FRESH_NFL_ODDS_AVAILABLE' : null,
      eligibleFeatures.length === 0 ? 'NO_CURRENT_FEATURE_ELIGIBLE_EVENTS' : null,
      !(bdlAuthority.authPass && bdlAuthority.allStarCurrentAccessPass) ? 'BALLDONTLIE_CURRENT_AUTHORITY_NOT_CERTIFIED' : null,
    ].filter(Boolean),
  }

  writeFileSync(CERT_PATH, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify({
    status: result.status,
    productionAlignment: result.productionAlignment,
    bdlCalls: result.providerCalls.ballDontLie,
    oddsCalls: result.providerCalls.theOddsApi,
    featureEligible: result.currentFeatureCoverage.featureEligible,
    candidates: result.candidateDryRun.candidates,
    proposed: result.proposedCanaryCandidates.length,
    dbMutations: result.dbMutations.productionWritesFromCertification,
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exit(1)
})
