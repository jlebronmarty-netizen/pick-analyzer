#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const DEFAULT_CAPTURE_DIR = '.tmp/odds-shadow-certification'
const DEFAULT_ENDPOINT = 'https://pick-analyzer.vercel.app/api/operations/odds-shadow-comparison'
const CONFIRMATION = 'ODDS_02_SHADOW'

function isoStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function boolArg(name) {
  return process.argv.includes(name)
}

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback
}

function loadEnvFile(path = '.env.local') {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      if (!line.trim() || line.trimStart().startsWith('#')) continue
      const index = line.indexOf('=')
      if (index <= 0) continue
      const name = line.slice(0, index).trim()
      const value = line.slice(index + 1).trim()
      if (name && process.env[name] === undefined) process.env[name] = value
    }
  } catch {
    // Local env is optional for dry-run and fixture parsing.
  }
}

function secretPatterns() {
  const values = [
    process.env.CRON_SECRET,
    process.env.THE_ODDS_API_KEY,
    process.env.ODDS_API_KEY,
  ].filter((value) => typeof value === 'string' && value.length >= 8)
  return [
    /authorization\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
    /apiKey=[^&\s"']+/i,
    /"apiKey"\s*:\s*"[^"]+"/i,
    ...values.map((value) => new RegExp(escapeRegExp(value), 'g')),
  ]
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function assertSecretSafe(text, label) {
  const hit = secretPatterns().find((pattern) => pattern.test(text))
  if (hit) throw new Error(`${label}_CONTAINS_SECRET_OR_AUTHORIZATION`)
}

function ensureCaptureDir(captureDir) {
  mkdirSync(captureDir, { recursive: true })
}

function writeCapture({ captureDir = DEFAULT_CAPTURE_DIR, label = 'odds-shadow', status, body, metadata = {} }) {
  ensureCaptureDir(captureDir)
  const id = `${isoStamp()}-${label}-${randomUUID().slice(0, 8)}`
  const bodyPath = join(captureDir, `${id}.body.json`)
  const metadataPath = join(captureDir, `${id}.metadata.json`)
  const safeBody = typeof body === 'string' ? body : JSON.stringify(body)
  assertSecretSafe(safeBody, 'RESPONSE_BODY')
  const safeMetadata = {
    capturedAt: new Date().toISOString(),
    httpStatus: status,
    ...metadata,
  }
  const metadataText = JSON.stringify(safeMetadata, null, 2)
  assertSecretSafe(metadataText, 'RESPONSE_METADATA')
  writeFileSync(bodyPath, safeBody)
  writeFileSync(metadataPath, `${metadataText}\n`)
  return { bodyPath, metadataPath, id }
}

function parseCapturedJson(bodyText) {
  try {
    return { ok: true, payload: JSON.parse(bodyText), error: null }
  } catch (error) {
    return { ok: false, payload: null, error: error instanceof Error ? error.message : 'JSON_PARSE_FAILED' }
  }
}

function validateTopLevelApiOkPayload(payload, { live = false } = {}) {
  const errors = []
  const object = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null
  if (!object) return { ok: false, errors: ['PAYLOAD_NOT_OBJECT'] }
  if (object.data && object.status === undefined && object.mode === undefined) errors.push('NESTED_DATA_ENVELOPE_NOT_CANONICAL')
  if (typeof object.success !== 'boolean') errors.push('success must be boolean')
  if (typeof object.mode !== 'string') errors.push('mode must be string')
  if (typeof object.providerCallsMade !== 'number') errors.push('providerCallsMade must be number')
  if (typeof object.remoteMutationsMade !== 'number') errors.push('remoteMutationsMade must be number')
  if (object.credentialVariable !== 'THE_ODDS_API_KEY') errors.push('credentialVariable must be THE_ODDS_API_KEY')
  if (object.sportsDataIoProductionAuthority !== true) errors.push('sportsDataIoProductionAuthority must be true')
  if (live) {
    for (const field of ['eventsReturned', 'eventsMapped', 'eventsUnmapped', 'ambiguousEvents', 'shadowSnapshots', 'comparisons', 'coverage', 'calls']) {
      if (!(field in object)) errors.push(`${field} missing`)
    }
  }
  return { ok: errors.length === 0, errors }
}

function extractCertificationMetrics(payload) {
  return {
    success: payload.success,
    mode: payload.mode,
    status: payload.status ?? null,
    providerCallsMade: payload.providerCallsMade,
    remoteMutationsMade: payload.remoteMutationsMade,
    productionMutationsMade: payload.productionMutationsMade ?? null,
    requestsUsed: payload.requestsUsed ?? null,
    creditsUsed: payload.creditsUsed ?? null,
    creditsRemaining: payload.creditsRemaining ?? null,
    eventsReturned: payload.eventsReturned ?? null,
    eventsMapped: payload.eventsMapped ?? null,
    eventsUnmapped: payload.eventsUnmapped ?? null,
    ambiguousEvents: payload.ambiguousEvents ?? null,
    shadowSnapshots: payload.shadowSnapshots ?? null,
    bookmakers: payload.coverage?.bookmakers ?? [],
    comparisons: Array.isArray(payload.comparisons) ? payload.comparisons.length : null,
    sourceAges: payload.sourceAges ?? null,
    cutoverDecision: payload.cutoverDecision ?? null,
  }
}

async function fetchOnce({ endpoint = DEFAULT_ENDPOINT, live = false, maxCalls = 1 }) {
  const url = new URL(endpoint)
  const headers = {}
  const init = { method: 'GET', headers }
  if (live) {
    loadEnvFile()
    if (!process.env.CRON_SECRET) throw new Error('CRON_SECRET_MISSING')
    url.searchParams.set('live', 'true')
    url.searchParams.set('confirm', CONFIRMATION)
    url.searchParams.set('maxCalls', String(Math.max(1, Math.min(Number(maxCalls) || 1, 1))))
    headers.Authorization = `Bearer ${process.env.CRON_SECRET}`
    init.method = 'POST'
    init.body = JSON.stringify({ live: true, confirm: CONFIRMATION, maxCalls: 1 })
    headers['content-type'] = 'application/json'
  }
  const response = await fetch(url, init)
  const body = await response.text()
  return {
    status: response.status,
    ok: response.ok,
    body,
    metadata: {
      endpoint: url.origin + url.pathname,
      method: init.method,
      live,
      maxLiveRequestsThisInvocation: live ? 1 : 0,
      requestHeadersCaptured: false,
      authorizationHeaderCaptured: false,
    },
  }
}

async function main() {
  const captureDir = argValue('--capture-dir', DEFAULT_CAPTURE_DIR)
  const fixture = argValue('--fixture')
  const live = boolArg('--live')
  const dryRun = boolArg('--dry-run') || (!live && !fixture)
  const endpoint = argValue('--endpoint', DEFAULT_ENDPOINT)
  let result
  if (fixture) {
    result = { status: 200, ok: true, body: readFileSync(fixture, 'utf8'), metadata: { endpoint: 'fixture', method: 'FIXTURE', live: false, maxLiveRequestsThisInvocation: 0, requestHeadersCaptured: false, authorizationHeaderCaptured: false } }
  } else {
    result = await fetchOnce({ endpoint, live, maxCalls: 1 })
  }
  const capture = writeCapture({ captureDir, label: live ? 'live' : dryRun ? 'dry-run' : 'fixture', status: result.status, body: result.body, metadata: result.metadata })
  const parsed = parseCapturedJson(result.body)
  if (!parsed.ok) {
    console.error(JSON.stringify({ ok: false, phase: 'json_parse', capture, httpStatus: result.status, error: parsed.error }, null, 2))
    process.exit(2)
  }
  const contract = validateTopLevelApiOkPayload(parsed.payload, { live })
  if (!contract.ok) {
    console.error(JSON.stringify({ ok: false, phase: 'contract', capture, httpStatus: result.status, errors: contract.errors }, null, 2))
    process.exit(3)
  }
  console.log(JSON.stringify({ ok: true, capture, httpStatus: result.status, metrics: extractCertificationMetrics(parsed.payload) }, null, 2))
}

if (import.meta.url === `file://${process.argv[1].replaceAll('\\', '/')}` || process.argv[1]?.endsWith('odds-shadow-certification-capture.mjs')) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
    process.exit(1)
  })
}

export {
  DEFAULT_CAPTURE_DIR,
  assertSecretSafe,
  extractCertificationMetrics,
  parseCapturedJson,
  validateTopLevelApiOkPayload,
  writeCapture,
}
