import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { reconcile, validatePreview, digest, PRIOR_SHA } from './mlb-data-02r-r2t-r2b-evidence-reconcile.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { resolvePregameTarget, resolveStarterContext } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'

assert.ok(process.env.R2S_VALIDATION_DIR, 'ISOLATED_GUARDED_VALIDATION_REQUIRED')
// No network whatsoever is needed for replay. Fail even on otherwise allowed reads.
let networkAttempts = 0
globalThis.fetch = async () => { networkAttempts++; throw new Error('OFFLINE_ONLY') }
const directory = process.env.R2S_VALIDATION_DIR
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const prior = read('docs/CERTIFICATION/MLB_DATA_02R_R2T_R2A_NATIVE_SAME_GAME_EVIDENCE_RECOVERY_AND_REPAIR_PLAN.json')
const input = { prior, frozen: read(path.join(directory, 'frozen-baseline.json')), ledger: read(path.join(directory, 'mlb-provider-ledger.json')),
  body: fs.readFileSync(path.join(directory, 'mlb-official-response.json'), 'utf8') }
const before = sha256(input)
const result = reconcile(input)
const checks = []
function check(name, fn) { fn(); checks.push({ name, status: 'PASS' }) }
function reject(name, change, expression) {
  check(name, () => { const copy = structuredClone(input); change(copy); assert.throws(() => reconcile(copy), expression) })
}
function alterResponse(copy, change) {
  const body = JSON.parse(copy.body); change(body); copy.body = JSON.stringify(body)
  copy.ledger.sourcePayloadDigest = digest(copy.body); copy.ledger.responseBytes = Buffer.byteLength(copy.body)
}
check('all 105 gaps reconciled without mutating frozen evidence', () => { assert.equal(result.matrix.length, 105); assert.equal(sha256(input), before) })
check('58 retained plus 45 acquired fields resolve 103 gaps', () => { assert.equal(result.resolved, 103); assert.equal(result.newlyResolved, 45); assert.deepEqual(result.countsAfter, { A: 0, B: 28, C: 75, D: 2, E: 0, F: 0 }) })
check('two unknown starters excluded', () => { assert.equal(result.remaining.length, 2); assert.ok(result.remaining.every((r) => r.gamePk === 823092 && r.logicalField.includes('ProbablePitcher'))) })
check('current evidence never labeled historical', () => { assert.equal(result.currentOnlyEvidenceCount, 103); assert.equal(result.historicallyPregameProvenCount, 0); assert.ok(result.matrix.every((r) => !r.historicallyPregameSafe)) })
check('all dates/types/states explicit, UTC boundary preserved', () => {
  assert.ok(result.gameEvidence.every((g) => g.officialDate === '2026-09-08' && g.gameType === 'R' && g.abstractGameState === 'Preview'))
  assert.equal(result.gameEvidence.filter((g) => g.scheduledAt.startsWith('2026-09-09')).length, 5)
})
check('exact preview 15 rows, 140 patches including control fields', () => {
  assert.equal(result.preview.maximumRowUpdates, 15); assert.equal(result.preview.maximumFieldPatches, 140)
  assert.deepEqual(result.preview.countsByPurpose, { RESOLVED_GAP: 103, OBSERVED_STATUS_PROGRESSION: 7, MANDATORY_PROVENANCE: 15, MANDATORY_WRITE_TIMESTAMP: 15 })
  validatePreview(result.preview, reconcile(input).preview, input.frozen.nativeRows)
})
reject('raw response digest tampering rejected', (c) => { c.body += ' ' }, /RESPONSE_DIGEST/)
reject('provider cap overrun rejected', (c) => { c.ledger.callsConsumed = 2 }, /PROVIDER_CAP/)
reject('frozen gap tampering rejected', (c) => { c.frozen.providerGapBaseline[0].currentValue = 'R' }, /GAP_BASELINE_CHANGED/)
reject('scope escape rejected', (c) => alterResponse(c, (p) => { p.dates[0].games[0].gamePk = 1 }), /EXACT_SAME_GAME_RESPONSE/)
reject('duplicate games rejected', (c) => alterResponse(c, (p) => { p.dates[0].games.push(p.dates[0].games[0]) }), /EXACT_SAME_GAME_RESPONSE/)
reject('missing game rejected without retry', (c) => alterResponse(c, (p) => { p.dates[0].games.pop() }), /EXACT_SAME_GAME_RESPONSE/)
reject('game type never defaults', (c) => alterResponse(c, (p) => { delete p.dates[0].games[0].gameType }), /GAME_TYPE_MISSING/)
reject('official date never inferred from UTC', (c) => alterResponse(c, (p) => { delete p.dates[0].games[0].officialDate }), /OFFICIAL_DATE_CONFLICT/)
reject('changed scheduled time rejected', (c) => alterResponse(c, (p) => { p.dates[0].games[0].gameDate = '2026-09-10T00:00:00Z' }), /START_TIME_CONFLICT/)
reject('doubleheader identity conflict rejected', (c) => alterResponse(c, (p) => { p.dates[0].games[0].gameNumber = 2 }), /GAME_NUMBER_CONFLICT/)
reject('cross-team evidence rejected', (c) => alterResponse(c, (p) => { p.dates[0].games[0].teams.home.team.id = 999 }), /TEAM_IDENTITY_CONFLICT/)
reject('changed starter rejected', (c) => alterResponse(c, (p) => { p.dates[0].games[0].teams.home.probablePitcher.id = 999 }), /STARTER_CHANGED/)
reject('invalid starter shape rejected', (c) => alterResponse(c, (p) => { p.dates[0].games[0].teams.home.probablePitcher.id = '999' }), /INVALID_STARTER_ID/)
reject('same pitcher on both teams rejected', (c) => alterResponse(c, (p) => {
  const game = p.dates.flatMap((d) => d.games).find((g) => g.gamePk === 823092)
  game.teams.home.probablePitcher = { id: 999 }; game.teams.away.probablePitcher = { id: 999 }
}), /STARTER_TEAM_CONFLICT/)
reject('backdated observation rejected', (c) => { c.ledger.responseReceivedAt = '2026-09-01T00:00:00Z' }, /OBSERVATION_ORDER/)
check('post-start or final games excluded from preview', () => {
  const copy = structuredClone(input); alterResponse(copy, (p) => { p.dates[0].games[0].status.abstractGameState = 'Final' })
  const pk = JSON.parse(copy.body).dates[0].games[0].gamePk
  assert.ok(!reconcile(copy).preview.patches.some((p) => p.gamePk === pk))
})
check('changed native row invalidates exact preview', () => {
  const rows = structuredClone(input.frozen.nativeRows); rows[0].updated_at = '2099-01-01T00:00:00Z'
  assert.throws(() => validatePreview(result.preview, result.preview, rows), /NATIVE_ROW_CHANGED/)
})
check('patch cap and unexpected write target rejected', () => {
  const cap = structuredClone(result.preview); cap.maximumFieldPatches--
  assert.throws(() => validatePreview(cap, result.preview, input.frozen.nativeRows), /FIELD_CAP/)
  const wrong = structuredClone(result.preview); wrong.patches[0].table = 'public.pick2_game_predictions'
  assert.throws(() => validatePreview(wrong, result.preview, input.frozen.nativeRows), /PREVIEW_CHANGED/)
})
// Hypothetical in-memory row projection, explicitly not a production write/readback.
const projected = structuredClone(input.frozen.nativeRows)
for (const patch of result.preview.patches) {
  const native = projected.find((n) => n.game_pk === patch.gamePk)
  if (patch.column === 'updated_at') native.updated_at = result.gameEvidence[0].availabilityUpperBound
  else if (patch.jsonPath) native.metadata[patch.jsonPath[0]] = structuredClone(patch.newValue)
  else native[patch.column] = patch.newValue
}
const prospectiveBindings = projected.map((native) => {
  const runAsOf = result.gameEvidence[0].availabilityUpperBound
  const target = resolvePregameTarget({ native, runAsOf, eligibleGamePks: input.frozen.gamePks })
  try { resolveStarterContext(target); return { gamePk: native.game_pk, target: 'PASS', certifiedNormalizedStatus: target.pregameStatus, starters: 'PASS' } }
  catch (error) { assert.match(error.message, /STARTER_MISSING/); return { gamePk: native.game_pk, target: 'PASS', certifiedNormalizedStatus: target.pregameStatus, starters: 'BLOCKED_UNKNOWN' } }
})
check('actual R1 target/starter resolver: 14 projected pass, one unknown', () => {
  assert.equal(prospectiveBindings.filter((r) => r.starters === 'PASS').length, 14)
  assert.deepEqual(prospectiveBindings.filter((r) => r.starters !== 'PASS').map((r) => r.gamePk), [823092])
})
check('old run as-of rejected by actual resolver', () => {
  assert.throws(() => resolvePregameTarget({ native: projected[0], runAsOf: input.frozen.frozenAt, eligibleGamePks: input.frozen.gamePks }), /TARGET_OBSERVATION_ASOF/)
})
check('started target rejected by actual resolver', () => {
  assert.throws(() => resolvePregameTarget({ native: projected[0], runAsOf: projected[0].scheduled_at, eligibleGamePks: input.frozen.gamePks }), /STARTED_GAME/)
})
let sideEffects = 0
const trap = new Proxy({}, { get: () => async () => { sideEffects++; throw new Error('UNEXPECTED_SIDE_EFFECT') } })
await assert.rejects(() => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', executionPackageSha: 'R2B_EVIDENCE_ONLY',
  authorization: { authorized: true, execution_package_sha: 'R2B_EVIDENCE_ONLY' }, providers: trap, repository: trap }), /R2T_LIVE_BLOCKED/)
check('actual LIVE_EXECUTE contained before provider/repository access', () => assert.equal(sideEffects, 0))
const parity = read('docs/CERTIFICATION/MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION.json')
const preservedFiles = [...new Set([...Object.keys(parity.sourceHashes), ...Object.keys(prior.sourceHashes),
  'scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs', 'scripts/mlb-data-02r-r2a-live-refresh-executor.mjs',
  'scripts/mlb-data-02r-r2g-persistence-interfaces.mjs', 'scripts/mlb-data-02r-r2t-real-feature-champion.mjs',
  'artifacts/mlb/mlb-02c-moneyline-baseline-model.json'])]
check('certified parity/runtime/Champion/76-feature code unchanged', () => {
  for (const file of preservedFiles) assert.equal(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'),
    execFileSync('git', ['show', `${PRIOR_SHA}:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n'), file)
})
check('all 19 inherited generated artifact bytes unchanged', () => {
  assert.equal(Object.keys(prior.protectedState.inheritedSha256).length, 19)
  for (const [file, expected] of Object.entries(prior.protectedState.inheritedSha256)) assert.equal(digest(fs.readFileSync(file)), expected, file)
})
check('offline replay has zero network or write invocations', () => { assert.equal(networkAttempts, 0); assert.equal(sideEffects, 0) })
const validation = { status: 'PASS', checksPassed: checks.length, checks, prospectiveBindings,
  projectionSemantics: 'In-memory future-row simulation at conservative acquisition availability bound; no claim actual production rows or historical Gate 4 pass',
  networkAttempts, productionDml: 0, productionDdl: 0, modelParityRerun: false, preservedFiles }
fs.writeFileSync(path.join(directory, 'reconciliation.json'), JSON.stringify(result, null, 2) + '\n')
fs.writeFileSync(path.join(directory, 'validation.json'), JSON.stringify(validation, null, 2) + '\n')
console.log(JSON.stringify({ status: validation.status, checksPassed: checks.length, resolved: result.resolved, remaining: result.remaining.length,
  previewRows: result.preview.maximumRowUpdates, previewFields: result.preview.maximumFieldPatches, prospectiveBindings, networkAttempts }))
