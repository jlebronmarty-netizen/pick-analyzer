import { normalizeBankroll } from '@/services/bankroll.service'
import { getLiveBettingOpportunities } from '@/services/live-betting.service'

type IntelligenceOpportunity = {
  bettingUrgency?: string
  sharpSignal?: boolean
  steamMove?: boolean
  staleLine?: boolean
  lineValue?: number
  valueGap?: number
  urgencyScore?: number
  sharpConfidence?: number
  marketMovementScore?: number
  smartScore?: number
  clvOpportunityScore?: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function average(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value))

  if (!validValues.length) return 0

  return round(
    validValues.reduce((sum, value) => sum + value, 0) / validValues.length
  )
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getClvScore(item: IntelligenceOpportunity) {
  return getNumber(item.clvOpportunityScore) || getNumber(item.urgencyScore)
}

export async function getSportsbookIntelligence({
  sportKey = 'baseball_mlb',
  bankroll = 1000,
}: {
  sportKey?: string
  bankroll?: number
}) {
  const normalizedBankroll = normalizeBankroll(bankroll)

  const result = await getLiveBettingOpportunities({
    sportKey,
    bankroll: normalizedBankroll,
  })

  const opportunities = (result.opportunities ?? []) as IntelligenceOpportunity[]

  const betNow = opportunities.filter(
    (item) => item.bettingUrgency === 'BET_NOW'
  )

  const sharp = opportunities.filter((item) => Boolean(item.sharpSignal))
  const steam = opportunities.filter((item) => Boolean(item.steamMove))
  const stale = opportunities.filter((item) => Boolean(item.staleLine))

  const bestOdds = [...opportunities]
    .sort(
      (a, b) =>
        getNumber(b.lineValue) - getNumber(a.lineValue) ||
        getNumber(b.valueGap) - getNumber(a.valueGap) ||
        getNumber(b.urgencyScore) - getNumber(a.urgencyScore)
    )
    .slice(0, 10)

  const bestClv = [...opportunities]
    .sort(
      (a, b) =>
        getClvScore(b) - getClvScore(a) ||
        getNumber(b.urgencyScore) - getNumber(a.urgencyScore) ||
        getNumber(b.lineValue) - getNumber(a.lineValue)
    )
    .slice(0, 10)

  const sharpMoney = [...sharp]
    .sort(
      (a, b) =>
        getNumber(b.sharpConfidence) - getNumber(a.sharpConfidence) ||
        getNumber(b.marketMovementScore) - getNumber(a.marketMovementScore) ||
        getNumber(b.urgencyScore) - getNumber(a.urgencyScore)
    )
    .slice(0, 10)

  const steamMoves = [...steam]
    .sort(
      (a, b) =>
        getNumber(b.marketMovementScore) - getNumber(a.marketMovementScore) ||
        getNumber(b.valueGap) - getNumber(a.valueGap)
    )
    .slice(0, 10)

  const staleLines = [...stale]
    .sort(
      (a, b) =>
        getNumber(b.valueGap) - getNumber(a.valueGap) ||
        getNumber(b.lineValue) - getNumber(a.lineValue) ||
        getNumber(b.urgencyScore) - getNumber(a.urgencyScore)
    )
    .slice(0, 10)

  const betNowList = [...betNow]
    .sort(
      (a, b) =>
        getNumber(b.urgencyScore) - getNumber(a.urgencyScore) ||
        getNumber(b.sharpConfidence) - getNumber(a.sharpConfidence) ||
        getNumber(b.smartScore) - getNumber(a.smartScore)
    )
    .slice(0, 10)

  return {
    success: true,
    sportKey,
    bankroll: normalizedBankroll,
    generatedAt: new Date().toISOString(),
    summary: {
      gamesChecked: result.summary.gamesChecked,
      sportsbookMarketsChecked: result.summary.sportsbookMarketsChecked,
      opportunities: opportunities.length,
      betNow: betNow.length,
      sharpSignals: sharp.length,
      steamMoves: steam.length,
      staleLines: stale.length,
      averageLineValue: average(
        opportunities.map((item) => getNumber(item.lineValue))
      ),
      averageSharpConfidence: average(
        opportunities.map((item) => getNumber(item.sharpConfidence))
      ),
      averageUrgencyScore: average(
        opportunities.map((item) => getNumber(item.urgencyScore))
      ),
    },
    lists: {
      betNow: betNowList,
      bestOdds,
      bestClv,
      sharpMoney,
      steamMoves,
      staleLines,
    },
  }
}