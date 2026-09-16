import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SOURCE_REGISTRY_ID = 'sportsbookreview_arnavsaraogi_mlb_odds_2025_3f952fd0'
const SOURCE = 'sportsbookreview_via_arnavsaraogi_dataset'
const PARSER_VERSION = 'mlb_sbr_open_close_sanitizer_v1'
const CONFIRM = 'IMPORT_SANITIZED_MLB_2025_OPEN_CLOSE_RESEARCH_ONLY'
const MAX_ROWS = 1000

const FORBIDDEN_KEYS = new Set([
  'homescore',
  'awayscore',
  'score',
  'winner',
  'actualwinner',
  'finalscore',
  'result',
  'rbi',
  'runs',
  'homeruns',
])

const TEAM_ALIASES: Record<string, string> = {
  OAK: 'ATH',
  CWS: 'CHW',
  WAS: 'WSH',
  KCR: 'KC',
  SFG: 'SF',
  SDP: 'SD',
  TBR: 'TB',
}

type InputRow = {
  sourceOrdinal: number
  sourceDate: string
  sourceStartDate: string
  homeTeam: string
  awayTeam: string
  sportsbook: string
  market: 'run_line' | 'total'
  snapshotRole: 'opening' | 'closing'
  outcome: 'home' | 'away' | 'over' | 'under'
  price: number
  line: number
}

type GameMapRow = {
  game_pk: number
  game_date: string
  home_team: string
  away_team: string
  start_time_local: string
  venue: string
}

type VenueRow = { venue: string; utc_offset_hours: number }

function normalizeTeam(value: unknown) {
  const raw = String(value ?? '').trim().toUpperCase()
  return TEAM_ALIASES[raw] ?? raw
}

function stableHash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function containsForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(containsForbiddenKey)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
    if (FORBIDDEN_KEYS.has(normalized)) return true
    if (containsForbiddenKey(child)) return true
  }
  return false
}

function finiteNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseLocalStartUtc(game: GameMapRow, offset: number | null) {
  if (offset === null || !game.start_time_local) return null
  const match = game.start_time_local.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})(AM|PM)$/)
  if (!match) return null
  let hour = Number(match[1]) % 12
  if (match[3] === 'PM') hour += 12
  const minute = Number(match[2])
  const [year, month, day] = game.game_date.split('-').map(Number)
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  return new Date(localAsUtc - offset * 60 * 60 * 1000)
}

function validateRow(row: unknown): row is InputRow {
  if (!row || typeof row !== 'object' || containsForbiddenKey(row)) return false
  const value = row as Record<string, unknown>
  const market = String(value.market ?? '')
  const role = String(value.snapshotRole ?? '')
  const outcome = String(value.outcome ?? '')
  const sourceDate = String(value.sourceDate ?? '')
  const sourceStartDate = String(value.sourceStartDate ?? '')
  const home = normalizeTeam(value.homeTeam)
  const away = normalizeTeam(value.awayTeam)
  const sportsbook = String(value.sportsbook ?? '').trim().toLowerCase()
  const price = finiteNumber(value.price)
  const line = finiteNumber(value.line)
  return Number.isInteger(Number(value.sourceOrdinal)) &&
    /^2025-\d{2}-\d{2}$/.test(sourceDate) &&
    Number.isFinite(Date.parse(sourceStartDate)) &&
    home.length > 0 && away.length > 0 && sportsbook.length > 0 &&
    ['run_line', 'total'].includes(market) &&
    ['opening', 'closing'].includes(role) &&
    (market === 'run_line' ? ['home', 'away'].includes(outcome) : ['over', 'under'].includes(outcome)) &&
    price !== null && line !== null
}

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ ok: false, blocker: 'PREVIEW_ONLY' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { confirm?: string; rows?: unknown[] } | null
  if (!body || body.confirm !== CONFIRM) {
    return NextResponse.json({ ok: false, blocker: 'CONFIRMATION_REQUIRED' }, { status: 400 })
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > MAX_ROWS) {
    return NextResponse.json({ ok: false, blocker: 'INVALID_BATCH_SIZE', maxRows: MAX_ROWS }, { status: 400 })
  }

  const invalidRows = body.rows.map((row, index) => ({ row, index })).filter(({ row }) => !validateRow(row))
  if (invalidRows.length) {
    return NextResponse.json({ ok: false, blocker: 'SANITIZATION_VALIDATION_FAILED', invalidIndexes: invalidRows.slice(0, 20).map((item) => item.index) }, { status: 400 })
  }
  const rows = body.rows as InputRow[]

  const [{ data: games, error: gamesError }, { data: venues, error: venuesError }, { data: sourceRegistry, error: sourceError }] = await Promise.all([
    supabaseAdmin.from('mlb_ml_game_map_2025_v3').select('game_pk,game_date,home_team,away_team,start_time_local,venue').limit(3000),
    supabaseAdmin.from('mlb_ml_venue_geo_2025_v3').select('venue,utc_offset_hours').limit(250),
    supabaseAdmin.from('historical_source_registry').select('id,status,checksum_sha256').eq('id', SOURCE_REGISTRY_ID).maybeSingle(),
  ])

  if (gamesError || venuesError || sourceError || !sourceRegistry) {
    return NextResponse.json({
      ok: false,
      blocker: 'CANONICAL_READ_FAILED',
      details: [gamesError?.message, venuesError?.message, sourceError?.message, !sourceRegistry ? 'source registry missing' : null].filter(Boolean),
    }, { status: 500 })
  }

  const venueOffsets = new Map<string, number>()
  for (const venue of (venues ?? []) as VenueRow[]) venueOffsets.set(venue.venue, Number(venue.utc_offset_hours))
  venueOffsets.set('WIL02', -4)
  venueOffsets.set('BST01', -4)

  const candidates = new Map<string, GameMapRow[]>()
  for (const game of (games ?? []) as GameMapRow[]) {
    const key = `${game.game_date}|${normalizeTeam(game.home_team)}|${normalizeTeam(game.away_team)}`
    const list = candidates.get(key) ?? []
    list.push(game)
    candidates.set(key, list)
  }

  const mappedRows = [] as Record<string, unknown>[]
  const unmapped: Array<Record<string, unknown>> = []

  for (const row of rows) {
    const homeTeam = normalizeTeam(row.homeTeam)
    const awayTeam = normalizeTeam(row.awayTeam)
    const key = `${row.sourceDate}|${homeTeam}|${awayTeam}`
    const gameCandidates = candidates.get(key) ?? []
    let game: GameMapRow | null = null

    if (gameCandidates.length === 1) {
      game = gameCandidates[0]
    } else if (gameCandidates.length > 1) {
      const sourceStartMs = Date.parse(row.sourceStartDate)
      const ranked = gameCandidates
        .map((candidate) => {
          const offset = venueOffsets.get(candidate.venue) ?? null
          const canonicalStart = parseLocalStartUtc(candidate, offset)
          return { candidate, delta: canonicalStart ? Math.abs(canonicalStart.getTime() - sourceStartMs) : Number.POSITIVE_INFINITY }
        })
        .sort((a, b) => a.delta - b.delta)
      if (ranked[0] && ranked[0].delta <= 4 * 60 * 60 * 1000) game = ranked[0].candidate
    }

    if (!game) {
      unmapped.push({ sourceDate: row.sourceDate, homeTeam, awayTeam, sourceStartDate: row.sourceStartDate })
      continue
    }

    const parsedFields = {
      canonicalGamePk: Number(game.game_pk),
      gameDate: game.game_date,
      sourceStartDate: row.sourceStartDate,
      homeTeam,
      awayTeam,
      sportsbook: row.sportsbook.toLowerCase(),
      market: row.market,
      snapshotRole: row.snapshotRole,
      outcome: row.outcome,
      price: Number(row.price),
      line: Number(row.line),
      exactSnapshotTimestamp: null,
      pregameEligibilityBasis: 'source_opening_or_closing_semantics',
      sourceRelease: 'ArnavSaraogi/mlb-odds-scraper:dataset',
      sourceAssetSha256: '3f952fd0bfae9f4f2d17e66692cb936ce6e1a5f6b415318012090c85933b882b',
    }
    const rawLine = JSON.stringify(parsedFields)
    const deterministic = [
      SOURCE_REGISTRY_ID,
      game.game_pk,
      row.sportsbook.toLowerCase(),
      row.market,
      row.snapshotRole,
      row.outcome,
      row.line,
      row.price,
    ].join('|')

    mappedRows.push({
      id: `sbr_market:${stableHash(deterministic)}`,
      source_registry_id: SOURCE_REGISTRY_ID,
      import_id: null,
      source: SOURCE,
      sport_key: 'baseball_mlb',
      league_key: 'mlb',
      season: '2025',
      source_filename: 'mlb_odds_dataset.json',
      source_line: Number(row.sourceOrdinal),
      game_reference: `mlb:game:${game.game_pk}`,
      record_type: 'market_open_close',
      raw_line: rawLine,
      parsed_fields: parsedFields,
      parser_version: PARSER_VERSION,
      checksum_sha256: stableHash(rawLine),
      historical_only: true,
      postgame_known: false,
      training_eligible: true,
      pregame_eligible: true,
      validation_status: 'warning',
      warnings: ['EXACT_SNAPSHOT_TIMESTAMP_UNAVAILABLE_SOURCE_ROLE_ONLY'],
      errors: [],
      imported_at: new Date().toISOString(),
    })
  }

  if (!mappedRows.length) {
    return NextResponse.json({ ok: false, blocker: 'NO_ROWS_MAPPED', inputRows: rows.length, unmapped: unmapped.slice(0, 20) }, { status: 422 })
  }

  const { error: writeError } = await supabaseAdmin.from('historical_raw_records').upsert(mappedRows, { onConflict: 'id' })
  if (writeError) {
    return NextResponse.json({ ok: false, blocker: 'WRITE_FAILED', error: writeError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    mode: 'research_only_historical_market_open_close_import_v1',
    sourceRegistryId: SOURCE_REGISTRY_ID,
    inputRows: rows.length,
    mappedRows: mappedRows.length,
    unmappedRows: unmapped.length,
    unmappedSamples: unmapped.slice(0, 10),
    providerCallsMade: 0,
    oddsApiCreditsConsumed: 0,
    officialPicksWrites: 0,
    apostarActivated: false,
  })
}
