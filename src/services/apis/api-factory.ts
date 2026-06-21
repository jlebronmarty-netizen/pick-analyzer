import { getOddsApiSports } from './odds-api'
import { testApiSportsConnection } from './api-sports'

export async function testSportsApiProviders() {
  const oddsApiSports = await getOddsApiSports()
  const apiSportsStatus = await testApiSportsConnection()

  return {
    oddsApi: {
      connected: true,
      sportsCount: oddsApiSports.length,
      sampleSports: oddsApiSports.slice(0, 10),
    },
    apiSports: {
      connected: true,
      status: apiSportsStatus,
    },
  }
}