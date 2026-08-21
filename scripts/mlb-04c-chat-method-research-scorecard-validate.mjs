import fs from 'node:fs'
import { auditMlb04cChatMethodResearchScorecard } from '../src/services/mlb-04c-chat-method-research-scorecard.service.ts'

const SERVICE_PATH = 'src/services/mlb-04c-chat-method-research-scorecard.service.ts'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04C_CHAT_METHOD_RESEARCH_SCORECARD.md'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04c-chat-method-research-scorecard.json'

function check(name, condition) {
  if (!condition) throw new Error(`${name} failed`)
  console.log(`PASS ${name}`)
}

const service = fs.readFileSync(SERVICE_PATH, 'utf8')
const doc = fs.readFileSync(DOC_PATH, 'utf8')
const certRaw = fs.readFileSync(CERT_PATH, 'utf8')
const cert = JSON.parse(certRaw)
const audit = auditMlb04cChatMethodResearchScorecard()

check('classification', cert.classification === 'MLB_04C_CHAT_METHOD_RESEARCH_SCORECARD_CERTIFIED')
check('runtime classification', audit.classification === cert.classification)
check('methodology version', audit.methodologyVersion === 'MLB_CHAT_METHOD_RESEARCH_SHADOW_V1')
check('scorecard version', audit.scorecardVersion === 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V1')
check('snapshot dependency version', audit.snapshotDependencyVersion === 'MLB_04B_RESEARCH_SNAPSHOT_CONTRACT_V1')
check('three row chat comparison unavailable', cert.existingThreeRowForwardLedger.chatMethodComparisonAvailableForExistingRows === false)
check('forward sample not sufficient', cert.existingThreeRowForwardLedger.forwardSampleSufficientForPromotion === false)
check('seven components', cert.scorecardContract.components.length === 7 && audit.scorecardContract.components.length === 7)
check('bounded range', cert.scorecardContract.range[0] === -1 && cert.scorecardContract.range[1] === 1)
check('missing not neutral', /NOT_COERCED_TO_ZERO/.test(cert.scorecardContract.missingDataPolicy) && service.includes('score === null'))
check('equal research weights only', cert.scorecardContract.componentWeightPolicy === 'EQUAL_RESEARCH_WEIGHTS_OVER_AVAILABLE_TIMESTAMP_SAFE_COMPONENTS')
check('not optimized against three rows', cert.scorecardContract.compositeOptimizationAgainstThreeRows === false)
check('no chat probability', cert.comparisonContract.chatProbabilityMetricsEnabled === false && audit.readiness.CHAT_METHOD_PROBABILITY_READY === 'NO')
check('starter contract pregame', cert.componentContracts.STARTER_EDGE.timestampRequirement === 'source_timestamp < event_start')
check('offense prior game only', /prior-game/.test(cert.componentContracts.OFFENSE_EDGE.source))
check('bullpen prior game only', /prior-game/.test(cert.componentContracts.BULLPEN_EDGE.source))
check('split temporal provenance unavailable', cert.componentContracts.SPLIT_EDGE.missingBehavior === 'UNAVAILABLE_TEMPORAL_PROVENANCE')
check('lineup snapshot specific', /MORNING projected/.test(cert.componentContracts.LINEUP_EDGE.source))
check('context blockers explicit', cert.componentContracts.CONTEXT_EDGE.missingBehavior === 'MISSING_CONTEXT_BLOCKER')
check('market exact identity', cert.componentContracts.MARKET_VALUE.source.includes('exact market identity'))
check('morning cannot use final pregame', audit.snapshotDependency.MORNING.includes('only MORNING'))
check('current probe cannot substitute', cert.snapshotDependency.currentProbeSubstitutionAllowed === false)
check('why changed fields complete', cert.snapshotDependency.whyScoreChangedFields.includes('market_odds_change') && cert.snapshotDependency.whyScoreChangedFields.includes('component_score_change'))
check('forward ledger immutable', cert.forwardLedgerContract.immutable === true && cert.forwardLedgerContract.noRetrospectiveRows === true)
check('ledger fields include raw calibrated chat result profit', ['raw_probability', 'calibrated_probability', 'chat_method_component_scores', 'result_after_settlement', 'profit_after_settlement'].every((field) => cert.forwardLedgerContract.fields.includes(field)))
check('research origin isolated', cert.researchOriginContract.isCurrent === false && cert.researchOriginContract.officialPick === false && cert.researchOriginContract.productVisible === false)
check('same opportunity exact line', cert.comparisonContract.sameOpportunityKeys.includes('line'))
check('dry run provider db zero', cert.currentForwardDryRun.providerCalls === 0 && cert.currentForwardDryRun.databaseMutations === 0 && cert.currentForwardDryRun.persistenceWrites === 0)
check('dry run candidates evaluated', audit.currentForwardDryRun.candidatesEvaluated === 2)
check('dry run ranks deterministic', audit.currentForwardDryRun.candidates.every((candidate, index) => candidate.researchRank === index + 1))
check('temporal safety dry run', audit.currentForwardDryRun.candidates.every((candidate) => candidate.temporalStatus === 'PREGAME'))
check('component scores in range', audit.currentForwardDryRun.candidates.every((candidate) => candidate.componentScores.every((component) => component.score === null || (component.score >= -1 && component.score <= 1))))
check('missing components remain null', audit.currentForwardDryRun.candidates.some((candidate) => candidate.missingComponents.includes('SPLIT_EDGE')))
check('no retrospective rows guard', cert.guards.noRetrospectiveChatMethodRows === true && audit.guards.noRetrospectiveChatMethodRows === true)
check('no 80 accuracy guard', cert.guards.noAccuracyClaimWithoutFrozenLedger === true && /No accuracy claim/.test(doc))
check('no copied probabilities', cert.guards.noCopiedChatGptProbabilities === true && /does not convert the composite score into a probability/.test(doc))
check('product isolation', cert.guards.noProductionModelChange === true && cert.guards.noOfficialPickChange === true)
check('write isolation', cert.guards.noCurrentEraShadowWrites === true && cert.guards.noSettlementWrites === true)
check('learning calibration isolation', cert.guards.noLearningWrites === true && cert.guards.noCalibrationWrites === true)
check('sportsdataio excluded', cert.guards.sportsDataIoExcluded === true)
check('nfl nba isolation', cert.guards.nflIsolation === true && cert.guards.nbaIsolation === true)
check('pitcher prop research only', cert.derivativeReuse.pitcherProps === 'YES_RESEARCH_ONLY')
check('nrfi research only', cert.derivativeReuse.nrfiYrfi === 'YES_RESEARCH_ONLY')
check('readiness scorecard yes', cert.readiness.CHAT_METHOD_SCORECARD_READY === 'YES')
check('readiness ledger yes', cert.readiness.CHAT_METHOD_FORWARD_LEDGER_READY === 'YES')
check('comparison ready yes', cert.readiness.RAW_CALIBRATED_CHAT_COMPARISON_READY === 'YES')
check('provider calls zero', cert.safetyCounters.providerCallsMade === 0 && audit.safetyCounters.providerCallsMade === 0)
check('database mutations zero', cert.safetyCounters.productionDatabaseMutations === 0 && audit.safetyCounters.productionDatabaseMutations === 0)
check('prediction mutations zero', cert.safetyCounters.predictionWrites === 0 && cert.safetyCounters.currentEraShadowWrites === 0)
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, doc, certRaw].join('\n')))

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_04c_chat_method_research_scorecard_validate',
  classification: cert.classification,
  checks: 50,
  providerCallsMade: cert.safetyCounters.providerCallsMade,
  productionDatabaseMutations: cert.safetyCounters.productionDatabaseMutations,
  chatMethodProbabilityReady: cert.readiness.CHAT_METHOD_PROBABILITY_READY,
}, null, 2))
