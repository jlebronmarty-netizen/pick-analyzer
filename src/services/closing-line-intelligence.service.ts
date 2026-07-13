import { supabaseAdmin } from '@/lib/supabase-admin'

type GenericPredictionRow = Record<string, unknown>

type LineRecord = {
  id: string
  sportKey: string
  gameId: string
  team: string
  opponent: string
  sportsbook: string
  market: string
  commenceTime: string
  capturedAt: string
  openingOdds: number
  currentOdds: number
  closingOdds: number | null
  modelProbability: number
  impliedProbability: number
  edge: number
  ev: number
  status: string
  result: string | null
}

type SportsbookAccumulator = {
  sportsbook: string
  samples: number
  positiveClv: number
  negativeClv: number
  totalClvPercent: number
  totalMoveCents: number
  staleLines: number
  favorableLines: number
}

type TimingAccumulator = {
  label: string
  samples: number
  positiveClv: number
  totalClvPercent: number
  totalMoveCents: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function numberValue(
  row: GenericPredictionRow,
  keys: string[],
  fallback = 0
) {
  for (const key of keys) {
    const value = Number(row[key])

    if (Number.isFinite(value)) {
      return value
    }
  }

  return fallback
}

function optionalNumberValue(
  row: GenericPredictionRow,
  keys: string[]
): number | null {
  for (const key of keys) {
    const raw = row[key]

    if (raw === null || raw === undefined || raw === '') {
      continue
    }

    const value = Number(raw)

    if (Number.isFinite(value)) {
      return value
    }
  }

  return null
}

function stringValue(
  row: GenericPredictionRow,
  keys: string[],
  fallback = ''
) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return fallback
}

function americanToDecimal(americanOdds: number) {
  if (americanOdds === 0) return 1

  if (americanOdds > 0) {
    return 1 + americanOdds / 100
  }

  return 1 + 100 / Math.abs(americanOdds)
}

function americanImpliedProbability(americanOdds: number) {
  if (americanOdds === 0) return 0

  if (americanOdds > 0) {
    return 100 / (americanOdds + 100)
  }

  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)
}

function probabilityToAmerican(probability: number) {
  const normalized = clamp(probability, 0.0001, 0.9999)

  if (normalized >= 0.5) {
    return round((-100 * normalized) / (1 - normalized))
  }

  return round((100 * (1 - normalized)) / normalized)
}

function calculateClvPercent(
  betOdds: number,
  closingOdds: number
) {
  if (betOdds === 0 || closingOdds === 0) return 0

  const betDecimal = americanToDecimal(betOdds)
  const closingDecimal = americanToDecimal(closingOdds)

  if (closingDecimal <= 0) return 0

  return round(
    ((betDecimal / closingDecimal) - 1) * 100
  )
}

function calculateMoveCents(
  openingOdds: number,
  closingOdds: number
) {
  return round(openingOdds - closingOdds)
}

function getHoursBeforeStart(
  capturedAt: string,
  commenceTime: string
) {
  const captured = new Date(capturedAt).getTime()
  const commence = new Date(commenceTime).getTime()

  if (
    !Number.isFinite(captured) ||
    !Number.isFinite(commence)
  ) {
    return 0
  }

  return Math.max(
    0,
    (commence - captured) / (1000 * 60 * 60)
  )
}

function getTimingBucket(hoursBeforeStart: number) {
  if (hoursBeforeStart >= 24) return '24h+'
  if (hoursBeforeStart >= 12) return '12–24h'
  if (hoursBeforeStart >= 6) return '6–12h'
  if (hoursBeforeStart >= 2) return '2–6h'
  if (hoursBeforeStart >= 1) return '1–2h'

  return '<1h'
}

function normalizeRow(
  row: GenericPredictionRow
): LineRecord {
  const odds = numberValue(
    row,
    ['odds', 'current_odds', 'book_odds'],
    0
  )

  const openingOdds = numberValue(
    row,
    [
      'opening_odds',
      'open_odds',
      'initial_odds',
      'captured_odds',
      'odds',
    ],
    odds
  )

  const currentOdds = numberValue(
    row,
    [
      'current_odds',
      'latest_odds',
      'book_odds',
      'odds',
    ],
    odds
  )

  const closingOdds = optionalNumberValue(
    row,
    [
      'closing_odds',
      'close_odds',
      'closing_line',
      'final_odds',
    ]
  )

  const impliedProbability = numberValue(
    row,
    ['implied_probability'],
    americanImpliedProbability(currentOdds) * 100
  )

  return {
    id: stringValue(row, ['id']),
    sportKey: stringValue(
      row,
      ['sport_key'],
      'unknown'
    ),
    gameId: stringValue(row, ['game_id']),
    team: stringValue(row, ['team'], 'Unknown'),
    opponent: stringValue(
      row,
      ['opponent'],
      'Unknown'
    ),
    sportsbook: stringValue(
      row,
      ['sportsbook', 'bookmaker', 'book'],
      'Unknown'
    ),
    market: stringValue(
      row,
      ['market'],
      'moneyline'
    ),
    commenceTime: stringValue(
      row,
      ['commence_time', 'game_time']
    ),
    capturedAt: stringValue(
      row,
      ['captured_at', 'created_at', 'updated_at']
    ),
    openingOdds,
    currentOdds,
    closingOdds,
    modelProbability: numberValue(
      row,
      ['model_probability'],
      0
    ),
    impliedProbability,
    edge: numberValue(row, ['edge'], 0),
    ev: numberValue(row, ['ev'], 0),
    status: stringValue(
      row,
      ['status'],
      'pending'
    ),
    result:
      stringValue(row, ['result'], '') || null,
  }
}

function getEffectiveClosingOdds(record: LineRecord) {
  return record.closingOdds ?? record.currentOdds
}

function calculateLineQuality(record: LineRecord) {
  const closingOdds = getEffectiveClosingOdds(record)
  const clv = calculateClvPercent(
    record.openingOdds,
    closingOdds
  )

  const movementCents = calculateMoveCents(
    record.openingOdds,
    closingOdds
  )

  const modelFairOdds =
    record.modelProbability > 0
      ? probabilityToAmerican(
          record.modelProbability / 100
        )
      : 0

  const valueVsModel =
    modelFairOdds !== 0
      ? round(record.currentOdds - modelFairOdds)
      : 0

  const staleLine =
    Math.abs(valueVsModel) >= 15 &&
    record.edge >= 4

  const favorableLine =
    clv > 0 ||
    record.ev >= 5 ||
    record.edge >= 5

  return {
    clvPercent: clv,
    movementCents,
    modelFairOdds,
    valueVsModel,
    staleLine,
    favorableLine,
  }
}

function buildSportsbookStats(
  records: LineRecord[]
) {
  const map = new Map<
    string,
    SportsbookAccumulator
  >()

  for (const record of records) {
    const quality = calculateLineQuality(record)

    const existing =
      map.get(record.sportsbook) ?? {
        sportsbook: record.sportsbook,
        samples: 0,
        positiveClv: 0,
        negativeClv: 0,
        totalClvPercent: 0,
        totalMoveCents: 0,
        staleLines: 0,
        favorableLines: 0,
      }

    existing.samples += 1
    existing.totalClvPercent += quality.clvPercent
    existing.totalMoveCents +=
      quality.movementCents

    if (quality.clvPercent > 0) {
      existing.positiveClv += 1
    }

    if (quality.clvPercent < 0) {
      existing.negativeClv += 1
    }

    if (quality.staleLine) {
      existing.staleLines += 1
    }

    if (quality.favorableLine) {
      existing.favorableLines += 1
    }

    map.set(record.sportsbook, existing)
  }

  return [...map.values()]
    .map((item) => {
      const positiveClvRate =
        item.samples > 0
          ? (item.positiveClv / item.samples) * 100
          : 0

      const averageClv =
        item.samples > 0
          ? item.totalClvPercent / item.samples
          : 0

      const averageMove =
        item.samples > 0
          ? item.totalMoveCents / item.samples
          : 0

      const staleRate =
        item.samples > 0
          ? (item.staleLines / item.samples) * 100
          : 0

      const opportunityScore = round(
        clamp(
          positiveClvRate * 0.35 +
            Math.max(averageClv, 0) * 4 +
            staleRate * 0.25 +
            (item.favorableLines /
              Math.max(item.samples, 1)) *
              25,
          0,
          100
        )
      )

      return {
        sportsbook: item.sportsbook,
        samples: item.samples,
        positiveClvRate: round(positiveClvRate),
        averageClv: round(averageClv),
        averageMoveCents: round(averageMove),
        staleLines: item.staleLines,
        favorableLines: item.favorableLines,
        opportunityScore,
      }
    })
    .sort(
      (a, b) =>
        b.opportunityScore -
        a.opportunityScore
    )
}

function buildTimingStats(records: LineRecord[]) {
  const map = new Map<
    string,
    TimingAccumulator
  >()

  for (const record of records) {
    const hours = getHoursBeforeStart(
      record.capturedAt,
      record.commenceTime
    )

    const label = getTimingBucket(hours)
    const quality = calculateLineQuality(record)

    const existing =
      map.get(label) ?? {
        label,
        samples: 0,
        positiveClv: 0,
        totalClvPercent: 0,
        totalMoveCents: 0,
      }

    existing.samples += 1
    existing.totalClvPercent += quality.clvPercent
    existing.totalMoveCents +=
      quality.movementCents

    if (quality.clvPercent > 0) {
      existing.positiveClv += 1
    }

    map.set(label, existing)
  }

  const order = [
    '24h+',
    '12–24h',
    '6–12h',
    '2–6h',
    '1–2h',
    '<1h',
  ]

  return [...map.values()]
    .map((item) => ({
      label: item.label,
      samples: item.samples,
      positiveClvRate: round(
        (item.positiveClv /
          Math.max(item.samples, 1)) *
          100
      ),
      averageClv: round(
        item.totalClvPercent /
          Math.max(item.samples, 1)
      ),
      averageMoveCents: round(
        item.totalMoveCents /
          Math.max(item.samples, 1)
      ),
    }))
    .sort(
      (a, b) =>
        order.indexOf(a.label) -
        order.indexOf(b.label)
    )
}

function buildCurrentOpportunities(
  records: LineRecord[]
) {
  const seen = new Set<string>()

  return records
    .filter((record) => {
      const key = [
        record.sportKey,
        record.gameId,
        record.team,
        record.sportsbook,
        record.market,
      ]
        .join(':')
        .toLowerCase()

      if (seen.has(key)) return false

      seen.add(key)

      return (
        record.status === 'pending' ||
        record.status === ''
      )
    })
    .map((record) => {
      const quality = calculateLineQuality(record)

      const urgencyScore = round(
        clamp(
          record.edge * 4 +
            record.ev * 2.5 +
            Math.max(
              quality.valueVsModel,
              0
            ) *
              0.7 +
            (quality.staleLine ? 15 : 0),
          0,
          100
        )
      )

      const recommendation =
        urgencyScore >= 75
          ? 'BET_NOW'
          : urgencyScore >= 55
            ? 'PLAYABLE'
            : urgencyScore >= 35
              ? 'WAIT'
              : 'PASS'

      return {
        id: record.id,
        sportKey: record.sportKey,
        gameId: record.gameId,
        team: record.team,
        opponent: record.opponent,
        sportsbook: record.sportsbook,
        market: record.market,
        commenceTime: record.commenceTime,
        currentOdds: record.currentOdds,
        openingOdds: record.openingOdds,
        closingOdds: record.closingOdds,
        projectedClosingOdds:
          quality.modelFairOdds,
        edge: record.edge,
        ev: record.ev,
        clvPercent: quality.clvPercent,
        movementCents:
          quality.movementCents,
        valueVsModel:
          quality.valueVsModel,
        staleLine: quality.staleLine,
        favorableLine:
          quality.favorableLine,
        urgencyScore,
        recommendation,
      }
    })
    .sort(
      (a, b) =>
        b.urgencyScore - a.urgencyScore
    )
    .slice(0, 20)
}

export async function getClosingLineIntelligence({
  sportKey = 'all',
  limit = 2500,
}: {
  sportKey?: string
  limit?: number
} = {}) {
  let query = supabaseAdmin
    .from('prediction_history')
    .select('*')
    .order('created_at', {
      ascending: false,
    })
    .limit(clamp(limit, 100, 5000))

  if (sportKey !== 'all') {
    query = query.eq('sport_key', sportKey)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const records = (
    (data ?? []) as GenericPredictionRow[]
  )
    .map(normalizeRow)
    .filter(
      (record) =>
        record.team !== 'Unknown' &&
        record.currentOdds !== 0
    )

  const recordsWithClosingLine = records.filter(
    (record) => record.closingOdds !== null
  )

  const settledRecords = records.filter(
    (record) =>
      record.status === 'settled' ||
      record.result === 'win' ||
      record.result === 'loss' ||
      record.result === 'push'
  )

  const analyticalSample =
    recordsWithClosingLine.length > 0
      ? recordsWithClosingLine
      : settledRecords.length > 0
        ? settledRecords
        : records

  const sportsbookStats =
    buildSportsbookStats(analyticalSample)

  const timingStats =
    buildTimingStats(analyticalSample)

  const opportunities =
    buildCurrentOpportunities(records)

  const allClv = analyticalSample.map(
    (record) =>
      calculateLineQuality(record).clvPercent
  )

  const positiveClvCount = allClv.filter(
    (value) => value > 0
  ).length

  const averageClv =
    allClv.length > 0
      ? allClv.reduce(
          (sum, value) => sum + value,
          0
        ) / allClv.length
      : 0

  const averageMovement =
    analyticalSample.length > 0
      ? analyticalSample.reduce(
          (sum, record) =>
            sum +
            calculateLineQuality(record)
              .movementCents,
          0
        ) / analyticalSample.length
      : 0

  const bestTimingWindow =
    [...timingStats].sort(
      (a, b) =>
        b.averageClv - a.averageClv ||
        b.positiveClvRate -
          a.positiveClvRate
    )[0] ?? null

  const bestSportsbook =
    sportsbookStats[0] ?? null

  const dataQuality =
    recordsWithClosingLine.length >= 100
      ? 'STRONG'
      : recordsWithClosingLine.length >= 25
        ? 'MODERATE'
        : records.length >= 25
          ? 'ESTIMATED'
          : 'INSUFFICIENT'

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    sportKey,
    mode: 'closing_line_intelligence_v1',

    dataQuality: {
      level: dataQuality,
      totalRecords: records.length,
      settledRecords: settledRecords.length,
      recordsWithClosingLine:
        recordsWithClosingLine.length,
      usesEstimatedClose:
        recordsWithClosingLine.length === 0,
      message:
        recordsWithClosingLine.length > 0
          ? 'Closing-line fields were found and used for CLV analysis.'
          : 'No dedicated closing-line field was found. Current or latest available odds are being used as an interim estimate.',
    },

    summary: {
      samples: analyticalSample.length,
      averageClv: round(averageClv),
      positiveClvRate: round(
        (positiveClvCount /
          Math.max(allClv.length, 1)) *
          100
      ),
      averageMovementCents: round(
        averageMovement
      ),
      sportsbooksTracked:
        sportsbookStats.length,
      currentOpportunities:
        opportunities.length,
      betNowOpportunities:
        opportunities.filter(
          (item) =>
            item.recommendation ===
            'BET_NOW'
        ).length,
      bestSportsbook,
      bestTimingWindow,
    },

    sportsbookStats,
    timingStats,
    opportunities,
  }
}