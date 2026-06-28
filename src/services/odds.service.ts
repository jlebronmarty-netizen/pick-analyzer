export type OddsOutcome = {
  name: string
  price: number
  point?: number
}

export type OddsMarket = {
  key: 'h2h' | 'spreads' | 'totals' | string
  last_update: string
  outcomes: OddsOutcome[]
}

export type Bookmaker = {
  key: string
  title: string
  last_update: string
  markets: OddsMarket[]
}

export type OddsGame = {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: Bookmaker[]
}

export async function getUpcomingOddsGames(
  sport = 'baseball_mlb'
): Promise<OddsGame[]> {
  const response = await fetch(`/api/odds?sport=${sport}`)

  if (!response.ok) {
    throw new Error('Could not load upcoming odds games.')
  }

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'Could not load upcoming odds games.')
  }

  return result.games as OddsGame[]
}