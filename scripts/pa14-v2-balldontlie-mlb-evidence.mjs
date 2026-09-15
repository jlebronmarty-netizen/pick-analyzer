#!/usr/bin/env node

import 'dotenv/config'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'

const BDL_BASE = 'https://api.balldontlie.io'
const MLB_BASE = 'https://statsapi.mlb.com'
const PROVIDER = 'BALLDONTLIE'
const SCRIPT_VERSION = 'pa14-v2-balldontlie-mlb-evidence/1.0.0'

function arg(name, fallback = null) {
  const prefix = `--${name}=`
  const hit = process.argv.find((value) => value.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : fallback
}

function flag(name) {
  return process.argv.includes(`--${name}`)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    )
  }
  return value
}

function stableJson(value) {
  return JSON.stringify(stableValue(value))
}

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function compactIso(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid timestamp: ${value}`)
  return d.toISOString().replace(/[-:]/g, '').replace('.000Z', 'Z')
}

function parseTimecode(value) {
  const match = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/.exec(String(value))
  if (!match) return null
  const [, y, m, d, hh, mm, ss] = match
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`)
}

function timecodeToIso(value) {
  const parsed = parseTimecode(value)
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true })
}

async function saveJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function fetchJson(url, { headers = {}, label, outputDir }) {
  const acquiredAt = new Date().toISOString()
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'pick-analyzer-pa14-v2-research/1.0',
      ...headers,
    },
  })
  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`${label} returned non-JSON HTTP ${response.status}`)
  }

  const envelope = {
    schema: 'pa14-v2-provider-raw-envelope/1.0.0',
    provider: url.startsWith(BDL_BASE) ? PROVIDER : 'MLB_STATSAPI',
    request: {
      method: 'GET',
      url,
    },
    acquiredAt,
    response: {
      status: response.status,
      payload,
    },
    payloadDigest: sha256(text),
    canonicalPayloadDigest: sha256(stableJson(payload)),
  }

  await saveJson(join(outputDir, `${label}.raw.json`), envelope)
  if (!response.ok) throw new Error(`${label} failed HTTP ${response.status}`)
  return { payload, acquiredAt, payloadDigest: envelope.payloadDigest, canonicalPayloadDigest: envelope.canonicalPayloadDigest }
}

async function fetchBdlAll(pathname, params, context) {
  const data = []
  let cursor = null
  let page = 0
  const rawPages = []
  do {
    page += 1
    const url = new URL(`${BDL_BASE}${pathname}`)
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, String(item)))
      else if (value !== null && value !== undefined) url.searchParams.set(key, String(value))
    }
    if (cursor !== null) url.searchParams.set('cursor', String(cursor))
    if (!url.searchParams.has('per_page')) url.searchParams.set('per_page', '100')

    const result = await fetchJson(url.toString(), {
      headers: { Authorization: context.apiKey },
      label: `${context.label}.page-${String(page).padStart(2, '0')}`,
      outputDir: context.outputDir,
    })
    rawPages.push({ acquiredAt: result.acquiredAt, payloadDigest: result.payloadDigest, canonicalPayloadDigest: result.canonicalPayloadDigest })
    if (!Array.isArray(result.payload?.data)) throw new Error(`${context.label}: response.data is not an array`)
    data.push(...result.payload.data)
    cursor = result.payload?.meta?.next_cursor ?? null
  } while (cursor !== null && cursor !== undefined)

  return { data, rawPages }
}

async function resolveMlbGame(gamePk, outputDir) {
  const url = `${MLB_BASE}/api/v1/schedule?sportId=1&gamePk=${encodeURIComponent(gamePk)}&hydrate=team,probablePitcher,venue`
  const result = await fetchJson(url, { label: 'mlb.schedule', outputDir })
  const game = result.payload?.dates?.flatMap((d) => d.games ?? []).find((g) => Number(g.gamePk) === Number(gamePk))
  if (!game) throw new Error(`MLB schedule did not resolve gamePk ${gamePk}`)
  return {
    game,
    gamePk: Number(gamePk),
    gameDate: game.gameDate,
    officialDate: game.officialDate,
    awayAbbreviation: game.teams?.away?.team?.abbreviation,
    homeAbbreviation: game.teams?.home?.team?.abbreviation,
    awayProbable: game.teams?.away?.probablePitcher ?? null,
    homeProbable: game.teams?.home?.probablePitcher ?? null,
    scheduleEvidence: result,
  }
}

async function fetchMlbFinalFeed(gamePk, outputDir) {
  const url = `${MLB_BASE}/api/v1.1/game/${encodeURIComponent(gamePk)}/feed/live`
  return fetchJson(url, { label: 'mlb.feed.final', outputDir })
}

function bdlGameMatch(games, resolved) {
  const date = String(resolved.officialDate ?? resolved.gameDate).slice(0, 10)
  const matches = games.filter((game) => {
    const away = game?.away_team?.abbreviation ?? game?.away_team_abbreviation
    const home = game?.home_team?.abbreviation ?? game?.home_team_abbreviation
    const gameDate = String(game?.date ?? '').slice(0, 10)
    return away === resolved.awayAbbreviation && home === resolved.homeAbbreviation && gameDate === date
  })
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one BALLDONTLIE game for ${resolved.awayAbbreviation}@${resolved.homeAbbreviation} ${date}; found ${matches.length}`)
  }
  return matches[0]
}

function mlbPlayerIndex(feed) {
  const players = Object.values(feed?.gameData?.players ?? {})
  const byName = new Map()
  for (const player of players) {
    const key = normalizeName(player?.fullName)
    if (!key) continue
    const arr = byName.get(key) ?? []
    arr.push({ mlbamId: Number(player.id), fullName: player.fullName })
    byName.set(key, arr)
  }
  return byName
}

function crosswalkPlayers(bdlPlayers, feed) {
  const byMlbName = mlbPlayerIndex(feed)
  const out = new Map()
  const unresolved = []
  const ambiguous = []

  for (const player of bdlPlayers) {
    const providerId = Number(player?.id)
    const fullName = player?.full_name ?? [player?.first_name, player?.last_name].filter(Boolean).join(' ')
    const candidates = byMlbName.get(normalizeName(fullName)) ?? []
    if (candidates.length === 1) {
      out.set(providerId, {
        providerPlayerId: providerId,
        providerFullName: fullName,
        mlbamId: candidates[0].mlbamId,
        mlbFullName: candidates[0].fullName,
        method: 'exact-normalized-full-name-within-game-roster',
      })
    } else if (candidates.length === 0) {
      unresolved.push({ providerPlayerId: providerId, providerFullName: fullName })
    } else {
      ambiguous.push({ providerPlayerId: providerId, providerFullName: fullName, candidates })
    }
  }

  return { map: out, unresolved, ambiguous }
}

async function fetchPlayers(playerIds, apiKey, outputDir) {
  if (!playerIds.length) return []
  const chunks = []
  for (let i = 0; i < playerIds.length; i += 50) chunks.push(playerIds.slice(i, i + 50))
  const all = []
  for (let i = 0; i < chunks.length; i += 1) {
    const result = await fetchBdlAll('/mlb/v1/players', { 'player_ids[]': chunks[i] }, {
      apiKey,
      label: `bdl.players.chunk-${String(i + 1).padStart(2, '0')}`,
      outputDir,
    })
    all.push(...result.data)
  }
  return all
}

function normalizePlateAppearances(plateAppearances, crosswalk) {
  const sorted = [...plateAppearances].sort((a, b) => Number(a.pa_number ?? 0) - Number(b.pa_number ?? 0))
  return sorted.map((pa, index) => {
    const batter = crosswalk.get(Number(pa.batter_id)) ?? null
    const pitcher = crosswalk.get(Number(pa.pitcher_id)) ?? null
    const result = String(pa.result ?? '').trim()
    const resultKey = normalizeName(result)
    const pitches = [...(pa.pitches ?? [])]
      .sort((a, b) => Number(a.pitch_number ?? 0) - Number(b.pitch_number ?? 0))
      .map((pitch) => ({
        pitchNumber: Number(pitch.pitch_number),
        pitchCallCode: pitch.pitch_call_code ?? null,
        pitchCall: pitch.pitch_call ?? null,
        description: pitch.description ?? null,
        pitchTypeCode: pitch.pitch_type_code ?? null,
        pitchType: pitch.pitch_type ?? null,
        releaseSpeed: Number.isFinite(Number(pitch.release_speed)) ? Number(pitch.release_speed) : null,
        ballsBeforePitch: pitch.balls ?? null,
        strikesBeforePitch: pitch.strikes ?? null,
      }))

    return {
      paOrder: Number(pa.pa_number ?? index + 1),
      inning: pa.inning ?? null,
      halfInning: pa.half_inning ?? null,
      providerBatterId: Number(pa.batter_id),
      batterMlbamId: batter?.mlbamId ?? null,
      batterName: batter?.mlbFullName ?? batter?.providerFullName ?? null,
      providerPitcherId: Number(pa.pitcher_id),
      pitcherMlbamId: pitcher?.mlbamId ?? null,
      pitcherName: pitcher?.mlbFullName ?? pitcher?.providerFullName ?? null,
      terminalResult: result || null,
      isStrikeout: resultKey.includes('strikeout'),
      pitches,
    }
  })
}

async function fetchPregameStarterSnapshot(gamePk, targetStart, outputDir) {
  const timestamps = await fetchJson(`${MLB_BASE}/api/v1.1/game/${encodeURIComponent(gamePk)}/feed/live/timestamps`, {
    label: 'mlb.timestamps',
    outputDir,
  })
  if (!Array.isArray(timestamps.payload)) throw new Error('MLB timestamps response is not an array')
  const cutoffMs = new Date(targetStart).getTime()
  const candidates = timestamps.payload
    .map((timecode) => ({ timecode, at: parseTimecode(timecode) }))
    .filter((row) => row.at && row.at.getTime() <= cutoffMs)
    .sort((a, b) => b.at.getTime() - a.at.getTime())

  if (!candidates.length) {
    return {
      status: 'NO_PRE_TARGET_TIMECODE',
      targetStart,
      authoritativeAt: null,
      timecode: null,
      probablePitchers: null,
    }
  }

  for (const candidate of candidates.slice(0, 200)) {
    const snapshot = await fetchJson(
      `${MLB_BASE}/api/v1.1/game/${encodeURIComponent(gamePk)}/feed/live?timecode=${encodeURIComponent(candidate.timecode)}`,
      { label: `mlb.pregame.${candidate.timecode}`, outputDir }
    )
    const probable = snapshot.payload?.gameData?.probablePitchers ?? null
    const away = probable?.away ?? null
    const home = probable?.home ?? null
    if (away?.id || home?.id) {
      const metadataTimestamp = snapshot.payload?.metaData?.timeStamp ?? null
      const metadataIso = metadataTimestamp ? timecodeToIso(metadataTimestamp) : null
      const authoritativeAt = metadataIso ?? candidate.at.toISOString()
      if (new Date(authoritativeAt).getTime() > cutoffMs) continue
      return {
        status: 'AUTHORITATIVE_PRE_TARGET_SNAPSHOT_FOUND',
        targetStart,
        requestedTimecode: candidate.timecode,
        returnedMetadataTimeStamp: metadataTimestamp,
        authoritativeAt,
        acquiredAt: snapshot.acquiredAt,
        payloadDigest: snapshot.payloadDigest,
        canonicalPayloadDigest: snapshot.canonicalPayloadDigest,
        probablePitchers: {
          away: away ? { mlbamId: Number(away.id), fullName: away.fullName ?? null } : null,
          home: home ? { mlbamId: Number(home.id), fullName: home.fullName ?? null } : null,
        },
      }
    }
  }

  return {
    status: 'NO_PRE_TARGET_PROBABLE_PITCHER_SNAPSHOT_FOUND',
    targetStart,
    authoritativeAt: null,
    probablePitchers: null,
  }
}

async function collectGame(gamePk, apiKey, rootDir, options) {
  const gameDir = join(rootDir, String(gamePk))
  await ensureDir(gameDir)

  const resolved = await resolveMlbGame(gamePk, gameDir)
  const finalFeed = await fetchMlbFinalFeed(gamePk, gameDir)
  const date = String(resolved.officialDate ?? resolved.gameDate).slice(0, 10)

  const bdlGames = await fetchBdlAll('/mlb/v1/games', { 'dates[]': [date], season_type: 'regular' }, {
    apiKey,
    label: 'bdl.games-by-date',
    outputDir: gameDir,
  })
  const bdlGame = bdlGameMatch(bdlGames.data, resolved)
  await saveJson(join(gameDir, 'bdl.game-match.json'), {
    canonicalGamePk: Number(gamePk),
    providerGameId: Number(bdlGame.id),
    officialDate: date,
    away: resolved.awayAbbreviation,
    home: resolved.homeAbbreviation,
    providerGame: bdlGame,
  })

  const providerGameId = Number(bdlGame.id)
  const plays = await fetchBdlAll('/mlb/v1/plays', { game_id: providerGameId, sort_order: 'asc' }, {
    apiKey,
    label: 'bdl.plays',
    outputDir: gameDir,
  })
  const plateAppearancesRaw = await fetchJson(`${BDL_BASE}/mlb/v1/plate_appearances?game_id=${providerGameId}`, {
    headers: { Authorization: apiKey },
    label: 'bdl.plate-appearances',
    outputDir: gameDir,
  })
  const plateAppearances = plateAppearancesRaw.payload?.data
  if (!Array.isArray(plateAppearances)) throw new Error(`BALLDONTLIE plate appearances missing for game ${providerGameId}`)

  const pitches = await fetchBdlAll('/mlb/v1/pitches', { game_id: providerGameId }, {
    apiKey,
    label: 'bdl.pitches',
    outputDir: gameDir,
  })
  const lineups = await fetchBdlAll('/mlb/v1/lineups', { 'game_ids[]': [providerGameId] }, {
    apiKey,
    label: 'bdl.lineups',
    outputDir: gameDir,
  })

  const uniquePlayerIds = [...new Set([
    ...plateAppearances.flatMap((pa) => [pa.batter_id, pa.pitcher_id]),
    ...lineups.data.map((row) => row?.player?.id),
  ].filter((id) => id !== null && id !== undefined).map(Number))]

  const bdlPlayers = await fetchPlayers(uniquePlayerIds, apiKey, gameDir)
  const playerCrosswalk = crosswalkPlayers(bdlPlayers, finalFeed.payload)
  if (playerCrosswalk.ambiguous.length) {
    throw new Error(`Ambiguous BALLDONTLIE→MLBAM player mappings for gamePk ${gamePk}: ${JSON.stringify(playerCrosswalk.ambiguous)}`)
  }

  const normalizedPas = normalizePlateAppearances(plateAppearances, playerCrosswalk.map)
  const missingCanonical = normalizedPas.filter((pa) => !pa.batterMlbamId || !pa.pitcherMlbamId)
  const paOrders = normalizedPas.map((pa) => pa.paOrder)
  const duplicatePaOrders = paOrders.filter((value, index) => paOrders.indexOf(value) !== index)

  const normalized = {
    schema: 'pa14-v2-terminal-pa-census/1.0.0',
    scriptVersion: SCRIPT_VERSION,
    canonicalGamePk: Number(gamePk),
    provider: PROVIDER,
    providerGameId,
    officialDate: date,
    awayTeam: resolved.awayAbbreviation,
    homeTeam: resolved.homeAbbreviation,
    orderedPlateAppearances: normalizedPas,
    counts: {
      plateAppearances: normalizedPas.length,
      strikeouts: normalizedPas.filter((pa) => pa.isStrikeout).length,
      nonStrikeouts: normalizedPas.filter((pa) => !pa.isStrikeout).length,
      nestedPitches: normalizedPas.reduce((sum, pa) => sum + pa.pitches.length, 0),
      standalonePitches: pitches.data.length,
      plays: plays.data.length,
    },
    validation: {
      paOrdersStrictlyUnique: duplicatePaOrders.length === 0,
      duplicatePaOrders: [...new Set(duplicatePaOrders)],
      everyPaHasTerminalResult: normalizedPas.every((pa) => Boolean(pa.terminalResult)),
      everyPaHasCanonicalBatterAndPitcher: missingCanonical.length === 0,
      missingCanonicalCount: missingCanonical.length,
      unresolvedProviderPlayers: playerCrosswalk.unresolved,
    },
  }
  const normalizedDigest = sha256(stableJson(normalized))
  await saveJson(join(gameDir, 'normalized-terminal-pa-census.json'), { ...normalized, deterministicNormalizedDigest: normalizedDigest })

  const lineupProbables = lineups.data
    .filter((row) => row?.is_probable_pitcher === true)
    .map((row) => {
      const mapping = playerCrosswalk.map.get(Number(row?.player?.id)) ?? null
      return {
        providerPlayerId: Number(row?.player?.id),
        providerFullName: row?.player?.full_name ?? null,
        teamAbbreviation: row?.team?.abbreviation ?? row?.player?.team?.abbreviation ?? null,
        mlbamId: mapping?.mlbamId ?? null,
        // Intentionally no source-state timestamp from BALLDONTLIE: acquiredAt is observation time only.
      }
    })

  let starterTiming = null
  if (options.starterTimingGamePks.has(Number(gamePk))) {
    const offTime = options.offTimes.get(Number(gamePk)) ?? null
    const commenceTime = resolved.gameDate
    const targetStart = offTime && new Date(offTime) < new Date(commenceTime) ? offTime : commenceTime
    starterTiming = await fetchPregameStarterSnapshot(gamePk, targetStart, gameDir)
  }

  const evidence = {
    schema: 'pa14-v2-game-evidence-manifest/1.0.0',
    scriptVersion: SCRIPT_VERSION,
    canonicalGamePk: Number(gamePk),
    provider: PROVIDER,
    providerGameId,
    acquiredAt: new Date().toISOString(),
    rawEvidencePolicy: 'raw provider payloads are stored as *.raw.json before normalization; Authorization header is never persisted',
    canonicalIdentity: {
      gamePk: Number(gamePk),
      awayTeam: resolved.awayAbbreviation,
      homeTeam: resolved.homeAbbreviation,
      playerCrosswalkMethod: 'exact-normalized-full-name-within-game-roster; ambiguous matches fail closed',
    },
    digests: {
      normalizedTerminalPaCensusSha256: normalizedDigest,
      bdlPlateAppearancesPayloadSha256: plateAppearancesRaw.payloadDigest,
      bdlPlateAppearancesCanonicalSha256: plateAppearancesRaw.canonicalPayloadDigest,
    },
    lineupProbables,
    starterTiming,
    certificationFlags: {
      rawProviderPayloadPreserved: true,
      providerIdsPreserved: true,
      acquisitionTimestampPreserved: true,
      normalizedDigestPresent: true,
      completeOrderedPaCensus: normalizedPas.length > 0 && duplicatePaOrders.length === 0 && normalized.validation.everyPaHasTerminalResult,
      canonicalPlayerIdentityComplete: normalized.validation.everyPaHasCanonicalBatterAndPitcher,
      ballDontLieAcquiredAtUsedAsSourceStateTimestamp: false,
      authoritativePregameStarterTimingPresent: starterTiming?.status === 'AUTHORITATIVE_PRE_TARGET_SNAPSHOT_FOUND',
    },
  }
  evidence.manifestDigest = sha256(stableJson(evidence))
  await saveJson(join(gameDir, 'evidence-manifest.json'), evidence)
  return evidence
}

async function main() {
  const apiKey = process.env.BALLDONTLIE_API_KEY
  if (!apiKey) {
    throw new Error('BALLDONTLIE_API_KEY is required. Load it from local .env.local or a secure runtime secret; never pass it on the command line.')
  }

  const gamePks = String(arg('game-pks', arg('game-pk', '823734,823902')))
    .split(',')
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite)
  if (!gamePks.length) throw new Error('At least one --game-pk or --game-pks value is required')

  const starterTimingGamePks = new Set(
    String(arg('starter-timing-game-pks', '823734'))
      .split(',')
      .map((value) => Number(value.trim()))
      .filter(Number.isFinite)
  )
  const offTimes = new Map()
  const offTime = arg('target-off-time')
  if (offTime) offTimes.set(823734, offTime)

  const stamp = compactIso(new Date().toISOString())
  const rootDir = resolve(arg('output-dir', `tmp/pa14-v2-balldontlie-mlb/${stamp}`))
  await ensureDir(rootDir)

  const run = {
    schema: 'pa14-v2-balldontlie-mlb-run/1.0.0',
    scriptVersion: SCRIPT_VERSION,
    startedAt: new Date().toISOString(),
    gamePks,
    outputDir: rootDir,
    dryWritePolicy: 'filesystem evidence only; no Supabase writes, no Official Picks mutation, no betting activation',
    results: [],
  }

  for (const gamePk of gamePks) {
    console.log(`[pa14-v2] collecting gamePk=${gamePk}`)
    run.results.push(await collectGame(gamePk, apiKey, rootDir, { starterTimingGamePks, offTimes }))
  }
  run.completedAt = new Date().toISOString()
  run.runDigest = sha256(stableJson(run))
  await saveJson(join(rootDir, 'run-manifest.json'), run)

  console.log(JSON.stringify({
    ok: true,
    outputDir: rootDir,
    runDigest: run.runDigest,
    games: run.results.map((result) => ({
      gamePk: result.canonicalGamePk,
      providerGameId: result.providerGameId,
      manifestDigest: result.manifestDigest,
      completeOrderedPaCensus: result.certificationFlags.completeOrderedPaCensus,
      canonicalPlayerIdentityComplete: result.certificationFlags.canonicalPlayerIdentityComplete,
      authoritativePregameStarterTimingPresent: result.certificationFlags.authoritativePregameStarterTimingPresent,
    })),
  }, null, 2))
}

main().catch((error) => {
  console.error(`[pa14-v2] FAIL: ${error?.stack ?? error}`)
  process.exitCode = 1
})
