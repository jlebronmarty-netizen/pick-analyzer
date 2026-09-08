import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { buildRepairPlan, aliasProposal, validatePreviewMutation, PROJECT } from './mlb-data-02r-r2t-r2a-repair-plan.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'

assert.ok(process.env.R2S_VALIDATION_DIR, 'READ_ONLY_GUARD_REQUIRED')
const directory = process.env.R2S_VALIDATION_DIR
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const prior = read('docs/CERTIFICATION/MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION.json')
const search = read(path.join(directory, 'native-source-search.json'))
const cache = read('docs/CERTIFICATION/mlb-data-01c-r3-acquisition-cache.json')
const mapping = read('docs/CERTIFICATION/mlb-data-01c-2025-canonical-mapping.json')
const before = sha256(search)
const plan = buildRepairPlan({ prior, search, cache, mapping })
const checks = []
const check = (name, condition) => { assert.ok(condition, name); checks.push({ name, status: 'PASS' }) }
check('fixed 15-game scope and 18-field catalog', plan.scopeClarification.games === 15 && plan.fieldCatalog.length === 18)
check('270 unique cells, 105 gaps, 165 present', plan.exactInventory.length === 270 && new Set(plan.exactInventory.map((r) => `${r.gamePk}:${r.logicalField}`)).size === 270 && plan.scopeClarification.actualGapCells === 105 && plan.scopeClarification.presentCells === 165)
check('all gap classifications explicit', plan.exactInventory.filter((r) => r.isGap).every((r) => ['MISSING', 'NULL', 'INVALID', 'ALIAS_ONLY', 'CONFLICTING'].includes(r.gapStatus) && Object.hasOwn(plan.recoveryClassifications, r.recoveryCategory)))
check('all six recovery categories retained', Object.keys(plan.recoveryClassifications).join('') === 'ABCDEF')
check('every inventory cell has physical contract, source, consumer, policy', plan.exactInventory.every((r) => r.physicalTable && r.physicalColumn && r.requiredValueType && r.consumer && r.whyRequired && r.evidence && r.repairNecessity && r.mutationPolicy))
const natives = search.sources.native.rows
check('all present fields valid for inspected contract', natives.every((r) => Number.isSafeInteger(r.game_pk) && r.game_pk > 0 && r.season === 2026 && /^2026-09-08$/.test(r.game_date) && Number.isFinite(Date.parse(r.scheduled_at)) && ['N', 'Y', 'S'].includes(r.doubleheader) && Number.isSafeInteger(r.game_number) && r.game_number > 0 && r.source === 'mlb_official' && /^[a-f0-9]{64}$/.test(r.source_payload_digest) && r.official_status === 'Scheduled' && Date.parse(r.created_at) <= Date.parse(r.updated_at)))
check('same-game native state unchanged since R2 audit', natives.every((r) => sha256(r) === sha256(prior.nativeFieldGapInventory.currentRows.find((p) => p.game_pk === r.game_pk))))
check('all requested persisted source families searched without truncation', Object.keys(search.sources).length === 20 && Object.values(search.sources).every((r) => ['FOUND', 'EMPTY'].includes(r.status)))
check('cached MLB schedule has zero exact target-game payloads', plan.localSources.exactAffectedGamesInCache === 0)
check('32 window candidates rejected without exact game edges', search.sources.eventWindow.count === 32 && search.exactWindowMatches.length === 0)
check('all team aliases reuse canonical crosswalk identities', plan.aliasRecovery.length === 30 && plan.aliasRecovery.every((r) => r.category === 'C' && r.value === r.evidence.canonicalId && r.evidence.existingCrosswalkId))
check('known starters stay probable, unknowns stay unknown', plan.starterRecovery.filter((r) => r.classification === 'PROBABLE').length === 28 && plan.starterRecovery.filter((r) => r.classification === 'UNKNOWN').length === 2 && plan.starterRecovery.every((r) => r.observedBeforeScheduledStart))
check('game type and omitted date/state stay unresolved', plan.exactInventory.filter((r) => ['game_type', 'metadata.officialDate', 'metadata.abstractGameState'].includes(r.logicalField)).every((r) => r.recoveryCategory === 'D' && r.proposedValue === null))
check('UTC and Puerto Rico dates never become officialDate patches', plan.futureDmlPlan.mutations.every((r) => !r.logicalField.includes('Date') && !r.logicalField.includes('date') && r.column !== 'scheduled_at'))
check('105 gap classifications sum exactly', Object.values(plan.recoveryClassifications).reduce((sum, r) => sum + r.count, 0) === 105)
check('exact preview maximum 15 row updates / 58 field patches', plan.futureDmlPlan.exactMaximumRowUpdates === 15 && plan.futureDmlPlan.mutations.length === 58)
check('47 provider-dependent fields excluded from DML preview', plan.futureDmlPlan.providerDependentPatchesExcluded === 47 && plan.futureDmlPlan.mutations.every((r) => r.newValue !== null))
check('each exact preview passes same-game and old-value preconditions', plan.futureDmlPlan.mutations.every((r) => validatePreviewMutation(r, natives.find((n) => n.game_pk === r.rowIdentity.game_pk))))
check('no mutation of evidence while planning', sha256(search) === before)
const mutation = structuredClone(plan.futureDmlPlan.mutations[0]), native = natives.find((r) => r.game_pk === mutation.rowIdentity.game_pk)
assert.throws(() => validatePreviewMutation({ ...mutation, evidenceSource: { ...mutation.evidenceSource, gamePk: -1 } }, native), /SAME_GAME_EVIDENCE/)
check('cross-game evidence rejected', true)
assert.throws(() => validatePreviewMutation(mutation, { ...native, updated_at: '2099-01-01T00:00:00Z' }), /ROW_CHANGED/)
check('changed production row invalidates preview', true)
assert.throws(() => validatePreviewMutation({ ...mutation, newValue: null }, native), /UNRESOLVED_VALUE/)
check('unknown new values cannot become planned writes', true)
assert.throws(() => validatePreviewMutation({ ...mutation, table: 'public.pick2_game_predictions' }, native), /UNEXPECTED_TABLE/)
check('unexpected target table rejected', true)
const stateChangedCache = structuredClone(cache)
for (const row of Object.values(stateChangedCache.gameIdentities)) { row.gameType = 'NOT_R'; row.officialDate = '1900-01-01'; row.status = { abstractGameState: 'Final' } }
check('other-game state cannot influence team entity translation', sha256(aliasProposal(native, 'home', cache, mapping, search)) === sha256(aliasProposal(native, 'home', stateChangedCache, mapping, search)))
const badMapping = structuredClone(mapping)
badMapping.teamCanonicalInventory.teams.push({ ...badMapping.teamCanonicalInventory.teams[0], canonicalTeamId: 'CONFLICT' })
const athNative = natives.find((r) => [r.metadata.mlb_official_identity.home_mlb_team_id, r.metadata.mlb_official_identity.away_mlb_team_id].includes(133))
const athSide = athNative.metadata.mlb_official_identity.home_mlb_team_id === 133 ? 'home' : 'away'
check('conflicting existing alias requires manual review', aliasProposal(athNative, athSide, cache, badMapping, search).category === 'F')
const unknownNative = structuredClone(native); unknownNative.metadata.mlb_official_identity.home_mlb_team_id = null
check('missing same-game official team ID never falls back by name/date', aliasProposal(unknownNative, 'home', cache, mapping, search).category === 'D')
let sideEffects = 0
const trap = new Proxy({}, { get: () => async () => { sideEffects++; throw new Error('UNEXPECTED_SIDE_EFFECT') } })
await assert.rejects(() => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', executionPackageSha: 'R2A_AUDIT_ONLY', authorization: { authorized: true, execution_package_sha: 'R2A_AUDIT_ONLY' }, providers: trap, repository: trap }), /R2T_LIVE_BLOCKED/)
check('actual LIVE_EXECUTE remains contained before providers/writes', sideEffects === 0)
const preservedFiles = [...Object.keys(prior.sourceHashes), 'scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs', 'scripts/mlb-data-02r-r2a-live-refresh-executor.mjs', 'scripts/mlb-data-02r-r2g-persistence-interfaces.mjs', 'scripts/mlb-data-02r-r2t-real-feature-champion.mjs', 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json']
for (const file of preservedFiles) {
  const old = execFileSync('git', ['show', `6f782635304815e2e0dcafe6e326e5059c3dea4d:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n')
  assert.equal(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'), old, file)
}
check('stored-parity code, Champion, preprocessing, manifest and executor preserved', true)
const result = { project: PROJECT, status: 'PASS', checks, checksPassed: checks.length, preservedFiles,
  planDigest: sha256(plan.exactInventory), boundaries: plan.boundaries, actualProviderOrWriteInvocations: sideEffects }
fs.writeFileSync(path.join(directory, 'repair-plan-validation.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ status: result.status, checks: checks.length, modelParityRerun: false, providerCalls: 0, productionDml: 0, productionDdl: 0 }))
