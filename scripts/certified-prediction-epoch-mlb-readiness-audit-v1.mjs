import fs from 'node:fs'
import path from 'node:path'
import { supabaseAdmin } from '@/lib/supabase-admin'

const SPORT = 'baseball_mlb'
const OUT = path.join(process.cwd(), 'docs', 'certified-prediction-epoch-mlb-readiness-audit-v1.json')
const DAY_MS = 24 * 60 * 60 * 1000

const PREDICTION_SELECT = [
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
  'feature_snapshot_key',
  'feature_set_version',
  'feature_snapshot_generated_at',
  'validation_warnings',
  'settlement_details',
  'settled_at',
  'is_current',
  'model_role',
  'prediction_group_key',
  'prediction_epoch_key',
  'prediction_epoch_id',
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

function day(value) {
  const parsed = d(value)
  return parsed ? parsed.toISOString().slice(0, 10) : null
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
  const probability = n(modelProbability)
  const decimal = americanToDecimal(odds)
  if (probability === null || decimal === null) return null
  return round(((probability / 100) * (decimal - 1) - (1 - probability / 100)) * 100, 4)
}

function isSettled(row) {
  return ['win', 'loss', 'push', 'void', 'settled'].includes(String(row.result ?? row.status ?? '').toLowerCase())
}

function snapshot(row) {
  return row.feature_snapshot && typeof row.feature_snapshot === 'object' ? row.feature_snapshot : {}
}

function hasFeatureLineage(row) {
  const snap = snapshot(row)
  return Boolean(
    row.feature_snapshot_id ||
      row.feature_snapshot_key ||
      snap.featureSnapshotId ||
      snap.featureSnapshotKey ||
      snap.featureQuality !== undefined ||
      snap.quality !== undefined
  )
}

function hasCompleteFeatureLineage(row) {
  const snap = snapshot(row)
  return Boolean(
    hasFeatureLineage(row) &&
      (snap.sufficiency !== undefined || snap.dataSufficiency !== undefined || snap.dataSufficiencyScore !== undefined) &&
      (snap.quality !== undefined || snap.featureQuality !== undefined || snap.featureQualityScore !== undefined) &&
      (row.feature_set_version || row.model_version)
  )
}

function pregameCutoffValid(row) {
  const generated = d(row.generated_at)
  const cutoff = d(row.cutoff_at)
  const commence = d(row.commence_time)
  return Boolean(generated && cutoff && commence && generated <= cutoff && generated < commence)
}

function oddsFreshnessVerified(row) {
  const oddsAt = d(row.odds_timestamp)
  const generated = d(row.generated_at)
  const cutoff = d(row.cutoff_at)
  if (!oddsAt || !generated || !cutoff) return false
  if (oddsAt > cutoff) return false
  return Math.abs(generated.getTime() - oddsAt.getTime()) <= 120 * 60 * 1000
}

function classify(row) {
  const generated = d(row.generated_at)
  const commence = d(row.commence_time)
  const cutoff = d(row.cutoff_at)
  const oddsAt = d(row.odds_timestamp)
  const warnings = Array.isArray(row.validation_warnings) ? row.validation_warnings : []
  const flags = []

  if (!commence || !generated || !cutoff || n(row.model_probability) === null || n(row.odds) === null) flags.push('INVALID')
  if (commence && generated && generated >= commence) flags.push('POST_START')
  if (commence && generated && generated.getTime() > commence.getTime() + 6 * 60 * 60 * 1000) flags.push('POST_FINAL')
  if (isSettled(row) && commence && generated && generated.getTime() > commence.getTime() + 6 * 60 * 60 * 1000) flags.push('POST_FINAL')
  if (!oddsAt || (oddsAt && cutoff && oddsAt > cutoff) || !oddsFreshnessVerified(row)) flags.push('ODDS_FRESHNESS_UNVERIFIED')
  if (!hasFeatureLineage(row)) flags.push('DATA_LINEAGE_INCOMPLETE')
  if (hasFeatureLineage(row) && !hasCompleteFeatureLineage(row)) flags.push('FEATURE_LINEAGE_UNVERIFIED')
  if (warnings.some((warning) => /legacy|untrusted|fallback|postgame|leak/i.test(String(warning)))) flags.push('LEGACY_UNTRUSTED')

  const certifiedLivePregame = Boolean(
    row.production_eligible === true &&
      row.trial !== true &&
      row.scrambled !== true &&
      pregameCutoffValid(row) &&
      oddsFreshnessVerified(row) &&
      hasCompleteFeatureLineage(row) &&
      row.prediction_epoch_key
  )

  if (certifiedLivePregame) flags.unshift('CERTIFIED_LIVE_PREGAME')
  if (
    !certifiedLivePregame &&
    pregameCutoffValid(row) &&
    oddsAt &&
    cutoff &&
    oddsAt <= cutoff &&
    hasCompleteFeatureLineage(row)
  ) {
    flags.push('VALID_BUT_PRE_CERTIFICATION')
  }
  if (!flags.length) flags.push('LEGACY_UNTRUSTED')

  const priority = [
    'CERTIFIED_LIVE_PREGAME',
    'INVALID',
    'POST_FINAL',
    'POST_START',
    'DATA_LINEAGE_INCOMPLETE',
    'FEATURE_LINEAGE_UNVERIFIED',
    'ODDS_FRESHNESS_UNVERIFIED',
    'VALID_BUT_PRE_CERTIFICATION',
    'LEGACY_UNTRUSTED',
  ]
  return { primary: priority.find((item) => flags.includes(item)) ?? 'LEGACY_UNTRUSTED', flags: Array.from(new Set(flags)) }
}

function summarizeRows(rows) {
  const dates = rows.map((row) => d(row.commence_time)).filter(Boolean).sort((a, b) => a - b)
  return {
    rowCount: rows.length,
    operatingDateRange: {
      start: dates[0]?.toISOString().slice(0, 10) ?? null,
      end: dates.at(-1)?.toISOString().slice(0, 10) ?? null,
    },
    cutoffValidity: {
      validPregame: rows.filter(pregameCutoffValid).length,
      postStart: rows.filter((row) => {
        const generated = d(row.generated_at)
        const commence = d(row.commence_time)
        return Boolean(generated && commence && generated >= commence)
      }).length,
      missingGeneratedOrCutoff: rows.filter((row) => !d(row.generated_at) || !d(row.cutoff_at)).length,
    },
    oddsTimestampAvailability: {
      present: rows.filter((row) => d(row.odds_timestamp)).length,
      beforeOrAtCutoff: rows.filter((row) => {
        const oddsAt = d(row.odds_timestamp)
        const cutoff = d(row.cutoff_at)
        return Boolean(oddsAt && cutoff && oddsAt <= cutoff)
      }).length,
      freshnessVerified: rows.filter(oddsFreshnessVerified).length,
    },
    featureSnapshotAvailability: {
      featureSnapshotId: rows.filter((row) => row.feature_snapshot_id).length,
      featureSnapshotKey: rows.filter((row) => row.feature_snapshot_key).length,
      inlineFeatureSnapshot: rows.filter((row) => Object.keys(snapshot(row)).length > 0).length,
      completeLineage: rows.filter(hasCompleteFeatureLineage).length,
    },
    productionEligibleState: {
      productionEligible: rows.filter((row) => row.production_eligible === true).length,
      previewOrQuarantined: rows.filter((row) => row.production_eligible !== true).length,
      trial: rows.filter((row) => row.trial === true).length,
      scrambled: rows.filter((row) => row.scrambled === true).length,
    },
    settlementState: {
      settled: rows.filter(isSettled).length,
      pendingOrUnsettled: rows.filter((row) => !isSettled(row)).length,
      settledAtPresent: rows.filter((row) => row.settled_at).length,
    },
    learningLabelState: {
      featureSnapshotLinkedAndSettled: rows.filter((row) => row.feature_snapshot_id && isSettled(row)).length,
      learningLabelDirectEvidence: rows.filter((row) => {
        const details = row.settlement_details && typeof row.settlement_details === 'object' ? row.settlement_details : {}
        return Boolean(details.learning || details.learning_label || details.learningLabel)
      }).length,
      classification: rows.some((row) => row.feature_snapshot_id && isSettled(row)) ? 'DERIVABLE_READ_ONLY_QUEUE' : 'NO_DIRECT_LABEL_EVIDENCE',
    },
    currentMetricInclusionRisk: {
      recommendedPickRows: rows.filter((row) => row.recommended_pick === true).length,
      currentRows: rows.filter((row) => row.is_current === true).length,
      productionEligibleRows: rows.filter((row) => row.production_eligible === true).length,
      epochLinkedRows: rows.filter((row) => row.prediction_epoch_key || row.prediction_epoch_id).length,
    },
  }
}

async function readAll(table, select, configure = (query) => query, pageSize = 1000, maxRows = 100000) {
  const rows = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const query = configure(supabaseAdmin.from(table).select(select).range(from, from + pageSize - 1))
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function safeRead(label, fn) {
  try {
    const data = await fn()
    return { label, ok: true, data }
  } catch (error) {
    return { label, ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

const predictions = await readAll(
  'prediction_history',
  PREDICTION_SELECT,
  (query) => query.eq('sport_key', SPORT).order('commence_time', { ascending: true })
)

const classified = predictions.map((row) => ({ row, ...classify(row) }))
const categories = [
  'CERTIFIED_LIVE_PREGAME',
  'VALID_BUT_PRE_CERTIFICATION',
  'POST_START',
  'POST_FINAL',
  'INVALID',
  'DATA_LINEAGE_INCOMPLETE',
  'ODDS_FRESHNESS_UNVERIFIED',
  'FEATURE_LINEAGE_UNVERIFIED',
  'LEGACY_UNTRUSTED',
]

const classificationTable = categories.map((category) => {
  const rows = classified.filter((item) => item.primary === category).map((item) => item.row)
  return {
    classification: category,
    ...summarizeRows(rows),
    excludedFrom: category === 'CERTIFIED_LIVE_PREGAME'
      ? []
      : ['certified_performance', 'calibration', 'official_pick_readiness', 'learning_brain_updates', 'production_trust_metrics'],
  }
})

const evMismatches = predictions
  .map((row) => {
    const recomputed = expectedValuePercent(row.model_probability, row.odds)
    const stored = n(row.ev)
    return {
      predictionId: row.id,
      event: `${row.away_team ?? 'Away'} @ ${row.home_team ?? 'Home'}`,
      operatingDate: day(row.commence_time),
      market: row.market,
      selection: row.selection ?? row.team,
      storedOdds: row.odds,
      storedProbability: row.model_probability,
      storedEv: stored,
      recomputedEv: recomputed,
      exactDifference: stored === null || recomputed === null ? null : round(stored - recomputed, 6),
      sourceOfDiscrepancy: stored === null || recomputed === null
        ? 'MISSING_INPUT'
        : Math.abs(stored - recomputed) <= 0.25
          ? 'ROUNDING_TOLERANCE'
          : 'STORED_EV_FORMULA_OR_INPUT_MISMATCH',
      likelyCause: row.odds === null || row.model_probability === null ? 'missing odds or probability' : 'stored EV does not match current American-odds EV formula',
    }
  })
  .filter((item) => item.exactDifference === null || Math.abs(item.exactDifference) > 0.25)

const oddsRows = await safeRead('sports_odds_snapshots_mlb', () =>
  readAll(
    'sports_odds_snapshots',
    'id, sport_key, event_id, market, sportsbook, outcome, price, line, snapshot_time, is_opening, is_closing, provider, metadata',
    (query) => query.eq('sport_key', SPORT).order('snapshot_time', { ascending: true })
  )
)

const featureRows = await safeRead('historical_feature_snapshots_mlb', () =>
  readAll(
    'historical_feature_snapshots',
    'id, sport_key, event_id, market, prediction_cutoff, as_of_timestamp, generated_at, model_version, feature_set_version, source_timestamps, data_quality_score, data_sufficiency_score, leakage_status, production_eligible, trial, scrambled',
    (query) => query.eq('sport_key', SPORT).order('prediction_cutoff', { ascending: true })
  )
)

const learningEvidence = await safeRead('model_weight_history', () =>
  readAll('model_weight_history', 'id, sport_key, created_at', (query) => query.eq('sport_key', SPORT).order('created_at', { ascending: true }), 500)
)

function marketReadiness(marketKey, aliases) {
  const odds = oddsRows.ok ? oddsRows.data.filter((row) => aliases.includes(String(row.market))) : []
  const features = featureRows.ok ? featureRows.data.filter((row) => aliases.includes(String(row.market))) : []
  const settledPredictions = predictions.filter((row) => aliases.includes(String(row.market)) && isSettled(row))
  const timestamps = odds.map((row) => d(row.snapshot_time)).filter(Boolean).sort((a, b) => a - b)
  const hasLines = odds.some((row) => row.line !== null && row.line !== undefined)
  const hasPrices = odds.some((row) => n(row.price) !== null)
  const bookmakerNames = Array.from(new Set(odds.map((row) => row.sportsbook).filter(Boolean))).sort()
  const readiness = !odds.length
    ? 'HISTORICAL_MARKET_DATA_MISSING'
    : !hasPrices
      ? 'HISTORICAL_PRICE_DATA_INCOMPLETE'
      : !features.length
        ? 'FEATURE_HISTORY_MISSING'
        : !settledPredictions.length
          ? 'SETTLEMENT_SAMPLE_MISSING'
          : 'REPLAY_DESIGN_READY_NOT_CERTIFIED'
  return {
    market: marketKey,
    aliases,
    historicalOddsRows: odds.length,
    oddsTimestampRange: {
      start: timestamps[0]?.toISOString() ?? null,
      end: timestamps.at(-1)?.toISOString() ?? null,
    },
    lineOrHandicapAvailability: hasLines,
    priceAvailability: hasPrices,
    bookmakers: bookmakerNames,
    providerSources: Array.from(new Set(odds.map((row) => row.provider).filter(Boolean))).sort(),
    featureRows: features.length,
    featureAvailabilityBeforeGameTime: features.length ? 'REQUIRES_EVENT_BY_EVENT_CUTOFF_AUDIT' : 'MISSING',
    settledPredictionRows: settledPredictions.length,
    leakageRisk: readiness === 'REPLAY_DESIGN_READY_NOT_CERTIFIED' ? 'MUST_BE_PROVEN_BY_WALK_FORWARD_CLOCK' : 'BLOCKED_BY_MISSING_EVIDENCE',
    readinessClassification: readiness,
  }
}

const marketMatrix = [
  marketReadiness('moneyline', ['moneyline', 'h2h']),
  marketReadiness('run_line', ['run_line', 'spread']),
  marketReadiness('total', ['total', 'totals']),
  marketReadiness('first_five_moneyline', ['first_5_innings_moneyline', 'first_five_moneyline', 'first_5_moneyline']),
  marketReadiness('first_five_run_line', ['first_5_innings_run_line', 'first_five_run_line', 'first_5_spread']),
  marketReadiness('first_five_total', ['first_5_innings_total', 'first_five_total', 'first_5_total']),
  marketReadiness('team_totals', ['team_total', 'team_totals']),
]

const modelVersions = Array.from(new Set(predictions.map((row) => row.model_version).filter(Boolean))).sort()
const featureVersions = Array.from(new Set(predictions.map((row) => row.feature_set_version).filter(Boolean))).sort()

const result = {
  generatedAt: new Date().toISOString(),
  mode: 'certified_prediction_epoch_mlb_promotion_readiness_design_v1',
  mutationSafety: {
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    sqlApplied: false,
    epochActivated: false,
    historicalReplayExecuted: false,
    probabilitiesChanged: false,
    officialPickThresholdsChanged: false,
    learningBrainWeightsChanged: false,
  },
  scope: {
    sport: SPORT,
    predictionRows: predictions.length,
    dateRange: summarizeRows(predictions).operatingDateRange,
    modelVersions,
    featureVersions,
  },
  legacyPredictionClassificationTable: classificationTable,
  classificationFlagCounts: Object.fromEntries(categories.map((category) => [
    category,
    classified.filter((item) => item.flags.includes(category)).length,
  ])),
  exclusionPolicy: {
    certifiedPerformanceExcludedRows: classified.filter((item) => item.primary !== 'CERTIFIED_LIVE_PREGAME').length,
    calibrationExcludedRows: classified.filter((item) => item.primary !== 'CERTIFIED_LIVE_PREGAME').length,
    officialPickReadinessExcludedRows: classified.filter((item) => item.primary !== 'CERTIFIED_LIVE_PREGAME').length,
    learningBrainUpdateExcludedRows: classified.filter((item) => item.primary !== 'CERTIFIED_LIVE_PREGAME').length,
    productionTrustMetricExcludedRows: classified.filter((item) => item.primary !== 'CERTIFIED_LIVE_PREGAME').length,
  },
  evMismatchAudit: {
    mismatchCount: evMismatches.length,
    mismatches: evMismatches,
  },
  historicalMarketReadinessMatrix: marketMatrix,
  evidenceTables: {
    sportsOddsSnapshots: oddsRows.ok ? { ok: true, rowCount: oddsRows.data.length } : oddsRows,
    historicalFeatureSnapshots: featureRows.ok ? { ok: true, rowCount: featureRows.data.length } : featureRows,
    modelWeightHistory: learningEvidence.ok ? { ok: true, rowCount: learningEvidence.data.length } : learningEvidence,
  },
  recommendation: {
    existingHistoryCertification: 'MIXED_CLASSIFICATION_REQUIRED',
    rationale: [
      'No MLB prediction row currently qualifies as CERTIFIED_LIVE_PREGAME because production eligibility and epoch linkage are absent.',
      'A subset is valid-but-pre-certification and should remain available for audit, but not production performance, calibration, official readiness or Learning Brain updates.',
      'Historical replay is design-ready only for markets with timestamped odds, feature and settlement evidence; missing markets must remain blocked.',
    ],
  },
}

fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify({
  output: OUT,
  scope: result.scope,
  classificationTable: result.legacyPredictionClassificationTable.map((row) => ({
    classification: row.classification,
    rowCount: row.rowCount,
    dateRange: row.operatingDateRange,
    validPregame: row.cutoffValidity.validPregame,
    productionEligible: row.productionEligibleState.productionEligible,
    settled: row.settlementState.settled,
  })),
  evMismatchCount: result.evMismatchAudit.mismatchCount,
  marketReadiness: result.historicalMarketReadinessMatrix.map((row) => ({
    market: row.market,
    oddsRows: row.historicalOddsRows,
    featureRows: row.featureRows,
    settledPredictionRows: row.settledPredictionRows,
    readiness: row.readinessClassification,
  })),
  mutationSafety: result.mutationSafety,
  recommendation: result.recommendation,
}, null, 2))

process.exit(0)
