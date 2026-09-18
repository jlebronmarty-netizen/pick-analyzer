import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const RESEARCH_BRANCH = 'research/totals-2025-historical-backfill'
const TABLE = 'mlb_totals_v26_full_ml_dataset_2025_v1'
const SEED = 20260917
const N_TREES = 200
const PAGE_SIZE = 500
const THRESHOLDS = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80] as const
const MODES = ['two_sided', 'over_only', 'under_only'] as const

const INTERNAL_N_MIN = 30
const INTERNAL_HALF_N_MIN = 10
const INTERNAL_ACC_MIN = 0.70
const INTERNAL_WORST_HALF_MIN = 0.65

const META = new Set(['game_pk', 'game_date', 'close_over_label', 'research_only'])
const FORBIDDEN = new Set([
  'total_runs',
  'home_runs',
  'away_runs',
  'actual_winner',
  'y_margin',
  'open_total_margin',
  'close_total_margin',
  'actual_offense_score',
  'actual_contact_score',
  'actual_starter_vulnerability_score',
  'actual_bullpen_vulnerability_score',
  'actual_defense_error_score',
])

type Mode = (typeof MODES)[number]

type Spec = {
  maxDepth: number | null
  minLeaf: number
  maxFeatures: 'sqrt' | 0.5
}

type Matrix = {
  x: Float64Array
  y: Int8Array
  day: Int8Array
  n: number
  p: number
}

type Tree =
  | { leaf: true; prob: number }
  | { leaf: false; feature: number; threshold: number; left: Tree; right: Tree }

function specs(): Spec[] {
  const out: Spec[] = []
  for (const maxDepth of [3, 5, null] as const) {
    for (const minLeaf of [5, 15] as const) {
      for (const maxFeatures of ['sqrt', 0.5] as const) {
        out.push({ maxDepth, minLeaf, maxFeatures })
      }
    }
  }
  return out
}

async function fetchRows(from: string, to: string) {
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('*')
      .gte('game_date', from)
      .lt('game_date', to)
      .in('close_over_label', [0, 1])
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw new Error('V26_QUERY_FAILED:' + error.message)

    const page = (data ?? []) as unknown as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function medians(rows: Record<string, unknown>[], features: string[]) {
  const med = new Float64Array(features.length)
  for (let j = 0; j < features.length; j++) {
    const values: number[] = []
    const feature = features[j]
    for (const row of rows) {
      const v = finiteNumber(row[feature])
      if (v !== null) values.push(v)
    }
    values.sort((a, b) => a - b)
    if (!values.length) {
      med[j] = 0
    } else if (values.length % 2) {
      med[j] = values[(values.length - 1) >> 1]
    } else {
      med[j] = (values[values.length / 2 - 1] + values[values.length / 2]) / 2
    }
  }
  return med
}

function toMatrix(
  rows: Record<string, unknown>[],
  features: string[],
  med: Float64Array,
): Matrix {
  const p = features.length
  const x = new Float64Array(rows.length * p)
  const y = new Int8Array(rows.length)
  const day = new Int8Array(rows.length)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    y[i] = Number(row.close_over_label)
    day[i] = Number(String(row.game_date).slice(8, 10))
    for (let j = 0; j < p; j++) {
      const v = finiteNumber(row[features[j]])
      x[i * p + j] = v === null ? med[j] : v
    }
  }
  return { x, y, day, n: rows.length, p }
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gini(n0: number, n1: number) {
  const n = n0 + n1
  if (!n) return 0
  const p0 = n0 / n
  const p1 = n1 / n
  return 1 - p0 * p0 - p1 * p1
}

function sampleFeatures(rand: () => number, p: number, count: number) {
  const arr = new Int32Array(p)
  for (let i = 0; i < p; i++) arr[i] = i
  for (let i = 0; i < count; i++) {
    const k = i + Math.floor(rand() * (p - i))
    const tmp = arr[i]
    arr[i] = arr[k]
    arr[k] = tmp
  }
  return arr.subarray(0, count)
}

function buildTree(
  matrix: Matrix,
  spec: Spec,
  seed: number,
): Tree {
  const rand = mulberry32(seed)
  const { x, y, p } = matrix
  const mtry =
    spec.maxFeatures === 'sqrt'
      ? Math.max(1, Math.floor(Math.sqrt(p)))
      : Math.max(1, Math.floor(p * spec.maxFeatures))

  const recurse = (idx: number[], depth: number): Tree => {
    let n1 = 0
    for (const i of idx) n1 += y[i]
    const n = idx.length
    const n0 = n - n1
    const prob = n1 / n

    if (
      n < 2 * spec.minLeaf ||
      n1 === 0 ||
      n0 === 0 ||
      (spec.maxDepth !== null && depth >= spec.maxDepth)
    ) {
      return { leaf: true, prob }
    }

    const parent = gini(n0, n1)
    let bestGain = -1
    let bestFeature = -1
    let bestThreshold = 0

    const candidateFeatures = sampleFeatures(rand, p, mtry)
    for (let z = 0; z < candidateFeatures.length; z++) {
      const feature = candidateFeatures[z]
      let min = Infinity
      let max = -Infinity
      for (const i of idx) {
        const v = x[i * p + feature]
        if (v < min) min = v
        if (v > max) max = v
      }
      if (!(max > min)) continue

      const threshold = min + rand() * (max - min)
      let l0 = 0
      let l1 = 0
      let r0 = 0
      let r1 = 0

      for (const i of idx) {
        const isLeft = x[i * p + feature] <= threshold
        if (isLeft) {
          if (y[i]) l1++
          else l0++
        } else {
          if (y[i]) r1++
          else r0++
        }
      }

      const ln = l0 + l1
      const rn = r0 + r1
      if (ln < spec.minLeaf || rn < spec.minLeaf) continue

      const gain = parent - (ln / n) * gini(l0, l1) - (rn / n) * gini(r0, r1)
      if (gain > bestGain) {
        bestGain = gain
        bestFeature = feature
        bestThreshold = threshold
      }
    }

    if (bestFeature < 0) return { leaf: true, prob }

    const left: number[] = []
    const right: number[] = []
    for (const i of idx) {
      if (x[i * p + bestFeature] <= bestThreshold) left.push(i)
      else right.push(i)
    }

    return {
      leaf: false,
      feature: bestFeature,
      threshold: bestThreshold,
      left: recurse(left, depth + 1),
      right: recurse(right, depth + 1),
    }
  }

  return recurse(Array.from({ length: matrix.n }, (_, i) => i), 0)
}

function predictTree(tree: Tree, matrix: Matrix, row: number) {
  let node = tree
  while (!node.leaf) {
    node =
      matrix.x[row * matrix.p + node.feature] <= node.threshold
        ? node.left
        : node.right
  }
  return node.prob
}

function forestProb(train: Matrix, validation: Matrix, spec: Spec, specIndex: number) {
  const probs = new Float64Array(validation.n)
  for (let k = 0; k < N_TREES; k++) {
    const tree = buildTree(train, spec, SEED + specIndex * 100003 + k * 997)
    for (let i = 0; i < validation.n; i++) {
      probs[i] += predictTree(tree, validation, i)
    }
  }
  for (let i = 0; i < validation.n; i++) probs[i] /= N_TREES
  return probs
}

function fullAccuracy(prob: Float64Array, y: Int8Array) {
  let correct = 0
  for (let i = 0; i < y.length; i++) {
    if ((prob[i] >= 0.5 ? 1 : 0) === y[i]) correct++
  }
  return correct / y.length
}

function evaluateSelection(
  prob: Float64Array,
  validation: Matrix,
  mode: Mode,
  threshold: number,
) {
  let n = 0
  let correct = 0
  let firstN = 0
  let firstCorrect = 0
  let secondN = 0
  let secondCorrect = 0

  for (let i = 0; i < validation.n; i++) {
    const score = prob[i]
    let selected = false
    let pred = 0

    if (mode === 'two_sided') {
      selected = score >= threshold || score <= 1 - threshold
      pred = score >= threshold ? 1 : 0
    } else if (mode === 'over_only') {
      selected = score >= threshold
      pred = 1
    } else {
      selected = score <= 1 - threshold
      pred = 0
    }

    if (!selected) continue
    const ok = pred === validation.y[i]
    n++
    if (ok) correct++

    if (validation.day[i] <= 15) {
      firstN++
      if (ok) firstCorrect++
    } else {
      secondN++
      if (ok) secondCorrect++
    }
  }

  if (n < INTERNAL_N_MIN || firstN < INTERNAL_HALF_N_MIN || secondN < INTERNAL_HALF_N_MIN) {
    return null
  }

  const accuracy = correct / n
  const firstAccuracy = firstCorrect / firstN
  const secondAccuracy = secondCorrect / secondN
  const worstHalfAccuracy = Math.min(firstAccuracy, secondAccuracy)

  return {
    mode,
    threshold,
    n,
    correct,
    accuracy,
    first_half: { n: firstN, correct: firstCorrect, accuracy: firstAccuracy },
    second_half: { n: secondN, correct: secondCorrect, accuracy: secondAccuracy },
    worst_half_accuracy: worstHalfAccuracy,
    min_half_n: Math.min(firstN, secondN),
    passes_internal_gate:
      accuracy >= INTERNAL_ACC_MIN && worstHalfAccuracy >= INTERNAL_WORST_HALF_MIN,
  }
}

export async function GET(request: NextRequest) {
  const ref = process.env.VERCEL_GIT_COMMIT_REF ?? ''
  if (ref !== RESEARCH_BRANCH) {
    return NextResponse.json({ error: 'RESEARCH_ROUTE_DISABLED' }, { status: 404 })
  }

  const specIndex = Number(request.nextUrl.searchParams.get('spec') ?? '-1')
  const allSpecs = specs()
  if (!Number.isInteger(specIndex) || specIndex < 0 || specIndex >= allSpecs.length) {
    return NextResponse.json(
      { error: 'INVALID_SPEC', valid: [0, allSpecs.length - 1] },
      { status: 400 },
    )
  }

  const [trainRows, juneRows] = await Promise.all([
    fetchRows('2025-04-01', '2025-06-01'),
    fetchRows('2025-06-01', '2025-07-01'),
  ])

  if (trainRows.length !== 769 || juneRows.length !== 381) {
    return NextResponse.json(
      {
        error: 'V26_SPLIT_COUNT_MISMATCH',
        train_rows: trainRows.length,
        june_rows: juneRows.length,
      },
      { status: 409 },
    )
  }

  const features = Object.keys(trainRows[0] ?? {})
    .filter((key) => !META.has(key))
    .sort()

  const leaked = features.filter((key) => FORBIDDEN.has(key))
  if (leaked.length) {
    return NextResponse.json(
      { error: 'FORBIDDEN_FEATURES_PRESENT', fields: leaked },
      { status: 409 },
    )
  }

  const med = medians(trainRows, features)
  const train = toMatrix(trainRows, features, med)
  const june = toMatrix(juneRows, features, med)
  const spec = allSpecs[specIndex]
  const prob = forestProb(train, june, spec, specIndex)

  const candidates = MODES.flatMap((mode) =>
    THRESHOLDS.map((threshold) => evaluateSelection(prob, june, mode, threshold)),
  )
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort(
      (a, b) =>
        b.accuracy - a.accuracy ||
        b.worst_half_accuracy - a.worst_half_accuracy ||
        b.n - a.n,
    )

  return NextResponse.json(
    {
      contract: 'MLB_TOTALS_V26_EXTRA_TREES_INTERNAL/1.0.0',
      research_only: true,
      branch: RESEARCH_BRANCH,
      source_table: TABLE,
      official_picks_writes: 0,
      apostar_activation: false,
      production_promotion: false,
      odds_api_credits_consumed: 0,
      external_2026_used: false,
      jul_aug_opened: false,
      methodology: {
        family: 'deterministic_extra_trees_style',
        n_estimators: N_TREES,
        bootstrap: false,
        split_rule: 'one_random_threshold_per_sampled_feature_per_node_best_gini_gain',
        seed: SEED,
        train_period: '2025-04-01/2025-05-31',
        internal_validation_period: '2025-06-01/2025-06-30',
        feature_median_imputation_fit_on: 'Apr-May only',
        feature_count: features.length,
        threshold_modes: MODES,
        thresholds: THRESHOLDS,
      },
      gate: {
        accuracy_min: INTERNAL_ACC_MIN,
        worst_half_accuracy_min: INTERNAL_WORST_HALF_MIN,
        n_min: INTERNAL_N_MIN,
        half_n_min: INTERNAL_HALF_N_MIN,
      },
      spec_index: specIndex,
      spec,
      train_rows: train.n,
      june_rows: june.n,
      full_june_accuracy_at_0_5: fullAccuracy(prob, june.y),
      gate_pass_count: candidates.filter((x) => x.passes_internal_gate).length,
      best_gate_candidate:
        candidates.find((x) => x.passes_internal_gate) ?? null,
      candidates,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
