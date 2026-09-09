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
  return { asOf: view.asOf, operatingDate: view.date, champion: MLB_CHAMPION, featureSet: 'MLB_ML_FEATURE_SET_V1', featureCount: 76, policy: MLB_POLICY,
    currentRun: latestCoordinator, currentRunState: telemetry.error ? 'COORDINATOR_TELEMETRY_UNAVAILABLE' : latestCoordinator ? latestCoordinator.status : 'NO_ACTIVE_COORDINATOR_TELEMETRY', lastPublishedRun: mission.providerAccounting.runs.at(-1) ?? null,
    accountingAsOf: mission.generatedAt, providerAccounting: mission.providerAccounting, dmlAccounting: mission.productionDml,
    accountingNote: 'Last published certification accounting; not a live provider counter. Active run journals remain on the coordinator host.',
    storedGames: view.games.length, blockedGames: view.games.filter(g => g.reason).map(g => ({ gamePk: g.gamePk, reason: g.reason })),
    predictionCount: view.games.filter(g => g.predictionAt).length, valueCount: view.board.rows.length, officialPickCount: view.board.rows.filter(r => r.status === 'OFFICIAL_PICK').length,
    freshness: view.games.map(g => ({ gamePk: g.gamePk, gameEvidenceAt: g.evidenceAt, predictionAt: g.predictionAt })), automation: { activation: automation.activation, dryCertification: automation.dryCertification, reason: automation.reason }, settlement: performance.status, warnings: view.warnings, readProviderCalls: 0, readProductionDml: 0 }
}
