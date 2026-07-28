import fs from 'node:fs'
import path from 'node:path'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  RECOMMENDATION_THRESHOLDS_V1,
  evaluateRecommendationEligibility,
} from '@/services/recommendation-eligibility-policy.service'
import { evaluateProductionDataGate } from '@/services/production-data-gate.service'
import { getRiskGrade } from '@/services/risk-grade.service'

const OUT = path.join(process.cwd(), 'docs', 'official-picks-eligibility-audit-v1.json')
const SPORT = 'baseball_mlb'
const NOW = new Date()
const TODAY = NOW.toISOString().slice(0, 10)
const DAY_MS = 24 * 60 * 60 * 1000

const SELECT = [
  'id',
  'sport_key',
  'game_id',
  'commence_time',
  'home_team',
  'away_team',
  'team',
  'opponent',
  'market',
  'sportsbook',
  'odds',
  'implied_probability',
  'model_probability',
  'edge',
  'ev',
  'confidence',
  'recommended_pick',
  'production_eligible',
  'trial',
  'scrambled',
  'status',
  'result',
  'created_at',
  'selection',
  'line',
  'odds_timestamp',
  'generated_at',
  'cutoff_at',
  'model_version',
  'feature_snapshot',
  'feature_snapshot_id',
  'feature_set_version',
  'feature_snapshot_generated_at',
  'validation_warnings',
  'is_current',
  'model_role',
  'prediction_group_key',
].join(', ')

function n(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function d(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function round(value, places = 4) {
  const num = n(value)
  if (num === null) return null
  const factor = 10 ** places
  return Math.round(num * factor) / factor
}

function bool(value) {
  return value === true
}

function americanToDecimal(odds) {
  const price = n(odds)
  if (price === null || price === 0) return null
  return price > 0 ? round(1 + price / 100, 6) : round(1 + 100 / Math.abs(price), 6)
}

function americanImplied(odds) {
  const price = n(odds)
  if (price === null || price === 0) return null
  return price > 0
    ? round((100 / (price + 100)) * 100, 6)
    : round((Math.abs(price) / (Math.abs(price) + 100)) * 100, 6)
}

function expectedValuePercent(modelProbability, odds) {
  const p = n(modelProbability)
  const decimal = americanToDecimal(odds)
  if (p === null || decimal === null) return null
  const probability = p / 100
  return round((probability * (decimal - 1) - (1 - probability)) * 100, 4)
}

function feature(row, keys, fallback = null) {
  const snap = row.feature_snapshot && typeof row.feature_snapshot === 'object' ? row.feature_snapshot : {}
  for (const key of keys) {
    const value = n(snap[key])
    if (value !== null) return value
  }
  return fallback
}

function isoDay(value) {
  const date = d(value)
  return date ? date.toISOString().slice(0, 10) : null
}

function normalizedMarket(value) {
  const market = String(value ?? '').toLowerCase()
  return market === 'run_line' ? 'run_line' : market
}

function eventLabel(row) {
  return `${row.away_team ?? 'Away'} @ ${row.home_team ?? 'Home'}`
}

function sameLine(a, b) {
  const left = a.line === null || a.line === undefined ? 'null' : String(a.line)
  const right = b.line === null || b.line === undefined ? 'null' : String(b.line)
  return left === right
}

function oppositeSelection(a, b) {
  const market = normalizedMarket(a.market)
  const as = String(a.selection ?? a.team ?? '').toLowerCase()
  const bs = String(b.selection ?? b.team ?? '').toLowerCase()
  if (market === 'total') return (as.includes('over') && bs.includes('under')) || (as.includes('under') && bs.includes('over'))
  return as && bs && as !== bs
}

function noVigProbability(row, allRows) {
  const raw = americanImplied(row.odds)
  if (raw === null) return null
  const peers = allRows.filter((peer) =>
    peer.id !== row.id &&
    String(peer.game_id) === String(row.game_id) &&
    normalizedMarket(peer.market) === normalizedMarket(row.market) &&
    String(peer.sportsbook ?? '') === String(row.sportsbook ?? '') &&
    sameLine(peer, row) &&
    oppositeSelection(peer, row)
  )
  if (!peers.length) return null
  const bestPeer = peers
    .map((peer) => ({ peer, implied: americanImplied(peer.odds) }))
    .filter((item) => item.implied !== null)
    .sort((a, b) => Math.abs((a.implied ?? 0) - raw))[0]
  if (!bestPeer) return null
  const overround = raw + bestPeer.implied
  return overround > 0 ? round((raw / overround) * 100, 6) : null
}

function gate(name, passed, actual, required, direction = 'at_least') {
  let distance = null
  const a = n(actual)
  const r = n(required)
  if (a !== null && r !== null) {
    distance = direction === 'at_most' ? round(Math.max(0, a - r), 4) : round(Math.max(0, r - a), 4)
  }
  return { name, passed: Boolean(passed), actual, required, distance }
}

function evaluateGates(row, allRows, now = NOW, options = {}) {
  const thresholds = { ...RECOMMENDATION_THRESHOLDS_V1, ...(options.thresholds ?? {}) }
  const market = normalizedMarket(row.market)
  const generated = d(row.generated_at)
  const cutoff = d(row.cutoff_at)
  const commence = d(row.commence_time)
  const oddsAt = d(row.odds_timestamp)
  const quality = feature(row, ['featureQualityScore', 'featureQuality', 'quality', 'dataQualityScore', 'dataQuality'], n(row.data_quality_score) ?? 0)
  const sufficiency = feature(row, ['dataSufficiencyScore', 'dataSufficiency', 'sufficiency'], n(row.data_sufficiency_score) ?? 0)
  const rawImplied = americanImplied(row.odds)
  const storedImplied = n(row.implied_probability)
  const noVig = noVigProbability(row, allRows)
  const modelProbability = n(row.model_probability) ?? 0
  const edge = n(row.edge) ?? (rawImplied === null ? null : round(modelProbability - rawImplied, 4))
  const ev = n(row.ev) ?? expectedValuePercent(modelProbability, row.odds)
  const confidence = n(row.confidence) ?? 0
  const warnings = Array.isArray(row.validation_warnings) ? row.validation_warnings : []
  const status = String(row.status ?? row.result ?? 'pending').toLowerCase()
  const maxAgeMs = thresholds.maximumOddsAgeMinutes * 60 * 1000
  const productionGate = evaluateProductionDataGate(row, 'recommendations')
  const policy = evaluateRecommendationEligibility(
    {
      ...row,
      data_quality_score: quality,
      data_sufficiency_score: sufficiency,
      calibrationStatus: options.calibrationStatus ?? 'probationary',
    },
    { now, allowProbationaryPreview: options.allowProbationaryPreview === true }
  )
  const risk = getRiskGrade(confidence, ev ?? 0, edge ?? 0)
  const duplicateKey = `${row.game_id}:${market}:${row.selection ?? row.team ?? ''}:${row.line ?? ''}`

  const gates = [
    gate('production_data_gate', productionGate.eligible, productionGate.blockedReasons.join('|') || 'eligible', 'eligible'),
    gate('pregame_cutoff_validity', Boolean(generated && cutoff && commence && generated <= cutoff && generated < commence), row.generated_at, 'generated_at <= cutoff_at and < commence_time'),
    gate('market_and_selection_mapping', thresholds.supportedMarkets.includes(market) && Boolean(row.selection ?? row.team), `${market}:${row.selection ?? row.team ?? ''}`, `supported ${thresholds.supportedMarkets.join(',')}`),
    gate('odds_availability', n(row.odds) !== null && n(row.odds) !== 0, row.odds, 'non-zero American odds'),
    gate('odds_timestamp_before_cutoff', Boolean(oddsAt && cutoff && oddsAt <= cutoff), row.odds_timestamp, 'odds_timestamp <= cutoff_at'),
    gate('odds_freshness', Boolean(oddsAt && now.getTime() - oddsAt.getTime() <= maxAgeMs), oddsAt ? round((now.getTime() - oddsAt.getTime()) / 60000, 2) : null, thresholds.maximumOddsAgeMinutes, 'at_most'),
    gate('bookmaker_source_validity', typeof row.sportsbook === 'string' && row.sportsbook.trim().length > 0, row.sportsbook, 'non-empty sportsbook'),
    gate('data_sufficiency', sufficiency >= thresholds.minimumDataSufficiency, sufficiency, thresholds.minimumDataSufficiency),
    gate('feature_quality', quality >= thresholds.minimumFeatureQuality, quality, thresholds.minimumFeatureQuality),
    gate('model_probability', modelProbability >= thresholds.minimumModelProbability, modelProbability, thresholds.minimumModelProbability),
    gate('raw_implied_probability_valid', rawImplied !== null && rawImplied > 0 && rawImplied < 100, rawImplied, '0 < implied < 100'),
    gate('stored_implied_matches_american_odds', rawImplied !== null && storedImplied !== null && Math.abs(rawImplied - storedImplied) <= 0.05, { stored: storedImplied, calculated: rawImplied }, 'within 0.05 percentage points'),
    gate('no_vig_probability_available', noVig !== null, noVig, 'opposite side available'),
    gate('probability_edge_positive', (edge ?? 0) > 0, edge, '> 0'),
    gate('probability_edge_threshold', (edge ?? 0) >= thresholds.minimumOfficialEdge, edge, thresholds.minimumOfficialEdge),
    gate('expected_value_positive', (ev ?? 0) > 0, ev, '> 0'),
    gate('expected_value_threshold', (ev ?? 0) >= thresholds.minimumOfficialEv, ev, thresholds.minimumOfficialEv),
    gate('confidence', confidence >= thresholds.minimumOfficialConfidence, confidence, thresholds.minimumOfficialConfidence),
    gate('trust_readiness_calibration', options.calibrationStatus === 'acceptable' || options.calibrationStatus === 'mature', options.calibrationStatus ?? 'probationary', 'acceptable or mature'),
    gate('risk_grade', !['F', 'D'].includes(String(risk.grade ?? '')), risk.grade, 'not D/F'),
    gate('validation_warnings', !warnings.some((warning) => /leak|critical|postgame/i.test(String(warning))), warnings.join('|') || 'none', 'no critical warnings'),
    gate('permitted_odds_range', n(row.odds) !== null && n(row.odds) < 500 && n(row.odds) > -1000, row.odds, '-1000 < odds < 500'),
    gate('policy_exclusions', !bool(row.trial) && !bool(row.scrambled) && bool(row.production_eligible), { trial: row.trial, scrambled: row.scrambled, production_eligible: row.production_eligible }, 'production, non-trial, non-scrambled'),
    gate('duplicate_conflict_rules', true, duplicateKey, 'dedupe applied downstream'),
    gate('event_daily_pick_limit', true, thresholds.maximumRecommendationsPerEvent, `<= ${thresholds.maximumRecommendationsPerEvent} per event`),
    gate('daily_slate_pick_limit', true, thresholds.maximumPicksPerDailySlate, `<= ${thresholds.maximumPicksPerDailySlate} per slate`),
    gate('sport_specific_official_pick_gate', SPORT === row.sport_key, row.sport_key, SPORT),
    gate('event_future_for_current_policy', Boolean(commence && commence > now), row.commence_time, 'future event for live Official Pick surface'),
    gate('event_not_settled', !['win', 'loss', 'push', 'void', 'settled'].includes(status), status, 'pending/unsettled'),
  ]
  const failed = gates.filter((item) => !item.passed)
  const policyFailed = policy.blockers
  const primary = failed[0]?.name ?? policyFailed[0] ?? null
  const qualificationDistance = failed.reduce((sum, item) => sum + (n(item.distance) ?? (item.passed ? 0 : 1)), 0)

  return {
    row,
    operatingDate: isoDay(row.commence_time),
    event: eventLabel(row),
    market,
    selection: row.selection ?? row.team ?? null,
    line: row.line ?? null,
    odds: row.odds,
    sportsbook: row.sportsbook,
    modelProbability,
    rawImpliedProbability: rawImplied,
    storedImpliedProbability: storedImplied,
    noVigProbability: noVig,
    edge,
    ev,
    confidence,
    quality,
    sufficiency,
    riskGrade: risk.grade,
    riskLabel: risk.label,
    gates,
    failedGates: failed,
    primaryRejectionReason: primary,
    policy,
    officialPick: row.recommended_pick === true,
    passesAllGates: failed.length === 0 && policy.officialPickEligible,
    qualificationDistance: round(qualificationDistance, 4),
    formulas: {
      americanOdds: row.odds,
      decimalOdds: americanToDecimal(row.odds),
      calculatedImpliedProbability: rawImplied,
      storedImpliedProbability: storedImplied,
      calculatedEv: expectedValuePercent(modelProbability, row.odds),
      storedEv: n(row.ev),
      calculatedRawEdge: rawImplied === null ? null : round(modelProbability - rawImplied, 4),
      storedEdge: n(row.edge),
      noVigProbability: noVig,
      noVigEdge: noVig === null ? null : round(modelProbability - noVig, 4),
    },
  }
}

function bucket(value, cuts) {
  const num = n(value)
  if (num === null) return 'unknown'
  for (const cut of cuts) {
    if (num < cut) return `<${cut}`
  }
  return `>=${cuts.at(-1)}`
}

function settledOutcome(row) {
  const result = String(row.result ?? row.status ?? '').toLowerCase()
  if (result === 'win') return 1
  if (result === 'loss') return 0
  if (result === 'push') return 0.5
  return null
}

function roi(row) {
  const outcome = settledOutcome(row)
  const odds = n(row.odds)
  if (outcome === null || odds === null || outcome === 0.5) return null
  if (outcome === 0) return -1
  return odds > 0 ? odds / 100 : 100 / Math.abs(odds)
}

function summarizeHistorical(items, groupBy) {
  const groups = new Map()
  for (const item of items) {
    const outcome = settledOutcome(item.row)
    if (outcome === null) continue
    const key = groupBy(item)
    const rows = groups.get(key) ?? []
    rows.push(item)
    groups.set(key, rows)
  }
  return Array.from(groups.entries()).map(([bucketName, rows]) => {
    const outcomes = rows.map((item) => settledOutcome(item.row)).filter((value) => value !== null)
    const wins = outcomes.filter((value) => value === 1).length
    const losses = outcomes.filter((value) => value === 0).length
    const brierValues = rows
      .map((item) => {
        const outcome = settledOutcome(item.row)
        const p = n(item.modelProbability)
        return outcome === null || p === null ? null : (p / 100 - outcome) ** 2
      })
      .filter((value) => value !== null)
    const roiValues = rows.map((item) => roi(item.row)).filter((value) => value !== null)
    return {
      bucket: bucketName,
      sampleSize: rows.length,
      wins,
      losses,
      pushes: outcomes.filter((value) => value === 0.5).length,
      winRate: wins + losses > 0 ? round((wins / (wins + losses)) * 100, 2) : null,
      brierScore: brierValues.length ? round(brierValues.reduce((a, b) => a + b, 0) / brierValues.length, 4) : null,
      roi: roiValues.length ? round((roiValues.reduce((a, b) => a + b, 0) / roiValues.length) * 100, 2) : null,
    }
  }).sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)))
}

function countPass(items, gateName) {
  return items.filter((item) => item.gates.find((gate) => gate.name === gateName)?.passed).length
}

function counterfactual(items, overrides) {
  const evaluated = items.map((item) => evaluateGates(item.row, items.map((x) => x.row), NOW, overrides))
  return evaluated.filter((item) => item.policy.officialPickEligible).length
}

function gateCounterfactual(items, ignoredGate) {
  return items.filter((item) =>
    item.gates.every((candidate) => candidate.name === ignoredGate || candidate.passed) &&
    item.policy.blockers.every((blocker) => {
      if (ignoredGate === 'production_data_gate') return !['QUARANTINED_ROW', 'TRIAL_ROW', 'SCRAMBLED_ROW'].includes(blocker)
      if (ignoredGate === 'trust_readiness_calibration') return blocker !== 'CALIBRATION_INSUFFICIENT'
      if (ignoredGate === 'feature_quality') return blocker !== 'LOW_DATA_QUALITY'
      if (ignoredGate === 'data_sufficiency') return blocker !== 'LOW_DATA_SUFFICIENCY'
      if (ignoredGate === 'confidence') return blocker !== 'LOW_CONFIDENCE'
      if (ignoredGate === 'probability_edge_threshold') return blocker !== 'LOW_EDGE'
      if (ignoredGate === 'expected_value_threshold') return blocker !== 'LOW_EV'
      if (ignoredGate === 'model_probability') return blocker !== 'LOW_MODEL_PROBABILITY'
      if (ignoredGate === 'odds_freshness') return blocker !== 'STALE_ODDS'
      if (ignoredGate === 'odds_availability') return blocker !== 'NO_ODDS'
      if (ignoredGate === 'market_and_selection_mapping') return blocker !== 'UNSUPPORTED_MARKET'
      if (ignoredGate === 'pregame_cutoff_validity') return !['EVENT_STARTED_OR_LOCKED', 'ODDS_AFTER_CUTOFF'].includes(blocker)
      return true
    })
  ).length
}

async function readAllMlbRows() {
  const rows = []
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('prediction_history')
      .select(SELECT)
      .eq('sport_key', SPORT)
      .order('commence_time', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

const rows = await readAllMlbRows()
const evaluated = rows.map((row) => evaluateGates(row, rows))
const currentDay = evaluated.filter((item) => item.operatingDate === TODAY)
const last7Start = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() - 6)).toISOString().slice(0, 10)
const last7 = evaluated.filter((item) => item.operatingDate && item.operatingDate >= last7Start && item.operatingDate <= TODAY)
const validPregame = evaluated.filter((item) => item.gates.find((gate) => gate.name === 'pregame_cutoff_validity')?.passed)
const official = evaluated.filter((item) => item.officialPick)
const allGatePass = evaluated.filter((item) => item.passesAllGates)
const rejected = evaluated.filter((item) => !item.policy.officialPickEligible)
const nearMisses = [...rejected]
  .sort((a, b) => a.qualificationDistance - b.qualificationDistance)
  .slice(0, 20)
  .map((item) => ({
    id: item.row.id,
    operatingDate: item.operatingDate,
    event: item.event,
    market: item.market,
    selection: item.selection,
    odds: item.odds,
    modelProbability: item.modelProbability,
    rawImpliedProbability: item.rawImpliedProbability,
    noVigProbability: item.noVigProbability,
    edge: item.edge,
    ev: item.ev,
    confidence: item.confidence,
    qualityScore: item.quality,
    dataSufficiency: item.sufficiency,
    riskGrade: item.riskGrade,
    exactFailedGate: item.primaryRejectionReason,
    failedGates: item.failedGates.map((gate) => ({
      gate: gate.name,
      actual: gate.actual,
      required: gate.required,
      distance: gate.distance,
    })),
    distanceFromThreshold: item.qualificationDistance,
  }))

const gateNames = evaluated[0]?.gates.map((gate) => gate.name) ?? []
const funnel = {
  totalPredictions: rows.length,
  productionEligibleRows: evaluated.filter((item) => item.row.production_eligible === true && item.row.trial !== true && item.row.scrambled !== true).length,
  validPregame: validPregame.length,
  gatePassCounts: Object.fromEntries(gateNames.map((name) => [name, countPass(evaluated, name)])),
  passesAllGates: allGatePass.length,
  officialPicks: official.length,
  currentOperatingDay: {
    date: TODAY,
    total: currentDay.length,
    validPregame: currentDay.filter((item) => item.gates.find((gate) => gate.name === 'pregame_cutoff_validity')?.passed).length,
    officialPicks: currentDay.filter((item) => item.officialPick).length,
  },
  last7OperatingDays: {
    start: last7Start,
    end: TODAY,
    total: last7.length,
    validPregame: last7.filter((item) => item.gates.find((gate) => gate.name === 'pregame_cutoff_validity')?.passed).length,
    officialPicks: last7.filter((item) => item.officialPick).length,
  },
}

const rejectionReasons = rejected.reduce((acc, item) => {
  const key = item.primaryRejectionReason ?? 'unknown'
  acc[key] = (acc[key] ?? 0) + 1
  return acc
}, {})

const counterfactuals = {
  currentPolicy: counterfactual(evaluated, {}),
  edgeMinus05pp: counterfactual(evaluated, { thresholds: { minimumOfficialEdge: RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEdge - 0.5 } }),
  edgeMinus10pp: counterfactual(evaluated, { thresholds: { minimumOfficialEdge: RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEdge - 1 } }),
  edgeMinus20pp: counterfactual(evaluated, { thresholds: { minimumOfficialEdge: RECOMMENDATION_THRESHOLDS_V1.minimumOfficialEdge - 2 } }),
  confidenceSlightlyReduced: counterfactual(evaluated, { thresholds: { minimumOfficialConfidence: RECOMMENDATION_THRESHOLDS_V1.minimumOfficialConfidence - 3 } }),
  qualitySlightlyReduced: counterfactual(evaluated, { thresholds: { minimumFeatureQuality: RECOMMENDATION_THRESHOLDS_V1.minimumFeatureQuality - 5 } }),
  allowProbationaryPreview: counterfactual(evaluated, { allowProbationaryPreview: true }),
  calibrationAcceptable: counterfactual(evaluated, { calibrationStatus: 'acceptable' }),
  calibrationMature: counterfactual(evaluated, { calibrationStatus: 'mature' }),
  removeOneGateAtATime: Object.fromEntries(gateNames.map((name) => [name, gateCounterfactual(evaluated, name)])),
}

const formulaAudit = {
  americanOddsConversion: {
    minus110: { decimal: americanToDecimal(-110), implied: americanImplied(-110) },
    plus150: { decimal: americanToDecimal(150), implied: americanImplied(150) },
  },
  storedImpliedMismatches: evaluated.filter((item) => {
    const stored = n(item.storedImpliedProbability)
    const calc = n(item.rawImpliedProbability)
    return stored !== null && calc !== null && Math.abs(stored - calc) > 0.05
  }).slice(0, 25).map((item) => ({ id: item.row.id, odds: item.odds, stored: item.storedImpliedProbability, calculated: item.rawImpliedProbability })),
  storedEdgeMismatches: evaluated.filter((item) => {
    const stored = n(item.edge)
    const calc = item.rawImpliedProbability === null ? null : round(item.modelProbability - item.rawImpliedProbability, 4)
    return stored !== null && calc !== null && Math.abs(stored - calc) > 0.1
  }).slice(0, 25).map((item) => ({ id: item.row.id, modelProbability: item.modelProbability, implied: item.rawImpliedProbability, storedEdge: item.edge, calculatedEdge: round(item.modelProbability - item.rawImpliedProbability, 4) })),
  storedEvMismatches: evaluated.filter((item) => {
    const stored = n(item.ev)
    const calc = expectedValuePercent(item.modelProbability, item.odds)
    return stored !== null && calc !== null && Math.abs(stored - calc) > 0.25
  }).slice(0, 25).map((item) => ({ id: item.row.id, odds: item.odds, modelProbability: item.modelProbability, storedEv: item.ev, calculatedEv: expectedValuePercent(item.modelProbability, item.odds) })),
  noVigRowsAvailable: evaluated.filter((item) => item.noVigProbability !== null).length,
  markets: Array.from(new Set(evaluated.map((item) => item.market))).sort(),
  marketKeyNormalization: { run_lineStoredAsRunLine: evaluated.filter((item) => item.market === 'run_line').length, spreadStoredRows: evaluated.filter((item) => item.market === 'spread').length },
  doubleheaderEventIdentity: {
    eventIds: new Set(evaluated.map((item) => item.row.game_id)).size,
    matchupDatePairs: new Set(evaluated.map((item) => `${item.operatingDate}:${item.event}`)).size,
  },
}

const historical = evaluated.filter((item) => settledOutcome(item.row) !== null)
const result = {
  generatedAt: new Date().toISOString(),
  mode: 'official_picks_eligibility_audit_v1',
  mutationSafety: {
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    policyChanged: false,
    predictionsChanged: false,
  },
  thresholds: RECOMMENDATION_THRESHOLDS_V1,
  scope: {
    currentOperatingDay: TODAY,
    last7Start,
    completeProductionSampleRows: evaluated.filter((item) => item.row.production_eligible === true && item.row.trial !== true && item.row.scrambled !== true).length,
    completePersistedMlbRows: rows.length,
    persistedValidPregameRows: validPregame.length,
    totalMlbRowsRead: rows.length,
  },
  funnel,
  rejectionAnalysis: {
    countsByPrimaryReason: rejectionReasons,
    rejectedCount: rejected.length,
    rejectedPredictions: rejected.map((item) => ({
      id: item.row.id,
      operatingDate: item.operatingDate,
      event: item.event,
      market: item.market,
      selection: item.selection,
      primaryRejectionReason: item.primaryRejectionReason,
      failedGates: item.failedGates.map((gate) => ({
        gate: gate.name,
        actual: gate.actual,
        required: gate.required,
        distance: gate.distance,
      })),
      policyBlockers: item.policy.blockers,
    })),
  },
  nearMisses,
  formulaAndMappingAudit: formulaAudit,
  policyImplementationAudit: {
    actualCalibrationModeInTopPicks: 'probationary',
    documentedThresholds: RECOMMENDATION_THRESHOLDS_V1,
    undocumentedOrSurprisingGates: [
      'top-picks.service.ts passes calibrationStatus=probationary for every row, so automatic Official Pick eligibility is unreachable unless a caller uses allowProbationaryPreview or a future implementation supplies acceptable/mature calibration.',
      'top-picks.service.ts filters to status pending and today/future before eligibility, while historical rows can only be audited offline.',
      'odds freshness uses wall-clock now; settled historical rows will always fail the live Official Pick freshness gate even if the original prediction was pregame-valid.',
    ],
    implementationDefectCandidates: [
      'Official policy has calibration thresholds but no production calibration status is derived from settled sample in getTopPicks.',
    ],
  },
  counterfactuals,
  historicalOutcomeValidation: {
    settledSampleSize: historical.length,
    byEdgeBucket: summarizeHistorical(historical, (item) => bucket(item.edge, [-5, 0, 3, 5, 7, 10])),
    byConfidenceBucket: summarizeHistorical(historical, (item) => bucket(item.confidence, [50, 60, 65, 72, 75, 80])),
    byQualityBucket: summarizeHistorical(historical, (item) => bucket(item.quality, [40, 50, 60, 70, 80])),
    byRiskGrade: summarizeHistorical(historical, (item) => String(item.riskGrade ?? 'unknown')),
    byNearMissDistance: summarizeHistorical(historical, (item) => bucket(item.qualificationDistance, [1, 3, 5, 10, 25, 50])),
  },
  classification: {
    preliminary: 'COMBINATION_IMPLEMENTATION_GATE_AND_MARKET_EDGE_DATA_QUALITY',
    reasons: [
      counterfactuals.calibrationAcceptable > counterfactuals.currentPolicy
        ? 'Calibration/readiness gate is the dominant implementation/policy bottleneck.'
        : 'Calibration/readiness gate did not change qualification count.',
      (rejectionReasons.probability_edge_threshold ?? 0) > 0 || (rejectionReasons.expected_value_threshold ?? 0) > 0
        ? 'Some rows also miss market edge or EV gates.'
        : 'Market edge/EV was not a primary rejection in this sample.',
      (rejectionReasons.feature_quality ?? 0) > 0 || (rejectionReasons.data_sufficiency ?? 0) > 0
        ? 'Some rows fail data quality/sufficiency gates.'
        : 'Data quality/sufficiency was not a primary rejection in this sample.',
    ],
  },
}

fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify({
  output: OUT,
  scope: result.scope,
  funnel: result.funnel,
  topRejectionReasons: Object.entries(rejectionReasons).sort((a, b) => b[1] - a[1]).slice(0, 10),
  counterfactuals,
  historicalSettledSampleSize: historical.length,
  classification: result.classification,
}, null, 2))
