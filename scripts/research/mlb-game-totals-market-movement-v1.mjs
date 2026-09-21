import fs from 'node:fs'
import path from 'node:path'

const INPUT = process.argv.find((x) => x.startsWith('--input='))?.slice('--input='.length)
const OUTPUT = process.argv.find((x) => x.startsWith('--output='))?.slice('--output='.length) ?? 'totals-market-movement-v1.json'
if (!INPUT) throw new Error('INPUT_REQUIRED')

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mean(xs) {
  const ys = xs.filter(Number.isFinite)
  return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null
}

function median(xs) {
  const ys = xs.filter(Number.isFinite).sort((a, b) => a - b)
  if (!ys.length) return null
  const m = Math.floor(ys.length / 2)
  return ys.length % 2 ? ys[m] : (ys[m - 1] + ys[m]) / 2
}

function impliedAmerican(price) {
  const p = num(price)
  if (p === null || p === 0) return null
  return p < 0 ? (-p) / ((-p) + 100) : 100 / (p + 100)
}

function noVigOver(overPrice, underPrice) {
  const po = impliedAmerican(overPrice)
  const pu = impliedAmerican(underPrice)
  if (po === null || pu === null || po + pu <= 0) return null
  return po / (po + pu)
}

function sign(v, eps = 1e-9) {
  if (v > eps) return 1
  if (v < -eps) return -1
  return 0
}

function avgLast(history, key, n = 10) {
  const tail = history.slice(-n)
  return mean(tail.map((x) => x[key]))
}

function monthKey(date) {
  return String(date).slice(0, 7)
}

function pct(v) {
  return v === null ? null : Number((100 * v).toFixed(2))
}

const payload = JSON.parse(fs.readFileSync(INPUT, 'utf8'))
const games = []
for (const date of Object.keys(payload).sort()) {
  for (const game of Array.isArray(payload[date]) ? payload[date] : []) {
    const view = game?.gameView ?? {}
    if (String(view?.gameType ?? '') !== 'R') continue
    const start = String(view?.startDate ?? '')
    const home = String(view?.homeTeam?.shortName ?? '').trim()
    const away = String(view?.awayTeam?.shortName ?? '').trim()
    const homeScore = num(view?.homeTeamScore)
    const awayScore = num(view?.awayTeamScore)
    if (!start || !home || !away || homeScore === null || awayScore === null) continue
    games.push({ date, start, home, away, homeScore, awayScore, totals: Array.isArray(game?.odds?.totals) ? game.odds.totals : [] })
  }
}
games.sort((a, b) => a.start.localeCompare(b.start) || a.home.localeCompare(b.home))

const teamHistory = new Map()
const rows = []

for (const game of games) {
  const homeHist = teamHistory.get(game.home) ?? []
  const awayHist = teamHistory.get(game.away) ?? []

  const totalRows = game.totals
  const openLines = []
  const closeLines = []
  const openProbs = []
  const closeProbs = []
  const perBookMoves = []

  for (const r of totalRows) {
    const ol = num(r?.openingLine?.total)
    const cl = num(r?.currentLine?.total)
    const op = noVigOver(r?.openingLine?.overOdds, r?.openingLine?.underOdds)
    const cp = noVigOver(r?.currentLine?.overOdds, r?.currentLine?.underOdds)
    if (ol !== null) openLines.push(ol)
    if (cl !== null) closeLines.push(cl)
    if (op !== null) openProbs.push(op)
    if (cp !== null) closeProbs.push(cp)
    if (ol !== null && cl !== null) perBookMoves.push(cl - ol)
  }

  if (homeHist.length >= 10 && awayHist.length >= 10 && openLines.length >= 2 && closeLines.length >= 2) {
    const homeOff = avgLast(homeHist, 'rf')
    const homeDef = avgLast(homeHist, 'ra')
    const awayOff = avgLast(awayHist, 'rf')
    const awayDef = avgLast(awayHist, 'ra')
    const predictedHome = (homeOff + awayDef) / 2
    const predictedAway = (awayOff + homeDef) / 2
    const predictedTotal = predictedHome + predictedAway
    const openLine = median(openLines)
    const closeLine = median(closeLines)
    const movement = closeLine - openLine
    const openOverProb = median(openProbs)
    const closeOverProb = median(closeProbs)
    const openBias = openOverProb === null ? 0 : openOverProb - 0.5
    const closeBias = closeOverProb === null ? 0 : closeOverProb - 0.5
    const nonZeroMoves = perBookMoves.filter((v) => sign(v) !== 0)
    const moveSign = sign(movement)
    const moveAgreement = nonZeroMoves.length && moveSign
      ? nonZeroMoves.filter((v) => sign(v) === moveSign).length / nonZeroMoves.length
      : 0
    const openDispersion = Math.max(...openLines) - Math.min(...openLines)
    const closeDispersion = Math.max(...closeLines) - Math.min(...closeLines)

    rows.push({
      date: game.date,
      year: Number(String(game.date).slice(0, 4)),
      month: monthKey(game.date),
      finalTotal: game.homeScore + game.awayScore,
      predictedTotal,
      openLine,
      closeLine,
      edgeOpen: predictedTotal - openLine,
      edgeClose: predictedTotal - closeLine,
      movement,
      openBias,
      closeBias,
      moveAgreement,
      openDispersion,
      closeDispersion,
      bookCount: Math.min(openLines.length, closeLines.length),
    })
  }

  homeHist.push({ rf: game.homeScore, ra: game.awayScore })
  awayHist.push({ rf: game.awayScore, ra: game.homeScore })
  teamHistory.set(game.home, homeHist)
  teamHistory.set(game.away, awayHist)
}

function pickFromDirection(direction, row, lineSource) {
  if (!direction) return null
  const line = lineSource === 'open' ? row.openLine : row.closeLine
  return { side: direction > 0 ? 'OVER' : 'UNDER', line }
}

const candidates = []
for (const t of [1.5, 2.0, 2.5, 3.0, 3.5]) {
  candidates.push({
    id: `open_edge_t${String(t).replace('.', 'p')}`,
    family: 'ROLLING_EDGE_OPEN',
    select: (r) => Math.abs(r.edgeOpen) >= t ? pickFromDirection(sign(r.edgeOpen), r, 'open') : null,
  })
  candidates.push({
    id: `close_edge_t${String(t).replace('.', 'p')}`,
    family: 'ROLLING_EDGE_CLOSE',
    select: (r) => Math.abs(r.edgeClose) >= t ? pickFromDirection(sign(r.edgeClose), r, 'close') : null,
  })
}
for (const t of [1.5, 2.0, 2.5]) {
  for (const m of [0.5, 1.0]) {
    candidates.push({
      id: `edge_move_agree_t${String(t).replace('.', 'p')}_m${String(m).replace('.', 'p')}`,
      family: 'ROLLING_EDGE_MOVEMENT_AGREEMENT',
      select: (r) => {
        const d = sign(r.edgeClose)
        return Math.abs(r.edgeClose) >= t && Math.abs(r.movement) >= m && d !== 0 && d === sign(r.movement)
          ? pickFromDirection(d, r, 'close') : null
      },
    })
  }
  for (const p of [0.01, 0.02]) {
    candidates.push({
      id: `edge_price_agree_t${String(t).replace('.', 'p')}_p${String(p).replace('.', 'p')}`,
      family: 'ROLLING_EDGE_PRICE_AGREEMENT',
      select: (r) => {
        const d = sign(r.edgeClose)
        return Math.abs(r.edgeClose) >= t && Math.abs(r.closeBias) >= p && d !== 0 && d === sign(r.closeBias)
          ? pickFromDirection(d, r, 'close') : null
      },
    })
    candidates.push({
      id: `triple_agree_t${String(t).replace('.', 'p')}_m0p5_p${String(p).replace('.', 'p')}`,
      family: 'ROLLING_EDGE_MOVEMENT_PRICE_TRIPLE',
      select: (r) => {
        const d = sign(r.edgeClose)
        return Math.abs(r.edgeClose) >= t && Math.abs(r.movement) >= 0.5 && Math.abs(r.closeBias) >= p &&
          d !== 0 && d === sign(r.movement) && d === sign(r.closeBias)
          ? pickFromDirection(d, r, 'close') : null
      },
    })
    candidates.push({
      id: `triple_consensus_t${String(t).replace('.', 'p')}_p${String(p).replace('.', 'p')}`,
      family: 'ROLLING_EDGE_TRIPLE_BOOK_AGREEMENT',
      select: (r) => {
        const d = sign(r.edgeClose)
        return Math.abs(r.edgeClose) >= t && Math.abs(r.movement) >= 0.5 && Math.abs(r.closeBias) >= p &&
          r.moveAgreement >= 0.75 && r.closeDispersion <= 0.5 &&
          d !== 0 && d === sign(r.movement) && d === sign(r.closeBias)
          ? pickFromDirection(d, r, 'close') : null
      },
    })
  }
}
for (const m of [0.5, 1.0]) {
  for (const p of [0.01, 0.02]) {
    candidates.push({
      id: `market_steam_m${String(m).replace('.', 'p')}_p${String(p).replace('.', 'p')}`,
      family: 'MARKET_STEAM',
      select: (r) => {
        const d = sign(r.movement)
        return Math.abs(r.movement) >= m && Math.abs(r.closeBias) >= p && d !== 0 && d === sign(r.closeBias)
          ? pickFromDirection(d, r, 'close') : null
      },
    })
  }
  candidates.push({
    id: `market_fade_m${String(m).replace('.', 'p')}`,
    family: 'MARKET_MOVE_FADE',
    select: (r) => Math.abs(r.movement) >= m ? pickFromDirection(-sign(r.movement), r, 'close') : null,
  })
}
for (const t of [1.5, 2.0, 2.5, 3.0]) {
  candidates.push({
    id: `under_only_edge_t${String(t).replace('.', 'p')}`,
    family: 'ROLLING_EDGE_UNDER_ONLY',
    select: (r) => r.edgeClose <= -t ? { side: 'UNDER', line: r.closeLine } : null,
  })
  candidates.push({
    id: `over_only_edge_t${String(t).replace('.', 'p')}`,
    family: 'ROLLING_EDGE_OVER_ONLY',
    select: (r) => r.edgeClose >= t ? { side: 'OVER', line: r.closeLine } : null,
  })
}

function evaluate(candidate, dataset) {
  let selected = 0
  let pushes = 0
  let correct = 0
  let wrong = 0
  const byYear = {}
  const byMonth = {}
  for (const r of dataset) {
    const pick = candidate.select(r)
    if (!pick) continue
    selected += 1
    const y = String(r.year)
    const m = r.month
    byYear[y] ??= { correct: 0, wrong: 0, pushes: 0, selected: 0 }
    byMonth[m] ??= { correct: 0, wrong: 0, pushes: 0, selected: 0 }
    byYear[y].selected += 1
    byMonth[m].selected += 1
    if (r.finalTotal === pick.line) {
      pushes += 1
      byYear[y].pushes += 1
      byMonth[m].pushes += 1
      continue
    }
    const hit = pick.side === 'OVER' ? r.finalTotal > pick.line : r.finalTotal < pick.line
    if (hit) {
      correct += 1
      byYear[y].correct += 1
      byMonth[m].correct += 1
    } else {
      wrong += 1
      byYear[y].wrong += 1
      byMonth[m].wrong += 1
    }
  }
  const nonPush = correct + wrong
  const accuracy = nonPush ? correct / nonPush : null
  for (const row of Object.values(byYear)) {
    const n = row.correct + row.wrong
    row.nonPush = n
    row.accuracy = n ? row.correct / n : null
  }
  for (const row of Object.values(byMonth)) {
    const n = row.correct + row.wrong
    row.nonPush = n
    row.accuracy = n ? row.correct / n : null
  }
  const yearAccs = Object.values(byYear).filter((x) => x.nonPush >= 20 && x.accuracy !== null).map((x) => x.accuracy)
  const monthAccs = Object.values(byMonth).filter((x) => x.nonPush >= 5 && x.accuracy !== null).map((x) => x.accuracy)
  return {
    id: candidate.id,
    family: candidate.family,
    selected,
    pushes,
    nonPush,
    correct,
    wrong,
    accuracy,
    coverage: dataset.length ? selected / dataset.length : 0,
    worstYearAccuracy: yearAccs.length ? Math.min(...yearAccs) : null,
    worstQualifiedMonthAccuracy: monthAccs.length ? Math.min(...monthAccs) : null,
    qualifiedMonthCount: monthAccs.length,
    byYear,
    byMonth,
  }
}

const devRows = rows.filter((r) => r.year >= 2021 && r.year <= 2024)
const externalRows = rows.filter((r) => r.year === 2025)

const devResults = candidates.map((candidate) => evaluate(candidate, devRows))
const eligible = devResults.filter((r) => {
  const yearN = ['2021','2022','2023','2024'].every((y) => (r.byYear[y]?.nonPush ?? 0) >= 20)
  return r.nonPush >= 150 && r.coverage >= 0.02 && yearN && (r.worstYearAccuracy ?? 0) >= 0.50
}).sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0) || b.nonPush - a.nonPush || a.id.localeCompare(b.id))

const championDev = eligible[0] ?? null
let external = null
let frozenCandidate = null
if (championDev) {
  frozenCandidate = candidates.find((c) => c.id === championDev.id)
  external = evaluate(frozenCandidate, externalRows)
}

const devTargetMet = Boolean(
  championDev &&
  (championDev.accuracy ?? 0) >= 0.75 &&
  (championDev.worstYearAccuracy ?? 0) >= 0.60 &&
  championDev.nonPush >= 150
)
const externalTargetMet = Boolean(
  external &&
  external.nonPush >= 50 &&
  (external.accuracy ?? 0) >= 0.75 &&
  (external.worstQualifiedMonthAccuracy ?? 0) >= 0.60
)

const topDevelopment = [...devResults]
  .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0) || b.nonPush - a.nonPush)
  .slice(0, 20)

const out = {
  schema: 'mlb-game-totals-market-movement-v1/1.0.0',
  state: 'RESEARCH_ONLY_THIRD_PARTY_EPHEMERAL',
  source: {
    repository: 'ArnavSaraogi/mlb-odds-scraper',
    releaseAsset: 'mlb_odds_dataset.json',
    licenseFoundInRepository: false,
    rawPersisted: false,
    exactClosingTimestampAvailable: false,
    sourceClaim: 'README describes currentLine as historical closing odds',
  },
  protocol: {
    developmentYears: [2021, 2022, 2023, 2024],
    externalYear: 2025,
    externalAvailableThrough: '2025-08-16',
    rollingTeamWindow: 10,
    candidateCount: candidates.length,
    candidateSelectionUsesExternal2025: false,
    developmentEligibility: {
      minimumNonPush: 150,
      minimumCoverage: 0.02,
      minimumNonPushPerDevelopmentYear: 20,
      minimumWorstYearAccuracy: 0.50,
    },
    targetGate: {
      accuracy: 0.75,
      developmentWorstYearAccuracy: 0.60,
      externalWorstQualifiedMonthAccuracy: 0.60,
    },
  },
  data: {
    featureRows: rows.length,
    developmentRows: devRows.length,
    externalRows: externalRows.length,
  },
  champion: championDev ? {
    id: championDev.id,
    family: championDev.family,
    development: championDev,
    developmentTargetMet: devTargetMet,
    external2025: external,
    externalTargetMet,
  } : null,
  topDevelopment,
  disposition: !championDev
    ? 'NO_DEVELOPMENT_CANDIDATE_MET_MINIMUM_SAMPLE_STABILITY_GATE_EXTERNAL_UNOPENED'
    : externalTargetMet
      ? 'TARGET_MET_75_PLUS_THIRD_PARTY_RESEARCH_ONLY_NOT_CERTIFIED'
      : 'BELOW_75_EXTERNAL_PRESERVE_NO_RETUNE',
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify(out, null, 2))
