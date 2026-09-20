import 'server-only'

export type MlbOfficialBatterGameLogRow = {
  gamePk: number
  date: string
  plateAppearances: number
  hits: number
  runs: number
  rbi: number
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function readMlbOfficialBatterGameLog(
  batterMlbamId: number,
  season: number,
): Promise<MlbOfficialBatterGameLogRow[]> {
  const url = new URL(`https://statsapi.mlb.com/api/v1/people/${batterMlbamId}/stats`)
  url.searchParams.set('stats', 'gameLog')
  url.searchParams.set('group', 'hitting')
  url.searchParams.set('season', String(season))

  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`MLB_OFFICIAL_BATTER_GAMELOG_HTTP_${response.status}:${batterMlbamId}:${season}`)

  const payload = await response.json() as any
  const blocks = Array.isArray(payload?.stats) ? payload.stats : []
  const splits = blocks.flatMap((block: any) => Array.isArray(block?.splits) ? block.splits : [])

  return splits.flatMap((split: any) => {
    const gamePk = n(split?.game?.gamePk)
    const date = typeof split?.date === 'string' ? split.date.slice(0, 10) : ''
    if (!gamePk || !date) return []
    return [{
      gamePk,
      date,
      plateAppearances: n(split?.stat?.plateAppearances) ?? 0,
      hits: n(split?.stat?.hits) ?? 0,
      runs: n(split?.stat?.runs) ?? 0,
      rbi: n(split?.stat?.rbi) ?? 0,
    }]
  }).sort((a: MlbOfficialBatterGameLogRow, b: MlbOfficialBatterGameLogRow) =>
    a.date.localeCompare(b.date) || a.gamePk - b.gamePk
  )
}
