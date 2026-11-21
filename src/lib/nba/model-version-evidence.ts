import {wilsonInterval} from './goat-calibration-core.mjs'

/** Stored NBA prediction_history probabilities use percentage points (0–100). */
export const NBA_GOAT_PROBABILITY_UNIT = 'PERCENT_0_100' as const
export const NBA_GOAT_MARKETS = ['moneyline', 'spread', 'total'] as const
export const NBA_GOAT_INDEPENDENT_ROW_POLICY = 'FIRST_FROZEN_ROW_PER_VERSION_MARKET_GAME' as const

export type NbaVersionRow = {
  id: string; game_id: string; model_version: string | null; market: string
  result: string | null; model_probability: number | null
  generated_at?: string | null; created_at: string; commence_time: string
  settled_at?: string | null; recommended_pick: boolean | null; production_eligible: boolean | null
}

function nonempty(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 }
function time(value: unknown) { return typeof value === 'string' ? Date.parse(value) : NaN }
export function nbaProbabilityFraction(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 100 ? value / 100 : null
}
function uniqueGames(rows: NbaVersionRow[]) { return new Set(rows.map(row => row.game_id).filter(nonempty)).size }
export function nbaVersionTotals(rows: NbaVersionRow[]) {
  const settled = rows.filter(row => ['win', 'loss', 'push'].includes(row.result ?? ''))
  return {
    rows: rows.length, uniqueGames: uniqueGames(rows), settledUniqueGames: uniqueGames(settled),
    pending: rows.filter(row => !row.result || row.result === 'pending').length,
    wins: rows.filter(row => row.result === 'win').length,
    losses: rows.filter(row => row.result === 'loss').length,
    pushes: rows.filter(row => row.result === 'push').length,
  }
}
export function nbaVersionMarketMetrics(rows: NbaVersionRow[]) {
  return NBA_GOAT_MARKETS.map(market => {
    const total = nbaVersionTotals(rows.filter(row => row.market === market))
    return { market, ...total, accuracy: total.wins + total.losses ? total.wins / (total.wins + total.losses) : null }
  })
}

/** No unknown version is silently attributed to the historical or corrected model. */
export function nbaVersionGroups<T extends NbaVersionRow>(rows: T[]) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    if (!nonempty(row.model_version)) throw Error('NBA_GOAT_MODEL_VERSION_MISSING')
    if (!nonempty(row.game_id) || !NBA_GOAT_MARKETS.includes(row.market as typeof NBA_GOAT_MARKETS[number]) ||
        !['pending', 'win', 'loss', 'push', null].includes(row.result) ||
        row.recommended_pick !== false || row.production_eligible !== false) throw Error('NBA_GOAT_MODEL_REPORT_INTEGRITY_FAILED')
    const group = groups.get(row.model_version) ?? []
    group.push(row)
    groups.set(row.model_version, group)
  }
  return [...groups].map(([modelVersion, group]) => ({
    modelVersion, rows: group, metrics: nbaVersionMarketMetrics(group), total: nbaVersionTotals(group),
    lastCreatedAt: group.reduce<string | null>((latest, row) => Number.isFinite(time(row.created_at)) &&
      (!latest || time(row.created_at) > time(latest)) ? row.created_at : latest, null),
  })).sort((a, b) => (time(b.lastCreatedAt) || 0) - (time(a.lastCreatedAt) || 0) || a.modelVersion.localeCompare(b.modelVersion))
}

/** Keep the established response fields scoped to one explicitly named version. */
export function buildNbaVersionReport<T extends NbaVersionRow>(rows: T[]) {
  const versions = nbaVersionGroups(rows), selected = versions[0]
  return {
    rows: selected?.rows ?? [], metrics: selected?.metrics ?? nbaVersionMarketMetrics([]),
    total: selected?.total ?? nbaVersionTotals([]), versions,
    selectedModelVersion: selected?.modelVersion ?? null, modelVersions: versions.map(group => group.modelVersion),
    models: versions.length, aggregationScope: 'SELECTED_MODEL_VERSION' as const,
    allVersionsTotal: { rows: rows.length, uniqueGames: uniqueGames(rows), models: versions.length },
    probabilityUnit: NBA_GOAT_PROBABILITY_UNIT, accuracyUnit: 'FRACTION_0_1' as const,
    probabilityStatus: 'EXPLORATORY_UNVALIDATED' as const,
  }
}

export type NbaIndependentGroup<T extends NbaVersionRow = NbaVersionRow> = {
  modelVersion: string; market: string; rows: T[]; sourceRows: number; duplicateRowsExcluded: number
  invalidRowsExcluded: number; exclusionReasons: Record<string, number>
}

/**
 * Freeze selection precedes outcome/probability filtering. A later winning contract
 * can never replace an earlier pending, losing, push or malformed contract.
 * Games can recur across groups, so group sample sizes must never be added together.
 */
export function nbaIndependentGroups<T extends NbaVersionRow>(input: T[]): NbaIndependentGroup<T>[] {
  const groups: NbaIndependentGroup<T>[] = []
  for (const version of nbaVersionGroups(input)) for (const market of NBA_GOAT_MARKETS) {
    const source = version.rows.filter(row => row.market === market)
    if (!source.length) continue
    const reasons: Record<string, number> = {}, invalid = (reason: string) => { reasons[reason] = (reasons[reason] ?? 0) + 1 }
    const unverifiedGames = new Set<string>()
    const pregame = source.filter(row => {
      const start = time(row.commence_time), generated = time(row.generated_at), created = time(row.created_at)
      if (![start, generated, created].every(Number.isFinite) || generated > created || created >= start) {
        unverifiedGames.add(row.game_id); invalid('UNVERIFIED_PREGAME_FREEZE'); return false
      }
      return true
    })
    // If any freeze receipt is unverified, do not infer which competing contract
    // was actually first by quietly falling back to another row from that game.
    const eligible = pregame.filter(row => {
      if (unverifiedGames.has(row.game_id)) { invalid('AMBIGUOUS_FIRST_FREEZE'); return false }
      return true
    }).sort((a, b) => time(a.generated_at) - time(b.generated_at) || time(a.created_at) - time(b.created_at) || a.id.localeCompare(b.id))
    const first = new Map<string, T>()
    for (const row of eligible) if (!first.has(row.game_id)) first.set(row.game_id, row)
    const independent = [...first.values()].filter(row => {
      if (!['win', 'loss', 'push'].includes(row.result ?? '')) return true
      if (!Number.isFinite(time(row.settled_at)) || time(row.settled_at) < time(row.commence_time)) {
        invalid('UNVERIFIED_SETTLEMENT_RECEIPT'); return false
      }
      return true
    })
    groups.push({ modelVersion: version.modelVersion, market, rows: independent, sourceRows: source.length,
      duplicateRowsExcluded: eligible.length - first.size,
      invalidRowsExcluded: Object.values(reasons).reduce((sum, n) => sum + n, 0), exclusionReasons: reasons })
  }
  return groups
}

export function nbaCalibrationGroups<T extends NbaVersionRow>(rows: T[]) {
  return nbaIndependentGroups(rows).map(group => {
    const settled = group.rows.filter(row => row.result === 'win' || row.result === 'loss')
    const records = settled.flatMap(row => {
      const probability = nbaProbabilityFraction(row.model_probability)
      return probability === null ? [] : [{ at: row.commence_time, p: probability, y: (row.result === 'win' ? 1 : 0) as 0 | 1, gameId: row.game_id }]
    })
    return { ...group, records, independentGames: records.length, invalidProbabilitiesExcluded: settled.length - records.length,
      sourceProbabilityUnit: NBA_GOAT_PROBABILITY_UNIT, evaluationProbabilityUnit: 'FRACTION_0_1' as const,
      selectionPolicy: NBA_GOAT_INDEPENDENT_ROW_POLICY, validationScope: 'RETROSPECTIVE_EXPLORATORY' as const,
      prospectiveHoldoutVerified: false as const }
  })
}

/** Audit accuracy/calibration stay in one version and one market at a time. */
export function nbaVersionAuditEvidence<T extends NbaVersionRow>(input: T[]) {
  return nbaVersionGroups(input).map(version => {
    const groups = nbaCalibrationGroups(version.rows)
    const byMarket = version.metrics.map(metric => {
      const group = groups.find(item => item.market === metric.market)
      const settled = (group?.rows ?? []).filter(row => ['win', 'loss', 'push'].includes(row.result ?? ''))
      const wins = settled.filter(row => row.result === 'win').length, losses = settled.filter(row => row.result === 'loss').length
      const probabilities = (group?.records ?? []).map(row => row.p * 100)
      return { ...metric, modelVersion: version.modelVersion, settled: metric.wins + metric.losses + metric.pushes,
        averageModelProbability: probabilities.length ? probabilities.reduce((sum, probability) => sum + probability, 0) / probabilities.length : null,
        probabilityUnit: NBA_GOAT_PROBABILITY_UNIT,
        independentGames: settled.length, independentWins: wins, independentLosses: losses,
        independentAccuracy: wins + losses ? wins / (wins + losses) : null,
        wilson95: wilsonInterval(wins, losses), wilsonSampleUnit: NBA_GOAT_INDEPENDENT_ROW_POLICY,
        duplicateRowsExcluded: group?.duplicateRowsExcluded ?? 0, invalidRowsExcluded: group?.invalidRowsExcluded ?? 0 }
    })
    const ml = byMarket.find(metric => metric.market === 'moneyline')!
    const records = groups.find(group => group.market === 'moneyline')?.records ?? []
    return { modelVersion: version.modelVersion, total: version.total, byMarket,
      sample: { modelVersion: version.modelVersion, market: 'moneyline', sampleUnit: NBA_GOAT_INDEPENDENT_ROW_POLICY,
        settled: ml.independentGames, uniqueGames: ml.independentGames, wins: ml.independentWins, losses: ml.independentLosses,
        accuracy: ml.independentAccuracy, brier: records.length ? records.reduce((sum, row) => sum + (row.p - row.y) ** 2, 0) / records.length : null,
        markets: byMarket },
      calibrationAudit: { modelVersion: version.modelVersion, market: 'moneyline',
        moneylineSettled: ml.independentGames, moneylineContractRows: ml.settled,
        distinctMoneylineProbabilities: [...new Set(records.map(row => row.p * 100))],
        sourceProbabilityUnit: NBA_GOAT_PROBABILITY_UNIT, accuracyUnit: 'FRACTION_0_1' as const,
        observedMoneylineAccuracy: ml.independentAccuracy, moneylineWilson95: ml.wilson95,
        prospectiveHoldoutVerified: false, productionFormulaChanged: false }
    }
  })
}
