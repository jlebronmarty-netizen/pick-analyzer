import fs from 'node:fs'

const files = {
  service: 'src/services/mlb-calibrated-shadow-v1.service.ts',
  generator: 'scripts/mlb-03-calibrated-shadow-foundation.mjs',
  validator: 'scripts/mlb-03-calibrated-shadow-foundation-validate.mjs',
  artifact: 'artifacts/mlb/mlb-03-market-calibration-v1.json',
  cert: 'docs/CERTIFICATION/mlb-03-calibrated-shadow-foundation.json',
  doc: 'docs/CERTIFICATION/MLB_03_CALIBRATED_SHADOW_FOUNDATION.md',
}

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
}

function assert(pass, message) {
  if (!pass) throw new Error(message)
}

const service = read(files.service)
const generator = read(files.generator)
const artifact = JSON.parse(read(files.artifact))
const certRaw = read(files.cert)
const cert = JSON.parse(certRaw)
const doc = read(files.doc)

assert(cert.classification === 'MLB_03_CALIBRATED_SHADOW_CERTIFIED_CONTEXT_FORWARD_ONLY', 'classification must be calibrated shadow/context forward-only')
assert(cert.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.productionDatabaseMutations === 0, 'production DB mutations must be zero')
assert(cert.productionModelChanged === false, 'production model must not change')
assert(cert.officialPickChanged === false, 'Official Picks must not change')
assert(cert.calibrationBootstrapCohort.temporalLeakage === 0, 'temporal leakage must be zero')
assert(cert.artifact.version === artifact.artifactVersion, 'artifact version mismatch')
assert(Boolean(artifact.digest), 'artifact digest required')
assert(artifact.sourceModelVersion === 'baseball_mlb_prospective_preview_v1', 'source model must be frozen baseline')
assert(artifact.shadowModelVersion === 'MLB_CALIBRATED_SHADOW_V1', 'shadow model version required')
assert(Object.keys(artifact.markets).includes('moneyline'), 'moneyline artifact required')
assert(Object.keys(artifact.markets).includes('run_line'), 'run line artifact required')
assert(Object.keys(artifact.markets).includes('total'), 'total artifact required')
for (const [market, map] of Object.entries(artifact.markets)) {
  assert(map.method === 'EMPIRICAL_BUCKETS_WITH_PLATT_FALLBACK', `${market} must use robust empirical + fallback`)
  assert(map.minBucketSample >= 30, `${market} min bucket support too low`)
  assert(map.fallback.method === 'PLATT_LOGISTIC', `${market} fallback must be Platt`)
  assert(map.buckets.every((bucket) => bucket.value > 0 && bucket.value < 1), `${market} bucket probabilities must be clipped`)
}
assert(service.includes("calibrationStatus: 'NOT_AVAILABLE'"), 'runtime must fail closed when artifact unavailable')
assert(service.includes('INVALID_PROBABILITY'), 'runtime must reject invalid probabilities')
assert(service.includes('buildMlbCalibratedShadowIdentity'), 'shadow identity helper required')
assert(cert.contextModel.selected === false, 'context model must not be selected without evidence')
assert(cert.contextModel.selectedContract === 'CALIBRATED_BASELINE_ONLY', 'selected contract must be calibrated baseline only')
assert(cert.currentContextSnapshotReadback.length >= 3, 'context snapshot readback required')
assert(cert.shadowContracts.predictionOrigin === 'CURRENT_ERA_SHADOW', 'shadow origin required')
assert(cert.shadowContracts.modelRole === 'shadow', 'model role must be shadow')
assert(cert.shadowContracts.productionEligible === false, 'shadow must not be production eligible')
assert(cert.shadowContracts.writeRuntimeReady === false, 'write runtime must remain gated off')
assert(cert.readiness.MARKET_CALIBRATION_ARTIFACT_READY === 'YES', 'artifact readiness required')
assert(cert.readiness.CALIBRATION_RUNTIME_READY === 'YES', 'runtime readiness required')
assert(cert.readiness.CALIBRATION_RUNTIME_PARITY === 'YES', 'runtime parity required')
assert(cert.readiness.CONTEXT_MODEL_SELECTED === 'NO', 'context model must not be selected')
assert(cert.readiness.CALIBRATED_SHADOW_RUNTIME_READY === 'YES', 'calibrated shadow runtime required')
assert(cert.readiness.CONTEXT_ENHANCED_SHADOW_RUNTIME_READY === 'NO', 'context enhanced runtime must not be overclaimed')
assert(cert.readiness.SHADOW_WRITE_RUNTIME_READY === 'NO', 'shadow write runtime must not be ready yet')
assert(!/supabase\.from\([^)]*\)[\s\S]{0,200}\.(insert|upsert|update|delete)\(/.test(generator), 'generator must not mutate Supabase')
assert(!/(SportsDataIO|SPORTSDATAIO_MLB_API_KEY)/.test(generator), 'SportsDataIO must not be called')
assert(doc.includes('Provider calls: 0'), 'doc must record provider calls')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, generator, certRaw, doc, JSON.stringify(artifact)].join('\n')), 'no secret values may be exposed')

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_03_calibrated_shadow_foundation_validator_v1',
  checks: 36,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))
