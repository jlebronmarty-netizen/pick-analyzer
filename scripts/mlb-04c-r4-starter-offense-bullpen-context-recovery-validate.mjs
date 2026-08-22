import fs from 'node:fs'
import {
  auditMlb04cChatMethodResearchScorecard,
  auditMlb04cR4StarterOffenseBullpenContextRecovery,
  MLB_04C_R4_SCORECARD_VERSION,
  MLB_04C_SCORECARD_VERSION,
} from '../src/services/mlb-04c-chat-method-research-scorecard.service.ts'

const SERVICE_PATH = 'src/services/mlb-04c-chat-method-research-scorecard.service.ts'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04C_R4_STARTER_OFFENSE_BULLPEN_CONTEXT_RECOVERY.md'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04c-r4-starter-offense-bullpen-context-recovery.json'

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function check(name, condition) {
  if (!condition) throw new Error(`${name} failed`)
  console.log(`PASS ${name}`)
}

const service = read(SERVICE_PATH)
const doc = read(DOC_PATH)
const certRaw = read(CERT_PATH)
const cert = JSON.parse(certRaw)
const v1 = auditMlb04cChatMethodResearchScorecard()
const r4 = auditMlb04cR4StarterOffenseBullpenContextRecovery()
const fixture = r4.forwardFixtureDryRun

check('classification', cert.classification === 'MLB_04C_R4_STARTER_OFFENSE_BULLPEN_CONTEXT_RECOVERY_CERTIFIED')
check('runtime classification', r4.classification === cert.classification)
check('v1 preserved', v1.scorecardVersion === MLB_04C_SCORECARD_VERSION && cert.previousScorecardVersion === MLB_04C_SCORECARD_VERSION)
check('v2 future only', r4.futureScorecardVersion === MLB_04C_R4_SCORECARD_VERSION && cert.futureScorecardVersion === MLB_04C_R4_SCORECARD_VERSION)
check('observation frozen', r4.observation1.OBSERVATION_1_FROZEN === 'YES' && cert.observation1.OBSERVATION_1_FROZEN === 'YES')
check('observation regression stable', r4.observation1.frozenScore === -0.0296 && r4.observation1.frozenCompleteness === 0.1429)
check('observation only market value', r4.observation1.usableComponents.length === 1 && r4.observation1.usableComponents[0] === 'MARKET_VALUE')
check('no retrospective enrichment', r4.observation1.NO_RETROSPECTIVE_ENRICHMENT === 'YES' && /not retrospectively enriched/.test(doc))
check('scorecard version separation', cert.scorecardVersioning.materialBehaviorChange === true && cert.scorecardVersioning.v1FrozenForExistingRows === true && cert.scorecardVersioning.v2FutureOnly === true)
check('starter source priority', cert.componentContracts.STARTER_EDGE.sourcePriority[0] === 'mlb_starter_assignments' && cert.componentContracts.STARTER_EDGE.sourcePriority.includes('sport_lineups'))
check('starter temporal safety', cert.componentContracts.STARTER_EDGE.timestampRequirement === 'source_timestamp < target_event_start')
check('starter missing behavior', cert.componentContracts.STARTER_EDGE.missingBehavior === 'STARTER_EDGE_BLOCKED_MISSING_CERTIFIED_STARTER_IDENTITY')
check('offense prior-game cutoff', cert.componentContracts.OFFENSE_EDGE.timestampRequirement === 'source_game.start_time < target_event.start_time')
check('offense fixed windows', ['last5Games', 'last10Games', 'seasonToDateBaseline', 'homeAwayContext'].every((item) => cert.componentContracts.OFFENSE_EDGE.windows.includes(item)))
check('offense deterministic normalization', /bounded average/.test(cert.componentContracts.OFFENSE_EDGE.normalization))
check('bullpen temporal cutoff', cert.componentContracts.BULLPEN_EDGE.timestampRequirement === 'source_timestamp < target_event_start')
check('bullpen deterministic normalization', /workloadLast1/.test(cert.componentContracts.BULLPEN_EDGE.formula) && /clamped/.test(cert.componentContracts.BULLPEN_EDGE.normalization))
check('market-aware directionality', /starter and bullpen run suppression favor Under/.test(cert.marketSpecificDirectionality.total))
check('missing as null policy', fixture.missingComponents.includes('SPLIT_EDGE') && fixture.missingComponents.includes('LINEUP_EDGE') && fixture.missingComponents.includes('CONTEXT_EDGE'))
check('component bounds', fixture.componentScores.every((component) => component.score === null || (component.score >= -1 && component.score <= 1)))
check('target components available', ['STARTER_EDGE', 'OFFENSE_EDGE', 'BULLPEN_EDGE', 'MARKET_VALUE'].every((component) => fixture.availableComponents.includes(component)))
check('completeness target', fixture.overallResearchCompleteness === 0.5714 && cert.projectedCompleteness === 0.5714)
check('composite deterministic', fixture.compositeScore !== null && fixture.compositePolicy === 'EQUAL_RESEARCH_WEIGHTS_OVER_AVAILABLE_TIMESTAMP_SAFE_COMPONENTS')
check('morning final separation', cert.snapshotFieldContract.morningFinalSeparated === true && cert.snapshotFieldContract.noOverwrite === true)
check('raw isolation', r4.guards.noProductionModelChange === true && r4.readiness.PRODUCTION_MODEL_CHANGED === 'NO')
check('calibrated isolation', r4.guards.noCalibrationWrites === true && r4.readiness.CHAT_METHOD_PROBABILITY_READY === 'NO')
check('product isolation', r4.guards.noProductWrites === true && r4.guards.noOfficialPickChange === true)
check('learning isolation', r4.guards.noLearningWrites === true)
check('settlement isolation', r4.guards.noSettlementWrites === true)
check('sportsdataio exclusion', r4.guards.sportsDataIoExcluded === true && /SportsDataIO calls: 0/.test(doc))
check('nfl nba isolation', r4.guards.nflIsolation === true && r4.guards.nbaIsolation === true)
check('provider calls zero', r4.safetyCounters.providerCallsMade === 0 && cert.safetyCounters.providerCallsMade === 0)
check('database mutations zero', r4.safetyCounters.productionDatabaseMutations === 0 && cert.safetyCounters.productionDatabaseMutations === 0)
check('prediction writes zero', r4.safetyCounters.predictionWrites === 0 && r4.safetyCounters.chatResearchPredictionWrites === 0)
check('derivative reuse remains research only', /RESEARCH_ONLY/.test(cert.derivativeReuseImpact.pitcherProps) && /RESEARCH_ONLY/.test(cert.derivativeReuseImpact.nrfiYrfi))
check('readiness flags', r4.readiness.OFFENSE_EDGE_FORWARD_READY === 'YES' && r4.readiness.BULLPEN_EDGE_FORWARD_READY === 'YES' && r4.readiness.MARKET_AWARE_DIRECTIONALITY_CERTIFIED === 'YES')
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, doc, certRaw].join('\n')))

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_04c_r4_starter_offense_bullpen_context_recovery_validate',
  classification: cert.classification,
  scorecardVersion: r4.futureScorecardVersion,
  projectedCompleteness: r4.readiness.R4_PROJECTED_SCORECARD_COMPLETENESS,
  providerCallsMade: r4.safetyCounters.providerCallsMade,
  productionDatabaseMutations: r4.safetyCounters.productionDatabaseMutations,
  chatMethodProbabilityReady: r4.readiness.CHAT_METHOD_PROBABILITY_READY,
}, null, 2))
