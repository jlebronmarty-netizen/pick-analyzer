import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  pitcherErRawKey,
  readPitcherErOutcome,
  retrosheetGameReference,
  type PitcherErMappingRow,
  type PitcherErRawRow,
} from '@/lib/shared-mlb-pitcher-er-outcome-contract'

const RAW_GAME_CHUNK = 25
const RAW_QUERY_LIMIT = 1000

function chunks<T>(values: T[], size: number) {
  const output: T[][] = []
  for (let i = 0; i < values.length; i += size) output.push(values.slice(i, i + size))
  return output
}

async function fetchRawErRows(gameReferences: string[]) {
  const output: PitcherErRawRow[] = []
  for (const group of chunks([...new Set(gameReferences)], RAW_GAME_CHUNK)) {
    if (!group.length) continue
    const { data, error } = await supabaseAdmin
      .from('historical_raw_records')
      .select('id,source_filename,source_line,game_reference,parsed_fields,parser_version,checksum_sha256,historical_only,postgame_known,training_eligible,pregame_eligible,validation_status')
      .eq('source', 'retrosheet')
      .eq('season', '2025')
      .eq('record_type', 'data')
      .eq('parsed_fields->>0', 'data')
      .eq('parsed_fields->>1', 'er')
      .in('game_reference', group)
      .order('source_line', { ascending: true })
      .limit(RAW_QUERY_LIMIT)
    if (error) throw new Error(`PA12_ER_RAW_READ_FAILED:${error.message}`)
    const rows = (data ?? []) as unknown as PitcherErRawRow[]
    if (rows.length >= RAW_QUERY_LIMIT) throw new Error('PA12_ER_RAW_SCOPE_TOO_LARGE')
    output.push(...rows)
  }
  return output
}

export async function readSharedPitcherErOutcomePage(cursor: number, limit: number) {
  const { data, error } = await supabaseAdmin
    .from('mlb_pitcher_prop_backtest_2025_v1_enriched')
    .select('canonical_game_id,target_game_pk,game_date,pitcher_source_id,mlbam_pitcher_id,pitcher_name,mapping_method,target_outs,fixed_split')
    .order('target_game_pk', { ascending: true })
    .order('mlbam_pitcher_id', { ascending: true })
    .range(cursor, cursor + limit - 1)
  if (error) throw new Error(`PA12_ER_MAPPING_READ_FAILED:${error.message}`)

  const mappings = (data ?? []) as unknown as PitcherErMappingRow[]
  if (!mappings.length) return { data: [], nextCursor: null }

  const references = mappings.map((row) => retrosheetGameReference(row.canonical_game_id))
  if (references.some((value) => value === null)) throw new Error('PA12_ER_CANONICAL_GAME_REFERENCE_INVALID')
  const rawRows = await fetchRawErRows(references as string[])
  const rawByKey = new Map<string, PitcherErRawRow>()
  for (const row of rawRows) {
    const key = pitcherErRawKey(row)
    if (!key) continue
    if (rawByKey.has(key)) throw new Error(`PA12_ER_SOURCE_DUPLICATE:${key}`)
    rawByKey.set(key, row)
  }

  const projected = mappings.map((mapping) => {
    const gameReference = retrosheetGameReference(mapping.canonical_game_id)
    const pitcherSourceId = typeof mapping.pitcher_source_id === 'string' ? mapping.pitcher_source_id.trim() : ''
    const raw = gameReference && pitcherSourceId ? rawByKey.get(`${gameReference}|${pitcherSourceId}`) : undefined
    return raw ? readPitcherErOutcome(mapping, raw) : null
  })
  if (projected.some((row) => row === null)) throw new Error('PA12_ER_CERTIFIED_SOURCE_DRIFT')
  const certified = projected.filter((row): row is NonNullable<typeof row> => row !== null)

  return {
    data: certified,
    nextCursor: mappings.length === limit ? cursor + mappings.length : null,
  }
}
