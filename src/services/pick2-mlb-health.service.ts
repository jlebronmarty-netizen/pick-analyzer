import 'server-only'
import fs from 'node:fs/promises'
import { getMlbOperationalView } from './pick2-operational-read.service'
import { MLB_CHAMPION, MLB_POLICY } from './pick2-operational-projection'
import { getMlbOfficialPerformance } from './pick2-mlb-performance-read.service'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MLB_OPERATIONAL_JOB_TYPE } from './pick2-operational-telemetry'

export async function getMlbOperationalHealth() {
  const [view, performance, missionText, activationText] = await Promise.all([getMlbOperationalView(), getMlbOfficialPerformance(), fs.readFile('docs/CERTIFICATION/MLB_OPERATIONAL_MISSION_STATUS.json', 'utf8'), fs.readFile('docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json', 'utf8')])
  const mission = JSON.parse(missionText), automation = JSON.parse(activationText)
  const telemetry = await supabaseAdmin.from('sports_sync_jobs').select('id,status,started_at,completed_at,updated_at,metadata').eq('job_type', MLB_OPERATIONAL_JOB_TYPE).eq('sport_key', 'baseball_mlb').order('started_at', { ascending: false }).limit(1)
  const latestCoordinator = !telemetry.error ? telemetry.data?.[0] ?? null : null
  // Server-only bounded reads. Never expose lease holders, reservation receipts,
  // checkpoint references, source payloads or credentials on the public surface.
  const [runRead,missionRead,leaseRead]=await Promise.all([
    supabaseAdmin.from('pick2_mlb_runtime_state').select('run_id,package_sha,run_date,run_as_of,status,updated_at,mlb_official_calls,statcast_calls,odds_calls,stage:checkpoint->>stage,completed:checkpoint->completed,blocked:checkpoint->blocked,scope:checkpoint->scope,result:checkpoint->result,dml:dml_accounting->stages,disposition:checkpoint->disposition->>status,failureCode:checkpoint->failure->>code,failureStage:checkpoint->failure->>stage,failureAt:checkpoint->failure->>timestamp').eq('state_kind','RUN').order('updated_at',{ascending:false}).limit(1),
    supabaseAdmin.from('pick2_mlb_runtime_state').select('mission_odds_calls,updated_at').eq('scope_key','MLB_OPERATIONAL_MISSION').limit(1),
    supabaseAdmin.from('pick2_mlb_runtime_state').select('lease_expires_at').eq('scope_key','MLB_OPERATIONAL_GLOBAL').limit(1),
  ])
  const durable=!runRead.error && !missionRead.error && !leaseRead.error?runRead.data?.[0]:null
  const missionOdds=missionRead.data?.[0]?.mission_odds_calls
  const liveProviders=durable?{scope:'CURRENT_DURABLE_RUN',MLBOfficial:durable.mlb_official_calls,sharedStatcast:durable.statcast_calls,OddsAPI:durable.odds_calls,missionOddsConsumed:missionOdds,missionOddsRemaining:20-Number(missionOdds),BALLDONTLIE:0,SportsDataIO:0,otherSportsProviders:0}:null
  const liveDml=durable && Array.isArray(durable.dml)?durable.dml.map(row=>Object.fromEntries(['stage','target','planned','cap','inserted','updated','reused','conflicts','readback'].map(k=>[k,row && typeof row==='object' && !Array.isArray(row)?row[k]:null]))):null
  const current=durable?{runId:durable.run_id,packageSha:durable.package_sha,date:durable.run_date,asOf:durable.run_as_of,status:durable.disposition??durable.status,stage:durable.stage,completed:durable.completed,eligibleScope:durable.scope,blocked:durable.blocked,result:durable.result,failure:durable.failureCode?{code:durable.failureCode,stage:durable.failureStage,at:durable.failureAt}:null,updatedAt:durable.updated_at,leaseActive:Date.parse(leaseRead.data?.[0]?.lease_expires_at??'')>Date.now()}:latestCoordinator
  return { asOf: view.asOf, operatingDate: view.date, champion: MLB_CHAMPION, featureSet: 'MLB_ML_FEATURE_SET_V1', featureCount: 76, policy: MLB_POLICY,
    currentRun: current, currentRunState: durable?.disposition??durable?.status??(telemetry.error ? 'COORDINATOR_TELEMETRY_UNAVAILABLE' : latestCoordinator ? latestCoordinator.status : 'NO_ACTIVE_COORDINATOR_TELEMETRY'), lastPublishedRun: mission.providerAccounting.runs.at(-1) ?? null,
    accountingAsOf: durable?.updated_at??mission.generatedAt, providerAccounting: liveProviders??mission.providerAccounting, dmlAccounting: liveDml??mission.productionDml,
    accountingNote: durable?'Live durable run accounting; the Odds counter is cumulative across the mission. Business DML excludes runtime coordination updates.':'Last published certification accounting; live durable runtime accounting is unavailable.',
    storedGames: view.games.length, blockedGames: view.games.filter(g => g.reason).map(g => ({ gamePk: g.gamePk, reason: g.reason })),
    predictionCount: view.games.filter(g => g.predictionAt).length, valueCount: view.board.rows.length, officialPickCount: view.board.rows.filter(r => r.status === 'OFFICIAL_PICK').length,
    freshness: view.games.map(g => ({ gamePk: g.gamePk, gameEvidenceAt: g.evidenceAt, predictionAt: g.predictionAt })), automation: { activation: automation.activation, dryCertification: automation.dryCertification, reason: automation.reason }, settlement: performance.status, warnings: view.warnings, readProviderCalls: 0, readProductionDml: 0 }
}
