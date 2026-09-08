// One explicitly authorized MLB Official GET. No retries, DML or live execution.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

const directory = process.env.R2S_VALIDATION_DIR
assert.ok(directory && path.isAbsolute(directory), 'ISOLATED_PHASE_DIRECTORY_REQUIRED')
// Preserve the native fetch only for the tightly scoped provider operation below.
// All other network and filesystem activity retains the existing read-only guard.
const nativeFetch = globalThis.fetch
await import('./mlb-data-02r-r2s-certification-guard.mjs')
const priorPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2T_R2A_NATIVE_SAME_GAME_EVIDENCE_RECOVERY_AND_REPAIR_PLAN.json'
const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'))
const packageSha = 'b1d1bae784c532d1cf0394733a70e7562982aefc'
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), packageSha, 'EXECUTION_BASELINE_CHANGED')
assert.equal(prior.certificationVerdict, prior.project + '_CERTIFIED')
const gamePks = prior.affectedGames.map((row) => row.gamePk).sort((a, b) => a - b)
const gaps = prior.exactInventory.filter((row) => row.recoveryCategory === 'D')
assert.equal(gamePks.length, 15); assert.equal(new Set(gamePks).size, 15); assert.equal(gaps.length, 47)
const endpoint = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePks=${gamePks.join(',')}&hydrate=probablePitcher,team,venue`
const freezePath = path.join(directory, 'frozen-baseline.json')
const baseline = { project: 'MLB_DATA_02R_R2T_R2B_BOUNDED_MLB_OFFICIAL_EVIDENCE_RECOVERY', packageSha,
  frozenAt: new Date().toISOString(), gamePks, targetGameCount: 15, providerGapCount: 47,
  providerGapBaseline: gaps.map((row) => ({ gamePk: row.gamePk, table: row.physicalTable, column: row.physicalColumn,
    jsonPath: row.jsonPath, logicalField: row.logicalField, currentValue: row.currentValue, valueState: row.valueState,
    requiredType: row.requiredValueType, reasonUnresolved: row.reason, r2aClassification: row.recoveryCategory })),
  nativeRows: prior.sourceSearch.sources.native.rows, priorArtifactDigest: sha256(prior),
  request: { method: 'GET', url: endpoint, redirects: 'error', retryCount: 0, maximumCalls: 1, maximumResponseBytes: 2000000 },
  restrictions: { productionDml: 0, productionDdl: 0, statcast: 0, odds: 0, otherProviders: 0, liveRefresh: false } }
if (process.argv.includes('--freeze')) {
  fs.writeFileSync(freezePath, JSON.stringify(baseline, null, 2) + '\n', { flag: 'wx' })
  console.log(JSON.stringify({ status: 'FROZEN_NO_PROVIDER_CALL', gamePks, providerGapCount: gaps.length, frozenAt: baseline.frozenAt, endpoint }))
} else if (process.argv.includes('--acquire')) {
  const frozen = JSON.parse(fs.readFileSync(freezePath, 'utf8'))
  assert.deepEqual(frozen.gamePks, gamePks); assert.equal(frozen.priorArtifactDigest, sha256(prior)); assert.equal(frozen.request.url, endpoint)
  const url = new URL(endpoint)
  assert.equal(url.origin, 'https://statsapi.mlb.com'); assert.equal(url.pathname, '/api/v1/schedule')
  assert.deepEqual(url.searchParams.get('gamePks').split(',').map(Number), gamePks)
  assert.deepEqual([...url.searchParams.keys()].sort(), ['gamePks', 'hydrate', 'sportId'])
  const ledgerPath = path.join(directory, 'mlb-provider-ledger.json')
  const ledger = { provider: 'MLB_OFFICIAL', callsConsumed: 1, maximumCalls: 1, requestedAt: new Date().toISOString(),
    responseReceivedAt: null, responseDateHeader: null, endpoint, gamePks, state: 'REQUEST_RESERVED_NO_RETRY',
    odds: 0, statcast: 0, balldontlie: 0, sportsdataio: 0, otherProviders: 0 }
  // Exclusive creation consumes the budget before network I/O. Any interruption
  // or failure leaves it consumed; replay must read evidence, never reacquire.
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n', { flag: 'wx' })
  try {
    const response = await nativeFetch(endpoint, { method: 'GET', redirect: 'error', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(45000) })
    const body = await response.text()
    ledger.responseReceivedAt = new Date().toISOString()
    ledger.responseDateHeader = response.headers.get('date')
    ledger.httpStatus = response.status
    ledger.responseBytes = Buffer.byteLength(body)
    ledger.sourcePayloadDigest = crypto.createHash('sha256').update(body).digest('hex')
    fs.writeFileSync(path.join(directory, 'mlb-official-response.json'), body, { flag: 'wx' })
    assert.ok(response.ok, `MLB_OFFICIAL_HTTP_${response.status}`)
    assert.ok(ledger.responseBytes <= frozen.request.maximumResponseBytes, 'RESPONSE_SIZE_CAP')
    const payload = JSON.parse(body)
    const rows = (payload.dates ?? []).flatMap((date) => date.games ?? [])
    const returnedIds = rows.map((game) => Number(game.gamePk))
    ledger.returnedGamePks = returnedIds
    ledger.outOfScopeGamePks = returnedIds.filter((pk) => !gamePks.includes(pk))
    ledger.missingGamePks = gamePks.filter((pk) => !returnedIds.includes(pk))
    assert.equal(ledger.outOfScopeGamePks.length, 0, 'PROVIDER_RESPONSE_SCOPE_ESCAPE')
    assert.equal(new Set(returnedIds).size, returnedIds.length, 'DUPLICATE_SAME_GAME_EVIDENCE')
    ledger.state = ledger.missingGamePks.length ? 'PARTIAL_RESPONSE' : 'ACQUIRED'
  } catch (error) {
    ledger.state = 'FAILED_NO_RETRY'
    ledger.error = error.code ?? error.name
    process.exitCode = 1
  } finally {
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n')
  }
  console.log(JSON.stringify(ledger))
} else throw new Error('CHOOSE_FREEZE_OR_SINGLE_ACQUIRE')
