import { existsSync, readFileSync } from 'node:fs'

const certPath = 'docs/CERTIFICATION/nba-01c-recover-balldontlie-goat-extraction.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_01C_RECOVER_BALLDONTLIE_GOAT_EXTRACTION.md'
const architecturePath = 'docs/ARCHITECTURE/NBA_HISTORICAL_FOUNDATION_FINAL_V1.md'
const providerMapPath = 'docs/ARCHITECTURE/NBA_FINAL_PROVIDER_MAP_V1.md'
const manifestPath = 'data/imports/balldontlie/nba/nba-01c-start-manifest.json'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function check(name, passed, details = '') {
  if (!passed) failures.push({ name, details })
}

const failures = []

check('certification exists', existsSync(certPath))
check('recovery doc exists', existsSync(docPath))
check('architecture checkpoint exists', existsSync(architecturePath))
check('manifest exists', existsSync(manifestPath))

const cert = readJson(certPath)
const manifest = readJson(manifestPath)
const doc = readFileSync(docPath, 'utf8')
const architecture = readFileSync(architecturePath, 'utf8')
const providerMap = readFileSync(providerMapPath, 'utf8')

check('recovery pass', cert.status === 'BALLDONTLIE_GOAT_HISTORICAL_EXTRACTION_RECOVERY_PASS')
check('pc restart pass', cert.pcRestartRecovery === 'PC_RESTART_RECOVERY_PASS')
check('foundation ready', cert.historicalFoundationVerdict === 'NBA_HISTORICAL_FOUNDATION_CERTIFIED_READY_FOR_REPLAY')
check('manifest completed', manifest.completed === true && cert.manifest.completed === true)
check('all tasks persisted', cert.manifest.taskCount === 5116 && cert.manifest.dbPersistedTasks === cert.manifest.taskCount)
check('no failed tasks', cert.manifest.failedTasks === 0 && !manifest.tasks.some((task) => String(task.state).startsWith('FAILED')))
check('no planned tasks', cert.manifest.plannedTasks === 0 && !manifest.tasks.some((task) => task.state === 'PLANNED'))
check('completed provider pages not refetched', cert.manifest.completedProviderPagesRefetched === 0)
check('raw gitignored', cert.rawPayloads.gitignored === true && cert.rawPayloads.accidentallyTracked === 0)
check('core event result count', cert.extraction.gamesObserved === 3710 && cert.extraction.gamesCanonicallyMapped === 3710)
check('advanced stats complete', cert.extraction.advancedStatRows === 358195)
check('event bindings repaired', cert.persistence.unresolvedEventBindings === 0 && cert.persistence.boundedEventBindingRepairRows === 100)
check('no SportsDataIO', cert.providerAccounting.sportsDataIoCalls === 0)
check('no The Odds API during recovery', cert.providerAccounting.theOddsApiHistoricalCallsDuringRecovery === 0)
check('no production activation', cert.safety.nbaProductionActivation === false && cert.safety.nbaCurrentEraWrites === 0)
check('NBA-02 not started', cert.safety.nba02Started === false)
check('provider map updated', providerMap.includes('NBA-01C Final Recovery Update') && providerMap.includes('DOWNGRADE_TO_ALL_STAR_RECOMMENDED'))
check('docs mention next phase', doc.includes('NBA-02') && architecture.includes('NBA-02'))
check('no literal key assignment in docs', !/BALLDONTLIE_API_KEY\s*=\s*[^\s`'"]+/i.test(doc + architecture + JSON.stringify(cert)))

if (failures.length) {
  console.error(JSON.stringify({ success: false, failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  success: true,
  mode: 'nba_01c_recover_balldontlie_goat_extraction_validation_v1',
  status: cert.status,
  manifestTasks: cert.manifest.taskCount,
  advancedStatRows: cert.extraction.advancedStatRows,
  providerCallsMadeByValidator: 0,
  databaseMutationsMadeByValidator: 0,
}, null, 2))
