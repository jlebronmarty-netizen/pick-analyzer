import { createHash } from 'node:crypto'
import { calculatePredictionV4, type PredictionV4Weights } from '@/utils/prediction-engine-v4'
import type { TeamStatsInput } from '@/utils/prediction-engine-v2'
import { getRiskGrade } from '@/services/risk-grade.service'
import { calculateSmartScore } from '@/services/smart-ranking.service'
import { ncaabEvidenceTime as evidenceTime } from '@/lib/ncaab-calibration-evidence.mjs'

// A new research cohort: never relabel or rewrite nba_prediction_engine_v1 history.
export const NBA_INPUTS_SHADOW_MODEL_VERSION = 'nba_prediction_engine_v1_1_inputs_shadow'
export const NBA_INPUTS_SHADOW_FEATURE_VERSION = 'nba_prediction_inputs_shadow_features_v1'
export const NBA_INPUTS_SHADOW_MAX_QUOTE_AGE_MS = 30 * 60_000
export const NBA_INPUTS_SHADOW_MAX_STATS_AGE_MS = 6 * 60 * 60_000
const SPORT = 'basketball_nba'
const WEIGHT_KEYS = ['homeAwayAdvantage', 'headToHeadAdvantage', 'pitcherAdvantage', 'injuryImpact', 'weatherImpact'] as const
const FROZEN_INPUT_KEYS = ['modelVersion', 'featureSetVersion', 'asOf', 'event', 'homeTeamStats', 'awayTeamStats',
  'selectedQuote', 'oppositeQuote', 'selectedTeam', 'projection', 'probabilityMethod', 'moneylineInput',
  'directionalFactors', 'globalCoverage', 'coverageSnapshot', 'trainingWeights', 'trainingWeightsHash', 'neutralInputs'] as const

export type NbaInputEvent = {
  id: string; sport_key: string; league_key: string; season: string
  home_team_id?: string | null; away_team_id?: string | null
  home_team: string; away_team: string; start_time: string; status: string
  metadata?: Record<string, unknown> | null
}
export type NbaInputStats = TeamStatsInput & {
  id?: string; updated_at: string; raw_data: Record<string, unknown> | null
}
export type NbaInputQuote = {
  id: string; event_id: string; provider: string; sportsbook: string
  market: string; outcome: string; price: number | null; line: number | null
  snapshot_time: string; provider_timestamp?: string | null
  created_at?: string | null
  metadata?: Record<string, unknown> | null
}
export type NbaInputCoverage = {
  confidence: { penalty: number; dataSufficiencyPenalty: number; featureQualityPenalty: number }
  warnings: string[]
  generatedAt?: string
  injuryFeed?: { latestUpdatedAt?: string | null }
  lineupFeed?: { latestUpdatedAt?: string | null }
}
export type NbaInputsShadowPrediction = {
  id: string; gameId: string; market: 'moneyline' | 'spread' | 'total' | 'first_half'
  team: string; opponent: string; sportsbook: string; odds: number; line: number | null
  projectedLine: number; impliedProbability: number; modelProbability: number; edge: number; ev: number
  confidence: number; recommendedPick: boolean; oddsTimestamp: string; featureQualityScore: number
  dataSufficiencyScore: number; cutoffAt: string; modelVersion: string; smartScore: number
  adaptiveScore: number; kellyPercent: number; recommendedStake: number; riskGrade: string
  probabilityStatus: 'EXPLORATORY_UNVALIDATED'; featureSnapshot: Record<string, unknown>
  inputHash: string; trainingWeightsHash: string
  explanation: { summary: string; reasons: string[]; warnings: string[] }
}

function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
export function nbaEvidenceTimestamp(value: unknown) { return evidenceTime(value) ?? NaN }
const timestamp = nbaEvidenceTimestamp
function round(value: number, digits = 2) { return Number(value.toFixed(digits)) }
function clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), max) }
function excluded(meta: Record<string, unknown> | null | undefined) {
  return meta?.trial === true || meta?.scrambled === true || meta?.production_eligible === false
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
  return value
}
export function hashNbaInputs(value: unknown) { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex') }
function copied<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function marketKey(market: string) { return ({ spreads: 'spread', totals: 'total' } as Record<string, string>)[market] ?? market }
function validPrice(price: unknown): price is number { return finite(price) && Math.abs(price) >= 100 }
function quoteTime(q: NbaInputQuote) { return q.provider_timestamp ?? q.snapshot_time }
function sourceReceived(q: NbaInputQuote) { return q.metadata?.source_received_at }

function validEvent(event: NbaInputEvent, asOf: string) {
  const now = timestamp(asOf), start = timestamp(event.start_time)
  return event.sport_key === SPORT && event.league_key === 'nba' && /^bdl_nba_\d+$/.test(event.id) &&
    Boolean(event.home_team && event.away_team && event.home_team !== event.away_team) &&
    event.status === 'scheduled' && !excluded(event.metadata) && finite(now) && finite(start) && start > now
}

function validQuote(q: NbaInputQuote, event: NbaInputEvent, asOf: string) {
  const now = timestamp(asOf), providerAt = timestamp(quoteTime(q)), receivedAt = timestamp(sourceReceived(q)), storedAt = timestamp(q.snapshot_time)
  const market = marketKey(q.market), meta = q.metadata ?? {}
  const expectedContract = market === 'moneyline' ? 'WINNER' : market === 'spread' ? 'SIGNED_HANDICAP' : q.outcome === 'Over' ? 'STRICT_GREATER_THAN' : 'STRICT_LESS_THAN'
  return q.event_id === event.id && q.provider === 'balldontlie' && q.sportsbook.toLowerCase() === 'fanduel' &&
    Boolean(q.id && meta.quote_id && meta.snapshot_id) && meta.module === 'NBA_MARKET_DATA_V1' &&
    meta.phase === 'PREGAME' && meta.period === 'FULL_GAME_LABEL_OT_UNVERIFIED' && meta.contract === expectedContract &&
    !excluded(meta) && validPrice(q.price) && [providerAt, receivedAt, storedAt].every(finite) &&
    providerAt <= receivedAt && receivedAt <= now && storedAt <= now && now - providerAt <= NBA_INPUTS_SHADOW_MAX_QUOTE_AGE_MS &&
    (q.created_at === undefined || (finite(timestamp(q.created_at)) && timestamp(q.created_at) <= now)) &&
    (market === 'moneyline' ? q.line === null : finite(q.line) && (market !== 'total' || q.line > 0)) &&
    (market === 'total' ? ['Over', 'Under'].includes(q.outcome) : [event.home_team, event.away_team].includes(q.outcome))
}

/** Keep the last archived menu even when malformed: an older price must not reappear. */
export function nbaLatestPairedQuotes(event: NbaInputEvent, quotes: NbaInputQuote[], asOf: string) {
  const latest = new Map<string, NbaInputQuote[]>()
  const ambiguous = new Set<string>()
  for (const quote of quotes) {
    if (quote.event_id !== event.id) continue
    // The archive is a whole game menu. A market removed from the newest menu
    // must not survive merely because another market received the newer quote.
    const key = [quote.provider, quote.sportsbook].join('|')
    const group = latest.get(key), received = timestamp(sourceReceived(quote)), previous = group?.[0]
    if (!finite(received)) { ambiguous.add(key); continue }
    const previousReceived = previous ? timestamp(sourceReceived(previous)) : -Infinity
    if (!previous || received > previousReceived) latest.set(key, [quote])
    else if (received === previousReceived) group!.push(quote)
  }
  const pairs: { selected: NbaInputQuote; opposite: NbaInputQuote }[] = []
  for (const [key, group] of latest) {
    if (ambiguous.has(key) || new Set(group.map(q => q.metadata?.snapshot_id)).size !== 1) continue
    for (const selected of group) {
    if (!['moneyline', 'spread', 'total'].includes(marketKey(selected.market))) continue
    if (!validQuote(selected, event, asOf)) continue
    const market = marketKey(selected.market)
    if (group.filter(q => marketKey(q.market) === market && q.outcome === selected.outcome && q.line === selected.line).length !== 1) continue
    const matches = group.filter(opposite => opposite.id !== selected.id && validQuote(opposite, event, asOf) &&
      opposite.provider === selected.provider && opposite.sportsbook === selected.sportsbook && marketKey(opposite.market) === market &&
      opposite.metadata?.snapshot_id === selected.metadata?.snapshot_id && quoteTime(opposite) === quoteTime(selected) &&
      opposite.metadata?.period === selected.metadata?.period && opposite.outcome !== selected.outcome &&
      (market === 'moneyline' || (market === 'total' ? opposite.line === selected.line : opposite.line === -selected.line!)))
    if (matches.length === 1) pairs.push({ selected, opposite: matches[0]! })
    }
  }
  return pairs
}

function teamFeatures(event: NbaInputEvent, team: string, rows: NbaInputStats[], asOf: string) {
  const matches = rows.filter(row => row.team_name === team)
  if (matches.length !== 1) return null
  const row = matches[0]!, raw = row.raw_data ?? {}, now = timestamp(asOf)
  const updated = timestamp(row.updated_at), received = timestamp(raw.source_received_at)
  const wins = row.wins, losses = row.losses, points = raw.points_per_game, allowed = raw.opponent_points_per_game
  if (row.sport_key !== SPORT || String(row.season) !== event.season.slice(0, 4) || excluded(raw) ||
    raw.source !== 'balldontlie_team_season_averages' || ![updated, received].every(finite) ||
    updated > now || received > now || now - received > NBA_INPUTS_SHADOW_MAX_STATS_AGE_MS ||
    !finite(wins) || !finite(losses) || !Number.isSafeInteger(wins) || !Number.isSafeInteger(losses) || wins < 0 || losses < 0 || wins + losses <= 0 ||
    !finite(points) || points <= 0 || !finite(allowed) || allowed <= 0) return null
  if ([row.last_10_wins, row.last_10_losses].some(v => v != null && (!finite(v) || !Number.isSafeInteger(v) || v < 0 || v > 10)) ||
    (finite(row.last_10_wins) && finite(row.last_10_losses) && row.last_10_wins + row.last_10_losses > 10)) return null
  const explicit = row.win_percentage
  const winPct = finite(explicit) ? (explicit > 1 ? explicit / 100 : explicit) : wins / (wins + losses)
  if (winPct < 0 || winPct > 1) return null
  const recentAvailable = finite(row.last_10_wins) && finite(row.last_10_losses) && row.last_10_wins >= 0 && row.last_10_losses >= 0 && row.last_10_wins + row.last_10_losses > 0
  const recent = recentAvailable ? row.last_10_wins! / (row.last_10_wins! + row.last_10_losses!) : 0.5
  const net = finite(raw.net_rating) ? raw.net_rating : points - allowed
  const stats: TeamStatsInput = {
    team_name: team, sport_key: SPORT, season: Number(row.season), wins, losses,
    win_percentage: winPct, last_10_wins: recentAvailable ? row.last_10_wins : null,
    last_10_losses: recentAvailable ? row.last_10_losses : null,
    streak: finite(row.streak) ? row.streak : null,
  }
  return { stats, sourceRow: copied(row), points, allowed, winPct, recent, net, recentAvailable,
    rating: winPct * 60 + recent * 25 + net * 1.5 + 10 }
}

function probabilityFromDiff(diff: number, scale: number) { return clamp(50 + Math.tanh(diff / scale) * 35, 5, 95) }

export function buildNbaInputsShadowPredictions({ event, stats, odds, coverage, learnedWeights, asOf }: {
  event: NbaInputEvent; stats: NbaInputStats[]; odds: NbaInputQuote[]; coverage: NbaInputCoverage
  learnedWeights: PredictionV4Weights; asOf: string
}): { predictions: NbaInputsShadowPrediction[]; issues: string[]; featureQualityScore: number; dataSufficiencyScore: number } {
  const blocked = (issue: string) => ({ predictions: [], issues: [issue], featureQualityScore: 0, dataSufficiencyScore: 0 })
  if (!validEvent(event, asOf)) return blocked('EVENT_IDENTITY_OR_PRESTART_INVALID')
  const home = teamFeatures(event, event.home_team, stats, asOf), away = teamFeatures(event, event.away_team, stats, asOf)
  if (!home || !away) return blocked('TEAM_STATS_MISSING_INVALID_STALE_OR_AFTER_CUTOFF')
  if (WEIGHT_KEYS.some(key => !finite(learnedWeights[key]))) return blocked('MODEL_WEIGHTS_INCOMPLETE')
  if (!coverage?.confidence || [coverage.confidence.penalty, coverage.confidence.featureQualityPenalty, coverage.confidence.dataSufficiencyPenalty]
    .some(v => !finite(v) || v < 0)) return blocked('COVERAGE_PENALTY_INVALID')
  if ([coverage.generatedAt, coverage.injuryFeed?.latestUpdatedAt, coverage.lineupFeed?.latestUpdatedAt]
    .some(value => value != null && (!finite(timestamp(value)) || timestamp(value) > timestamp(asOf)))) return blocked('COVERAGE_AFTER_CUTOFF')
  const weights = copied(learnedWeights), trainingWeightsHash = hashNbaInputs(weights)
  const confidencePenalty = coverage.confidence.penalty
  const dataSufficiencyScore = round(clamp(100 - coverage.confidence.dataSufficiencyPenalty, 0, 100))
  const featureQualityScore = round(clamp(dataSufficiencyScore * .65 + Math.min(home.stats.wins! + home.stats.losses!, 25) * .7 + Math.min(away.stats.wins! + away.stats.losses!, 25) * .7 - coverage.confidence.featureQualityPenalty, 0, 100))
  const homePoints = clamp((home.points + away.allowed) / 2 + (home.recent - .5) * 4 + 1.6, 88, 142)
  const awayPoints = clamp((away.points + home.allowed) / 2 + (away.recent - .5) * 4, 88, 142)
  const projection = { home: round(homePoints, 1), away: round(awayPoints, 1), total: round(homePoints + awayPoints, 1), margin: round(homePoints - awayPoints, 1) }
  const selectedTeam = projection.margin >= 0 ? event.home_team : event.away_team
  const team = selectedTeam === event.home_team ? home : away, opponent = selectedTeam === event.home_team ? away : home
  const warnings = [...coverage.warnings, 'EXPLORATORY_UNVALIDATED: probabilities and EV are research estimates, not calibrated betting recommendations.', 'GLOBAL_COVERAGE_CONFIDENCE_ONLY: no team-specific injury advantage is inferred.', 'FULL_GAME_OVERTIME_CONTRACT_NOT_USER_CERTIFIED']
  if (!home.recentAvailable || !away.recentAvailable) warnings.push('L10_UNAVAILABLE: neutral recent-form input, not an observed L10 record.')
  if (home.stats.streak === null || away.stats.streak === null) warnings.push('STREAK_UNAVAILABLE: neutral streak input.')
  const pairs = nbaLatestPairedQuotes(event, odds, asOf)
  const chosen = pairs.filter(({ selected }) => {
    const market = marketKey(selected.market)
    return market === 'total' ? selected.outcome === (projection.total >= selected.line! ? 'Over' : 'Under') : selected.outcome === selectedTeam
  })
  const predictions = chosen.map(({ selected, opposite }) => {
    const market = marketKey(selected.market) as 'moneyline' | 'spread' | 'total'
    const factors = { homeAwayAdvantage: selectedTeam === event.home_team ? 2 : -1, headToHeadAdvantage: 0, injuryImpact: 0, weatherImpact: 0, pitcherAdvantage: 0 }
    // Projected margin is already in ratings/projection, not observed head-to-head evidence.
    const moneylineInput = { teamName: selectedTeam, opponentName: selectedTeam === event.home_team ? event.away_team : event.home_team,
      americanOdds: selected.price!, opponentAmericanOdds: opposite.price!, teamRating: team.rating, opponentRating: opponent.rating,
      teamStats: team.stats, opponentStats: opponent.stats, isHomeTeam: selectedTeam === event.home_team }
    const signedMargin = selectedTeam === event.home_team ? projection.margin : -projection.margin
    const modelProbability = round(market === 'moneyline' ? calculatePredictionV4(moneylineInput, factors, weights).modelProbability :
      market === 'spread' ? probabilityFromDiff(signedMargin + selected.line!, 5) :
      probabilityFromDiff((projection.total - selected.line!) * (selected.outcome === 'Over' ? 1 : -1), 8))
    const oddsValue = selected.price!, impliedProbability = round(oddsValue < 0 ? -oddsValue / (100 - oddsValue) * 100 : 10000 / (100 + oddsValue))
    const edge = round(modelProbability - impliedProbability), decimal = oddsValue < 0 ? 1 + 100 / -oddsValue : 1 + oddsValue / 100
    const ev = round((modelProbability / 100 * decimal - 1) * 100)
    const confidence = round(clamp(modelProbability * .58 + featureQualityScore * .32 + Math.max(edge, 0) * .55 - confidencePenalty, 1, 99))
    const risk = getRiskGrade(confidence, ev, edge)
    const smartScore = calculateSmartScore({ confidence, ev, edge, risk_stars: risk.stars, kelly_percent: 0 })
    const inputs = copied({ modelVersion: NBA_INPUTS_SHADOW_MODEL_VERSION, featureSetVersion: NBA_INPUTS_SHADOW_FEATURE_VERSION,
      asOf, event, homeTeamStats: home.sourceRow, awayTeamStats: away.sourceRow, selectedQuote: selected, oppositeQuote: opposite,
      selectedTeam, projection, probabilityMethod: market === 'moneyline' ? 'SHARED_V4_CORRECTED_INPUTS' : 'UNVALIDATED_TANH_MARGIN',
      moneylineInput: market === 'moneyline' ? moneylineInput : null, directionalFactors: factors,
      globalCoverage: { ...coverage.confidence, directionalInjuryImpact: 0, use: 'CONFIDENCE_AND_QUALITY_ONLY' },
      coverageSnapshot: coverage,
      trainingWeights: weights, trainingWeightsHash, neutralInputs: { homeRecent: !home.recentAvailable, awayRecent: !away.recentAvailable, homeStreak: home.stats.streak === null, awayStreak: away.stats.streak === null } })
    const inputHash = hashNbaInputs(inputs)
    const featureSnapshot = { ...inputs, inputHash, probabilityStatus: 'EXPLORATORY_UNVALIDATED', officialPickEligible: false,
      productionLearningEligible: false, productionCalibrationEligible: false, featureQualityScore, dataSufficiencyScore }
    return {
      id: [event.id, market, selected.outcome, selected.line ?? 'null', selected.id, NBA_INPUTS_SHADOW_MODEL_VERSION].join(':'),
      gameId: event.id, market, team: selected.outcome, opponent: market === 'total' ? `${event.away_team} @ ${event.home_team}` : moneylineInput.opponentName,
      sportsbook: selected.sportsbook, odds: oddsValue, line: selected.line,
      projectedLine: market === 'total' ? projection.total : projection.margin,
      impliedProbability, modelProbability, edge, ev, confidence, recommendedPick: false,
      oddsTimestamp: quoteTime(selected), featureQualityScore, dataSufficiencyScore, cutoffAt: asOf,
      modelVersion: NBA_INPUTS_SHADOW_MODEL_VERSION, smartScore, adaptiveScore: smartScore,
      kellyPercent: 0, recommendedStake: 0, riskGrade: risk.grade,
      probabilityStatus: 'EXPLORATORY_UNVALIDATED' as const, featureSnapshot, inputHash, trainingWeightsHash,
      explanation: { summary: `SHADOW research ${market}: ${selected.outcome} at ${oddsValue}; not a betting recommendation.`,
        reasons: [`Projection: ${event.home_team} ${projection.home}, ${event.away_team} ${projection.away}.`,
          `Both prices are archived in ${String(selected.metadata?.snapshot_id)} at ${quoteTime(selected)}.`,
          `Global coverage penalty ${confidencePenalty} affects confidence only; directional injury impact is zero.`,
          'The current cohort has no validated probability or proven EV advantage.'], warnings: [...warnings] }
    }
  })
  const issues = ['FIRST_HALF_UNAVAILABLE: this model has no period-specific archived inputs; no synthetic H1 line or price is emitted.']
  for (const market of ['moneyline', 'spread', 'total']) if (!predictions.some(p => p.market === market)) issues.push(`${market.toUpperCase()}_PAIRED_CURRENT_PRICE_UNAVAILABLE`)
  return { predictions, issues, featureQualityScore, dataSufficiencyScore }
}

/** Recompute from frozen evidence before allowing the dedicated research writer. */
export function assertNbaInputsShadowPrediction(prediction: NbaInputsShadowPrediction, event: {
  id: string; home_team: string | null; away_team: string | null; start_time: string
}, quote: NbaInputQuote, writtenAt: string) {
  const snapshot = prediction.featureSnapshot
  if (prediction.modelVersion !== NBA_INPUTS_SHADOW_MODEL_VERSION || prediction.probabilityStatus !== 'EXPLORATORY_UNVALIDATED' ||
    prediction.recommendedPick !== false || prediction.kellyPercent !== 0 || prediction.recommendedStake !== 0 || !snapshot) {
    throw new Error('NBA_INPUTS_SHADOW_UNSAFE_OUTPUT')
  }
  if (hashNbaInputs(Object.fromEntries(FROZEN_INPUT_KEYS.map(key => [key, snapshot[key]]))) !== prediction.inputHash) {
    throw new Error('NBA_INPUTS_SHADOW_REPLAY_MISMATCH')
  }
  const sourceEvent = snapshot.event as NbaInputEvent
  const selected = snapshot.selectedQuote as NbaInputQuote, opposite = snapshot.oppositeQuote as NbaInputQuote
  const asOf = snapshot.asOf as string
  const now = timestamp(writtenAt), start = timestamp(event.start_time), cutoff = timestamp(asOf)
  if (!sourceEvent || sourceEvent.id !== event.id || sourceEvent.home_team !== event.home_team || sourceEvent.away_team !== event.away_team ||
    sourceEvent.start_time !== event.start_time || ![now, start, cutoff].every(finite) || cutoff > now || now >= start - 10 * 60_000 ||
    !selected || !opposite || !snapshot.coverageSnapshot || selected.id !== quote.id || selected.price !== quote.price || selected.line !== quote.line ||
    selected.outcome !== quote.outcome || selected.market !== quote.market || selected.provider !== quote.provider || selected.sportsbook !== quote.sportsbook ||
    selected.event_id !== quote.event_id || quoteTime(selected) !== quoteTime(quote) ||
    selected.metadata?.snapshot_id !== quote.metadata?.snapshot_id || selected.metadata?.period !== quote.metadata?.period ||
    selected.metadata?.contract !== quote.metadata?.contract || !validQuote(quote, sourceEvent, writtenAt) ||
    !validQuote(selected, sourceEvent, writtenAt) || !validQuote(opposite, sourceEvent, writtenAt)) {
    throw new Error('NBA_INPUTS_SHADOW_EVIDENCE_MISMATCH')
  }
  const replay = buildNbaInputsShadowPredictions({ event: sourceEvent,
    stats: [snapshot.homeTeamStats, snapshot.awayTeamStats] as NbaInputStats[], odds: [selected, opposite],
    coverage: snapshot.coverageSnapshot as NbaInputCoverage,
    learnedWeights: snapshot.trainingWeights as PredictionV4Weights, asOf,
  }).predictions.find(item => item.id === prediction.id)
  if (!replay || replay.inputHash !== prediction.inputHash || snapshot.inputHash !== prediction.inputHash ||
    replay.trainingWeightsHash !== prediction.trainingWeightsHash || snapshot.trainingWeightsHash !== prediction.trainingWeightsHash ||
    (['team', 'opponent', 'market', 'gameId', 'odds', 'line', 'modelProbability', 'impliedProbability', 'edge', 'ev', 'confidence', 'projectedLine', 'cutoffAt', 'oddsTimestamp', 'featureQualityScore', 'dataSufficiencyScore'] as const)
      .some(key => prediction[key] !== replay[key])) throw new Error('NBA_INPUTS_SHADOW_REPLAY_MISMATCH')
}
