import 'server-only'

export type MlbOfficialPitcherGameLogRow = {
  gamePk: number
  date: string
  gamesStarted: number
  earnedRuns: number | null
  hits: number | null
  strikeOuts: number | null
  battersFaced: number | null
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function readMlbOfficialPitcherGameLog(
  pitcherMlbamId: number,
  season: number,
): Promise<MlbOfficialPitcherGameLogRow[]> {
  const url = new URL(`https://statsapi.mlb.com/api/v1/people/${pitcherMlbamId}/stats`)
  url.searchParams.set('stats', 'gameLog')
  url.searchParams.set('group', 'pitching')
  url.searchParams.set('season', String(season))

  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`MLB_OFFICIAL_PITCHER_GAMELOG_HTTP_${response.status}:${pitcherMlbamId}:${season}`)

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
      gamesStarted: n(split?.stat?.gamesStarted) ?? 0,
      earnedRuns: n(split?.stat?.earnedRuns),
      hits: n(split?.stat?.hits),
      strikeOuts: n(split?.stat?.strikeOuts),
      battersFaced: n(split?.stat?.battersFaced),
    }]
  })
}

export async function mapConcurrent<T, R>(
  values: T[],
  limit: number,
  fn: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length)
  let next = 0

  async function worker() {
    for (;;) {
      const index = next
      next += 1
      if (index >= values.length) return
      output[index] = await fn(values[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), values.length) }, () => worker()))
  return output
}
