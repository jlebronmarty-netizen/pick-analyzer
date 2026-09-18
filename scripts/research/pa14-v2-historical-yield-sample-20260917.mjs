#!/usr/bin/env node

const { auditHistoricalPa14V2Target } = await import('../../src/services/pa14-v2-historical-yield-audit.service.ts')

// Manual/read-only research audit. No Supabase writes, no sportsbook calls, no model training.

const targets = [
  { canonicalGamePk: 778177, expectedPitcherIds: [519242, 668678], targetPitcherId: 519242 },
  { canonicalGamePk: 778177, expectedPitcherIds: [519242, 668678], targetPitcherId: 668678 },
  { canonicalGamePk: 778161, expectedPitcherIds: [622608, 668881], targetPitcherId: 622608 },
  { canonicalGamePk: 778161, expectedPitcherIds: [622608, 668881], targetPitcherId: 668881 },
  { canonicalGamePk: 778156, expectedPitcherIds: [592332, 608331], targetPitcherId: 592332 },
  { canonicalGamePk: 778156, expectedPitcherIds: [592332, 608331], targetPitcherId: 608331 },
  { canonicalGamePk: 778139, expectedPitcherIds: [641927, 668909], targetPitcherId: 641927 },
  { canonicalGamePk: 778139, expectedPitcherIds: [641927, 668909], targetPitcherId: 668909 },
  { canonicalGamePk: 778140, expectedPitcherIds: [608372, 701542], targetPitcherId: 608372 },
  { canonicalGamePk: 778140, expectedPitcherIds: [608372, 701542], targetPitcherId: 701542 },
  { canonicalGamePk: 778130, expectedPitcherIds: [593958, 656849], targetPitcherId: 593958 },
  { canonicalGamePk: 778130, expectedPitcherIds: [593958, 656849], targetPitcherId: 656849 },
  { canonicalGamePk: 778096, expectedPitcherIds: [605488, 641816], targetPitcherId: 605488 },
  { canonicalGamePk: 778096, expectedPitcherIds: [605488, 641816], targetPitcherId: 641816 },
  { canonicalGamePk: 777985, expectedPitcherIds: [571760, 700363], targetPitcherId: 571760 },
  { canonicalGamePk: 777985, expectedPitcherIds: [571760, 700363], targetPitcherId: 700363 },
  { canonicalGamePk: 777891, expectedPitcherIds: [657277, 676664], targetPitcherId: 657277 },
  { canonicalGamePk: 777891, expectedPitcherIds: [657277, 676664], targetPitcherId: 676664 },
  { canonicalGamePk: 777811, expectedPitcherIds: [571510, 668881], targetPitcherId: 571510 },
  { canonicalGamePk: 777811, expectedPitcherIds: [571510, 668881], targetPitcherId: 668881 },
  { canonicalGamePk: 777732, expectedPitcherIds: [641154, 656876], targetPitcherId: 641154 },
  { canonicalGamePk: 777732, expectedPitcherIds: [641154, 656876], targetPitcherId: 656876 },
  { canonicalGamePk: 777700, expectedPitcherIds: [622608, 673540], targetPitcherId: 622608 },
  { canonicalGamePk: 777700, expectedPitcherIds: [622608, 673540], targetPitcherId: 673540 },
  { canonicalGamePk: 777692, expectedPitcherIds: [676979, 693821], targetPitcherId: 676979 },
  { canonicalGamePk: 777692, expectedPitcherIds: [676979, 693821], targetPitcherId: 693821 },
  { canonicalGamePk: 777673, expectedPitcherIds: [608566, 676974], targetPitcherId: 608566 },
  { canonicalGamePk: 777673, expectedPitcherIds: [608566, 676974], targetPitcherId: 676974 },
  { canonicalGamePk: 777553, expectedPitcherIds: [666200, 676962], targetPitcherId: 666200 },
  { canonicalGamePk: 777553, expectedPitcherIds: [666200, 676962], targetPitcherId: 676962 },
  { canonicalGamePk: 777408, expectedPitcherIds: [605135, 605288], targetPitcherId: 605135 },
  { canonicalGamePk: 777408, expectedPitcherIds: [605135, 605288], targetPitcherId: 605288 },
  { canonicalGamePk: 777377, expectedPitcherIds: [624133, 664285], targetPitcherId: 624133 },
  { canonicalGamePk: 777377, expectedPitcherIds: [624133, 664285], targetPitcherId: 664285 },
  { canonicalGamePk: 777320, expectedPitcherIds: [607067, 621121], targetPitcherId: 607067 },
  { canonicalGamePk: 777320, expectedPitcherIds: [607067, 621121], targetPitcherId: 621121 },
  { canonicalGamePk: 777247, expectedPitcherIds: [641793, 663978], targetPitcherId: 641793 },
  { canonicalGamePk: 777247, expectedPitcherIds: [641793, 663978], targetPitcherId: 663978 },
  { canonicalGamePk: 777165, expectedPitcherIds: [450203, 656849], targetPitcherId: 450203 },
  { canonicalGamePk: 777165, expectedPitcherIds: [450203, 656849], targetPitcherId: 656849 },
  { canonicalGamePk: 777169, expectedPitcherIds: [573186, 693433], targetPitcherId: 573186 },
  { canonicalGamePk: 777169, expectedPitcherIds: [573186, 693433], targetPitcherId: 693433 },
  { canonicalGamePk: 777122, expectedPitcherIds: [684007, 701542], targetPitcherId: 684007 },
  { canonicalGamePk: 777122, expectedPitcherIds: [684007, 701542], targetPitcherId: 701542 },
  { canonicalGamePk: 777112, expectedPitcherIds: [647336, 656302], targetPitcherId: 647336 },
  { canonicalGamePk: 777112, expectedPitcherIds: [647336, 656302], targetPitcherId: 656302 },
  { canonicalGamePk: 777072, expectedPitcherIds: [608566, 657746], targetPitcherId: 608566 },
  { canonicalGamePk: 777072, expectedPitcherIds: [608566, 657746], targetPitcherId: 657746 },
  { canonicalGamePk: 776893, expectedPitcherIds: [605135, 607625], targetPitcherId: 605135 },
  { canonicalGamePk: 776893, expectedPitcherIds: [605135, 607625], targetPitcherId: 607625 },
  { canonicalGamePk: 776872, expectedPitcherIds: [641778, 685299], targetPitcherId: 641778 },
  { canonicalGamePk: 776872, expectedPitcherIds: [641778, 685299], targetPitcherId: 685299 },
  { canonicalGamePk: 776845, expectedPitcherIds: [607074, 683004], targetPitcherId: 607074 },
  { canonicalGamePk: 776845, expectedPitcherIds: [607074, 683004], targetPitcherId: 683004 },
  { canonicalGamePk: 776824, expectedPitcherIds: [622491, 656876], targetPitcherId: 622491 },
  { canonicalGamePk: 776824, expectedPitcherIds: [622491, 656876], targetPitcherId: 656876 },
  { canonicalGamePk: 776809, expectedPitcherIds: [593958, 687134], targetPitcherId: 593958 },
  { canonicalGamePk: 776809, expectedPitcherIds: [593958, 687134], targetPitcherId: 687134 },
  { canonicalGamePk: 776746, expectedPitcherIds: [518876, 668678], targetPitcherId: 518876 },
  { canonicalGamePk: 776746, expectedPitcherIds: [518876, 668678], targetPitcherId: 668678 },
  { canonicalGamePk: 776468, expectedPitcherIds: [668678, 683004], targetPitcherId: 668678 },
  { canonicalGamePk: 776468, expectedPitcherIds: [668678, 683004], targetPitcherId: 683004 },
  { canonicalGamePk: 776456, expectedPitcherIds: [650911, 678368], targetPitcherId: 650911 },
  { canonicalGamePk: 776456, expectedPitcherIds: [650911, 678368], targetPitcherId: 678368 },
  { canonicalGamePk: 776410, expectedPitcherIds: [676979, 806960], targetPitcherId: 676979 },
  { canonicalGamePk: 776410, expectedPitcherIds: [676979, 806960], targetPitcherId: 806960 },
  { canonicalGamePk: 776372, expectedPitcherIds: [670912, 700249], targetPitcherId: 670912 },
  { canonicalGamePk: 776372, expectedPitcherIds: [670912, 700249], targetPitcherId: 700249 },
  { canonicalGamePk: 776213, expectedPitcherIds: [660271, 694297], targetPitcherId: 660271 },
  { canonicalGamePk: 776213, expectedPitcherIds: [660271, 694297], targetPitcherId: 694297 },
  { canonicalGamePk: 776184, expectedPitcherIds: [607074, 663436], targetPitcherId: 607074 },
  { canonicalGamePk: 776184, expectedPitcherIds: [607074, 663436], targetPitcherId: 663436 },
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
