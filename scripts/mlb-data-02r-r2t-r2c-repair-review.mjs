// Pure review/authorization packet builder. No provider, database or live executor.
import assert from 'node:assert/strict'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
export const PROJECT = 'MLB_DATA_02R_R2T_R2C_NATIVE_REPAIR_REVIEW_AND_UNKNOWN_STARTER_RESOLUTION'
export const VERSION = PROJECT + '_V1'
export const PRIOR_SHA = '5602d03907af269061bef97f6dc375fe349eb9b5'
const fieldKey = (p) => `${p.gamePk}:${p.logicalField}`
const transient = (p) => p.logicalField === 'official_status' || p.logicalField === 'metadata.abstractGameState' || p.logicalField.includes('ProbablePitcher')
const get = (row, p) => p.jsonPath ? p.jsonPath.reduce((v, k) => v?.[k], row[p.column]) : row[p.column]
function project(rowPlan, timestamp) {
  const row = structuredClone(rowPlan.expectedRow)
  for (const p of rowPlan.patches) {
    if (p.column === 'updated_at') row.updated_at = timestamp
    else if (p.jsonPath) {
      assert.equal(p.column, 'metadata'); assert.equal(p.jsonPath.length, 1)
      row.metadata[p.jsonPath[0]] = structuredClone(p.newValue)
    } else row[p.column] = structuredClone(p.newValue)
  }
  return row
}

export function buildReview(prior, internal) {
  assert.equal(prior.certificationVerdict, prior.project + '_CERTIFIED')
  assert.equal(prior.preview.patches.length, 140)
  assert.equal(prior.remaining.length, 2)
  assert.ok(prior.remaining.every((p) => p.gamePk === 823092 && p.logicalField.includes('ProbablePitcher')))
  assert.equal(internal.gamePk, 823092)
  assert.equal(internal.sources.find((s) => s.source === 'native').rows.length, 1)
  assert.ok(internal.sources.filter((s) => s.source !== 'native').every((s) => s.total === 0 && s.rows.length === 0), 'NEW_INTERNAL_EVIDENCE_REQUIRES_REVIEW')
  const fresh = internal.sources.find((s) => s.source === 'native').rows[0]
  assert.equal(sha256(fresh), sha256(prior.frozenBaseline.nativeRows.find((n) => n.game_pk === 823092)), 'NATIVE_CHANGED')
  const patches = prior.preview.patches.map((old) => {
    const p = structuredClone(old)
    const excluded = transient(p)
    p.safeToPatch = !excluded
    p.starterDependency = 'NONE_FOR_CANONICAL_ENRICHMENT; explicit UNKNOWN allowed'
    p.currentCanonicalOnly = true
    p.historicallyPregameProven = false
    p.immutabilityClassification = excluded ? 'UNSAFE_HISTORICAL_REWRITE' : p.logicalField.endsWith('_team_id') ? 'SAFE_CANONICAL_ALIAS_ENRICHMENT' : p.column === 'updated_at' ? 'SAFE_CURRENT_STATUS_ENRICHMENT' : 'SAFE_NULL_ENRICHMENT'
    p.reviewReason = excluded
      ? 'Excluded from timeless repair authority: a prior mutable observation must not become unqualified current/historical starter or pregame-status authority. Retain it inside the dated provenance record only.'
      : p.column === 'updated_at' ? 'Actual write bookkeeping timestamp only; no baseball status change or backdating.' : 'Exact canonical identity or null enrichment, with immutable source evidence and dated provenance preserved.'
    if (p.patchPurpose === 'MANDATORY_PROVENANCE') {
      p.newValue = { ...p.newValue, repairVersion: VERSION, repairReason: 'Canonical team/date/type enrichment; mutable observations archived without promoting them to current game state',
        observationOnly: true, notCurrentStateAuthority: true, historicalPregameProven: false,
        originalSourcePayloadDigest: p.preconditions.expectedSourcePayloadDigest,
        canonicalEvidence: prior.matrix.filter((m) => m.gamePk === p.gamePk && ['home_team_id', 'away_team_id', 'game_type', 'metadata.officialDate'].includes(m.logicalField))
          .map((m) => ({ logicalField: m.logicalField, value: m.newValue, priorEvidence: m.priorEvidence, sourceDigest: m.sourceDigest, observedAt: m.sourceTimestamp })) }
    }
    return p
  })
  const safe = patches.filter((p) => p.safeToPatch)
  assert.equal(safe.length, 90)
  assert.equal(new Set(safe.map(fieldKey)).size, safe.length)
  const rows = prior.frozenBaseline.nativeRows.map((native) => {
    const rowPatches = safe.filter((p) => p.gamePk === native.game_pk)
    assert.equal(rowPatches.length, 6)
    for (const p of rowPatches) {
      assert.equal(p.table, 'public.pick2_mlb_games')
      assert.deepEqual(get(native, p) ?? null, p.oldValue, 'EXPECTED_OLD_VALUE')
      assert.equal(sha256(native), p.preconditions.expectedNativeRowDigest)
      if (p.column !== 'updated_at') assert.ok(get(native, p) == null, 'NON_NULL_OVERWRITE')
    }
    return { gamePk: native.game_pk, table: 'public.pick2_mlb_games', expectedRow: native, expectedRowDigest: sha256(native),
      expectedSourceDigest: native.source_payload_digest, repairVersion: VERSION, patches: rowPatches,
      patchDigest: sha256(rowPatches), currentCanonicalOnly: true, historicallyPregameProven: false,
      minimumWriteTimestamp: prior.provenanceContract.conservativeAvailabilityUpperBound,
      predicate: 'Exact game_pk and expected full row digest/old values/source digest, or exact previously applied version and values for REUSE_NO_OP; otherwise BLOCK_CONFLICT',
      concurrency: 'Future executor must lock/re-read each row and atomically compare before update; a preview hash check alone is not a transaction lock',
      starterDependency: 'NONE; unknown and existing original starter evidence preserved' }
  })
  const inventory = prior.remaining.map((r) => ({ gamePk: 823092, table: r.table, column: r.column, jsonPath: r.jsonPath,
    logicalField: r.logicalField, currentValue: null, valueState: 'Top-level metadata key absent; nested original starter_evidence is null',
    expectedSemanticType: 'Positive MLBAM pitcher integer with exact same-game, side and availability provenance',
    side: r.logicalField.includes('home') ? 'home' : 'away', consumer: 'resolveStarterContext -> starter feature identity and buildPregameFeatureRows',
    whyRequired: 'Required only when reconstructing or predicting this game with the certified starter-dependent model',
    currentEvidence: { original: null, boundedOfficialResponse: null, internalRecovery: 'NONE', observationTimestamp: prior.providerAccounting.responseReceivedAt, sourceDigest: prior.providerAccounting.sourcePayloadDigest },
    unresolvedReason: 'Official response supplies no probablePitcher for this side; internal search supplies no exact same-game assignment. Player/roster identities cannot substitute.' }))
  return { project: PROJECT, priorPackageSha: PRIOR_SHA, unknownStarterInventory: inventory, internalStarterRecovery: 'NONE',
    starterRequirementMatrix: [
      { context: 'A_CURRENT_CANONICAL_NATIVE_ENRICHMENT', required: false, policy: 'UNKNOWN_ALLOWED_FOR_CANONICAL_ROW', reason: 'Schema permits missing starter metadata; team identity/date/type enrichment does not require pitcher assignment' },
      { context: 'B_HISTORICAL_STORED_OUTPUT_PARITY_824552', required: false, policy: 'NOT_REQUIRED_FOR_R2T_R2_TEST_CASE', reason: 'Already-certified case 824552 has its own starters 680732 and 641927; no dependency on game 823092' },
      { context: 'B_HISTORICAL_RECONSTRUCTION_823092', required: true, policy: 'BLOCK_HISTORICAL_RECONSTRUCTION', reason: 'No same-game starter evidence proven available at the requested historical as-of' },
      { context: 'C_FUTURE_LIVE_823092_IF_TARGETED', required: true, policy: 'BLOCK_FUTURE_LIVE_GAME_IF_TARGETED', reason: 'No default pitcher or feature imputation may replace a missing starter identity' },
      { context: 'D_R2T_R2_SELECTED_INJECTED_PERSISTENCE_824552', required: false, policy: 'NOT_REQUIRED_FOR_R2T_R2_TEST_CASE', reason: 'Only selected target entities enter that test; game 823092 must not enter its target scope' },
      { context: 'D_ALL_GAME_PERSISTENCE_IF_823092_TARGETED', required: true, policy: 'BLOCK_FUTURE_LIVE_GAME_IF_TARGETED', reason: 'A selected all-game target with unknown required starters is blocked; no hidden scope substitution' },
    ], reviewedPatches: patches, rowReviews: rows.map((r) => ({ gamePk: r.gamePk, reviewedPatchKeys: patches.filter((p) => p.gamePk === r.gamePk).map(fieldKey), exactValuesSource: 'reviewedPatches: match gamePk and logicalField; each entry includes exact original/proposed values and full provenance', safePatchCount: r.patches.length,
      safeToPatch: 'CONDITIONAL_CANONICAL_ENRICHMENT_ONLY_AFTER_SEPARATE_AUTHORIZATION_AND_FRESH_ROW_MATCH', starterDependency: r.starterDependency })),
    authorizationPacket: { status: 'READY_NOT_AUTHORIZED', repairVersion: VERSION, targetTables: ['public.pick2_mlb_games'],
      rows, maximumRowUpdates: 15, maximumFieldPatches: 90, physicalColumnAssignments: 75,
      deletes: 0, unrestrictedUpdates: 0, ddl: 0, providerCalls: 0, modelChanges: 0, liveRefresh: false,
      rule: 'No SQL or production executor included. Revalidate all 15 rows under a future explicit authorization; all-or-nothing abort on any conflict. REUSE_NO_OP rows consume zero cap.',
      timestamps: 'statement_timestamp() on first applied write only; second pass preserves it. No backdating. Observation timestamps stay separate.',
      pregameUse: 'This packet deliberately leaves transient starter/state bindings unchanged. It does not make these 15 rows usable for historical replay or live execution.' },
    exclusions: { fromPriorPreview: 50, unresolvedNeverProposed: 2, totalExcludedFrom142Candidates: 52,
      counts: { detailedStatus: 7, abstractPregameState: 15, probableStarterPromotion: 28, unresolvedStarters: 2 },
      reason: 'Mutable observations remain dated provenance only; unknown IDs remain absent. All 50 rejected promotions are unsafe under unqualified historical/current-state reuse, not contradictory provider facts.',
      fields: [...patches.filter((p) => !p.safeToPatch).map((p) => ({ gamePk: p.gamePk, logicalField: p.logicalField, reason: p.reviewReason })), ...inventory.map((i) => ({ gamePk: i.gamePk, logicalField: i.logicalField, reason: i.unresolvedReason }))] },
    immutability: { status: 'PASS_FOR_SAFE_SUBSET', safeNullEnrichment: 45, safeCanonicalAliasEnrichment: 30, safeCurrentStatusEnrichment: 15,
      unsafeHistoricalRewriteInAuthorizationPacket: 0, conflictsInAuthorizationPacket: 0, excludedUnsafePromotions: 50,
      preservation: ['original source_payload_digest', 'created_at', 'original starter_evidence', 'existing official_status', 'all unrelated metadata', 'historical feature/prediction/Official Pick rows'] },
    gate4Criteria: { status: 'READY', selectedTestGamePk: 824552, selectedCaseRequires823092: false,
      selectedCase: 'PASS only when existing real native target and its own starters resolve at archived as-of, exact entities/digests are retained, and no data repair is needed for that case',
      fullCurrentScope: 'Separate claim: every actually targeted game must have valid native identity, time/state and proven starters. Unknown game 823092 blocks itself; no all-15 PASS claim.',
      gate5Executed: false, priorGlobalBlockClarification: 'The original all-current-row audit stop does not prove a dependency of the selected historical test on unrelated game 823092. Do not edit the old certificate or silently narrow an all-game test.' },
    boundaries: { providerCalls: 0, productionDml: 0, productionDdl: 0, automationChanges: 0, cronChanges: 0, liveRefresh: false, gate5Resumed: false } }
}

export function classifyRepair(rowPlan, current, writeTimestamp) {
  assert.equal(rowPlan.patchDigest, sha256(rowPlan.patches), 'PATCH_TAMPERING')
  assert.equal(rowPlan.expectedRowDigest, sha256(rowPlan.expectedRow), 'BASELINE_TAMPERING')
  if (current?.game_pk !== rowPlan.gamePk || current.source_payload_digest !== rowPlan.expectedSourceDigest) return { action: 'BLOCK_CONFLICT' }
  if (sha256(current) === rowPlan.expectedRowDigest) {
    assert.ok(Number.isFinite(Date.parse(writeTimestamp)) && Date.parse(writeTimestamp) >= Date.parse(rowPlan.minimumWriteTimestamp) && Date.parse(writeTimestamp) >= Date.parse(current.updated_at), 'WRITE_TIMESTAMP')
    return { action: 'UPDATE_ELIGIBLE', projected: project(rowPlan, writeTimestamp) }
  }
  if (Number.isFinite(Date.parse(current.updated_at)) && Date.parse(current.updated_at) >= Date.parse(rowPlan.minimumWriteTimestamp)
    && sha256(current) === sha256(project(rowPlan, current.updated_at))) return { action: 'REUSE_NO_OP' }
  return { action: 'BLOCK_CONFLICT' }
}
