import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const FEATURE_VERSION = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const PAGE_SIZE = 1000

type GameRow = {
  game_pk: number
  game_date: string
  scheduled_at: string
  metadata: Record<string, unknown> | null
}

type RawRow = {
  game_pk: number
  game_date: string
  mlbam_pitcher_id: number
  events: string | null
  description: string | null
  type: string | null
  inning: number | null
  release_speed: number | string | null
  launch_speed: number | string | null
  estimated_woba_using_speedangle: number | string | null
}

type PitcherTarget = {
  gamePk: number
  gameDate: string
  scheduledAt: string
  pitcherId: number
  pitcherName: string
  side: 'home' | 'away'
}

type GameStats = {
  gameDate: string
  pitches: number
  plateAppearances: number
  strikeouts: number
  walks: number
  strikes: number
  swings: number
  whiffs: number
  calledStrikes: number
  releaseSpeedSum: number
  releaseSpeedCount: number
  launchSpeedSum: number
  launchSpeedCount: number
  estimatedWobaSum: number
  estimatedWobaCount: number
  firstInningPitches: number
  firstInningStrikeouts: number
  firstInningWalks: number
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function positiveInt(value: unknown) {
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

function finite(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function previousDate(date: string) {
  const value = new Date(date + 'T00:00:00Z')
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

function hashJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function description(row: RawRow) {
  return String(row.description ?? '').toLowerCase()
}

function eventName(row: RawRow) {
  return String(row.events ?? '').toLowerCase()
}

function isPaEnding(row: RawRow) {
  return row.events !== null && String(row.events).trim() !== ''
}

function isStrikeout(row: RawRow) {
  return eventName(row).includes('strikeout')
}

function isWalk(row: RawRow) {
  const value = eventName(row)
  return value === 'walk' || value === 'intent_walk'
}

function isStrike(row: RawRow) {
  const pitchType = String(row.type ?? '').toUpperCase()
  const value = description(row)
  return pitchType === 'S' || value.includes('strike') || value.includes('foul')
}

function isSwing(row: RawRow) {
  const value = description(row)
  return value.includes('swing') || value.includes('foul') || value.includes('hit_into_play')
}

function isWhiff(row: RawRow) {
  return description(row).includes('swinging_strike')
}

function emptyGameStats(gameDate: string): GameStats {
  return {
    gameDate,
    pitches: 0,
    plateAppearances: 0,
    strikeouts: 0,
    walks: 0,
    strikes: 0,
    swings: 0,
    whiffs: 0,
    calledStrikes: 0,
    releaseSpeedSum: 0,
    releaseSpeedCount: 0,
    launchSpeedSum: 0,
    launchSpeedCount: 0,
    estimatedWobaSum: 0,
    estimatedWobaCount: 0,
    firstInningPitches: 0,
    firstInningStrikeouts: 0,
    firstInningWalks: 0,
  }
}

function safeRate(a: number, b: number) {
  return b > 0 ? Number((a / b).toFixed(6)) : null
}

function average(sum: number, count: number) {
  return count > 0 ? Number((sum / count).toFixed(4)) : null
}

function daysBetween(target: string, prior: string | null) {
  if (!prior) return null
  const a = Date.parse(target + 'T00:00:00Z')
  const b = Date.parse(prior + 'T00:00:00Z')
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((a - b) / 86400000) : null
}

function probableTargets(game: GameRow): PitcherTarget[] {
  const metadata = asRecord(game.metadata)
  const targets: PitcherTarget[] = []
  for (const side of ['home', 'away'] as const) {
    const bag = asRecord(metadata[side + 'ProbablePitcher'])
    const id = positiveInt(bag.id)
    const name = String(bag.fullName ?? '').trim()
    if (id && name) {
      targets.push({
        gamePk: Number(game.game_pk),
        gameDate: game.game_date,
        scheduledAt: game.scheduled_at,
        pitcherId: id,
        pitcherName: name,
        side,
      })
    }
  }
  return targets
}

async function pagedRawRead(pitcherIds: number[], targetDate: string) {
  if (!pitcherIds.length) return [] as RawRow[]
  const rows: RawRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('pick2_raw_mlb_statcast_pitches')
      .select('game_pk,game_date,mlbam_pitcher_id,events,description,type,inning,release_speed,launch_speed,estimated_woba_using_speedangle')
      .in('mlbam_pitcher_id', pitcherIds)
      .lt('game_date', targetDate)
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true })
      .order('at_bat_number', { ascending: true })
      .order('pitch_number', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (result.error) throw new Error('MLB_PROP_PITCHER_FEATURE_RAW_READ_FAILED:' + result.error.message)
    rows.push(...((result.data ?? []) as RawRow[]))
    if (!result.data || result.data.length < PAGE_SIZE) break
  }
  return rows
}

function aggregatePitcher(rows: RawRow[], pitcherId: number) {
  const byGame = new Map<number, GameStats>()
  for (const row of rows) {
    if (Number(row.mlbam_pitcher_id) !== pitcherId) continue
    const gamePk = Number(row.game_pk)
    const gameDate = String(row.game_date)
    const stats = byGame.get(gamePk) ?? emptyGameStats(gameDate)
    stats.pitches += 1
    if (isStrike(row)) stats.strikes += 1
    if (isSwing(row)) stats.swings += 1
    if (isWhiff(row)) stats.whiffs += 1
    if (description(row).includes('called_strike')) stats.calledStrikes += 1
    if (Number(row.inning) === 1) stats.firstInningPitches += 1
    const release = finite(row.release_speed)
    if (release !== null) {
      stats.releaseSpeedSum += release
      stats.releaseSpeedCount += 1
    }
    const launch = finite(row.launch_speed)
    if (launch !== null) {
      stats.launchSpeedSum += launch
      stats.launchSpeedCount += 1
    }
    const woba = finite(row.estimated_woba_using_speedangle)
    if (woba !== null) {
      stats.estimatedWobaSum += woba
      stats.estimatedWobaCount += 1
    }
    if (isPaEnding(row)) {
      stats.plateAppearances += 1
      if (isStrikeout(row)) {
        stats.strikeouts += 1
        if (Number(row.inning) === 1) stats.firstInningStrikeouts += 1
      }
      if (isWalk(row)) {
        stats.walks += 1
        if (Number(row.inning) === 1) stats.firstInningWalks += 1
      }
    }
    byGame.set(gamePk, stats)
  }

  const games = [...byGame.entries()]
    .sort((a, b) => a[1].gameDate.localeCompare(b[1].gameDate) || a[0] - b[0])
    .map(([, stats]) => stats)
  if (!games.length) return null

  const total = games.reduce((acc, item) => {
    acc.pitches += item.pitches
    acc.plateAppearances += item.plateAppearances
    acc.strikeouts += item.strikeouts
    acc.walks += item.walks
    acc.strikes += item.strikes
    acc.swings += item.swings
    acc.whiffs += item.whiffs
    acc.calledStrikes += item.calledStrikes
    acc.releaseSpeedSum += item.releaseSpeedSum
    acc.releaseSpeedCount += item.releaseSpeedCount
    acc.launchSpeedSum += item.launchSpeedSum
    acc.launchSpeedCount += item.launchSpeedCount
    acc.estimatedWobaSum += item.estimatedWobaSum
    acc.estimatedWobaCount += item.estimatedWobaCount
    acc.firstInningPitches += item.firstInningPitches
    acc.firstInningStrikeouts += item.firstInningStrikeouts
    acc.firstInningWalks += item.firstInningWalks
    return acc
  }, emptyGameStats(games[0].gameDate))

  const gameVelocity = games.map((item) => average(item.releaseSpeedSum, item.releaseSpeedCount))
  const velocityL1 = gameVelocity.at(-1) ?? null
  const velocityAvg = (values: Array<number | null>) => {
    const usable = values.filter((value): value is number => value !== null)
    return usable.length ? Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(4)) : null
  }
  const velocityL3 = velocityAvg(gameVelocity.slice(-3))
  const velocityL5 = velocityAvg(gameVelocity.slice(-5))

  return {
    games: games.length,
    pitches: total.pitches,
    plateAppearances: total.plateAppearances,
    kRate: safeRate(total.strikeouts, total.plateAppearances),
    bbRate: safeRate(total.walks, total.plateAppearances),
    kMinusBbRate: total.plateAppearances
      ? Number(((total.strikeouts - total.walks) / total.plateAppearances).toFixed(6))
      : null,
    whiffRate: safeRate(total.whiffs, total.swings),
    cswRate: safeRate(total.whiffs + total.calledStrikes, total.pitches),
    strikeRate: safeRate(total.strikes, total.pitches),
    swingRate: safeRate(total.swings, total.pitches),
    avgReleaseSpeed: average(total.releaseSpeedSum, total.releaseSpeedCount),
    avgLaunchSpeed: average(total.launchSpeedSum, total.launchSpeedCount),
    avgEstimatedWoba: average(total.estimatedWobaSum, total.estimatedWobaCount),
    firstInningKRate: safeRate(total.firstInningStrikeouts, games.length),
    firstInningBbRate: safeRate(total.firstInningWalks, games.length),
    firstInningPitchCountPerAppearance: safeRate(total.firstInningPitches, games.length),
    velocityL1,
    velocityL3,
    velocityL5,
    previousPitchCount: games.at(-1)?.pitches ?? null,
    latestPriorDate: games.at(-1)?.gameDate ?? null,
  }
}

function buildSnapshot(target: PitcherTarget, stats: NonNullable<ReturnType<typeof aggregatePitcher>>) {
  const asOfDate = previousDate(target.gameDate)
  const sampleSizes = {
    kind: 'starter_appearances',
    pitches: stats.pitches,
    sample_size: stats.games,
    plate_appearances: stats.plateAppearances,
    no_sample_values_written_as_zero: false,
  }
  const sourceWindow = {
    kind: 'starter',
    rule: 'source_game_date < target_game_date',
    as_of_date: asOfDate,
    sample_size: stats.games,
    feature_version: FEATURE_VERSION,
  }
  const features = {
    side: target.side,
    kRate: stats.kRate,
    bbRate: stats.bbRate,
    kMinusBbRate: stats.kMinusBbRate,
    whiffRate: stats.whiffRate,
    cswRate: stats.cswRate,
    strikeRate: stats.strikeRate,
    swingRate: stats.swingRate,
    avgReleaseSpeed: stats.avgReleaseSpeed,
    avgLaunchSpeed: stats.avgLaunchSpeed,
    avgEstimatedWoba: stats.avgEstimatedWoba,
    source: 'PROP_PITCHER_FEATURE_RECOVERY_V1',
  }
  const native = {
    target_game_pk: target.gamePk,
    game_date: target.gameDate,
    family: 'starter',
    source_rule: 'strict_prior_date_only',
  }
  const inputDigest = hashJson({ native, sample: sampleSizes, features })
  const deterministicIdentity = [
    'PROP_FEATURE_RECOVERY_V1',
    FEATURE_VERSION,
    'pitcher',
    'starter',
    target.gamePk,
    'mlbam_pitcher:' + target.pitcherId,
    asOfDate,
    inputDigest,
  ].join(':')

  return {
    deterministicIdentity,
    inputDigest,
    snapshot: {
      deterministic_identity: deterministicIdentity,
      pick2_era: 'PICK_2_ERA_V1',
      sport_key: 'baseball_mlb',
      feature_domain: 'pitcher',
      subject_id: 'mlbam_pitcher:' + target.pitcherId,
      secondary_subject_id: null,
      event_id: null,
      feature_date: target.gameDate,
      as_of_date: asOfDate,
      as_of_timestamp: asOfDate + 'T23:59:59.000Z',
      feature_version: FEATURE_VERSION,
      source_window: sourceWindow,
      sample_sizes: sampleSizes,
      features,
      input_digest: inputDigest,
      target_game_pk: target.gamePk,
      mlbam_person_id: target.pitcherId,
      mlbam_pitcher_id: target.pitcherId,
      mlbam_batter_id: null,
      native_identity_metadata: native,
    },
    daily: {
      player_id: null,
      target_game_pk: target.gamePk,
      mlbam_pitcher_id: target.pitcherId,
      feature_date: target.gameDate,
      as_of_date: asOfDate,
      as_of_timestamp: asOfDate + 'T23:59:59.000Z',
      feature_version: FEATURE_VERSION,
      k_rate: stats.kRate,
      bb_rate: stats.bbRate,
      k_minus_bb_rate: stats.kMinusBbRate,
      whiff_rate: stats.whiffRate,
      csw_rate: stats.cswRate,
      strike_rate: stats.strikeRate,
      swing_rate: stats.swingRate,
      avg_release_speed: stats.avgReleaseSpeed,
      velocity_l1: stats.velocityL1,
      velocity_l3: stats.velocityL3,
      velocity_l5: stats.velocityL5,
      velocity_delta: stats.velocityL1 !== null && stats.velocityL5 !== null
        ? Number((stats.velocityL1 - stats.velocityL5).toFixed(4))
        : null,
      previous_pitch_count: stats.previousPitchCount,
      days_rest: daysBetween(target.gameDate, stats.latestPriorDate),
      pitch_mix: { unavailable_fields_remain_null: true },
      pitch_mix_change: { unavailable_fields_remain_null: true },
      handedness_splits: { source: 'statcast_prior_date' },
      first_inning_performance: {
        k_rate: stats.firstInningKRate,
        bb_rate: stats.firstInningBbRate,
        pitch_count_per_appearance: stats.firstInningPitchCountPerAppearance,
      },
      sample_sizes: sampleSizes,
      source_window: sourceWindow,
    },
  }
}

export async function materializeApprovedPropPitcherFeatures(input: {
  targetDate: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const gamesResult = await supabaseAdmin
    .from('pick2_mlb_games')
    .select('game_pk,game_date,scheduled_at,metadata')
    .eq('game_date', input.targetDate)
    .eq('game_type', 'R')
    .order('scheduled_at', { ascending: true })
  if (gamesResult.error) throw new Error('MLB_PROP_PITCHER_FEATURE_GAME_READ_FAILED:' + gamesResult.error.message)
  const allGames = (gamesResult.data ?? []) as GameRow[]
  if (!allGames.length) {
    return {
      success: false,
      status: 'BLOCK_CANONICAL_SLATE_MISSING',
      targetDate: input.targetDate,
      games: 0,
      targets: 0,
      writes: 0,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
    }
  }

  const futureGames = allGames.filter((game) => Date.parse(game.scheduled_at) > now.getTime())
  const targets = futureGames.flatMap(probableTargets)
  const blockers = futureGames
    .filter((game) => probableTargets(game).length !== 2)
    .map((game) => ({ gamePk: Number(game.game_pk), reason: 'PROBABLE_PITCHER_INCOMPLETE' }))
  const pitcherIds = [...new Set(targets.map((target) => target.pitcherId))]

  const existingResult = pitcherIds.length
    ? await supabaseAdmin
        .from('pick2_mlb_pitcher_daily_features')
        .select('target_game_pk,mlbam_pitcher_id,feature_snapshot_id')
        .eq('feature_date', input.targetDate)
        .eq('feature_version', FEATURE_VERSION)
        .in('mlbam_pitcher_id', pitcherIds)
    : { data: [], error: null }
  if (existingResult.error) throw new Error('MLB_PROP_PITCHER_FEATURE_EXISTING_READ_FAILED:' + existingResult.error.message)
  const existingKeys = new Set((existingResult.data ?? []).map((row) => String(row.target_game_pk) + ':' + String(row.mlbam_pitcher_id)))
  const missingTargets = targets.filter((target) => !existingKeys.has(target.gamePk + ':' + target.pitcherId))

  if (!missingTargets.length) {
    return {
      success: blockers.length === 0,
      status: blockers.length ? 'PITCHER_FEATURES_REUSE_WITH_BLOCKERS' : 'PITCHER_FEATURES_REUSE_NO_OP',
      targetDate: input.targetDate,
      games: futureGames.length,
      targets: targets.length,
      existing: targets.length,
      inserted: 0,
      blockers,
      writes: 0,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
    }
  }

  const rawRows = await pagedRawRead([...new Set(missingTargets.map((target) => target.pitcherId))], input.targetDate)
  const plans = missingTargets.flatMap((target) => {
    const stats = aggregatePitcher(rawRows, target.pitcherId)
    if (!stats || stats.games < 1 || stats.kRate === null) {
      blockers.push({ gamePk: target.gamePk, reason: 'STRICT_PRIOR_PITCHER_HISTORY_UNAVAILABLE' })
      return []
    }
    return [{ target, ...buildSnapshot(target, stats) }]
  })

  if (!plans.length) {
    return {
      success: false,
      status: 'BLOCK_NO_INSERT_ELIGIBLE_PITCHER_FEATURES',
      targetDate: input.targetDate,
      games: futureGames.length,
      targets: targets.length,
      existing: targets.length - missingTargets.length,
      inserted: 0,
      blockers,
      writes: 0,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
    }
  }

  const identities = plans.map((plan) => plan.deterministicIdentity)
  const snapshotRead = await supabaseAdmin
    .from('pick2_feature_snapshots')
    .select('id,deterministic_identity,input_digest')
    .in('deterministic_identity', identities)
  if (snapshotRead.error) throw new Error('MLB_PROP_PITCHER_SNAPSHOT_READ_FAILED:' + snapshotRead.error.message)
  const snapshotByIdentity = new Map((snapshotRead.data ?? []).map((row) => [String(row.deterministic_identity), row]))

  const snapshotsToInsert = plans
    .filter((plan) => !snapshotByIdentity.has(plan.deterministicIdentity))
    .map((plan) => plan.snapshot)
  if (snapshotsToInsert.length) {
    const inserted = await supabaseAdmin
      .from('pick2_feature_snapshots')
      .insert(snapshotsToInsert)
      .select('id,deterministic_identity,input_digest')
    if (inserted.error) throw new Error('MLB_PROP_PITCHER_SNAPSHOT_INSERT_FAILED:' + inserted.error.message)
    for (const row of inserted.data ?? []) snapshotByIdentity.set(String(row.deterministic_identity), row)
  }

  for (const plan of plans) {
    const snapshot = snapshotByIdentity.get(plan.deterministicIdentity)
    if (!snapshot?.id) throw new Error('MLB_PROP_PITCHER_SNAPSHOT_ID_UNRESOLVED:' + plan.deterministicIdentity)
    if (String(snapshot.input_digest) !== plan.inputDigest) throw new Error('MLB_PROP_PITCHER_SNAPSHOT_DIGEST_CONFLICT:' + plan.deterministicIdentity)
  }

  const rowsToInsert = plans.map((plan) => ({
    ...plan.daily,
    feature_snapshot_id: snapshotByIdentity.get(plan.deterministicIdentity)?.id,
  }))
  const dailyInsert = await supabaseAdmin
    .from('pick2_mlb_pitcher_daily_features')
    .insert(rowsToInsert)
  if (dailyInsert.error) throw new Error('MLB_PROP_PITCHER_FEATURE_INSERT_FAILED:' + dailyInsert.error.message)

  const readback = await supabaseAdmin
    .from('pick2_mlb_pitcher_daily_features')
    .select('target_game_pk,mlbam_pitcher_id,k_rate,as_of_date,source_window')
    .eq('feature_date', input.targetDate)
    .eq('feature_version', FEATURE_VERSION)
    .in('mlbam_pitcher_id', pitcherIds)
  if (readback.error) throw new Error('MLB_PROP_PITCHER_FEATURE_READBACK_FAILED:' + readback.error.message)
  const readbackKeys = new Set((readback.data ?? []).map((row) => String(row.target_game_pk) + ':' + String(row.mlbam_pitcher_id)))
  const missingAfter = targets.filter((target) => !readbackKeys.has(target.gamePk + ':' + target.pitcherId))
  if (missingAfter.length && blockers.length === 0) {
    throw new Error('MLB_PROP_PITCHER_FEATURE_READBACK_INCOMPLETE:' + missingAfter.map((item) => item.gamePk + ':' + item.pitcherId).join(','))
  }

  return {
    success: blockers.length === 0 && missingAfter.length === 0,
    status: blockers.length || missingAfter.length
      ? 'PITCHER_FEATURES_MATERIALIZED_PARTIAL'
      : 'PITCHER_FEATURES_MATERIALIZED',
    targetDate: input.targetDate,
    games: futureGames.length,
    targets: targets.length,
    existing: targets.length - missingTargets.length,
    inserted: rowsToInsert.length,
    blockers,
    missingAfter: missingAfter.map((item) => ({ gamePk: item.gamePk, pitcherId: item.pitcherId })),
    writes: snapshotsToInsert.length + rowsToInsert.length,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
  }
}
