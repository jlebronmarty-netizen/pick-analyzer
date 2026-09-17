#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SAMPLE = [
  { gamePk: 778105, expectedPitcherIds: [650633, 694738] },
  { gamePk: 778106, expectedPitcherIds: [543135, 622663] },
  { gamePk: 778112, expectedPitcherIds: [571510, 669387] },
  { gamePk: 778115, expectedPitcherIds: [471911, 700249] },
  { gamePk: 777691, expectedPitcherIds: [656302, 663559] },
  { gamePk: 777694, expectedPitcherIds: [608379, 669373] },
  { gamePk: 777695, expectedPitcherIds: [641927, 682243] },
  { gamePk: 777696, expectedPitcherIds: [647336, 694297] },
  { gamePk: 777291, expectedPitcherIds: [657277, 669194] },
  { gamePk: 777296, expectedPitcherIds: [656876, 682052] },
  { gamePk: 777297, expectedPitcherIds: [608379, 669923] },
  { gamePk: 777299, expectedPitcherIds: [571760, 607200] },
  { gamePk: 776929, expectedPitcherIds: [642547, 684007] },
  { gamePk: 776923, expectedPitcherIds: [669923, 677958] },
  { gamePk: 776927, expectedPitcherIds: [573186, 686752] },
  { gamePk: 776928, expectedPitcherIds: [628452, 671096] },
  { gamePk: 776507, expectedPitcherIds: [434378, 608372] },
  { gamePk: 776508, expectedPitcherIds: [594798, 669372] },
  { gamePk: 776509, expectedPitcherIds: [694297, 808967] },
  { gamePk: 776510, expectedPitcherIds: [667755, 686613] },
  { gamePk: 776136, expectedPitcherIds: [676664, 694297] },
  { gamePk: 776137, expectedPitcherIds: [657277, 685326] },
  { gamePk: 776138, expectedPitcherIds: [666142, 669620] },
  { gamePk: 776139, expectedPitcherIds: [477132, 682243] },
]

const MLB_BASE = 'https://statsapi.mlb.com'
const MAX_PRESTART_SNAPSHOTS = 20
const OUTPUT = process.env.PA14_AUDIT_OUTPUT || 'tmp/pa14-v2-historical-starter-authority-audit/result.json'

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function parseTimecode(value) {
  const match = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/.exec(String(value))
  if (!match) return null
  const [, y, m, d, hh, mm, ss] = match
  const date = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}.000Z`)
  return Number.isFinite(date.getTime()) ? date : null
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'pick-analyzer-pa14-v2-historical-authority-audit/1.0',
    },
    signal: AbortSignal.timeout(20000),
  })
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  if (!response.ok || json === null) {
    throw new Error(`HTTP_${response.status}:${url}`)
  }
  return {
    json,
    digest: sha256(text),
    acquiredAt: new Date().toISOString(),
  }
}

async function resolveSchedule(gamePk) {
  const url = `${MLB_BASE}/api/v1/schedule?sportId=1&gamePk=${gamePk}&hydrate=team,probablePitcher,venue`
  const source = await fetchJson(url)
  const games = (source.json?.dates ?? []).flatMap((row) => row?.games ?? [])
  const game = games.find((row) => Number(row?.gamePk) === gamePk)
  if (!game) throw new Error(`SCHEDULE_NOT_FOUND:${gamePk}`)
  const targetStart = String(game?.gameDate ?? '')
  if (!Number.isFinite(Date.parse(targetStart))) throw new Error(`TARGET_START_INVALID:${gamePk}`)
  return {
    targetStart,
    officialDate: String(game?.officialDate ?? '').slice(0, 10),
    away: game?.teams?.away?.team?.abbreviation ?? game?.teams?.away?.team?.name ?? null,
    home: game?.teams?.home?.team?.abbreviation ?? game?.teams?.home?.team?.name ?? null,
    scheduleDigest: source.digest,
    scheduleAcquiredAt: source.acquiredAt,
  }
}

async function auditGame(sample) {
  const schedule = await resolveSchedule(sample.gamePk)
  const targetStartMs = Date.parse(schedule.targetStart)
  const tsSource = await fetchJson(`${MLB_BASE}/api/v1.1/game/${sample.gamePk}/feed/live/timestamps`)
  if (!Array.isArray(tsSource.json)) throw new Error(`TIMESTAMPS_NOT_ARRAY:${sample.gamePk}`)

  const candidates = tsSource.json
    .map((timecode) => ({ timecode: String(timecode), at: parseTimecode(timecode) }))
    .filter((row) => row.at && row.at.getTime() < targetStartMs)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, MAX_PRESTART_SNAPSHOTS)

  const attempts = []
  let matched = null

  for (const candidate of candidates) {
    const source = await fetchJson(
      `${MLB_BASE}/api/v1.1/game/${sample.gamePk}/feed/live?timecode=${encodeURIComponent(candidate.timecode)}`
    )
    const probable = source.json?.gameData?.probablePitchers ?? null
    const away = probable?.away ?? null
    const home = probable?.home ?? null
    const ids = [Number(away?.id), Number(home?.id)].filter(Number.isSafeInteger)
    const metadataTimecode = source.json?.metaData?.timeStamp ?? null
    const metadataAt = metadataTimecode ? parseTimecode(metadataTimecode) : null
    const expectedFound = sample.expectedPitcherIds.filter((id) => ids.includes(id))
    const expectedComplete = sample.expectedPitcherIds.every((id) => ids.includes(id))

    const attempt = {
      requestedTimecode: candidate.timecode,
      requestedAt: candidate.at.toISOString(),
      returnedMetadataTimeStamp: metadataTimecode,
      returnedMetadataAt: metadataAt?.toISOString() ?? null,
      snapshotDigest: source.digest,
      probablePitchers: {
        away: away?.id ? { mlbamId: Number(away.id), fullName: away.fullName ?? null } : null,
        home: home?.id ? { mlbamId: Number(home.id), fullName: home.fullName ?? null } : null,
      },
      expectedFound,
      expectedComplete,
      strictlyPregameByRequestedTime: candidate.at.getTime() < targetStartMs,
      strictlyPregameByMetadataTime: metadataAt ? metadataAt.getTime() < targetStartMs : false,
    }
    attempts.push(attempt)

    if (expectedComplete && attempt.strictlyPregameByMetadataTime) {
      matched = attempt
      break
    }
  }

  return {
    canonicalGamePk: sample.gamePk,
    expectedPitcherIds: sample.expectedPitcherIds,
    ...schedule,
    timestampArchiveDigest: tsSource.digest,
    prestartTimecodesAvailable: candidates.length,
    snapshotsChecked: attempts.length,
    verdict: matched ? 'POTENTIAL_HISTORICAL_STARTER_AUTHORITY_FOUND' : 'NO_COMPLETE_PREGAME_STARTER_AUTHORITY_IN_BOUNDED_SCAN',
    matchedSnapshot: matched,
    attempts,
  }
}

async function main() {
  const startedAt = new Date().toISOString()
  const results = []
  for (const sample of SAMPLE) {
    try {
      results.push(await auditGame(sample))
    } catch (error) {
      results.push({
        canonicalGamePk: sample.gamePk,
        expectedPitcherIds: sample.expectedPitcherIds,
        verdict: 'AUDIT_ERROR',
        error: String(error?.message ?? error),
      })
    }
  }

  const foundGames = results.filter((row) => row.verdict === 'POTENTIAL_HISTORICAL_STARTER_AUTHORITY_FOUND').length
  const foundPitchers = results
    .filter((row) => row.verdict === 'POTENTIAL_HISTORICAL_STARTER_AUTHORITY_FOUND')
    .reduce((sum, row) => sum + row.expectedPitcherIds.length, 0)

  const output = {
    schema: 'PA14_V2_HISTORICAL_STARTER_AUTHORITY_AUDIT/1.0.0',
    scope: 'TEMPORAL_AUTHORITY_AUDIT_ONLY_NOT_V2_ROW_CERTIFICATION',
    startedAt,
    completedAt: new Date().toISOString(),
    sampleGames: SAMPLE.length,
    samplePitchers: SAMPLE.reduce((sum, row) => sum + row.expectedPitcherIds.length, 0),
    foundGames,
    foundPitchers,
    rules: {
      maxPrestartSnapshotsCheckedPerGame: MAX_PRESTART_SNAPSHOTS,
      exactExpectedMlbamIdsRequired: true,
      requestedTimeStrictlyBeforeTargetStart: true,
      returnedMetadataTimeStrictlyBeforeTargetStart: true,
      postgameActualStarterNotUsedAsTemporalAuthority: true,
      providerCreditsConsumed: 0,
      supabaseWrites: 0,
      officialPicksModified: false,
      apostarActivated: false,
      productionEligible: false,
    },
    interpretation: foundGames > 0
      ? 'Archival MLB timecoded snapshots may supply the missing historical target/starter temporal-authority seam. Full V2 identity/census/source-completeness validation remains required before any row can be contract-valid.'
      : 'This bounded sample did not establish historical target/starter temporal authority. Do not weaken the frozen V2 contract.',
    results,
  }

  await mkdir(path.dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({
    status: 'COMPLETE',
    output: OUTPUT,
    sampleGames: output.sampleGames,
    samplePitchers: output.samplePitchers,
    foundGames,
    foundPitchers,
    providerCreditsConsumed: 0,
    supabaseWrites: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.stack ?? error)
  process.exitCode = 1
})
