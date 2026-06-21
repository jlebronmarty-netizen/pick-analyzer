const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io'

export async function testApiSportsConnection() {
  const apiKey = process.env.API_SPORTS_KEY

  if (!apiKey) {
    throw new Error('Missing API_SPORTS_KEY in .env.local')
  }

  const response = await fetch(`${API_SPORTS_BASE_URL}/status`, {
    method: 'GET',
    headers: {
      'x-apisports-key': apiKey,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`API-Sports error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}