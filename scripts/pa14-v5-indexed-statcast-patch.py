from pathlib import Path

path = Path('src/services/pa14-v2-real-evidence.service.ts')
text = path.read_text()

view_ref = ".from('mlb_statcast_classified_v')"
raw_ref = ".from('pick2_raw_mlb_statcast_pitches')"
assert text.count(view_ref) == 2, text.count(view_ref)
text = text.replace(view_ref, raw_ref)

old = """async function loadOpponentStatcast(opponentGamePks: number[]): Promise<StatcastRow[]> {
  const rows: StatcastRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('pick2_raw_mlb_statcast_pitches')
      .select(STATCAST_FIELDS)
      .eq('game_year', SEASON)
      .eq('game_type', 'R')
      .lt('game_date', TARGET_DATE)
      .in('game_pk', opponentGamePks)
      .order('game_pk', { ascending: true })
      .order('at_bat_number', { ascending: true })
      .order('pitch_number', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Opponent Statcast query failed: ${error.message}`)
    const page = (data ?? []) as unknown as StatcastRow[]
    for (const row of page) {
      const battingHalf =
        (row.canonical_away_team_id === TARGET_OPPONENT_CANONICAL && row.inning_topbot === 'Top') ||
        (row.canonical_home_team_id === TARGET_OPPONENT_CANONICAL && row.inning_topbot === 'Bot')
      if (battingHalf) rows.push(row)
    }
    if (page.length < PAGE_SIZE) break
  }
  return rows
}"""

new = """async function loadOpponentStatcast(opponentGamePks: number[]): Promise<StatcastRow[]> {
  const gameRows = await mapConcurrent([...new Set(opponentGamePks)].sort((a, b) => a - b), 12, async (gamePk) => {
    const { data, error } = await supabaseAdmin
      .from('pick2_raw_mlb_statcast_pitches')
      .select(STATCAST_FIELDS)
      .eq('game_pk', gamePk)
      .eq('game_type', 'R')
      .order('at_bat_number', { ascending: true })
      .order('pitch_number', { ascending: true })
      .limit(PAGE_SIZE)
    if (error) throw new Error(`Opponent Statcast query failed ${gamePk}: ${error.message}`)
    const page = (data ?? []) as unknown as StatcastRow[]
    if (page.length >= PAGE_SIZE) throw new Error(`Opponent Statcast game ${gamePk} reached page limit ${PAGE_SIZE}`)
    return page.filter((row) =>
      (row.canonical_away_team_id === TARGET_OPPONENT_CANONICAL && row.inning_topbot === 'Top') ||
      (row.canonical_home_team_id === TARGET_OPPONENT_CANONICAL && row.inning_topbot === 'Bot'),
    )
  })
  return gameRows.flat()
}"""

assert text.count(old) == 1, text.count(old)
text = text.replace(old, new)
path.write_text(text)
