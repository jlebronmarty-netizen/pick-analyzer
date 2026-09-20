export const MLB_RUNLINE_V2_CORE_MODEL = 'rl_v2_core_fixed_v1' as const
export const MLB_RUNLINE_V2_TRANSFER_MODEL = 'rl_v2_transfer_fixed_v1' as const
export const MLB_RUNLINE_V2_BROAD_MODEL = 'rl_v2_broad_union_fixed_v1' as const
export const MLB_RUNLINE_V2_STANDARD_FREEZE_VERSION = 'MLB_RUNLINE_V2_STANDARD_FORWARD_FREEZE_V1' as const
export const MLB_RUNLINE_V2_STANDARD_MARKET_POLICY = 'MLB_RUNLINE_MARKET_2026_V1_EARLIEST_CAPTURED_PAIRED_MODAL_PROXY' as const

export const MLB_RUNLINE_V2_MARKET_MU = 0.57629591863738
export const MLB_RUNLINE_V2_MARKET_SD = 0.0754955595992703
export const MLB_RUNLINE_V2_CORE_THRESHOLD = 1.0002553572466371
export const MLB_RUNLINE_V2_TRANSFER_THRESHOLD = 0.889684454234473

export type StandardRunlineOpeningRow = {
  sportsbook: string
  snapshotTime: string
  outcome: 'home' | 'away'
  line: number
  price: number
}

export type StandardRunlineMarketProxy = {
  homeLine: number
  awayLine: number
  homePriceAvg: number
  awayPriceAvg: number
  books: number
  earliestSnapshotAt: string
  latestBookOpenSnapshotAt: string
  dogSide: 'HOME' | 'AWAY' | null
  marketPDog: number | null
  marketZV2: number | null
  marketEligible: boolean
}

type BookOpen = {
  sportsbook: string
  snapshotTime: string
  homeLine: number
  awayLine: number
  homePrice: number
  awayPrice: number
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function americanImplied(price: number) {
  if (!finite(price) || price === 0) return null
  return price < 0 ? -price / (-price + 100) : 100 / (price + 100)
}

export function buildStandardRunlineOpeningProxy(rows: StandardRunlineOpeningRow[]): StandardRunlineMarketProxy | null {
  const byBookTs = new Map<string, { sportsbook: string; snapshotTime: string; home?: StandardRunlineOpeningRow; away?: StandardRunlineOpeningRow }>()
  for (const row of rows) {
    if (!row?.sportsbook || !row?.snapshotTime || (row.outcome !== 'home' && row.outcome !== 'away')) continue
    if (!finite(row.line) || !finite(row.price)) continue
    const key = `${row.sportsbook}|${row.snapshotTime}`
    const bucket = byBookTs.get(key) ?? { sportsbook: row.sportsbook, snapshotTime: row.snapshotTime }
    bucket[row.outcome] = row
    byBookTs.set(key, bucket)
  }

  const firstByBook = new Map<string, BookOpen>()
  const complete = [...byBookTs.values()]
    .filter((bucket) => bucket.home && bucket.away)
    .sort((a, b) => Date.parse(a.snapshotTime) - Date.parse(b.snapshotTime) || a.sportsbook.localeCompare(b.sportsbook))
  for (const bucket of complete) {
    if (firstByBook.has(bucket.sportsbook)) continue
    firstByBook.set(bucket.sportsbook, {
      sportsbook: bucket.sportsbook,
      snapshotTime: new Date(bucket.snapshotTime).toISOString(),
      homeLine: Number(bucket.home!.line),
      awayLine: Number(bucket.away!.line),
      homePrice: Number(bucket.home!.price),
      awayPrice: Number(bucket.away!.price),
    })
  }

  const groups = new Map<string, BookOpen[]>()
  for (const row of firstByBook.values()) {
    if (row.homeLine !== -row.awayLine) continue
    const key = `${row.homeLine}|${row.awayLine}`
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  if (!groups.size) return null

  const candidates = [...groups.values()].map((bookRows) => {
    const sorted = [...bookRows].sort((a, b) => Date.parse(a.snapshotTime) - Date.parse(b.snapshotTime))
    return {
      bookRows,
      books: bookRows.length,
      homeLine: bookRows[0].homeLine,
      awayLine: bookRows[0].awayLine,
      earliest: sorted[0].snapshotTime,
      latest: sorted.at(-1)!.snapshotTime,
    }
  })
  candidates.sort((a, b) =>
    b.books - a.books
    || Date.parse(a.latest) - Date.parse(b.latest)
    || Date.parse(a.earliest) - Date.parse(b.earliest)
    || a.homeLine - b.homeLine
  )
  const selected = candidates[0]
  const homePriceAvg = selected.bookRows.reduce((sum, row) => sum + row.homePrice, 0) / selected.books
  const awayPriceAvg = selected.bookRows.reduce((sum, row) => sum + row.awayPrice, 0) / selected.books
  const marketEligible = Math.abs(selected.homeLine) === 1.5
    && Math.abs(selected.awayLine) === 1.5
    && selected.homeLine === -selected.awayLine

  let dogSide: 'HOME' | 'AWAY' | null = null
  let marketPDog: number | null = null
  let marketZV2: number | null = null
  if (marketEligible) {
    dogSide = selected.homeLine === 1.5 ? 'HOME' : 'AWAY'
    const homeImp = americanImplied(homePriceAvg)
    const awayImp = americanImplied(awayPriceAvg)
    if (homeImp !== null && awayImp !== null && homeImp + awayImp > 0) {
      marketPDog = dogSide === 'HOME' ? homeImp / (homeImp + awayImp) : awayImp / (homeImp + awayImp)
      marketZV2 = (marketPDog - MLB_RUNLINE_V2_MARKET_MU) / MLB_RUNLINE_V2_MARKET_SD
    }
  }

  return {
    homeLine: selected.homeLine,
    awayLine: selected.awayLine,
    homePriceAvg,
    awayPriceAvg,
    books: selected.books,
    earliestSnapshotAt: selected.earliest,
    latestBookOpenSnapshotAt: selected.latest,
    dogSide,
    marketPDog,
    marketZV2,
    marketEligible: Boolean(marketEligible && dogSide && marketPDog !== null && marketZV2 !== null),
  }
}

export type StandardRunlineDecisionInput = {
  market: StandardRunlineMarketProxy | null
  recentFormDog: number | null
  historyDog: number | null
  fatigueTravelDog: number | null
  dogFavHand: string | null
}

export function evaluateStandardRunlineV2(input: StandardRunlineDecisionInput) {
  const market = input.market
  const coreScore = finite(input.recentFormDog) && finite(input.fatigueTravelDog)
    ? (input.recentFormDog + input.fatigueTravelDog) / Math.sqrt(2)
    : null
  const transferScore = market && finite(market.marketZV2) && finite(input.historyDog) && finite(input.fatigueTravelDog)
    ? (market.marketZV2 + input.historyDog + input.fatigueTravelDog) / Math.sqrt(3)
    : null

  const coreEvaluable = Boolean(market?.marketEligible && finite(market?.marketPDog) && finite(coreScore))
  const transferEvaluable = Boolean(market?.marketEligible && finite(transferScore) && input.dogFavHand)

  const coreSelected = Boolean(
    coreEvaluable
    && market!.marketPDog! >= 0.54
    && market!.marketPDog! < 0.58
    && coreScore! >= MLB_RUNLINE_V2_CORE_THRESHOLD,
  )
  const transferSelected = Boolean(
    transferEvaluable
    && input.dogFavHand === 'L/R'
    && transferScore! >= MLB_RUNLINE_V2_TRANSFER_THRESHOLD,
  )

  return {
    coreScore,
    transferScore,
    coreEvaluable,
    transferEvaluable,
    coreSelected,
    transferSelected,
    broadSelected: coreSelected || transferSelected,
  }
}
