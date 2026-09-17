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
  { canonicalGamePk: 778105, expectedPitcherIds: [650633, 694738], targetPitcherId: 650633 },
  { canonicalGamePk: 778106, expectedPitcherIds: [543135, 622663], targetPitcherId: 543135 },
  { canonicalGamePk: 778112, expectedPitcherIds: [571510, 669387], targetPitcherId: 571510 },
  { canonicalGamePk: 778115, expectedPitcherIds: [471911, 700249], targetPitcherId: 471911 },
  { canonicalGamePk: 777691, expectedPitcherIds: [656302, 663559], targetPitcherId: 656302 },
  { canonicalGamePk: 777694, expectedPitcherIds: [608379, 669373], targetPitcherId: 608379 },
  { canonicalGamePk: 777695, expectedPitcherIds: [641927, 682243], targetPitcherId: 641927 },
  { canonicalGamePk: 777696, expectedPitcherIds: [647336, 694297], targetPitcherId: 647336 },
  { canonicalGamePk: 777291, expectedPitcherIds: [657277, 669194], targetPitcherId: 657277 },
  { canonicalGamePk: 777296, expectedPitcherIds: [656876, 682052], targetPitcherId: 656876 },
  { canonicalGamePk: 777297, expectedPitcherIds: [608379, 669923], targetPitcherId: 608379 },
  { canonicalGamePk: 777299, expectedPitcherIds: [571760, 607200], targetPitcherId: 571760 },
  { canonicalGamePk: 776929, expectedPitcherIds: [642547, 684007], targetPitcherId: 642547 },
  { canonicalGamePk: 776923, expectedPitcherIds: [669923, 677958], targetPitcherId: 669923 },
  { canonicalGamePk: 776927, expectedPitcherIds: [573186, 686752], targetPitcherId: 573186 },
  { canonicalGamePk: 776928, expectedPitcherIds: [628452, 671096], targetPitcherId: 628452 },
  { canonicalGamePk: 776507, expectedPitcherIds: [434378, 608372], targetPitcherId: 434378 },
  { canonicalGamePk: 776508, expectedPitcherIds: [594798, 669372], targetPitcherId: 594798 },
  { canonicalGamePk: 776509, expectedPitcherIds: [694297, 808967], targetPitcherId: 694297 },
  { canonicalGamePk: 776510, expectedPitcherIds: [667755, 686613], targetPitcherId: 667755 },
  { canonicalGamePk: 776136, expectedPitcherIds: [676664, 694297], targetPitcherId: 676664 },
  { canonicalGamePk: 776137, expectedPitcherIds: [657277, 685326], targetPitcherId: 657277 },
  { canonicalGamePk: 776138, expectedPitcherIds: [666142, 669620], targetPitcherId: 666142 },
  { canonicalGamePk: 776139, expectedPitcherIds: [477132, 682243], targetPitcherId: 477132 },
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
