#!/usr/bin/env node

const EXPECTED_BRANCH = 'research/pa14-v2-historical-yield-execution-20260917'

if (
  process.env.VERCEL !== '1' ||
  process.env.VERCEL_ENV !== 'preview' ||
  process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH
) {
  console.log(JSON.stringify({ status: 'PA14_V2_HISTORICAL_YIELD_PROBE_SKIPPED_NOT_EXACT_PREVIEW_BRANCH' }))
  process.exit(0)
}

const { auditHistoricalPa14V2Target } = await import('../../src/services/pa14-v2-historical-yield-audit.service.ts')

const targets = [
  { canonicalGamePk: 777408, expectedPitcherIds: [605135, 605288], targetPitcherId: 605135 },
  { canonicalGamePk: 776184, expectedPitcherIds: [607074, 663436], targetPitcherId: 607074 },
]

for (const target of targets) {
  try {
    const evidence = await auditHistoricalPa14V2Target(target)
    console.log('PA14_V2_HISTORICAL_YIELD_PROBE_RESULT=' + JSON.stringify({
      status: 'COMPLETE',
      target: evidence.target,
      builderStatus: evidence.result.status,
      blockReasons: evidence.result.status === 'BLOCKED' ? evidence.result.reasons : [],
      replayMatch: evidence.replayMatch,
      historicalAuditEligible: evidence.historicalAuditEligible,
      certificationCandidate: false,
      productionEligible: false,
      researchOnly: true,
      features: evidence.result.status === 'ELIGIBLE' ? evidence.result.row.features : null,
      statistics: evidence.result.status === 'ELIGIBLE' ? evidence.result.row.statistics : null,
      audit: evidence.audit,
      boundaries: {
        supabaseWrites: 0,
        sportsbookCalls: 0,
        officialPicksModified: false,
        apostarActivated: false,
        modelTrainingAuthorized: false,
      },
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const unfinished = message.match(/Uncertified unfinished witness (\d+)\/(\d+):/)
    let unfinishedWitnessDiagnostic = null
    if (unfinished) {
      const gamePk = Number(unfinished[1])
      const atBatNumber = Number(unfinished[2])
      const response = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      })
      if (response.ok) {
        const payload = await response.json()
        const play = payload?.liveData?.plays?.allPlays?.[atBatNumber - 1] ?? null
        unfinishedWitnessDiagnostic = play ? {
          gamePk,
          atBatNumber,
          result: play.result ?? null,
          matchup: {
            batter: play.matchup?.batter ?? null,
            pitcher: play.matchup?.pitcher ?? null,
          },
          runners: play.runners ?? null,
          playEvents: (play.playEvents ?? []).map((event) => ({
            details: event.details ?? null,
            isPitch: event.isPitch ?? null,
            count: event.count ?? null,
          })),
        } : { gamePk, atBatNumber, play: null }
      }
    }
    console.log('PA14_V2_HISTORICAL_YIELD_PROBE_RESULT=' + JSON.stringify({
      status: 'REJECTED',
      canonicalGamePk: target.canonicalGamePk,
      pitcherMlbamId: target.targetPitcherId,
      error: message,
      unfinishedWitnessDiagnostic,
      certificationCandidate: false,
      productionEligible: false,
      researchOnly: true,
      boundaries: {
        supabaseWrites: 0,
        sportsbookCalls: 0,
        officialPicksModified: false,
        apostarActivated: false,
        modelTrainingAuthorized: false,
      },
    }))
  }
}
