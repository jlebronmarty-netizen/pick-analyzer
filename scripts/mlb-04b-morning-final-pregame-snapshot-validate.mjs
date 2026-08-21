import fs from 'node:fs'

const SERVICE_PATH = 'src/services/mlb-04b-research-snapshot-runtime.service.ts'
const CERT_PATH = 'docs/CERTIFICATION/mlb-04b-morning-final-pregame-snapshot-runtime.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/MLB_04B_MORNING_FINAL_PREGAME_SNAPSHOT_RUNTIME.md'
const MIGRATION_PATH = 'supabase/migrations/202608200001_mlb_context_snapshots_v1.sql'

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
}

function check(name, condition) {
  if (!condition) throw new Error(`${name} failed`)
  console.log(`PASS ${name}`)
}

const service = read(SERVICE_PATH)
const certRaw = read(CERT_PATH)
const cert = JSON.parse(certRaw)
const doc = read(DOC_PATH)
const migration = read(MIGRATION_PATH)

check('classification', cert.classification === 'MLB_04B_MORNING_FINAL_PREGAME_SNAPSHOT_RUNTIME_CERTIFIED')
check('existing snapshot table reused', cert.existingSnapshotInfrastructure.table === 'mlb_context_snapshots')
check('migration supports morning', /'MORNING'/.test(migration))
check('migration supports final pregame', /'FINAL_PREGAME'/.test(migration))
check('current probe not substitute', cert.existingSnapshotInfrastructure.currentProbeSubstitutionAllowed === false && service.includes('currentProbeSubstitutionAllowed: false'))
check('dry run default', cert.runtime.dryRunDefault === true && service.includes('dryRunDefault: !executionAuthorized'))
check('explicit authorization required', cert.runtime.activationGuard === 'MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED' && service.includes('MLB_04B_CONTEXT_SNAPSHOT_AUTH_ENV'))
check('identity fields complete', cert.snapshotIdentityContract.fields.join(',') === 'sport_key,event_id,snapshot_type,capture_window,methodology_version')
check('morning final distinct', cert.snapshotIdentityContract.morningAndFinalPregameDistinct === true)
check('no overwrite', cert.snapshotIdentityContract.overwriteAllowed === false)
check('temporal capture before start', cert.temporalSafety.captureTimestampBeforeStartRequired === true)
check('source timestamps before start', cert.temporalSafety.allSourceTimestampsBeforeStartRequired === true)
check('post start blocked', cert.temporalSafety.postStartSourcesBlocked === true && service.includes('SKIP_POST_START'))
check('retrospective morning blocked', cert.temporalSafety.retrospectiveMorningFabricationBlocked === true)
check('sportsdataio excluded', cert.sourceAuthority.sportsDataIo === 'EXCLUDED_ROLLBACK_ONLY' && service.includes('EXCLUDED_ROLLBACK_ONLY'))
check('weather explicit missing', cert.completenessContract.missingWeatherExplicit === true && doc.includes('missing weather'))
check('injury explicit missing', cert.completenessContract.missingInjuryExplicit === true && doc.includes('missing injury'))
check('morning dry run eligible', cert.dryRuns.morning.eligible === 1 && cert.dryRuns.morning.skipped === 0)
check('final dry run eligible', cert.dryRuns.finalPregame.eligible === 1 && cert.dryRuns.finalPregame.skipped === 0)
check('provider calls zero', cert.mutationSafety.providerCallsMade === 0 && cert.dryRuns.providerCalls === 0)
check('database mutations zero', cert.mutationSafety.productionDatabaseMutations === 0)
check('prediction writes zero', cert.mutationSafety.predictionHistoryWrites === 0 && cert.mutationSafety.currentEraShadowWrites === 0)
check('official pick writes zero', cert.mutationSafety.officialPickWrites === 0)
check('settlement learning calibration zero', cert.mutationSafety.settlementWrites === 0 && cert.mutationSafety.learningWrites === 0 && cert.mutationSafety.calibrationWrites === 0)
check('no fourth canary', cert.regressionSafety.fourthCanaryCreated === false)
check('scorecard no probability', cert.deltaContract.scorecardEmitsProbability === false && doc.includes('must not emit copied ChatGPT probabilities'))
check('pitcher props not ready', cert.propAndDerivativePolicy.pitcherProps === 'FOUNDATION_ONLY_NOT_PRODUCT_READY')
check('nrfi blocked', cert.propAndDerivativePolicy.nrfiYrfi === 'BLOCKED_NOT_PRODUCT_READY')
check('readiness yes', cert.readiness.MORNING_SNAPSHOT_RUNTIME_READY === 'YES' && cert.readiness.FINAL_PREGAME_SNAPSHOT_RUNTIME_READY === 'YES')
check('write proof not completed', cert.readiness.PRODUCTION_WRITE_PROOF_COMPLETED === 'NO')
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([service, certRaw, doc].join('\n')))

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_04b_morning_final_pregame_snapshot_validate',
  classification: cert.classification,
  providerCallsMade: cert.mutationSafety.providerCallsMade,
  productionDatabaseMutations: cert.mutationSafety.productionDatabaseMutations,
}, null, 2))
