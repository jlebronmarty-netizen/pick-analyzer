const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4'

export type OddsApiSport = {
  key: string
  group: string
  title: string
  description: string
  active: boolean
  has_outrights: boolean
}

export async function getOddsApiSports(): Promise<OddsApiSport[]> {
  const apiKey = process.env.ODDS_API_KEY

  if (!apiKey) {
    throw new Error('Missing ODDS_API_KEY in .env.local')
  }

  const response = await fetch(`${ODDS_API_BASE_URL}/sports?apiKey=${apiKey}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`The Odds API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}