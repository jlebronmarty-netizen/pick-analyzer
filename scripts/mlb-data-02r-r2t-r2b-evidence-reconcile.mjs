// Offline evidence reconciliation and review-only repair preview. No database client.
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

export const PROJECT = 'MLB_DATA_02R_R2T_R2B_BOUNDED_MLB_OFFICIAL_EVIDENCE_RECOVERY'
export const PRIOR_SHA = 'b1d1bae784c532d1cf0394733a70e7562982aefc'
export const digest = (body) => crypto.createHash('sha256').update(body).digest('hex')
const key = (r) => `${r.gamePk}:${r.logicalField}`
const sorted = (ids) => [...ids].sort((a, b) => a - b)
const validId = (id) => Number.isSafeInteger(id) && id > 0

export function reconcile({ prior, frozen, ledger, body }) {
  assert.equal(prior.certificationVerdict, prior.project + '_CERTIFIED', 'PRIOR_CERTIFICATION')
  assert.equal(frozen.packageSha, PRIOR_SHA, 'FROZEN_PACKAGE')
  assert.equal(frozen.priorArtifactDigest, sha256(prior), 'BASELINE_DIGEST')
  assert.deepEqual(frozen.nativeRows, prior.sourceSearch.sources.native.rows, 'FROZEN_NATIVE_ROWS')
  const ids = sorted(prior.affectedGames.map((r) => r.gamePk))
  assert.equal(ids.length, 15); assert.equal(new Set(ids).size, 15)
  assert.deepEqual(frozen.gamePks, ids, 'FROZEN_SCOPE')
  const gaps = prior.exactInventory.filter((r) => r.isGap)
  assert.equal(gaps.length, 105)
  assert.deepEqual(frozen.providerGapBaseline, gaps.filter((r) => r.recoveryCategory === 'D').map((r) => ({
    gamePk: r.gamePk, table: r.physicalTable, column: r.physicalColumn, jsonPath: r.jsonPath,
    logicalField: r.logicalField, currentValue: r.currentValue, valueState: r.valueState,
    requiredType: r.requiredValueType, reasonUnresolved: r.reason, r2aClassification: r.recoveryCategory,
  })), 'GAP_BASELINE_CHANGED')
  assert.equal(frozen.providerGapBaseline.length, 47)
  assert.equal(ledger.callsConsumed, 1, 'PROVIDER_CAP'); assert.equal(ledger.maximumCalls, 1)
  assert.equal(ledger.provider, 'MLB_OFFICIAL'); assert.equal(ledger.state, 'ACQUIRED')
  assert.equal(ledger.httpStatus, 200)
  assert.ok(['odds', 'statcast', 'balldontlie', 'sportsdataio', 'otherProviders'].every((k) => ledger[k] === 0))
  assert.ok(Date.parse(frozen.frozenAt) <= Date.parse(ledger.requestedAt) && Date.parse(ledger.requestedAt) <= Date.parse(ledger.responseReceivedAt), 'OBSERVATION_ORDER')
  assert.deepEqual(ledger.gamePks, ids)
  assert.equal(ledger.endpoint, frozen.request.url)
  assert.equal(ledger.endpoint, `https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePks=${ids.join(',')}&hydrate=probablePitcher,team,venue`, 'REQUEST_SCOPE')
  assert.equal(digest(body), ledger.sourcePayloadDigest, 'RESPONSE_DIGEST')
  assert.equal(Buffer.byteLength(body), ledger.responseBytes)
  assert.ok(ledger.responseBytes <= frozen.request.maximumResponseBytes)
  const games = JSON.parse(body).dates.flatMap((d) => d.games)
  assert.deepEqual(sorted(games.map((g) => g.gamePk)), ids, 'EXACT_SAME_GAME_RESPONSE')
  const observedAt = ledger.responseReceivedAt
  // The HTTP server clock differs from the local clock. Retain both, and use
  // their maximum for conservative prospective as-of tests, never an old run.
  const availabilityUpperBound = new Date(Math.max(Date.parse(observedAt), Date.parse(ledger.responseDateHeader))).toISOString()
  const gameEvidence = games.map((g) => {
    const n = frozen.nativeRows.find((r) => r.game_pk === g.gamePk)
    assert.equal(g.officialDate, n.game_date, 'OFFICIAL_DATE_CONFLICT')
    assert.equal(Date.parse(g.gameDate), Date.parse(n.scheduled_at), 'START_TIME_CONFLICT')
    assert.equal(g.doubleHeader, n.doubleheader, 'DOUBLEHEADER_CONFLICT')
    assert.equal(g.gameNumber, n.game_number, 'GAME_NUMBER_CONFLICT')
    assert.ok(typeof g.gameType === 'string' && g.gameType.length > 0, 'GAME_TYPE_MISSING')
    assert.ok(typeof g.status?.abstractGameState === 'string' && typeof g.status?.detailedState === 'string', 'STATUS_MISSING')
    const starters = {}
    for (const side of ['home', 'away']) {
      assert.equal(g.teams[side].team.id, n.metadata.mlb_official_identity[`${side}_mlb_team_id`], 'TEAM_IDENTITY_CONFLICT')
      const id = g.teams[side].probablePitcher?.id ?? null
      assert.ok(id === null || validId(id), 'INVALID_STARTER_ID')
      const old = n.metadata.starter_evidence?.[`${side}ProbablePitcher`]?.id ?? null
      assert.ok(!old || old === id, 'STARTER_CHANGED')
      starters[side] = { id, classification: id ? 'CURRENT_CANONICAL_STARTER' : 'UNKNOWN', historicallyPregameProven: false }
    }
    assert.ok(!starters.home.id || !starters.away.id || starters.home.id !== starters.away.id, 'STARTER_TEAM_CONFLICT')
    return { gamePk: g.gamePk, officialDate: g.officialDate, scheduledAt: g.gameDate,
      doubleheader: g.doubleHeader, gameNumber: g.gameNumber, gameType: g.gameType,
      detailedOfficialStatus: g.status.detailedState, priorDetailedOfficialStatus: n.official_status,
      abstractGameState: g.status.abstractGameState, storedNormalizedStatus: n.status ?? null,
      eligibleAtObservation: g.gameType === 'R' && g.status.abstractGameState === 'Preview' && ['Scheduled', 'Pre-Game', 'Warmup'].includes(g.status.detailedState) && Date.parse(g.gameDate) > Date.parse(availabilityUpperBound),
      provider: 'MLB_OFFICIAL', observedAt, availabilityUpperBound, sourcePayloadDigest: ledger.sourcePayloadDigest,
      evidenceClass: 'CURRENT_CANONICAL', historicallyPregameProven: false, starters }
  }).sort((a, b) => a.gamePk - b.gamePk)
  const matrix = gaps.map((r) => {
    const g = games.find((g) => g.gamePk === r.gamePk)
    const e = gameEvidence.find((g) => g.gamePk === r.gamePk)
    let value = r.proposedValue, category = r.recoveryCategory
    if (category === 'D') {
      const values = { game_type: g.gameType, 'metadata.officialDate': g.officialDate, 'metadata.abstractGameState': g.status.abstractGameState,
        'metadata.homeProbablePitcher.id': g.teams.home.probablePitcher?.id ?? null,
        'metadata.awayProbablePitcher.id': g.teams.away.probablePitcher?.id ?? null }
      assert.ok(Object.hasOwn(values, r.logicalField), 'UNEXPECTED_GAP_FIELD')
      value = values[r.logicalField]
      if (value !== null) category = 'C'
    }
    const resolved = value !== null && value !== undefined
    return { gamePk: r.gamePk, table: r.physicalTable, column: r.physicalColumn, jsonPath: r.jsonPath,
      logicalField: r.logicalField, oldValue: r.currentValue, oldValueState: r.valueState, requiredType: r.requiredValueType,
      beforeCategory: r.recoveryCategory, afterCategory: category, resolved, newValue: value,
      acquisitionSource: r.recoveryCategory === 'D' && resolved ? 'NEW_BOUNDED_RESPONSE_NOW_CAPTURED_IN_CACHE' : 'RETAINED_R2A_EVIDENCE',
      priorEvidence: r.evidence, provider: 'MLB_OFFICIAL', sourceTimestamp: observedAt,
      sourceDigest: ledger.sourcePayloadDigest, sameGameIdentity: r.gamePk, evidenceClass: resolved ? 'CURRENT_CANONICAL' : 'UNKNOWN',
      historicallyPregameSafe: false, eligibleAtObservation: e.eligibleAtObservation,
      classification: !resolved ? 'MANUAL_REVIEW_REQUIRED' : r.logicalField.endsWith('_team_id') ? 'SAFE_CANONICAL_ENRICHMENT' : r.logicalField === 'metadata.abstractGameState' ? 'MUTABLE_STATUS_ENRICHMENT' : 'CURRENT_ONLY_NOT_VALID_FOR_HISTORICAL_PREGAME',
      reason: resolved ? 'Exact same-game evidence; original affected-run as-of is unproven. No historical replay authorization.' : 'Official response still supplies no probable pitcher. Preserve UNKNOWN; no patch.' }
  })
  const patches = []
  const add = (r) => {
    const native = frozen.nativeRows.find((n) => n.game_pk === r.gamePk)
    patches.push({ ...r, table: 'public.pick2_mlb_games', executed: false,
      preconditions: { gamePk: r.gamePk, expectedNativeRowDigest: sha256(native), expectedSourcePayloadDigest: native.source_payload_digest,
        actionOnChangedRow: 'ABORT_AND_REVIEW', requireSeparateDmlAuthorization: true, originalHistoricalAsOfAllowed: false } })
  }
  for (const r of matrix.filter((r) => r.resolved && r.eligibleAtObservation)) {
    const old = prior.futureDmlPlan.mutations.find((m) => `${m.rowIdentity.game_pk}:${m.logicalField}` === key(r))
    add({ ...r, jsonPath: old?.jsonPath ?? r.jsonPath, newValue: old?.newValue ?? r.newValue,
      patchPurpose: 'RESOLVED_GAP', mutationType: r.column === 'metadata' ? 'METADATA_ENRICHMENT' : 'BOUNDED_UPDATE' })
  }
  for (const e of gameEvidence.filter((e) => e.eligibleAtObservation)) {
    const common = { gamePk: e.gamePk, provider: e.provider, sourceTimestamp: observedAt, sourceDigest: e.sourcePayloadDigest,
      evidenceClass: 'CURRENT_CANONICAL', historicallyPregameSafe: false,
      reason: 'Preserve actual new observation separately; forbid reuse as earlier pregame evidence.' }
    if (e.detailedOfficialStatus !== e.priorDetailedOfficialStatus) add({ ...common, column: 'official_status', jsonPath: null,
      logicalField: 'official_status', oldValue: e.priorDetailedOfficialStatus, newValue: e.detailedOfficialStatus,
      classification: 'MUTABLE_STATUS_ENRICHMENT', mutationType: 'BOUNDED_UPDATE', patchPurpose: 'OBSERVED_STATUS_PROGRESSION' })
    const native = frozen.nativeRows.find((n) => n.game_pk === e.gamePk)
    assert.ok(!Object.hasOwn(native.metadata, 'r2t_r2b_evidence'), 'PROVENANCE_KEY_CONFLICT')
    add({ ...common, column: 'metadata', jsonPath: ['r2t_r2b_evidence'], logicalField: 'metadata.r2t_r2b_evidence',
      oldValue: null, oldValueState: 'MISSING', newValue: e, classification: 'CURRENT_ONLY_NOT_VALID_FOR_HISTORICAL_PREGAME',
      mutationType: 'METADATA_ENRICHMENT', patchPurpose: 'MANDATORY_PROVENANCE' })
    add({ ...common, column: 'updated_at', jsonPath: null, logicalField: 'updated_at', oldValue: native.updated_at,
      newValue: { expression: 'statement_timestamp()', semantics: 'Actual future authorized write time; never a fixture or backdated provider time' },
      classification: 'CURRENT_ONLY_NOT_VALID_FOR_HISTORICAL_PREGAME', mutationType: 'BOUNDED_UPDATE', patchPurpose: 'MANDATORY_WRITE_TIMESTAMP' })
  }
  const counts = Object.fromEntries('ABCDEF'.split('').map((c) => [c, matrix.filter((r) => r.afterCategory === c).length]))
  return { project: PROJECT, gameEvidence, matrix, countsBefore: { A: 0, B: 28, C: 30, D: 47, E: 0, F: 0 }, countsAfter: counts,
    categoryCMeaning: '30 pre-existing cached entity translations plus 45 newly acquired same-game fields now preserved in the response cache; no claim the new cache existed before acquisition.',
    resolved: matrix.filter((r) => r.resolved).length, newlyResolved: matrix.filter((r) => r.beforeCategory === 'D' && r.resolved).length,
    remaining: matrix.filter((r) => !r.resolved), currentOnlyEvidenceCount: matrix.filter((r) => r.resolved).length,
    historicallyPregameProvenCount: 0, manualConflictCount: 0, originalAffectedRunAsOf: null,
    preview: { status: 'READY_FOR_REVIEW_ONLY', executed: false, patches,
      maximumRowUpdates: new Set(patches.map((r) => r.gamePk)).size, maximumFieldPatches: patches.length,
      countsByPurpose: Object.fromEntries(['RESOLVED_GAP', 'OBSERVED_STATUS_PROGRESSION', 'MANDATORY_PROVENANCE', 'MANDATORY_WRITE_TIMESTAMP'].map((p) => [p, patches.filter((r) => r.patchPurpose === p).length])),
      physicalColumnAssignments: new Set(patches.map((r) => `${r.gamePk}:${r.column}`)).size,
      capSemantics: 'One conditional UPDATE per game. Field cap includes each metadata path assignment and mandatory timestamp expression; all paths coalesced into metadata once per row.',
      excluded: matrix.filter((r) => !r.resolved || !r.eligibleAtObservation).map((r) => ({ gamePk: r.gamePk, logicalField: r.logicalField, reason: r.reason })),
      futureRequirements: ['Separate exact DML authorization; no executable SQL in this phase', 'Re-read all 15 native rows and match frozen row digests; changed state aborts', 'Revalidate actual future run date/as-of, scheduled start, status and starter provenance; this is not perpetual pregame authorization', 'Apply provenance and actual write timestamp atomically with field patches; preserve created_at, original source_payload_digest, nested starter_evidence and all unrelated metadata', 'No historical replay with this current-only evidence; no inserts, deletes, DDL or other target tables'] },
    resumeReady: 'NO', remainingBlockers: ['823092 home and away probable pitchers remain UNKNOWN', 'Production native rows remain unrepaired; this phase has no DML authority', 'Current acquisition does not establish original affected-run historical pregame availability'],
    boundaries: { mlbOfficialCalls: 1, otherProviderCalls: 0, productionDml: 0, productionDdl: 0, predictionChanges: 0, featureWrites: 0,
      officialPickChanges: 0, automationChanges: 0, cronChanges: 0, settlement: 0, liveRefresh: false, modelTraining: 0, championChanges: 0 } }
}

export function validatePreview(preview, expected, natives) {
  assert.equal(preview.maximumFieldPatches, preview.patches.length, 'FIELD_CAP')
  assert.equal(preview.maximumRowUpdates, new Set(preview.patches.map((p) => p.gamePk)).size, 'ROW_CAP')
  assert.equal(new Set(preview.patches.map(key)).size, preview.patches.length, 'DUPLICATE_PATCH')
  assert.deepEqual(preview, expected, 'PREVIEW_CHANGED')
  for (const patch of preview.patches) {
    assert.equal(patch.table, 'public.pick2_mlb_games', 'UNEXPECTED_TARGET')
    const native = natives.find((n) => n.game_pk === patch.gamePk)
    assert.ok(native, 'SCOPE_ESCAPE')
    assert.equal(sha256(native), patch.preconditions.expectedNativeRowDigest, 'NATIVE_ROW_CHANGED')
    assert.ok(patch.newValue !== null && patch.newValue !== undefined, 'UNKNOWN_PATCH')
    assert.equal(patch.executed, false)
  }
  return true
}
