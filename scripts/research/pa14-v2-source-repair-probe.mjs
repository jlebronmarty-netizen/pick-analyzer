#!/usr/bin/env node

const EXPECTED_BRANCH = 'research/pa14-v2-blocker-forensics-20260917'
if (
  process.env.VERCEL !== '1' ||
  process.env.VERCEL_ENV !== 'preview' ||
  process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH
) {
  console.log(JSON.stringify({ status: 'PA14_V2_SOURCE_REPAIR_PROBE_SKIPPED_NOT_EXACT_PREVIEW_BRANCH' }))
  process.exit(0)
}

const { auditHistoricalPa14V2Target } = await import('../../src/services/pa14-v2-historical-yield-audit.service.ts')

const REQUIRED = new Map([
  ['called_strike','S'],['swinging_strike','S'],['swinging_strike_blocked','S'],['foul','S'],['foul_tip','S'],
  ['foul_bunt','S'],['missed_bunt','S'],['bunt_foul_tip','S'],['swinging_pitchout','S'],['foul_pitchout','S'],
  ['ball','B'],['blocked_ball','B'],['pitchout','B'],['hit_by_pitch','B'],['intentional_ball','B'],
  ['hit_into_play','X'],['hit_into_play_no_out','X'],['hit_into_play_score','X'],['automatic_ball','B'],['automatic_strike','S'],
])
const AUTO = new Set(['automatic_ball','automatic_strike'])
const OFFICIAL_DESC = new Map([
  ['Called Strike','called_strike'],['Swinging Strike','swinging_strike'],['Swinging Strike (Blocked)','swinging_strike_blocked'],
  ['Foul','foul'],['Foul Tip','foul_tip'],['Foul Bunt','foul_bunt'],['Missed Bunt','missed_bunt'],['Bunt Foul Tip','bunt_foul_tip'],
  ['Swinging Pitchout','swinging_pitchout'],['Foul Pitchout','foul_pitchout'],['Ball','ball'],['Ball In Dirt','blocked_ball'],
  ['Pitchout','pitchout'],['Hit By Pitch','hit_by_pitch'],['Intent Ball','intentional_ball'],['In play, out(s)','hit_into_play'],
  ['In play, no out','hit_into_play_no_out'],['In play, run(s)','hit_into_play_score'],['Automatic Ball','automatic_ball'],
  ['Automatic Strike','automatic_strike'],
])

async function fetchFeed(gamePk) {
  const response = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`MLB_HTTP_${response.status}:${gamePk}`)
  return response.json()
}

function findOfficialPitch(feed, atBatNumber, pitchNumber) {
  const play = feed?.liveData?.plays?.allPlays?.[atBatNumber - 1]
  if (!play || Number(play.atBatIndex) + 1 !== atBatNumber) return null
  const events = Array.isArray(play.playEvents) ? play.playEvents : []
  const event = events.find((row) => row?.isPitch === true && Number(row?.pitchNumber) === pitchNumber)
  if (!event) return null
  const rawDescription = String(event?.details?.description ?? '')
  const description = OFFICIAL_DESC.get(rawDescription) ?? null
  const requiredType = description ? REQUIRED.get(description) ?? null : null
  return {
    rawDescription,
    description,
    requiredType,
    callCode: event?.details?.call?.code ?? null,
    isStrike: event?.details?.isStrike ?? null,
    isBall: event?.details?.isBall ?? null,
    isInPlay: event?.details?.isInPlay ?? null,
    startSpeed: event?.pitchData?.startSpeed ?? null,
    pitchTypeCode: event?.details?.type?.code ?? null,
    pitchTypeDescription: event?.details?.type?.description ?? null,
  }
}

function issuesFromGame(game, role) {
  const issues=[]
  for (const pitch of game.pitches ?? []) {
    if (!AUTO.has(pitch.description) && (pitch.releaseSpeed == null || !Number.isFinite(Number(pitch.releaseSpeed)))) {
      issues.push({role,gamePk:game.gamePk,atBatNumber:pitch.atBatNumber,pitchNumber:pitch.pitchNumber,pitcherMlbamId:pitch.pitcherMlbamId,kind:'MISSING_VELOCITY',raw:pitch})
    }
    const expected = REQUIRED.get(pitch.description)
    if (expected && pitch.type !== expected) {
      issues.push({role,gamePk:game.gamePk,atBatNumber:pitch.atBatNumber,pitchNumber:pitch.pitchNumber,pitcherMlbamId:pitch.pitcherMlbamId,kind:'STRIKE_TYPE_CONFLICT',raw:pitch,expectedType:expected})
    }
  }
  return issues
}

const targets = [
  { canonicalGamePk: 776410, expectedPitcherIds: [676979, 806960], targetPitcherId: 676979 },
  { canonicalGamePk: 776372, expectedPitcherIds: [670912, 700249], targetPitcherId: 670912 },
]

for (const target of targets) {
  const evidence = await auditHistoricalPa14V2Target(target)
  const input=evidence.storedInput
  const issues=[
    ...(input.starts ?? []).flatMap((game)=>issuesFromGame(game,'START')),
    ...(input.opponentGames ?? []).flatMap((game)=>issuesFromGame(game,'OPPONENT')),
  ]
  const byGame=new Map()
  for(const issue of issues){
    const bucket=byGame.get(issue.gamePk) ?? []
    bucket.push(issue)
    byGame.set(issue.gamePk,bucket)
  }

  const gameResults=[]
  for(const [gamePk,gameIssues] of byGame){
    const feed=await fetchFeed(gamePk)
    const checks=gameIssues.map((issue)=>{
      const official=findOfficialPitch(feed,issue.atBatNumber,issue.pitchNumber)
      const exactDescriptionMatch=Boolean(official && official.description===issue.raw.description)
      const velocityRepairable=issue.kind==='MISSING_VELOCITY' && exactDescriptionMatch && Number.isFinite(Number(official?.startSpeed))
      const typeRepairable=issue.kind==='STRIKE_TYPE_CONFLICT' && exactDescriptionMatch && official?.requiredType===issue.expectedType
      return {...issue,official,exactDescriptionMatch,velocityRepairable,typeRepairable}
    })
    gameResults.push({
      gamePk,
      issueCount:checks.length,
      missingVelocity:checks.filter(x=>x.kind==='MISSING_VELOCITY').length,
      strikeTypeConflicts:checks.filter(x=>x.kind==='STRIKE_TYPE_CONFLICT').length,
      exactOfficialPitchMatches:checks.filter(x=>x.official && x.exactDescriptionMatch).length,
      velocityRepairable:checks.filter(x=>x.velocityRepairable).length,
      typeRepairable:checks.filter(x=>x.typeRepairable).length,
      unrepaired:checks.filter(x=>(x.kind==='MISSING_VELOCITY'&&!x.velocityRepairable)||(x.kind==='STRIKE_TYPE_CONFLICT'&&!x.typeRepairable)).length,
      sample:checks.slice(0,8).map(x=>({
        kind:x.kind,atBatNumber:x.atBatNumber,pitchNumber:x.pitchNumber,pitcherMlbamId:x.pitcherMlbamId,
        rawDescription:x.raw.description,rawType:x.raw.type,rawReleaseSpeed:x.raw.releaseSpeed,expectedType:x.expectedType??null,
        official:x.official,exactDescriptionMatch:x.exactDescriptionMatch,velocityRepairable:x.velocityRepairable,typeRepairable:x.typeRepairable,
      })),
    })
  }

  console.log('PA14_V2_SOURCE_REPAIR_PROBE=' + JSON.stringify({
    target:evidence.target,
    builderStatus:evidence.result.status,
    builderReasons:evidence.result.status==='BLOCKED'?evidence.result.reasons:[],
    totalIssues:issues.length,
    gameResults,
    researchOnly:true,
    supabaseWrites:0,
    sportsbookCalls:0,
    modelTrainingAuthorized:false,
  }))
}
