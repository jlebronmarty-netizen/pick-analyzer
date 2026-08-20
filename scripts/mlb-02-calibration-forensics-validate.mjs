import fs from 'node:fs'

const files = {
  analyzer: 'scripts/mlb-02-calibration-forensics.mjs',
  cert: 'docs/CERTIFICATION/mlb-02-calibration-forensics.json',
  doc: 'docs/CERTIFICATION/MLB_02_CALIBRATION_FORENSICS.md',
}

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
}

function assert(pass, message) {
  if (!pass) throw new Error(message)
}

const analyzer = read(files.analyzer)
const doc = read(files.doc)
const certRaw = read(files.cert)
const cert = JSON.parse(certRaw)

assert(analyzer.includes("eq('sport_key', SPORT)") || analyzer.includes('.eq('), 'analyzer must filter sport')
assert(analyzer.includes('providerCallsMade: 0'), 'provider calls must be zero')
assert(analyzer.includes('productionDatabaseMutations: 0'), 'production mutations must be zero')
assert(!/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(analyzer), 'analyzer must not write to Supabase')
assert(cert.classification === 'MLB_02_CALIBRATION_FORENSICS_CERTIFIED', 'classification must certify MLB-02')
assert(cert.providerCallsMade === 0, 'cert provider calls must be zero')
assert(cert.productionDatabaseMutations === 0, 'cert DB mutations must be zero')
assert(cert.baseline.filteredPredictionCount > 0, 'baseline rows required')
assert(cert.marketPerformance.moneyline || cert.marketPerformance.run_line || cert.marketPerformance.total, 'market performance required')
assert(Object.keys(cert.probabilityBuckets).length > 0, 'probability bucket calibration required')
assert(Object.keys(cert.edgeBuckets).length > 0, 'edge bucket analysis required')
assert(Object.keys(cert.evBuckets).length > 0, 'EV bucket analysis required')
assert(cert.runtimeCalibrationRootCause.identified === true, 'root cause must be identified')
assert(cert.calibrationResearch.temporalSplit.leakage === 0, 'temporal leakage must be zero')
assert(cert.calibrationResearch.byMarket.moneyline, 'moneyline calibration required')
assert(cert.calibrationResearch.byMarket.run_line, 'run line calibration required')
assert(cert.calibrationResearch.byMarket.total, 'total calibration required')
assert(cert.labelIntegrity.fabricatedLabels === 0, 'labels must not be fabricated')
assert(cert.clvCoverage.limitation.includes('do not infer'), 'CLV limitation must be explicit')
assert(cert.currentContextSnapshots.length >= 3, 'MLB-01 context snapshots must be read')
assert(cert.designs.shadowV1.modelVersion === 'MLB_CONTEXT_ENHANCED_SHADOW_V1', 'shadow V1 design required')
assert(cert.readiness.MLB_CALIBRATION_ROOT_CAUSE_IDENTIFIED === 'YES', 'root cause readiness required')
assert(cert.readiness.MARKET_SPECIFIC_CALIBRATION_RECOMMENDED === 'YES', 'market-specific calibration required')
assert(cert.readiness.CALIBRATION_BOOTSTRAP_READY === 'YES', 'bootstrap readiness required')
assert(cert.readiness.CONTEXT_ENHANCED_SHADOW_DESIGN_READY === 'YES', 'context shadow design readiness required')
assert(cert.readiness.MLB_03_CONTEXT_ENHANCED_SHADOW_READY === 'YES', 'MLB-03 readiness required')
assert(doc.includes('Provider calls: 0'), 'doc must record zero provider calls')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([analyzer, doc, certRaw].join('\n')), 'no secret values may be exposed')

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_02_calibration_forensics_validator_v1',
  checks: 27,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))
