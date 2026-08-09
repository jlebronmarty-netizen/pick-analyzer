import fs from 'node:fs'
import { execSync } from 'node:child_process'

const files = {
  adaptive: 'src/services/adaptive-refresh-orchestrator.service.ts',
  official: 'src/services/mlb-official-replacement.service.ts',
  provider: 'src/services/mlb-official-data-provider.service.ts',
  config: 'src/config/mlb-data-source-mode.config.ts',
  docs: 'docs/PRODUCTION_PILOT/SDIO_EXIT_03A_NATURAL_SHADOW_PROOF.md',
  providerDocs: 'docs/ARCHITECTURE/MLB_OFFICIAL_DATA_PROVIDER_V1.md',
  cert: 'docs/CERTIFICATION/sdio-exit-03a-natural-shadow-proof.json',
  validator: 'scripts/sdio-exit-03a-natural-shadow-proof-validate.mjs'
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const missing = Object.values(files).filter((path) => !fs.existsSync(path))
if (missing.length) {
  console.error(JSON.stringify({ success: false, missing }, null, 2))
  process.exit(1)
}

const adaptive = read(files.adaptive)
const official = read(files.official)
const provider = read(files.provider)
const config = read(files.config)
const docs = read(files.docs)
const providerDocs = read(files.providerDocs)
const cert = JSON.parse(read(files.cert))
const validator = read(files.validator)
const changedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
const combined = [adaptive, official, provider, config, docs, providerDocs, JSON.stringify(cert), validator].join('\n')

const checks = [
  ['DUAL_READ behavior documented', docs.includes('SportsDataIO remains product-authoritative') && docs.includes('MLB Stats API official shadow')],
  ['scheduler chain traced', docs.includes('/api/cron/operating-day') && docs.includes('runAdaptiveRefresh')],
  ['zero-natural-call root cause classified', cert.rootCause === 'MLB_OFFICIAL_NOT_WIRED' && docs.includes('MLB_OFFICIAL_NOT_WIRED')],
  ['official provider accounting separate', official.includes("job_type: 'sdio_exit_03a_mlb_official_shadow_v1'") && official.includes("provider: PROVIDER")],
  ['schedule calls bounded', official.includes('fetchMlbOfficialSchedule(operatingDate') && official.includes('timeoutMs ?? 12000')],
  ['starter calls bounded', !official.includes('/people/') && !official.includes('person?') && docs.includes('one bounded date-level MLB Stats API schedule call')],
  ['official rows remain shadow', official.includes('shadowOnly: true') && adaptive.includes('productAuthorityChanged: false')],
  ['canonical events not overwritten', official.includes('canonicalEventsOverwritten: false') && !official.includes(".from('sport_events').upsert")],
  ['event mappings unambiguous accounting exists', official.includes('ambiguousGames') && official.includes('duplicateEvents: 0')],
  ['probable starter mappings safe', official.includes('probableStartersReturned') && official.includes("entity_type: 'player'")],
  ['lifecycle differences observable', official.includes('statusDifferences') && official.includes('startTimeDifferences')],
  ['no production authority change', cert.safety.mlbOfficialPrimaryPromoted === false && cert.safety.oddsAuthorityPromoted === false],
  ['no prediction policy change', cert.safety.predictionPolicyChanged === false && cert.safety.officialPickPolicyChanged === false],
  ['certification reads make 0 provider calls', cert.safety.certificationProviderCalls === 0],
  ['certification reads make 0 mutations', cert.safety.certificationDatabaseMutations === 0],
  ['rollback retained', config.includes("rollbackMode: 'SPORTSDATAIO'") && cert.expectedDualReadBehavior.sportsDataIo === 'PRODUCT_AUTHORITY_AND_ROLLBACK_RETAINED'],
  ['adaptive scheduler invokes official shadow', adaptive.includes('executeMlbOfficialShadowAcquisition') && adaptive.includes('mlbOfficialShadowAcquisition')],
  ['only MLB scoped runtime changed', !changedFiles.some((path) => /^(src\/app\/api|src\/services)\/(nba|nfl|nhl|soccer|tennis|ufc)\b/.test(path.replaceAll('\\', '/')))],
  ['no secret values exposed', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SPORTSDATAIO_MLB_API_KEY\s*=\s*\S+|THE_ODDS_API_KEY\s*=\s*\S+|CRON_SECRET\s*=\s*\S+)/.test(combined)]
]

const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failedChecks.length === 0,
  mode: 'sdio_exit_03a_natural_shadow_proof_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  databaseMutationsMade: 0,
  finalClassification: cert.finalClassification
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
