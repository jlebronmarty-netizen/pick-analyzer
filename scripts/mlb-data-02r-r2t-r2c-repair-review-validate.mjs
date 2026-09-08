import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { buildReview, classifyRepair, PRIOR_SHA, VERSION } from './mlb-data-02r-r2t-r2c-repair-review.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { digest } from './mlb-data-02r-r2t-r2b-evidence-reconcile.mjs'
import { resolvePregameTarget, resolveStarterContext } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'

assert.ok(process.env.R2S_VALIDATION_DIR, 'ISOLATED_DIRECTORY_REQUIRED')
let networkAttempts = 0
globalThis.fetch = async () => { networkAttempts++; throw new Error('OFFLINE_VALIDATION_ONLY') }
const directory = process.env.R2S_VALIDATION_DIR
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))
const prior = read('docs/CERTIFICATION/MLB_DATA_02R_R2T_R2B_BOUNDED_MLB_OFFICIAL_EVIDENCE_RECOVERY.json')
const internal = read(path.join(directory, 'internal-evidence.json'))
const initialDigest = sha256(prior)
const review = buildReview(prior, internal)
const checks = []
const check = (name, fn) => { fn(); checks.push({ name, status: 'PASS' }) }
check('review preserves prior certificate and complete 140-patch inventory', () => { assert.equal(sha256(prior), initialDigest); assert.equal(review.reviewedPatches.length, 140) })
check('exact two-field unknown inventory and zero internal recovery', () => { assert.equal(review.unknownStarterInventory.length, 2); assert.equal(review.internalStarterRecovery, 'NONE') })
check('all 22 internal source searches complete and raw below cap', () => { assert.equal(internal.sources.length, 22); assert.ok(internal.sources.every((s) => s.total === s.rows.length)); assert.ok(internal.sources.find((s) => s.source === 'raw').total < internal.rawCap); assert.equal(internal.discoveredGameScopedStatcastRelations.length, 7) })
check('source changes require fresh manual review', () => { const copy = structuredClone(internal); copy.sources[1].rows.push({ mlbam_person_id: 1 }); copy.sources[1].total = 1; assert.throws(() => buildReview(prior, copy), /NEW_INTERNAL_EVIDENCE/) })
check('fresh game row equals certified baseline', () => { const copy = structuredClone(internal); copy.sources[0].rows[0].official_status = 'Final'; assert.throws(() => buildReview(prior, copy), /NATIVE_CHANGED/) })
check('safe subset contains 15 rows and exactly 90 fields', () => { assert.equal(review.authorizationPacket.rows.length, 15); assert.equal(review.authorizationPacket.rows.flatMap((r) => r.patches).length, 90) })
check('50 rejected promotions plus 2 unresolved fields explicitly excluded', () => { assert.equal(review.exclusions.fields.length, 52); assert.equal(review.exclusions.fromPriorPreview, 50) })
check('safe subset has zero transient current-state promotions', () => { assert.ok(review.authorizationPacket.rows.every((r) => r.patches.every((p) => !p.logicalField.includes('ProbablePitcher') && !['official_status', 'metadata.abstractGameState'].includes(p.logicalField)))) })
check('all safe patches have complete provenance and permitted safety class', () => {
  for (const row of review.authorizationPacket.rows) for (const p of row.patches) {
    assert.ok(p.sourceTimestamp && p.sourceDigest && p.provider && p.reviewReason && p.currentCanonicalOnly && !p.historicallyPregameProven)
    assert.ok(['SAFE_NULL_ENRICHMENT', 'SAFE_CANONICAL_ALIAS_ENRICHMENT', 'SAFE_CURRENT_STATUS_ENRICHMENT'].includes(p.immutabilityClassification))
  }
})
check('per-game provenance stores repair reason/version and immutable original source', () => {
  for (const row of review.authorizationPacket.rows) {
    const p = row.patches.find((p) => p.patchPurpose === 'MANDATORY_PROVENANCE')
    assert.equal(p.newValue.repairVersion, VERSION); assert.ok(p.newValue.repairReason && p.newValue.notCurrentStateAuthority)
    assert.equal(p.newValue.originalSourcePayloadDigest, row.expectedSourceDigest); assert.equal(p.newValue.canonicalEvidence.length, 4)
  }
})
const writeTime = new Date(Math.max(Date.now(), Date.parse(prior.provenanceContract.conservativeAvailabilityUpperBound) + 1)).toISOString()
const simulation = review.authorizationPacket.rows.map((row) => {
  const first = classifyRepair(row, row.expectedRow, writeTime)
  assert.equal(first.action, 'UPDATE_ELIGIBLE')
  const after = first.projected
  for (const key of ['created_at', 'source_payload_digest', 'official_status', 'scheduled_at']) assert.deepEqual(after[key], row.expectedRow[key])
  assert.deepEqual(after.metadata.starter_evidence, row.expectedRow.metadata.starter_evidence)
  const second = classifyRepair(row, after, '2099-01-01T00:00:00Z')
  assert.equal(second.action, 'REUSE_NO_OP'); assert.equal(after.updated_at, writeTime)
  return { gamePk: row.gamePk, first: first.action, second: second.action, fieldAssignments: row.patches.length }
})
check('15 first-pass simulated updates, zero second-pass updates', () => { assert.equal(simulation.length, 15); assert.ok(simulation.every((s) => s.second === 'REUSE_NO_OP')); assert.equal(simulation.reduce((s, r) => s + r.fieldAssignments, 0), 90) })
const row = review.authorizationPacket.rows[0]
check('wrong row identity rejected', () => assert.equal(classifyRepair(row, { ...row.expectedRow, game_pk: 1 }, writeTime).action, 'BLOCK_CONFLICT'))
check('changed source digest rejected', () => assert.equal(classifyRepair(row, { ...row.expectedRow, source_payload_digest: 'changed' }, writeTime).action, 'BLOCK_CONFLICT'))
check('non-null old value conflict rejected', () => assert.equal(classifyRepair(row, { ...row.expectedRow, home_team_id: 'OTHER' }, writeTime).action, 'BLOCK_CONFLICT'))
check('unrelated concurrent metadata change rejected', () => assert.equal(classifyRepair(row, { ...row.expectedRow, metadata: { ...row.expectedRow.metadata, other: true } }, writeTime).action, 'BLOCK_CONFLICT'))
check('partial application is a conflict', () => assert.equal(classifyRepair(row, { ...row.expectedRow, home_team_id: row.patches.find((p) => p.column === 'home_team_id').newValue }, writeTime).action, 'BLOCK_CONFLICT'))
check('backdated write timestamp rejected', () => assert.throws(() => classifyRepair(row, row.expectedRow, '2000-01-01T00:00:00Z'), /WRITE_TIMESTAMP/))
check('patch and baseline tampering rejected', () => { const p = structuredClone(row); p.patches[0].newValue = 'OTHER'; assert.throws(() => classifyRepair(p, row.expectedRow, writeTime), /PATCH_TAMPERING/); p.patchDigest = sha256(p.patches); p.expectedRow.game_type = 'OTHER'; assert.throws(() => classifyRepair(p, row.expectedRow, writeTime), /BASELINE_TAMPERING/) })
check('changed applied version prevents no-op masquerade', () => { const applied = classifyRepair(row, row.expectedRow, writeTime).projected; applied.metadata.r2t_r2b_evidence.repairVersion = 'OTHER'; assert.equal(classifyRepair(row, applied, writeTime).action, 'BLOCK_CONFLICT') })
const r1 = read('docs/CERTIFICATION/MLB_DATA_02R_R2T_R1_PREGAME_EVIDENCE_PROVENANCE_AND_TARGET_BINDING.json')
const native = r1.selected.target.native
const target = resolvePregameTarget({ native, runAsOf: r1.selected.target.runAsOf, eligibleGamePks: [824552] })
const starters = resolveStarterContext(target)
check('selected real case 824552 native binding and own starters pass', () => { assert.equal(target.gamePk, 824552); assert.equal(starters.home.mlbam_pitcher_id, 680732); assert.equal(starters.away.mlbam_pitcher_id, 641927) })
check('unknown game not required or included in selected case', () => { assert.deepEqual(target.eligibleGamePks, [824552]); assert.ok(review.starterRequirementMatrix.filter((r) => r.policy === 'NOT_REQUIRED_FOR_R2T_R2_TEST_CASE').every((r) => !r.required)) })
check('same-game unknown starter still rejected by actual resolver', () => {
  const altered = { ...target, gamePk: 823092, native: { ...target.native, game_pk: 823092, metadata: { ...target.native.metadata, homeProbablePitcher: null, awayProbablePitcher: null } } }
  assert.throws(() => resolveStarterContext(altered), /STARTER_MISSING/)
})
let sideEffects = 0
const trap = new Proxy({}, { get: () => async () => { sideEffects++; throw new Error('SIDE_EFFECT') } })
await assert.rejects(() => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', executionPackageSha: 'R2C_REVIEW_ONLY', authorization: { authorized: true, execution_package_sha: 'R2C_REVIEW_ONLY' }, providers: trap, repository: trap }), /R2T_LIVE_BLOCKED/)
check('actual live entrypoint remains contained before side effects', () => { assert.equal(sideEffects, 0); assert.equal(networkAttempts, 0) })
const localPaths = execFileSync('rg', ['-l', '823092', 'docs/CERTIFICATION', 'artifacts', '-g', '*.json', '-g', '*.md'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter((p) => !p.includes('R2C_NATIVE_REPAIR_REVIEW'))
const localSearch = localPaths.map((file) => {
  const body = fs.readFileSync(file, 'utf8'), matches = []
  if (file.endsWith('.json')) {
    const scan = (value) => {
      if (!value || typeof value !== 'object') return
      if (value.gamePk === 823092 || value.game_pk === 823092) {
        const candidateIds = [value.mlbam_pitcher_id, value.metadata?.homeProbablePitcher?.id, value.metadata?.awayProbablePitcher?.id,
          value.metadata?.starter_evidence?.homeProbablePitcher?.id, value.metadata?.starter_evidence?.awayProbablePitcher?.id,
          value.starters?.home?.id, value.starters?.away?.id].filter((id) => Number.isSafeInteger(id) && id > 0)
        matches.push({ digest: sha256(value), candidateIds })
      }
      for (const child of Object.values(value)) if (child && typeof child === 'object') scan(child)
    }
    scan(JSON.parse(body))
  }
  return { file: file.replaceAll('\\', '/'), sha256: digest(body), exactIdentityObjects: matches.length, positiveStarterCandidateIds: [...new Set(matches.flatMap((m) => m.candidateIds))] }
})
check('all matching internal certification artifacts contain no new starter IDs', () => { assert.equal(localSearch.length, 7); assert.ok(localSearch.every((s) => s.positiveStarterCandidateIds.length === 0)) })
check('cached exact MLB response still supplies no starter for 823092', () => { const g = JSON.parse(prior.rawResponse.body).dates.flatMap((d) => d.games).find((g) => g.gamePk === 823092); assert.ok(g && !g.teams.home.probablePitcher?.id && !g.teams.away.probablePitcher?.id) })
check('all 19 inherited artifacts unchanged', () => { for (const [file, hash] of Object.entries(prior.protectedState.inheritedSha256)) assert.equal(digest(fs.readFileSync(file)), hash, file) })
check('prior runtime/parity/Champion source bytes preserved', () => {
  for (const file of prior.validation.preservedFiles) assert.equal(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'), execFileSync('git', ['show', `${PRIOR_SHA}:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n'), file)
})
review.internalEvidence = internal
review.localEvidenceSearch = localSearch
review.selectedCaseBinding = { status: 'PASS', gamePk: target.gamePk, runAsOf: target.runAsOf, nativeDigest: sha256(native), sourceDigest: target.sourceDigest,
  starters: { home: starters.home.mlbam_pitcher_id, away: starters.away.mlbam_pitcher_id }, scope: 'Native/own-starter binding only; no feature generation, persistence, parity rerun or Gate 5 execution', unrelatedUnknownBlocksSelectedCase: false }
review.validation = { status: 'PASS', checksPassed: checks.length, checks, simulation, secondPassUpdates: 0,
  providerCalls: 0, productionDml: 0, productionDdl: 0, networkAttempts, liveSideEffects: sideEffects, gate5Executed: false }
fs.writeFileSync(path.join(directory, 'repair-review.json'), JSON.stringify(review, null, 2) + '\n')
console.log(JSON.stringify({ status: 'PASS', checks: checks.length, safeRows: 15, safeFields: 90, excluded: 52, internalRecovery: 'NONE', selectedCaseBinding: review.selectedCaseBinding, secondPassUpdates: 0 }))
