import 'server-only'

import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchMlbOfficialSchedule } from '@/services/mlb-official-data-provider.service'

const SEASON = 2026

type TeamRow = {
  id: string
  abbreviation: string | null
}

function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function normalizeAbbreviation(value: string | null | undefined) {
  const abbr = String(value ?? '').toUpperCase()
  if (abbr === 'CWS') return 'CHW'
  if (abbr === 'AZ') return 'ARI'
  if (abbr === 'OAK') return 'ATH'
  return abbr
}

export async function reconcileMlbCanonicalSlateFromOfficial(targetDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new Error(`MLB_CANONICAL_SLATE_INVALID_DATE:${targetDate}`)
  }

  const official = await fetchMlbOfficialSchedule(targetDate)
  const regular = official.rows.filter((game) => (
    game.officialDate === targetDate
    && game.sourceMetadata?.gamePk != null
  ))
  if (regular.length === 0) {
    throw new Error(`MLB_CANONICAL_SLATE_OFFICIAL_EMPTY:${targetDate}:${official.endpoint}`)
  }

  const { data: teams, error: teamError } = await supabaseAdmin
    .from('sports_teams')
    .select('id,abbreviation')
    .eq('sport_key', 'baseball_mlb')
    .limit(100)
  if (teamError) throw new Error(`MLB_CANONICAL_SLATE_TEAM_READ_FAILED:${teamError.message}`)

  const teamByAbbr = new Map<string, string>()
  for (const row of (teams ?? []) as TeamRow[]) {
    const key = normalizeAbbreviation(row.abbreviation)
    if (key) teamByAbbr.set(key, row.id)
  }
  if (teamByAbbr.size < 30) throw new Error(`MLB_CANONICAL_SLATE_TEAM_MAP_INCOMPLETE:${teamByAbbr.size}`)

  const gamePks = regular.map((game) => Number(game.gamePk)).filter(Number.isSafeInteger)
  if (gamePks.length !== regular.length) {
    throw new Error(`MLB_CANONICAL_SLATE_INVALID_GAME_PK:${gamePks.length}/${regular.length}`)
  }
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('pick2_mlb_games')
    .select('game_pk')
    .in('game_pk', gamePks)
  if (existingError) throw new Error(`MLB_CANONICAL_SLATE_EXISTING_READ_FAILED:${existingError.message}`)
  const existingSet = new Set((existing ?? []).map((row) => Number(row.game_pk)))

  const now = Date.now()
  const inserts = regular
    .filter((game) => !existingSet.has(Number(game.gamePk)))
    .map((game) => {
      const scheduledAt = game.gameDate ? new Date(game.gameDate).toISOString() : null
      const homeTeamId = teamByAbbr.get(normalizeAbbreviation(game.home.abbreviation))
      const awayTeamId = teamByAbbr.get(normalizeAbbreviation(game.away.abbreviation))
      if (!scheduledAt) throw new Error(`MLB_CANONICAL_SLATE_START_MISSING:${game.gamePk}`)
      if (!homeTeamId || !awayTeamId) throw new Error(`MLB_CANONICAL_SLATE_TEAM_MAPPING_MISSING:${game.gamePk}`)
      if (Date.parse(scheduledAt) <= now) throw new Error(`MLB_CANONICAL_SLATE_STARTED_GAME_MISSING:${game.gamePk}`)

      const evidence = {
        gamePk: Number(game.gamePk),
        officialDate: game.officialDate,
        gameDate: scheduledAt,
        homeMlbTeamId: Number(game.home.id),
        awayMlbTeamId: Number(game.away.id),
        homeAbbreviation: game.home.abbreviation,
        awayAbbreviation: game.away.abbreviation,
        homeProbablePitcher: game.probablePitchers.home.player,
        awayProbablePitcher: game.probablePitchers.away.player,
        gameNumber: game.gameNumber,
        doubleHeader: game.doubleHeader,
        status: game.status,
      }

      return {
        game_pk: Number(game.gamePk),
        season: SEASON,
        game_date: game.officialDate,
        scheduled_at: scheduledAt,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        game_type: 'R',
        official_status: game.status.detailedState ?? game.status.abstractGameState ?? null,
        doubleheader: game.doubleHeader,
        game_number: game.gameNumber,
        source: 'mlb_official',
        source_payload_digest: sha256(evidence),
        metadata: {
          phase: 'MLB_CANONICAL_SLATE_PREFLIGHT_V1',
          officialDate: game.officialDate,
          statusCode: game.status.statusCode,
          abstractGameState: game.status.abstractGameState,
          homeMlbTeamId: Number(game.home.id),
          awayMlbTeamId: Number(game.away.id),
          homeProbablePitcher: game.probablePitchers.home.player,
          awayProbablePitcher: game.probablePitchers.away.player,
          mlb_official_identity: {
            home_mlb_team_id: Number(game.home.id),
            away_mlb_team_id: Number(game.away.id),
            home_abbreviation: game.home.abbreviation,
            away_abbreviation: game.away.abbreviation,
          },
        },
      }
    })

  if (inserts.length) {
    const { error: insertError } = await supabaseAdmin
      .from('pick2_mlb_games')
      .insert(inserts)
    if (insertError) throw new Error(`MLB_CANONICAL_SLATE_INSERT_FAILED:${insertError.message}`)
  }

  const { data: readback, error: readbackError } = await supabaseAdmin
    .from('pick2_mlb_games')
    .select('game_pk,game_date,scheduled_at,home_team_id,away_team_id,game_type')
    .in('game_pk', gamePks)
  if (readbackError) throw new Error(`MLB_CANONICAL_SLATE_READBACK_FAILED:${readbackError.message}`)

  const readbackSet = new Set((readback ?? []).map((row) => Number(row.game_pk)))
  const missingAfter = gamePks.filter((gamePk) => !readbackSet.has(gamePk))
  if (missingAfter.length) throw new Error(`MLB_CANONICAL_SLATE_READBACK_INCOMPLETE:${missingAfter.join(',')}`)

  console.info('MLB_CANONICAL_SLATE_PREFLIGHT', {
    targetDate,
    endpoint: official.endpoint,
    officialRows: official.rows.length,
    regularGames: regular.length,
    existingGames: existingSet.size,
    insertedGames: inserts.length,
    readbackGames: readbackSet.size,
  })

  return {
    success: true,
    status: inserts.length ? 'MLB_CANONICAL_SLATE_RECONCILED' : 'MLB_CANONICAL_SLATE_ALREADY_COMPLETE',
    targetDate,
    officialGames: gamePks.length,
    existingGames: existingSet.size,
    insertedGames: inserts.length,
    readbackGames: readbackSet.size,
    providerCallsMade: official.providerCallsMade,
    officialPicksModified: false,
    apostarActivated: false,
  }
}
