import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const servicePath = 'src/services/current-board.service.ts'
const homePath = 'src/components/home/HomeBettingPlan.tsx'
const docPath = 'docs/ARCHITECTURE/MLB_PRODUCT_EVIDENCE_BINDING_V1.md'
const certPath = 'docs/CERTIFICATION/mlb-current-board-model-probability-binding.json'

for (const file of [servicePath, homePath, docPath, certPath]) {
  assert(fs.existsSync(file), `missing artifact: ${file}`)
}

const service = read(servicePath)
const home = read(homePath)
const doc = read(docPath)
const cert = JSON.parse(read(certPath))

assert(service.includes('modelProbability: number'), 'CurrentBoardCandidate must expose modelProbability')
assert(service.includes('winProbability: number'), 'CurrentBoardCandidate must expose winProbability')
assert(service.includes('probability: number'), 'CurrentBoardCandidate must expose probability alias')
assert(service.includes('edgePercentagePoints: number | null'), 'CurrentBoardCandidate must expose same-selection edge alias')
assert(service.includes('expectedValuePercent: number | null'), 'CurrentBoardCandidate must expose same-selection EV alias')
assert(service.includes('analysisSnapshotTimestamp: string | null'), 'CurrentBoardCandidate must expose analysis snapshot timestamp')
assert(service.includes('modelProbability: rawProbability'), 'modelProbability must bind to stored prediction_history.model_probability')
assert(service.includes('winProbability: rawProbability'), 'winProbability must bind to stored prediction_history.model_probability')
assert(service.includes('probability: rawProbability'), 'probability alias must bind to stored prediction_history.model_probability')
assert(service.includes('edgePercentagePoints: marketAlignment.edgePercentagePoints'), 'top-level edge must bind to same-selection marketAlignment')
assert(service.includes('expectedValuePercent: marketAlignment.expectedValuePercent'), 'top-level EV must bind to same-selection marketAlignment')
assert(service.includes('analysisSnapshotTimestamp: row.generated_at'), 'analysis snapshot timestamp must bind to prediction generated_at')
assert(service.includes('rawProbability = numberValue(row.model_probability)'), 'stored model_probability must remain the source')
assert(service.includes('modelProbability: oppositeProbability'), 'canonical complement alignment must remain separately available')
assert(service.includes('canonicalMarketAlignment: complementAlignment'), 'canonical complement evidence must remain separate')
assert(home.includes('row.modelProbability ?? row.model_probability ?? row.probability'), 'homepage adapter must consume top-level modelProbability')
assert(home.includes('row.edgePercentagePoints ?? row.edge ?? canonicalEv.edge'), 'homepage adapter must prefer same-selection edge before canonical fallback')
assert(home.includes('row.expectedValuePercent ?? row.expectedValue ?? row.ev ?? canonicalEv.expectedValue'), 'homepage adapter must prefer same-selection EV before canonical fallback')
assert(!service.includes('ODDS_PRIMARY_AUTHORITY_STAGE='), 'repair must not hardcode odds authority')
assert(!service.includes('MLB_DATA_SOURCE_MODE='), 'repair must not hardcode MLB data source mode')
assert(!service.includes('THE_ODDS_API_KEY'), 'repair must not touch provider credentials')
assert(!service.includes('SPORTSDATAIO_MLB_API_KEY'), 'repair must not touch provider credentials')
assert(cert.status === 'MLB_MODEL_PROBABILITY_EVIDENCE_BINDING_REPAIR_READY_FOR_DEPLOYMENT', 'certification status mismatch')
assert(cert.rootCause.classification === 'CURRENT_BOARD_FIELD_NOT_MAPPED', 'root cause classification mismatch')
assert(cert.repair.topLevelModelProbabilityMapped === true, 'modelProbability repair must be certified')
assert(cert.repair.canonicalComplementEvidencePreserved === true, 'canonical evidence preservation must be certified')
assert(cert.protectedInvariants.predictionFormulaChanged === false, 'prediction formula must remain unchanged')
assert(cert.protectedInvariants.modelProbabilityChanged === false, 'model probability values must remain unchanged')
assert(cert.protectedInvariants.evFormulaChanged === false, 'EV formula must remain unchanged')
assert(cert.protectedInvariants.officialPickPolicyChanged === false, 'Official Pick policy must remain unchanged')
assert(cert.protectedInvariants.oddsAuthorityChanged === false, 'odds authority must remain unchanged')
assert(cert.protectedInvariants.nbaHistoricalFoundationChanged === false, 'NBA historical foundation must remain unchanged')
assert(cert.certificationAccounting.providerCallsFromCertificationReads === 0, 'certification reads must make zero provider calls')
assert(cert.certificationAccounting.databaseMutationsFromCertificationReads === 0, 'certification reads must make zero database mutations')
assert(doc.includes('Current Board product candidates must expose the same model probability'), 'architecture doc must define binding purpose')
assert(doc.includes('DTO/evidence-binding defect'), 'architecture doc must document root cause')
assert(doc.includes('No prediction formula'), 'architecture doc must document safety')

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_current_board_model_probability_binding_validate_v1',
  checks: 37,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  classification: cert.status,
}, null, 2))
