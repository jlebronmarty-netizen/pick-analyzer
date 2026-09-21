import fs from 'node:fs'
import path from 'node:path'

function arg(name, fallback = null) {
  const prefix = `--${name}=`
  const hit = process.argv.find((value) => value.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : fallback
}

function finite(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function median(values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!xs.length) return null
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
}

function percentile(values, p) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!xs.length) return null
  const idx = Math.min(xs.length - 1, Math.max(0, Math.floor((xs.length - 1) * p)))
  return xs[idx]
}

const input = arg('input')
const output = arg('output', 'sbr-fullgame-totals-audit.json')
if (!input) throw new Error('INPUT_REQUIRED')

const raw = fs.readFileSync(input, 'utf8')
const payload = JSON.parse(raw)
if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('TOP_LEVEL_OBJECT_REQUIRED')

const dates = Object.keys(payload).sort()
const byYear = {}
const books = new Map()
const movements = []
const absMovements = []
const openingBookCounts = []
const closingBookCounts = []
const bothBookCounts = []
let totalGames = 0
let regularGames = 0
let scoreComplete = 0
let totalsAny = 0
let totalsOpeningAny = 0
let totalsClosingAny = 0
let totalsBothAny = 0
let totalsBoth2Plus = 0
let totalsBoth3Plus = 0
let nonPushClosingSettlements = 0
let pushesClosing = 0
let malformedDates = 0

for (const date of dates) {
  const year = String(date).slice(0, 4)
  if (!/^20\d{2}$/.test(year)) malformedDates += 1
  const games = Array.isArray(payload[date]) ? payload[date] : []
  for (const game of games) {
    totalGames += 1
    const view = game?.gameView ?? {}
    const isRegular = String(view?.gameType ?? '') === 'R'
    if (isRegular) {
      regularGames += 1
      byYear[year] ??= {
        games: 0,
        scoreComplete: 0,
        totalsAny: 0,
        openingAny: 0,
        closingAny: 0,
        bothAny: 0,
        both2Plus: 0,
        both3Plus: 0,
      }
      byYear[year].games += 1
    }

    const awayScore = finite(view?.awayTeamScore)
    const homeScore = finite(view?.homeTeamScore)
    const hasScore = awayScore !== null && homeScore !== null
    if (isRegular && hasScore) {
      scoreComplete += 1
      byYear[year].scoreComplete += 1
    }

    const rows = Array.isArray(game?.odds?.totals) ? game.odds.totals : []
    if (!isRegular) continue
    if (rows.length) {
      totalsAny += 1
      byYear[year].totalsAny += 1
    }

    const openingLines = []
    const closingLines = []
    let openBooks = 0
    let closeBooks = 0
    let bothBooks = 0

    for (const row of rows) {
      const sportsbook = String(row?.sportsbook ?? '').trim().toLowerCase() || 'unknown'
      const openLine = finite(row?.openingLine?.total)
      const openOver = finite(row?.openingLine?.overOdds)
      const openUnder = finite(row?.openingLine?.underOdds)
      const closeLine = finite(row?.currentLine?.total)
      const closeOver = finite(row?.currentLine?.overOdds)
      const closeUnder = finite(row?.currentLine?.underOdds)

      const openValid = openLine !== null && openOver !== null && openUnder !== null
      const closeValid = closeLine !== null && closeOver !== null && closeUnder !== null
      if (openValid) {
        openBooks += 1
        openingLines.push(openLine)
      }
      if (closeValid) {
        closeBooks += 1
        closingLines.push(closeLine)
      }
      if (openValid && closeValid) bothBooks += 1

      if (openValid || closeValid) {
        const s = books.get(sportsbook) ?? { rows: 0, openingComplete: 0, closingComplete: 0, bothComplete: 0 }
        s.rows += 1
        if (openValid) s.openingComplete += 1
        if (closeValid) s.closingComplete += 1
        if (openValid && closeValid) s.bothComplete += 1
        books.set(sportsbook, s)
      }
    }

    openingBookCounts.push(openBooks)
    closingBookCounts.push(closeBooks)
    bothBookCounts.push(bothBooks)

    if (openBooks > 0) {
      totalsOpeningAny += 1
      byYear[year].openingAny += 1
    }
    if (closeBooks > 0) {
      totalsClosingAny += 1
      byYear[year].closingAny += 1
    }
    if (bothBooks > 0) {
      totalsBothAny += 1
      byYear[year].bothAny += 1
    }
    if (bothBooks >= 2) {
      totalsBoth2Plus += 1
      byYear[year].both2Plus += 1
    }
    if (bothBooks >= 3) {
      totalsBoth3Plus += 1
      byYear[year].both3Plus += 1
    }

    const openConsensus = median(openingLines)
    const closeConsensus = median(closingLines)
    if (openConsensus !== null && closeConsensus !== null) {
      const delta = closeConsensus - openConsensus
      movements.push(delta)
      absMovements.push(Math.abs(delta))
      if (hasScore) {
        const finalTotal = awayScore + homeScore
        if (finalTotal === closeConsensus) pushesClosing += 1
        else nonPushClosingSettlements += 1
      }
    }
  }
}

for (const [year, row] of Object.entries(byYear)) {
  row.scoreCoverage = row.games ? row.scoreComplete / row.games : null
  row.totalsCoverage = row.games ? row.totalsAny / row.games : null
  row.openingCoverage = row.games ? row.openingAny / row.games : null
  row.closingCoverage = row.games ? row.closingAny / row.games : null
  row.bothCoverage = row.games ? row.bothAny / row.games : null
  row.both2PlusCoverage = row.games ? row.both2Plus / row.games : null
  row.both3PlusCoverage = row.games ? row.both3Plus / row.games : null
}

const bookSummary = [...books.entries()]
  .map(([sportsbook, row]) => ({ sportsbook, ...row }))
  .sort((a, b) => b.bothComplete - a.bothComplete || a.sportsbook.localeCompare(b.sportsbook))

const summary = {
  schema: 'mlb-sbr-fullgame-totals-audit/1.0.0',
  source: {
    repository: 'ArnavSaraogi/mlb-odds-scraper',
    releaseTag: 'dataset',
    asset: 'mlb_odds_dataset.json',
    declaredDateRange: ['2021-04-01', '2025-08-16'],
    declaredMarkets: ['moneyline', 'pointspread', 'totals'],
    declaredBooks: ['betmgm', 'fanduel', 'caesars', 'bet365', 'draftkings', 'betrivers'],
    licenseFoundInRepository: false,
    rawDatasetPersistedByThisAudit: false,
    redistributionAuthorizedByThisAudit: false,
  },
  observed: {
    dateKeys: dates.length,
    minDate: dates[0] ?? null,
    maxDate: dates.at(-1) ?? null,
    malformedDates,
    totalGames,
    regularGames,
    scoreComplete,
    totalsAny,
    totalsOpeningAny,
    totalsClosingAny,
    totalsBothAny,
    totalsBoth2Plus,
    totalsBoth3Plus,
    byYear,
    sportsbookCount: bookSummary.length,
    sportsbooks: bookSummary,
    bookCountDistribution: {
      openingMedian: median(openingBookCounts),
      closingMedian: median(closingBookCounts),
      bothMedian: median(bothBookCounts),
      bothP10: percentile(bothBookCounts, 0.10),
      bothP90: percentile(bothBookCounts, 0.90),
    },
    consensusMovement: {
      games: movements.length,
      median: median(movements),
      p10: percentile(movements, 0.10),
      p90: percentile(movements, 0.90),
      absMedian: median(absMovements),
      absP90: percentile(absMovements, 0.90),
    },
    closingSettlementSupport: {
      nonPushGames: nonPushClosingSettlements,
      pushes: pushesClosing,
    },
  },
  researchDisposition: {
    eligibleForRawRedistribution: false,
    candidateUse: 'EPHEMERAL_RESEARCH_ONLY',
    potentialNewInformationSurface: [
      'multi_book_opening_total_consensus',
      'multi_book_closing_total_consensus',
      'open_to_close_total_movement',
      'sportsbook_dispersion',
      'multi_book_price_balance',
    ],
    periodMarketsPresent: false,
    note: 'Use only as an ephemeral third-party historical research surface unless licensing/provenance requirements are separately resolved.',
  },
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
