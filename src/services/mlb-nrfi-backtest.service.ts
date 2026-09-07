import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type RawRow = Record<string, unknown>
type Split = 'TRAIN' | 'VALIDATION' | 'TEST' | 'HOLDOUT'

type Row = {
  season: number
  gamePk: number
  gameDate: string
  split: Split
  y: number
  leagueNrfiPrior: number
  awayOffScoreAll: number
  awayOffScore30d: number
  homeOffScoreAll: number
  homeOffScore30d: number
  homeDefAllowAll: number
  homeDefAllow30d: number
  awayDefAllowAll: number
  awayDefAllow30d: number
  homeStarterAllowAll: number
  homeStarterAllow60d: number
  awayStarterAllowAll: number
  awayStarterAllow60d: number
}

type Candidate = {
  id: number
  wOff: number
  wDef: number
  wStarter: number
  betaRecent: number
  gammaLeague: number
}

type Calibration = { a: number; b: number; trainBrier: number }
type Scored = { actual: number; predicted: number; date: string }

const MODEL_VERSION = 'MLB_NRFI_RESEARCH_V1'
const PAGE_SIZE = 1000
const BETA_GRID = [0, 0.5, 1]
const GAMMA_GRID = [0, 0.25, 0.5]
const CAL_A_GRID = Array.from({ length: 11 }, (_, index) => -0.5 + index * 0.1)
const CAL_B_GRID = [0.5, 0.75, 1, 1.25, 1.5]

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function requiredNumber(value: unknown, label: string) {
  const parsed = numberOrNull(value)
  if (parsed === null) throw new Error(`Missing NRFI feature: ${label}`)
  return parsed
}

function clampProbability(value: number) {
  return Math.min(0.98, Math.max(0.02, value))
}

function logistic(value: number) {
  return 1 / (1 + Math.exp(-value))
}

function logit(value: number) {
  const p = clampProbability(value)
  return Math.log(p / (1 - p))
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

async function fetchRows(): Promise<Row[]> {
  const output: Row[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_nrfi_backtest_rows_v1_mv')
      .select('season,game_pk,game_date,split,nrfi,strict_prior_date_only,league_nrfi_prior,away_off_score_all,away_off_score_30d,home_off_score_all,home_off_score_30d,home_def_allow_all,home_def_allow_30d,away_def_allow_all,away_def_allow_30d,home_starter_allow_all,home_starter_allow_60d,away_starter_allow_all,away_starter_allow_60d')
      .eq('modeling_eligible', true)
      .order('season', { ascending: true })
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`NRFI backtest row read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    for (const row of page) {
      if (row.strict_prior_date_only !== true) throw new Error('NRFI leakage contract violated')
      const split = String(row.split) as Split
      if (!['TRAIN', 'VALIDATION', 'TEST', 'HOLDOUT'].includes(split)) throw new Error(`Unexpected NRFI split ${split}`)
      output.push({
        season: requiredNumber(row.season, 'season'),
        gamePk: requiredNumber(row.game_pk, 'game_pk'),
        gameDate: String(row.game_date),
        split,
        y: row.nrfi === true ? 1 : 0,
        leagueNrfiPrior: requiredNumber(row.league_nrfi_prior, 'league_nrfi_prior'),
        awayOffScoreAll: requiredNumber(row.away_off_score_all, 'away_off_score_all'),
        awayOffScore30d: requiredNumber(row.away_off_score_30d, 'away_off_score_30d'),
        homeOffScoreAll: requiredNumber(row.home_off_score_all, 'home_off_score_all'),
        homeOffScore30d: requiredNumber(row.home_off_score_30d, 'home_off_score_30d'),
        homeDefAllowAll: requiredNumber(row.home_def_allow_all, 'home_def_allow_all'),
        homeDefAllow30d: requiredNumber(row.home_def_allow_30d, 'home_def_allow_30d'),
        awayDefAllowAll: requiredNumber(row.away_def_allow_all, 'away_def_allow_all'),
        awayDefAllow30d: requiredNumber(row.away_def_allow_30d, 'away_def_allow_30d'),
        homeStarterAllowAll: requiredNumber(row.home_starter_allow_all, 'home_starter_allow_all'),
        homeStarterAllow60d: requiredNumber(row.home_starter_allow_60d, 'home_starter_allow_60d'),
        awayStarterAllowAll: requiredNumber(row.away_starter_allow_all, 'away_starter_allow_all'),
        awayStarterAllow60d: requiredNumber(row.away_starter_allow_60d, 'away_starter_allow_60d'),
      })
    }
    if (page.length < PAGE_SIZE) break
  }
  return output
}

function candidates(): Candidate[] {
  const output: Candidate[] = []
  let id = 1
  for (let off = 0; off <= 4; off += 1) {
    for (let defense = 0; defense <= 4 - off; defense += 1) {
      const wOff = off / 4
      const wDef = defense / 4
      const wStarter = 1 - wOff - wDef
      for (const betaRecent of BETA_GRID) {
        for (const gammaLeague of GAMMA_GRID) {
          output.push({ id, wOff, wDef, wStarter, betaRecent, gammaLeague })
          id += 1
        }
      }
    }
  }
  return output
}

function blended(full: number, recent: number, beta: number) {
  return (1 - beta) * full + beta * recent
}

function rawProbability(row: Row, candidate: Candidate) {
  const awayScore =
    candidate.wOff * blended(row.awayOffScoreAll, row.awayOffScore30d, candidate.betaRecent) +
    candidate.wDef * blended(row.homeDefAllowAll, row.homeDefAllow30d, candidate.betaRecent) +
    candidate.wStarter * blended(row.homeStarterAllowAll, row.homeStarterAllow60d, candidate.betaRecent)
  const homeScore =
    candidate.wOff * blended(row.homeOffScoreAll, row.homeOffScore30d, candidate.betaRecent) +
    candidate.wDef * blended(row.awayDefAllowAll, row.awayDefAllow30d, candidate.betaRecent) +
    candidate.wStarter * blended(row.awayStarterAllowAll, row.awayStarterAllow60d, candidate.betaRecent)
  const componentNrfi = (1 - awayScore) * (1 - homeScore)
  return clampProbability((1 - candidate.gammaLeague) * componentNrfi + candidate.gammaLeague * row.leagueNrfiPrior)
}

function calibratedProbability(raw: number, calibration: Pick<Calibration, 'a' | 'b'>) {
  return logistic(calibration.a + calibration.b * logit(raw))
}

function brier(rows: Row[], candidate: Candidate, calibration?: Pick<Calibration, 'a' | 'b'>) {
  if (!rows.length) return Infinity
  let total = 0
  for (const row of rows) {
    const raw = rawProbability(row, candidate)
    const predicted = calibration ? calibratedProbability(raw, calibration) : raw
    total += (predicted - row.y) ** 2
  }
  return total / rows.length
}

function calibrate(train: Row[], candidate: Candidate): Calibration {
  let best: Calibration | null = null
  for (const a of CAL_A_GRID) {
    for (const b of CAL_B_GRID) {
      const trainBrier = brier(train, candidate, { a, b })
      if (
        best === null ||
        trainBrier < best.trainBrier - 1e-15 ||
        (Math.abs(trainBrier - best.trainBrier) <= 1e-15 && (a < best.a || (a === best.a && b < best.b)))
      ) {
        best = { a, b, trainBrier }
      }
    }
  }
  if (!best) throw new Error('Unable to calibrate NRFI candidate')
  return best
}

function selectCandidate(train: Row[], validation: Row[]) {
  const evaluated = candidates().map((candidate) => {
    const calibration = calibrate(train, candidate)
    return {
      candidate,
      calibration,
      validationBrier: brier(validation, candidate, calibration),
    }
  })
  evaluated.sort(
    (left, right) =>
      left.validationBrier - right.validationBrier ||
      left.calibration.trainBrier - right.calibration.trainBrier ||
      left.candidate.id - right.candidate.id,
  )
  const selected = evaluated[0]
  if (!selected) throw new Error('No NRFI candidate available')
  return { selected, topValidationCandidates: evaluated.slice(0, 12) }
}

function scoreRows(rows: Row[], candidate: Candidate, calibration: Calibration): Scored[] {
  return rows.map((row) => ({
    actual: row.y,
    predicted: calibratedProbability(rawProbability(row, candidate), calibration),
    date: row.gameDate,
  }))
}

function splitMetrics(scored: Scored[], baselineProbability: number) {
  if (!scored.length) return { n: 0 }
  const actual = scored.map((row) => row.actual)
  const predicted = scored.map((row) => row.predicted)
  const brierValue = mean(scored.map((row) => (row.predicted - row.actual) ** 2)) ?? 0
  const baselineBrier = mean(scored.map((row) => (baselineProbability - row.actual) ** 2)) ?? 0
  const logLoss =
    mean(
      scored.map((row) => {
        const p = Math.min(1 - 1e-9, Math.max(1e-9, row.predicted))
        return -(row.actual * Math.log(p) + (1 - row.actual) * Math.log(1 - p))
      }),
    ) ?? 0
  return {
    n: scored.length,
    brier: brierValue,
    baselineBrier,
    brierSkill: baselineBrier > 0 ? 1 - brierValue / baselineBrier : null,
    logLoss,
    actualNrfiRate: mean(actual),
    predictedNrfiRate: mean(predicted),
    bias: mean(scored.map((row) => row.predicted - row.actual)),
  }
}

function monthlyMetrics(scored: Scored[], baselineProbability: number) {
  const groups = new Map<string, Scored[]>()
  for (const row of scored) {
    const month = row.date.slice(0, 7)
    const bucket = groups.get(month) ?? []
    bucket.push(row)
    groups.set(month, bucket)
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, rows]) => ({ month, ...splitMetrics(rows, baselineProbability) }))
}

export async function runMlbNrfiBacktest() {
  const rows = await fetchRows()
  const train = rows.filter((row) => row.split === 'TRAIN')
  const validation = rows.filter((row) => row.split === 'VALIDATION')
  const test = rows.filter((row) => row.split === 'TEST')
  const holdout = rows.filter((row) => row.split === 'HOLDOUT')
  if (!train.length || !validation.length || !test.length || !holdout.length) throw new Error('NRFI chronological split is incomplete')

  const trainRate = mean(train.map((row) => row.y)) ?? 0.5
  const selection = selectCandidate(train, validation)
  const { candidate, calibration } = selection.selected

  const trainMetrics = splitMetrics(scoreRows(train, candidate, calibration), trainRate)
  const validationMetrics = splitMetrics(scoreRows(validation, candidate, calibration), trainRate)
  const testMetrics = splitMetrics(scoreRows(test, candidate, calibration), trainRate)
  const holdoutScored = scoreRows(holdout, candidate, calibration)
  const holdoutMetrics = splitMetrics(holdoutScored, trainRate)

  const fixedTestSkill = typeof testMetrics.brierSkill === 'number' ? testMetrics.brierSkill : -Infinity
  const holdoutSkill = typeof holdoutMetrics.brierSkill === 'number' ? holdoutMetrics.brierSkill : -Infinity
  const shadowEligible = fixedTestSkill > 0 && holdoutSkill > 0

  return {
    modelVersion: MODEL_VERSION,
    status: shadowEligible ? 'SHADOW_CANDIDATE_ONLY' : 'RESEARCH_ONLY_NOT_READY_FOR_SHADOW',
    market: 'NRFI_YRFI',
    generatedAt: new Date().toISOString(),
    design: {
      modelClass: 'weighted prior-date half-inning scoring components plus TRAIN-only logit calibration',
      hyperparameterSelection: '2025 TRAIN calibration -> 2025 VALIDATION candidate selection only',
      fixedTest: '2025-09-01 through 2025-09-28; never used for candidate selection',
      externalHoldout: '2026; never used for candidate selection or calibration',
      sameDayRule: 'all source games require source_game_date < target_game_date; earlier games on the same date are excluded',
      legacyFieldQuarantine: 'pick2_mlb_first_inning_daily_features.team_first_inning_scoring_rate is excluded because audit proved it stores average first-inning pitches seen, not scoring rate',
      sportsbookOddsUsed: false,
      providerCallsAtRuntime: false,
      officialPickWrites: false,
    },
    dataQuality: {
      scoredRows: rows.length,
      strictPriorRows: rows.length,
      leakageDetected: false,
      splitCounts: { train: train.length, validation: validation.length, fixedTest2025: test.length, externalHoldout2026: holdout.length },
    },
    selected: {
      candidate,
      calibration,
      validationBrier: selection.selected.validationBrier,
      topValidationCandidates: selection.topValidationCandidates.map((item) => ({
        candidate: item.candidate,
        calibration: item.calibration,
        validationBrier: item.validationBrier,
      })),
    },
    metrics: {
      train: trainMetrics,
      validation: validationMetrics,
      fixedTest2025: testMetrics,
      externalHoldout2026: holdoutMetrics,
      externalHoldoutMonthly: monthlyMetrics(holdoutScored, trainRate),
    },
    gate: {
      shadowEligible,
      requirement: 'Brier skill versus the frozen 2025 TRAIN event-rate baseline must be positive on both untouched 2025 TEST and external 2026 HOLDOUT.',
      blockers: [
        ...(fixedTestSkill <= 0 ? ['FIXED_2025_TEST_BRIER_SKILL_NOT_POSITIVE'] : []),
        ...(holdoutSkill <= 0 ? ['EXTERNAL_2026_HOLDOUT_BRIER_SKILL_NOT_POSITIVE'] : []),
      ],
      observation: 'The first candidate class shows only small probability gains and meaningful September-2025 regime drift. It is not promoted when the fixed-test gate fails.',
    },
    safety: {
      theOddsApiCreditsConsumed: 0,
      providerCalls: 0,
      officialPickWrites: 0,
      bettingActivated: false,
      productionEligible: false,
      recommendation: null,
      expectedValue: null,
      nextGate: shadowEligible
        ? 'Forward shadow against frozen real pregame NRFI/YRFI lines and prices'
        : 'Improve the first-inning model using only TRAIN/VALIDATION evidence, then repeat untouched TEST and external HOLDOUT evaluation',
    },
  }
}
