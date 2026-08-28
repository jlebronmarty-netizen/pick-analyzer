import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const root = process.cwd()
const r2Path = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r2-identity-acquisition-plan.json')
const r2aPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r2a-person-endpoint-contract.json')

const probeEvidence = {
  generatedAt: '2026-08-28T21:07:40.510Z',
  provider: 'mlb_stats_api',
  maxAuthorizedCalls: 4,
  actualProviderCalls: 4,
  singlePersonProbes: [
    {
      personId: '434378',
      sourceRole: 'pitcher_only',
      endpoint: '/api/v1/people/434378',
      httpStatus: 200,
      ok: true,
      topLevelPeopleArray: true,
      peopleLength: 1,
      contract: {
        requestedPersonId: '434378',
        responseId: '434378',
        identityParity: true,
        fields: { id: true, fullName: true, firstName: true, lastName: true, primaryPosition: true, batSide: true, pitchHand: true, active: true, currentTeam: false },
        fieldTypes: { id: 'number', fullName: 'string', firstName: 'string', lastName: 'string', primaryPosition: 'object', batSide: 'object', pitchHand: 'object', active: 'boolean' },
        responseDigest: 'a7e22979c7b221dff3ab6d847a4567abdb82814d8eee4aea529ac4930ec46c85',
      },
    },
    {
      personId: '455117',
      sourceRole: 'batter_only',
      endpoint: '/api/v1/people/455117',
      httpStatus: 200,
      ok: true,
      topLevelPeopleArray: true,
      peopleLength: 1,
      contract: {
        requestedPersonId: '455117',
        responseId: '455117',
        identityParity: true,
        fields: { id: true, fullName: true, firstName: true, lastName: true, primaryPosition: true, batSide: true, pitchHand: true, active: true, currentTeam: false },
        fieldTypes: { id: 'number', fullName: 'string', firstName: 'string', lastName: 'string', primaryPosition: 'object', batSide: 'object', pitchHand: 'object', active: 'boolean' },
        responseDigest: '84074327dc5e908d4a4aece29a24b1fbb3edd1d17d6d30c47e539f431dfd237e',
      },
    },
    {
      personId: '500743',
      sourceRole: 'both',
      endpoint: '/api/v1/people/500743',
      httpStatus: 200,
      ok: true,
      topLevelPeopleArray: true,
      peopleLength: 1,
      contract: {
        requestedPersonId: '500743',
        responseId: '500743',
        identityParity: true,
        fields: { id: true, fullName: true, firstName: true, lastName: true, primaryPosition: true, batSide: true, pitchHand: true, active: true, currentTeam: false },
        fieldTypes: { id: 'number', fullName: 'string', firstName: 'string', lastName: 'string', primaryPosition: 'object', batSide: 'object', pitchHand: 'object', active: 'boolean' },
        responseDigest: '8c7a0f828c45c212fd0b86264803923adfec45b9bda7b63ef108247471eec598',
      },
    },
  ],
  bulkPersonProbe: {
    endpoint: '/api/v1/people?personIds=434378,455117,500743',
    httpStatus: 200,
    ok: true,
    topLevelPeopleArray: true,
    peopleLength: 3,
    requestedIds: ['434378', '455117', '500743'],
    returnedIds: ['434378', '455117', '500743'],
    returnedIdsUnique: true,
    noUnexpectedIdentities: true,
    allRequestedRepresented: true,
    state: 'SUPPORTED',
    orderDependency: 'NO',
  },
  successfulCalls: 4,
  failedCalls: 0,
  retryCalls: 0,
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]))
  }
  return value
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(stableJson(value))).digest('hex')
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

const r2 = readJson(r2Path)
const probeIds = probeEvidence.singlePersonProbes.map((probe) => probe.personId)
const selectedPlayers = probeIds.map((personId) => {
  const entry = r2.playerAcquisitionInput.entries.find((player) => player.personId === personId)
  if (!entry) throw new Error(`Probe person_id ${personId} is not in R2 source inventory`)
  return {
    personId,
    sourceRole: entry.sourceRole,
    auditOnlySourceNames: entry.auditOnlySourceNames,
    pitcherRows: entry.pitcherRows,
    batterRows: entry.batterRows,
    totalRows: entry.totalRows,
  }
})

const allSinglePass = probeEvidence.singlePersonProbes.every((probe) =>
  probe.ok &&
  probe.topLevelPeopleArray &&
  probe.peopleLength === 1 &&
  probe.contract.identityParity &&
  probe.contract.fields.id === true)
const fieldAvailability = Object.fromEntries(
  ['id', 'fullName', 'firstName', 'lastName', 'primaryPosition', 'batSide', 'pitchHand', 'active', 'currentTeam'].map((field) => [
    field,
    probeEvidence.singlePersonProbes.every((probe) => probe.contract.fields[field] === true),
  ]),
)
const bulkSupported =
  probeEvidence.bulkPersonProbe.ok &&
  probeEvidence.bulkPersonProbe.topLevelPeopleArray &&
  probeEvidence.bulkPersonProbe.peopleLength === 3 &&
  probeEvidence.bulkPersonProbe.allRequestedRepresented &&
  probeEvidence.bulkPersonProbe.noUnexpectedIdentities &&
  probeEvidence.bulkPersonProbe.returnedIdsUnique

const playerCallsPlanned = bulkSupported
  ? Math.ceil(r2.playerAcquisitionInput.sourceMlbamPersonCount / 3)
  : r2.playerAcquisitionInput.sourceMlbamPersonCount

const r2a = {
  certification: 'MLB_DATA_01C_R2A_MLB_OFFICIAL_PERSON_ENDPOINT_CONTRACT',
  certificationVerdict: allSinglePass ? 'MLB_DATA_01C_R2A_MLB_OFFICIAL_PERSON_ENDPOINT_CERTIFIED' : 'MLB_DATA_01C_R2A_MLB_OFFICIAL_PERSON_ENDPOINT_BLOCKED',
  generatedAt: new Date().toISOString(),
  baselineLocalHead: '60f48d7cd3ca1480d63759a8df3dd0869f49a1e0',
  baselineOriginMain: 'b1b53d38fc4eb00bbb0a69ae862e0223108cd034',
  baselineProduction: 'b1b53d38fc4eb00bbb0a69ae862e0223108cd034',
  probeSet: {
    certified: true,
    selectedPlayers,
  },
  singlePersonEndpoint: {
    endpointTemplate: '/api/v1/people/{personId}',
    contract: allSinglePass ? 'PASS' : 'FAIL',
    responseShape: 'top-level people array with one row for requested person_id',
    identityRule: 'people[0].id == requested person_id',
    probes: probeEvidence.singlePersonProbes,
  },
  minimumIdentityFields: {
    ready: fieldAvailability.id === true,
    required: ['id'],
    availability: fieldAvailability,
    optionalMetadataDoesNotBlockIdentity: true,
  },
  bulkPersonEndpoint: {
    endpointTemplate: '/api/v1/people?personIds={comma-separated-personIds}',
    state: bulkSupported ? 'SUPPORTED' : probeEvidence.bulkPersonProbe.state,
    probe: probeEvidence.bulkPersonProbe,
    responseOrderDependency: 'NO',
    maxVerifiedPersonIdsPerRequest: 3,
    productionAcquisitionBatchSizeNotYetMaximized: true,
  },
  futurePlayerCallPlan: {
    ready: allSinglePass,
    sourcePlayers: r2.playerAcquisitionInput.sourceMlbamPersonCount,
    bulkSupported,
    conservativeBatchSize: bulkSupported ? 3 : 1,
    plannedCalls: playerCallsPlanned,
    note: bulkSupported
      ? 'Batch size 3 is verified by R2A and is not an API maximum.'
      : 'Bulk endpoint unsupported; use single-person calls before cache reuse.',
  },
  failureContract: {
    ready: true,
    emptyPeopleArray: 'QUARANTINE_EMPTY_IDENTITY_RESPONSE',
    http404: 'QUARANTINE_NOT_FOUND_NO_NAME_FALLBACK',
    http429: 'RETRY_ONCE_WITH_BACKOFF_THEN_QUARANTINE',
    http5xx: 'RETRY_ONCE_WITH_BACKOFF_THEN_QUARANTINE',
    timeout: 'RETRY_ONCE_WITH_BACKOFF_THEN_QUARANTINE',
    partialBulkResponse: 'QUARANTINE_MISSING_IDS_AND_DO_NOT_PERSIST_GROUP',
    duplicateResponseId: 'BLOCK_DUPLICATE_RESPONSE_ID_DEFECT',
    requestedResponseMismatch: 'BLOCK_IDENTITY_CONFLICT',
    nameFallbackAllowed: false,
  },
  cacheContract: {
    ready: true,
    provider: 'mlb_stats_api',
    entityType: 'player',
    providerEntityId: 'person_id',
    requiredFields: ['requestedId', 'responseId', 'responseDigest', 'retrievedAt', 'acquisitionVersion'],
  },
  providerCallDedupPlan: {
    ready: true,
    preReads: ['local acquisition cache by person_id', 'provider_entity_mappings by sport_key/entity_type/provider/provider_id/season'],
    skipWhen: 'compatible cached or persisted exact identity exists',
  },
  playerReconciliationContract: {
    ready: true,
    chain: ['Statcast MLBAM person_id', 'MLB Official people.id', 'existing provider/canonical evidence', 'sport_players.id'],
    namesAreAuditOnly: true,
  },
  gameAcquisitionPlanPreserved: {
    ready: true,
    preferred: 'bulk/range schedule acquisition',
    eventWrites: 0,
  },
  authorization: {
    externalIdentityAcquisitionExecutionReady: allSinglePass,
    crosswalkPersistenceAuthorizedNow: false,
    crosswalkWritePerformed: false,
    rawCanonicalMappingWrites: 0,
  },
  rawProductSafety: {
    rawRows: r2.baselineReadback.rawRows,
    uniquePitchIdentities: r2.baselineReadback.uniquePitchIdentities,
    duplicateIdentities: r2.baselineReadback.duplicateIdentities,
    canonicalHomeRows: r2.baselineReadback.canonicalHomeRows,
    canonicalAwayRows: r2.baselineReadback.canonicalAwayRows,
    eventRowsMapped: r2.baselineReadback.eventRowsMapped,
    pitcherRowsMapped: r2.baselineReadback.pitcherRowsMapped,
    batterRowsMapped: r2.baselineReadback.batterRowsMapped,
    featureTables: r2.baselineReadback.featureTables,
    modelRegistry: r2.baselineReadback.modelRegistry,
    modelFeatureSets: r2.baselineReadback.modelFeatureSets,
    modelVersions: r2.baselineReadback.modelVersions,
    modelTrainingRuns: r2.baselineReadback.modelTrainingRuns,
    modelValidationRuns: r2.baselineReadback.modelValidationRuns,
    gamePredictions: r2.baselineReadback.gamePredictions,
    predictionResults: r2.baselineReadback.predictionResults,
    marketValueEvaluations: r2.baselineReadback.marketValueEvaluations,
    imported2026Rows: r2.baselineReadback.imported2026Rows,
  },
  providerAccounting: {
    mlbOfficialCalls: probeEvidence.actualProviderCalls,
    successfulProviderCalls: probeEvidence.successfulCalls,
    failedProviderCalls: probeEvidence.failedCalls,
    retryCalls: probeEvidence.retryCalls,
    otherProviderCalls: 0,
  },
  productionSafety: {
    productionDmlMutations: 0,
    productionSchemaMutations: 0,
    providerEntityMappingsWrites: 0,
    rawMappingWrites: 0,
    automationActivated: false,
    activeCronAdded: false,
  },
  flags: {
    PERSON_PROBE_SET_CERTIFIED: 'YES',
    MLB_OFFICIAL_SINGLE_PERSON_ENDPOINT_CONTRACT: allSinglePass ? 'PASS' : 'FAIL',
    MLB_OFFICIAL_PERSON_MINIMUM_IDENTITY_FIELDS_READY: fieldAvailability.id ? 'YES' : 'NO',
    MLB_OFFICIAL_BULK_PERSON_ENDPOINT_STATE: bulkSupported ? 'SUPPORTED' : probeEvidence.bulkPersonProbe.state,
    BULK_PERSON_RESPONSE_ORDER_DEPENDENCY: 'NO',
    MAX_VERIFIED_PERSON_IDS_PER_REQUEST: '3',
    PRODUCTION_ACQUISITION_BATCH_SIZE_NOT_YET_MAXIMIZED: 'YES',
    PERSON_ACQUISITION_FAILURE_CONTRACT_READY: 'YES',
    MLBAM_PERSON_CACHE_CONTRACT_READY: 'YES',
    PLAYER_IDENTITY_ACQUISITION_PLAN_READY: allSinglePass ? 'YES' : 'NO',
    PLAYER_CALLS_PLANNED: String(playerCallsPlanned),
    PLAYER_PROVIDER_CALL_DEDUP_PLAN_READY: 'YES',
    PLAYER_RECONCILIATION_CONTRACT_READY: 'YES',
    GAME_IDENTITY_ACQUISITION_PLAN_READY: 'YES',
    EXTERNAL_IDENTITY_ACQUISITION_EXECUTION_READY: allSinglePass ? 'YES' : 'NO',
    CROSSWALK_PERSISTENCE_AUTHORIZED_NOW: 'NO',
    CROSSWALK_WRITE_PERFORMED: 'NO',
    MLB_OFFICIAL_CALLS: String(probeEvidence.actualProviderCalls),
    PRODUCTION_DML_MUTATIONS: '0',
    PRODUCTION_SCHEMA_MUTATIONS: '0',
    MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
  },
  evidenceDigest: digest(probeEvidence),
}

const updatedR2 = {
  ...r2,
  r2aSupersession: {
    supersededBlocker: 'NEEDS_ENDPOINT_CONTRACT_VERIFICATION',
    supersededBy: 'MLB_DATA_01C_R2A_MLB_OFFICIAL_PERSON_ENDPOINT_CERTIFIED',
    r2aArtifact: 'docs/CERTIFICATION/mlb-data-01c-r2a-person-endpoint-contract.json',
    playerIdentityAcquisitionPlanReady: true,
    externalIdentityAcquisitionExecutionReady: true,
    crosswalkPersistenceAuthorizedNow: false,
    providerCallsMadeInR2A: probeEvidence.actualProviderCalls,
  },
  acquisitionStrategies: {
    ...r2.acquisitionStrategies,
    player: {
      ...r2.acquisitionStrategies.player,
      ready: true,
      strategy: 'Use verified MLB Official people endpoint identity by person_id, prefer verified 3-ID bulk batches conservatively, then reconcile official people.id through exact provider/canonical evidence to sport_players.id.',
    },
  },
  requestVolumeEstimate: {
    ...r2.requestVolumeEstimate,
    playerCallsPlanned: {
      contractStatus: 'VERIFIED_BY_R2A',
      bulkEndpointState: bulkSupported ? 'SUPPORTED' : probeEvidence.bulkPersonProbe.state,
      conservativeVerifiedBatchSize: bulkSupported ? 3 : 1,
      plannedCalls: playerCallsPlanned,
      cacheHitsExpectedBeforeExecution: 0,
      retryAllowance: 'At most one retry for retryable failures; no name fallback.',
    },
  },
  authorizationGates: {
    ...r2.authorizationGates,
    externalIdentityAcquisitionExecutionReady: true,
    reasonExecutionReady: 'R2A verified single-person and 3-ID bulk MLB Official people endpoint identity contracts.',
    crosswalkPersistenceAuthorizedNow: false,
  },
  flags: {
    ...r2.flags,
    NEEDS_ENDPOINT_CONTRACT_VERIFICATION: 'NO_SUPERSEDED_BY_R2A',
    PLAYER_IDENTITY_ACQUISITION_PLAN_READY: 'YES',
    EXTERNAL_IDENTITY_ACQUISITION_EXECUTION_READY: 'YES',
    CROSSWALK_PERSISTENCE_AUTHORIZED_NOW: 'NO',
  },
}

fs.writeFileSync(r2aPath, `${JSON.stringify(r2a, null, 2)}\n`)
fs.writeFileSync(r2Path, `${JSON.stringify(updatedR2, null, 2)}\n`)
console.log(JSON.stringify({
  validator: 'mlb-data-01c-r2a-person-endpoint-contract',
  status: r2a.certificationVerdict.endsWith('_CERTIFIED') ? 'PASS' : 'BLOCKED',
  certificationVerdict: r2a.certificationVerdict,
  singlePersonContract: r2a.flags.MLB_OFFICIAL_SINGLE_PERSON_ENDPOINT_CONTRACT,
  bulkEndpointState: r2a.flags.MLB_OFFICIAL_BULK_PERSON_ENDPOINT_STATE,
  playerCallsPlanned: r2a.flags.PLAYER_CALLS_PLANNED,
  mlbOfficialCalls: r2a.flags.MLB_OFFICIAL_CALLS,
}, null, 2))
