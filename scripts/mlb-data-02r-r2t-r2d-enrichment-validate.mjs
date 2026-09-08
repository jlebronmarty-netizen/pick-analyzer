import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { compileEnrichment, validatePacket, verifyReadback, CERTIFICATE, FROZEN_SHA } from './mlb-data-02r-r2t-r2d-canonical-enrichment.mjs'
import { classifyRepair } from './mlb-data-02r-r2t-r2c-repair-review.mjs'
import { digest } from './mlb-data-02r-r2t-r2b-evidence-reconcile.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
assert.ok(process.env.R2S_VALIDATION_DIR)
globalThis.fetch = async () => { throw new Error('OFFLINE_ONLY') }
const directory = process.env.R2S_VALIDATION_DIR
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))
const certificate = read(CERTIFICATE), before = read(path.join(directory, 'before.json')).rows
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), FROZEN_SHA)
const checks = []
const check = (name, fn) => { fn(); checks.push({ name, status: 'PASS' }) }
check('frozen certificate equals package content', () => assert.equal(fs.readFileSync(CERTIFICATE, 'utf8').replaceAll('\r\n', '\n'), execFileSync('git', ['show', `${FROZEN_SHA}:${CERTIFICATE}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n')))
check('all 15 fresh rows satisfy exact old-value predicates', () => validatePacket(certificate, before))
check('packet cap or excluded-field changes rejected', () => { const c = structuredClone(certificate); c.authorizationPacket.rows[0].patches[0].logicalField = 'official_status'; assert.throws(() => validatePacket(c, before), /FROZEN_PACKET_CHANGED/) })
check('changed old value fails closed', () => { const b = structuredClone(before); b[0].game_type = 'R'; assert.throws(() => validatePacket(certificate, b), /EXPECTED_OLD_ROW_CHANGED/) })
check('changed source digest fails closed', () => { const b = structuredClone(before); b[0].source_payload_digest = 'OTHER'; assert.throws(() => validatePacket(certificate, b), /EXPECTED_OLD_ROW_CHANGED/) })
check('scope escape fails closed', () => { const b = structuredClone(before); b[0].game_pk = 1; assert.throws(() => validatePacket(certificate, b), /ROW_SCOPE/) })
const timestamp = new Date().toISOString()
const projected = certificate.authorizationPacket.rows.map((p) => classifyRepair(p, p.expectedRow, timestamp).projected)
check('exact readback, 52 exclusions and second-pass zero updates', () => { const r = verifyReadback(certificate, before, projected); assert.equal(r.fieldPatches, 90); assert.equal(r.excludedFieldsUntouched, 52); assert.equal(r.secondPassProjectedUpdates, 0) })
check('tampered provenance readback rejected', () => { const a = structuredClone(projected); a[0].metadata.r2t_r2b_evidence.repairVersion = 'OTHER'; assert.throws(() => verifyReadback(certificate, before, a), /READBACK_OR_PROVENANCE_CONFLICT/) })
check('excluded starter write rejected', () => { const a = structuredClone(projected); a.find((r) => r.game_pk === 823092).metadata.homeProbablePitcher = { id: 999 }; assert.throws(() => verifyReadback(certificate, before, a), /READBACK_OR_PROVENANCE_CONFLICT/) })
const drySql = compileEnrichment(certificate, before), executeSql = compileEnrichment(certificate, before, { execute: true })
check('dry and execute SQL differ only in explicit execution flag', () => assert.equal(drySql.replace('execute_authorized constant boolean := false', 'execute_authorized constant boolean := true'), executeSql))
check('SQL has one exact UPDATE statement and no inserts/deletes/DDL', () => {
  assert.equal((executeSql.match(/UPDATE public\.pick2_mlb_games AS g SET/g) ?? []).length, 1)
  assert.ok(!/\b(?:INSERT INTO|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE|CREATE FUNCTION)\b/i.test(executeSql))
  assert.ok(executeSql.includes('WHERE g.game_pk=old_row.game_pk AND to_jsonb(g)=to_jsonb(old_row)'))
  assert.ok(executeSql.indexOf('FOR UPDATE NOWAIT') < executeSql.indexOf('IF execute_authorized THEN'))
})
check('inherited artifacts and certified source files preserved', () => {
  for (const [f, h] of Object.entries(certificate.protectedState.inheritedSha256)) assert.equal(digest(fs.readFileSync(f)), h, f)
  for (const f of [...certificate.protectedState.preservedRuntimeFiles, ...Object.keys(certificate.sourceHashes)]) assert.equal(fs.readFileSync(f, 'utf8').replaceAll('\r\n', '\n'), execFileSync('git', ['show', `${FROZEN_SHA}:${f}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n'), f)
})
let sideEffects = 0
const trap = new Proxy({}, { get: () => async () => { sideEffects++; throw new Error('SIDE_EFFECT') } })
await assert.rejects(() => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', executionPackageSha: 'R2D_NO_LIVE', authorization: { authorized: true, execution_package_sha: 'R2D_NO_LIVE' }, providers: trap, repository: trap }), /R2T_LIVE_BLOCKED/)
check('live remains contained before provider/repository calls', () => assert.equal(sideEffects, 0))
fs.writeFileSync(path.join(directory, 'preflight.sql'), drySql)
fs.writeFileSync(path.join(directory, 'execute.sql'), executeSql)
fs.writeFileSync(path.join(directory, 'validation.json'), JSON.stringify({ status: 'PASS', checks, checksPassed: checks.length,
  simulationOnly: true, providerCalls: 0, productionDml: 0, productionDdl: 0, drySqlDigest: digest(drySql), executionSqlDigest: digest(executeSql) }, null, 2) + '\n')
console.log(JSON.stringify({ status: 'PASS', checks: checks.length, beforeRows: before.length, sqlBytes: Buffer.byteLength(executeSql), sideEffects }))
