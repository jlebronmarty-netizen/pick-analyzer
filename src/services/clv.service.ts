import { supabaseAdmin } from '@/lib/supabase-admin'

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string
  home_team: string
  away_team: string
  team: string
  market: string
  sportsbook: string
  odds: number
}

type OddsOutcome = {
  name: string
  price: number
}

type OddsMarket = {
  key: string
  outcomes: OddsOutcome[]
}

type Bookmaker = {
  key?: string
  title: string
  markets: OddsMarket[]
}

type OddsGame = {
  id: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: Bookmaker[]
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function getImpliedProbability(americanOdds: number) {
  if (americanOdds < 0) {
    return round(Math.abs(americanOdds) / (Math.abs(americanOdds) + 100) * 100)
  }

  return round(100 / (americanOdds + 100) * 100)
}

function getClvQuality(clvPercent: number) {
  if (clvPercent >= 3) return 'strong_positive'
  if (clvPercent > 0) return 'positive'
  if (clvPercent <= -3) return 'strong_negative'
  if (clvPercent < 0) return 'negative'

  return 'neutral'
}

function getClvStatus(clvPercent: number) {
  if (clvPercent > 0) return 'won'
  if (clvPercent < 0) return 'lost'

  return 'push'
}

function isSameTeam(a: string, b: string) {
  return normalize(a) === normalize(b)
}

function isSameCommenceTime(a: string, b: string) {
  const first = new Date(a).getTime()
  const second = new Date(b).getTime()

  if (Number.isNaN(first) || Number.isNaN(second)) {
    return false
  }

  return Math.abs(first - second) <= 5 * 60 * 1000
}

function isValidOdds(value: number) {
  if (!Number.isFinite(value)) return false
  if (value === 0) return false

  return value >= -5000 && value <= 5000
}

function isSuspiciousMove(openingOdds: number, closingOdds: number) {
  const openingImplied = getImpliedProbability(openingOdds)
  const closingImplied = getImpliedProbability(closingOdds)

  return Math.abs(closingImplied - openingImplied) > 20
}

async function fetchOddsForSport(sportKey: string) {
  const apiKey = process.env.ODDS_API_KEY

  if (!apiKey) {
    throw new Error('Missing ODDS_API_KEY')
  }

  const url = new URL(`${ODDS_API_BASE_URL}/sports/${sportKey}/odds`)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('regions', 'us')
  url.searchParams.set('markets', 'h2h')
  url.searchParams.set('oddsFormat', 'american')

  const response = await fetch(url.toString(), {
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Odds API error for ${sportKey}: ${details}`)
  }

  return response.json() as Promise<OddsGame[]>
}

function findClosingOdds({
  games,
  pick,
}: {
  games: OddsGame[]
  pick: PredictionRow
}) {
  const game = games.find((item) => {
    return (
      item.id === pick.game_id &&
      isSameTeam(item.home_team, pick.home_team) &&
      isSameTeam(item.away_team, pick.away_team) &&
      isSameCommenceTime(item.commence_time, pick.commence_time)
    )
  })

  if (!game) {
    return {
      closingOdds: null,
      reason: 'Matching game not found',
    }
  }

  const bookmaker = game.bookmakers.find(
    (book) =>
      normalize(book.title) === normalize(pick.sportsbook) ||
      normalize(book.key ?? '') === normalize(pick.sportsbook)
  )

  if (!bookmaker) {
    return {
      closingOdds: null,
      reason: 'Matching sportsbook not found',
    }
  }

  const market = bookmaker.markets.find(
    (item) => item.key === pick.market || item.key === 'h2h'
  )

  if (!market) {
    return {
      closingOdds: null,
      reason: 'Matching market not found',
    }
  }

  const outcome = market.outcomes.find((item) => isSameTeam(item.name, pick.team))

  if (!outcome) {
    return {
      closingOdds: null,
      reason: 'Matching team outcome not found',
    }
  }

  if (!isValidOdds(outcome.price)) {
    return {
      closingOdds: null,
      reason: `Invalid closing odds: ${outcome.price}`,
    }
  }

  if (isSuspiciousMove(pick.odds, outcome.price)) {
    return {
      closingOdds: null,
      reason: `Suspicious CLV move rejected: ${pick.odds} to ${outcome.price}`,
    }
  }

  return {
    closingOdds: outcome.price,
    reason: null,
  }
}

function calculateClv({
  openingOdds,
  closingOdds,
}: {
  openingOdds: number
  closingOdds: number
}) {
  const openingImplied = getImpliedProbability(openingOdds)
  const closingImplied = getImpliedProbability(closingOdds)

  const clvPercent = round(openingImplied - closingImplied)
  const rawLineMove = closingOdds - openingOdds

  return {
    openingImplied,
    closingImplied,
    clvPercent,
    rawLineMove,
    clvStatus: getClvStatus(clvPercent),
    clvQuality: getClvQuality(clvPercent),
  }
}

export async function updateClosingLineValue() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(
      'id, sport_key, game_id, commence_time, home_team, away_team, team, market, sportsbook, odds'
    )
    .eq('status', 'pending')
    .limit(1000)

  if (error) {
    throw new Error(error.message)
  }

  const picks = (data ?? []) as PredictionRow[]

  const sports = [...new Set(picks.map((pick) => pick.sport_key))]
  const oddsBySport = new Map<string, OddsGame[]>()

  for (const sport of sports) {
    try {
      const games = await fetchOddsForSport(sport)
      oddsBySport.set(sport, games)
    } catch (error) {
      console.error(`CLV odds fetch failed for ${sport}:`, error)
      oddsBySport.set(sport, [])
    }
  }

  const results = []

  for (const pick of picks) {
    const games = oddsBySport.get(pick.sport_key) ?? []
    const closingResult = findClosingOdds({ games, pick })

    if (closingResult.closingOdds === null) {
      results.push({
        id: pick.id,
        success: false,
        team: pick.team,
        reason: closingResult.reason,
      })

      continue
    }

    const openingOdds = pick.odds
    const closingOdds = closingResult.closingOdds

    const clv = calculateClv({
      openingOdds,
      closingOdds,
    })

    const { error: updateError } = await supabaseAdmin
      .from('prediction_history')
      .update({
        opening_odds: openingOdds,
        closing_odds: closingOdds,
        clv: clv.rawLineMove,
        clv_status: clv.clvStatus,
        clv_implied_open: clv.openingImplied,
        clv_implied_close: clv.closingImplied,
        clv_percent: clv.clvPercent,
        clv_quality: clv.clvQuality,
        closing_checked_at: new Date().toISOString(),
      })
      .eq('id', pick.id)

    results.push({
      id: pick.id,
      success: !updateError,
      team: pick.team,
      sportsbook: pick.sportsbook,
      openingOdds,
      closingOdds,
      rawLineMove: clv.rawLineMove,
      openingImplied: clv.openingImplied,
      closingImplied: clv.closingImplied,
      clvPercent: clv.clvPercent,
      clvStatus: clv.clvStatus,
      clvQuality: clv.clvQuality,
      error: updateError?.message,
    })
  }

  const updated = results.filter((item) => item.success).length

  return {
    success: true,
    checked: picks.length,
    updated,
    failed: results.length - updated,
    results,
  }
}