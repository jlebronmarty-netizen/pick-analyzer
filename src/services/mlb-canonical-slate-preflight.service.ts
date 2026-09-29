import 'server-only'

import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchMlbOfficialSchedule } from '@/services/mlb-official-data-provider.service'
import { isMlbModelGameType } from '@/services/mlb-game-type-policy'

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

function lifecycleStatus(value: string | null | undefined) {
  const status = String(value ?? '').toLowerCase()
  if (status.includes('final') || status.includes('completed')) return 'completed'
  if (status.includes('live') || status.includes('progress')) return 'live'
  if (status.includes('postpon')) return 'postponed'
  if (status.includes('cancel')) return 'cancelled'
  return 'scheduled'
}

export async function reconcileMlbCanonicalSlateFromOfficial(targetDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new Error(`MLB_CANONICAL_SLATE_INVALID_DATE:${targetDate}`)
  }

  const official = await fetchMlbOfficialSchedule(targetDate)
  const slate = official.rows.filter((game) => (
    game.officialDate === targetDate
    && game.sourceMetadata?.gamePk != null
    && isMlbModelGameType(game.gameType)
  ))
  if (slate.length === 0) {
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

  const gamePks = slate.map((game) => Number(game.gamePk)).filter(Number.isSafeInteger)
  if (gamePks.length !== slate.length) {
    throw new Error(`MLB_CANONICAL_SLATE_INVALID_GAME_PK:${gamePks.length}/${slate.length}`)
  }
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('pick2_mlb_games')
    .select('game_pk')
    .in('game_pk', gamePks)
  if (existingError) throw new Error(`MLB_CANONICAL_SLATE_EXISTING_READ_FAILED:${existingError.message}`)
  const existingSet = new Set((existing ?? []).map((row) => Number(row.game_pk)))

  const now = Date.now()
  const inserts = slate
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
        gameType: game.gameType,
        status: game.status,
      }

      return {
        game_pk: Number(game.gamePk),
        season: SEASON,
        game_date: game.officialDate,
        scheduled_at: scheduledAt,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        game_type: game.gameType,
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

  // SportsDataIO historically populated sport_events for regular-season MLB,
  // but postseason games may exist only in the MLB Official / pick2 surface.
  // Materialize a canonical lifecycle identity for non-regular-season games so
  // current odds and player-prop capture can crosswalk without fabricating a
  // SportsDataIO event. Regular-season sport_events remain untouched.
  const postseasonEvents = slate
    .filter((game) => game.gameType !== 'R')
    .map((game) => {
      const gamePk = Number(game.gamePk)
      const scheduledAt = game.gameDate ? new Date(game.gameDate).toISOString() : null
      const homeTeam = normalizeAbbreviation(game.home.abbreviation)
      const awayTeam = normalizeAbbreviation(game.away.abbreviation)
      const homeTeamId = teamByAbbr.get(homeTeam)
      const awayTeamId = teamByAbbr.get(awayTeam)
      if (!scheduledAt) throw new Error(`MLB_CANONICAL_LIFECYCLE_START_MISSING:${gamePk}`)
      if (!homeTeamId || !awayTeamId) throw new Error(`MLB_CANONICAL_LIFECYCLE_TEAM_MAPPING_MISSING:${gamePk}`)
      return {
        id: `baseball_mlb:mlb:mlb_official:event:${gamePk}`,
        sport_key: 'baseball_mlb',
        league_key: 'mlb',
        season: String(SEASON),
        stage: 'postseason',
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_team: homeTeam,
        away_team: awayTeam,
        start_time: scheduledAt,
        venue: null,
        status: lifecycleStatus(game.status.detailedState ?? game.status.abstractGameState),
        provider_ids: {
          mlb_official_game_pk: gamePk,
        },
        metadata: {
          provider: 'mlb_official',
          entityType: 'event',
          source: 'MLB_CANONICAL_SLATE_POSTSEASON_LIFECYCLE_V1',
          gamePk,
          gameType: game.gameType,
          officialStatus: game.status.detailedState ?? game.status.abstractGameState ?? null,
          researchOnly: true,
          production_eligible: false,
        },
      }
    })

  if (postseasonEvents.length) {
    const { error: lifecycleError } = await supabaseAdmin
      .from('sport_events')
      .upsert(postseasonEvents, { onConflict: 'id' })
    if (lifecycleError) throw new Error(`MLB_CANONICAL_LIFECYCLE_UPSERT_FAILED:${lifecycleError.message}`)
  }

  console.info('MLB_CANONICAL_SLATE_PREFLIGHT', {
    targetDate,
    endpoint: official.endpoint,
    officialRows: official.rows.length,
    modelEligibleGames: slate.length,
    existingGames: existingSet.size,
    insertedGames: inserts.length,
    readbackGames: readbackSet.size,
    postseasonLifecycleEvents: postseasonEvents.length,
  })

  return {
    success: true,
    status: inserts.length ? 'MLB_CANONICAL_SLATE_RECONCILED' : 'MLB_CANONICAL_SLATE_ALREADY_COMPLETE',
    targetDate,
    officialGames: gamePks.length,
    existingGames: existingSet.size,
    insertedGames: inserts.length,
    readbackGames: readbackSet.size,
    postseasonLifecycleEvents: postseasonEvents.length,
    providerCallsMade: official.providerCallsMade,
    officialPicksModified: false,
    apostarActivated: false,
  }
}
