import crypto from 'node:crypto'

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function fetchSchedule(label, startDate, endDate) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&hydrate=probablePitcher`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${label}: HTTP_${response.status}`)
  const payload = await response.json()
  const games = (payload.dates ?? []).flatMap((date) => date.games ?? [])
  return {
    label,
    url,
    games: games.map((game) => ({
      gamePk: Number(game.gamePk),
      officialDate: game.officialDate ?? null,
      digest: sha256(stable(game)),
    })),
  }
}

const historicalGamePks = new Set([822853,823095,823337,823907,824069,824144,824388,824632,824796])

const historicalSeason = await fetchSchedule('historicalSeason', '2026-01-01', '2026-09-03')
const historicalHorizon = await fetchSchedule('historicalHorizon', '2026-09-03', '2026-09-06')
const currentHorizon = await fetchSchedule('currentHorizon', '2026-09-06', '2026-09-09')

const output = {
  mode: 'MLB_DATA_02H_DIGEST_PROOF_READ_ONLY',
  databaseReads: 0,
  databaseWrites: 0,
  historical: [historicalSeason, historicalHorizon].map((source) => ({
    label: source.label,
    url: source.url,
    games: source.games.filter((game) => historicalGamePks.has(game.gamePk)),
  })),
  sep7: currentHorizon.games.filter((game) => game.officialDate === '2026-09-07'),
}

console.log(`MLB_DATA_02H_DIGEST_PROOF=${JSON.stringify(output)}`)
