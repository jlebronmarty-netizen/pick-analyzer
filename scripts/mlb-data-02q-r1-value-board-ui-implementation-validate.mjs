import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02q-r1-value-board-ui-implementation.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02q-r1-value-board-ui-implementation-audit.md'
const pagePath = 'src/app/mlb-value-board/page.tsx'
const loadingPath = 'src/app/mlb-value-board/loading.tsx'
const errorPath = 'src/app/mlb-value-board/error.tsx'
const clientPath = 'src/components/pick2/MlbValueBoardClient.tsx'
const servicePath = 'src/services/pick2-mlb-value-board.service.ts'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')
const page = fs.readFileSync(pagePath, 'utf8')
const loading = fs.readFileSync(loadingPath, 'utf8')
const error = fs.readFileSync(errorPath, 'utf8')
const client = fs.readFileSync(clientPath, 'utf8')
const service = fs.readFileSync(servicePath, 'utf8')

assert(artifact.certificationVerdict === 'MLB_DATA_02Q_R1_VALUE_BOARD_UI_IMPLEMENTATION_CERTIFIED', 'classification mismatch')
assert(artifact.publication.state === 'PASS', 'publication failed')
assert(artifact.production.PRODUCTION_ALIGNMENT === 'PASS', 'production alignment failed')
assert(artifact.featureGate.MLB_02Q_R1_FEATURE_GATE_CONTRACT === 'PASS', 'feature gate failed')
assert(artifact.featureGate.MLB_02Q_R1_FEATURE_GATE_DEFAULT_OFF === 'PASS', 'feature gate default failed')
assert(artifact.featureGate.MLB_02Q_R1_PUBLIC_NAV_HIDDEN === 'PASS', 'public nav visible')
assert(artifact.page.MLB_02Q_R1_VALUE_BOARD_PAGE === 'READY', 'page missing')
assert(artifact.page.MLB_02Q_R1_BOARD_SUMMARY === 'READY', 'summary missing')
assert(artifact.page.MLB_02Q_R1_OFFICIAL_PICK_SECTION === 'READY', 'official section missing')
assert(artifact.page.MLB_02Q_R1_VALUE_CANDIDATE_SECTION === 'READY', 'value section missing')
assert(artifact.page.MLB_02Q_R1_WATCHLIST_SECTION === 'READY', 'watchlist missing')
assert(artifact.page.MLB_02Q_R1_BLOCKED_SECTION === 'READY', 'blocked missing')
assert(artifact.page.MLB_02Q_R1_PICK_LANGUAGE === 'PASS', 'pick language failed')
assert(artifact.layout.MLB_02Q_R1_MOBILE_CARD_CORE === 'PASS', 'mobile core failed')
assert(artifact.layout.MLB_02Q_R1_DESKTOP_LAYOUT === 'READY', 'desktop missing')
assert(artifact.presentation.MLB_02Q_R1_VALUE_SCORE_UI === 'PASS', 'value score failed')
assert(artifact.presentation.MLB_02Q_R1_WHY_UI === 'READY', 'why missing')
assert(artifact.presentation.MLB_02Q_R1_RISK_UI === 'READY', 'risk missing')
assert(artifact.presentation.MLB_02Q_R1_BLOCKER_UI === 'READY', 'blocker missing')
assert(artifact.presentation.MLB_02Q_R1_FACTOR_EDGE_UI === 'READY', 'factor edge missing')
assert(artifact.presentation.MLB_02Q_R1_FACTOR_EDGE_INTEGRITY === 'PASS', 'factor integrity failed')
assert(artifact.presentation.MLB_02Q_R1_PICK_DETAIL_UI === 'READY', 'detail missing')
assert(artifact.presentation.MLB_02Q_R1_FILTER_UI === 'READY', 'filters missing')
assert(artifact.presentation.MLB_02Q_R1_SORT_UI === 'READY', 'sorting missing')
assert(artifact.presentation.MLB_02Q_R1_STATUS_VISUAL_HIERARCHY === 'PASS', 'visual hierarchy failed')
assert(artifact.presentation.MLB_02Q_R1_FRESHNESS_UI === 'READY', 'freshness missing')
assert(artifact.presentation.MLB_02Q_R1_TIMESTAMP_UI === 'READY', 'timestamps missing')
assert(artifact.presentation.MLB_02Q_R1_LOADING_STATE === 'READY', 'loading state missing')
assert(artifact.presentation.MLB_02Q_R1_ERROR_STATE === 'READY', 'error state missing')
assert(artifact.presentation.MLB_02Q_R1_EMPTY_STATE === 'READY', 'empty state missing')
assert(artifact.query.MLB_02Q_R1_QUERY_INTEGRATION === 'PASS', 'query integration failed')
assert(artifact.query.MLB_02Q_R1_QUERY_READ_ONLY === 'PASS', 'query read only failed')
assert(artifact.currentData.officialPickCount === 5, 'official pick count mismatch')
assert(artifact.currentData.valueCandidateCount === 14, 'value candidate count mismatch')
assert(artifact.currentData.watchlistCount === 23, 'watchlist count mismatch')
assert(artifact.currentData.blockedCount === 0, 'blocked count mismatch')
assert(artifact.currentData.totalBoardRows === 42, 'total board rows mismatch')
assert(artifact.currentData.topPick.game_pk === 823904, 'top pick game mismatch')
assert(artifact.currentData.topPick.side === 'AWAY', 'top pick side mismatch')
assert(artifact.currentData.topPick.best_book === 'betrivers', 'top pick book mismatch')
assert(Math.abs(artifact.currentData.topPick.consensus_edge - 0.081935617141676) < 0.000001, 'top pick edge mismatch')
assert(Math.abs(artifact.currentData.topPick.unit_ev - 0.2409281394125) < 0.000001, 'top pick ev mismatch')
assert(artifact.currentData.MLB_02Q_R1_TOP_PICK_PARITY === 'PASS', 'top pick parity failed')
assert(artifact.layout.MLB_02Q_R1_RESPONSIVE_VALIDATION === 'PASS', 'responsive validation failed')
assert(artifact.layout.MLB_02Q_R1_ACCESSIBILITY === 'PASS', 'accessibility failed')
assert(artifact.presentation.MLB_02Q_R1_MODEL_NOTE === 'READY', 'model note missing')
assert(artifact.presentation.MLB_02Q_R1_NO_PROFITABILITY_CLAIM === 'PASS', 'profitability guard failed')
assert(artifact.featureGate.MLB_02Q_R1_GATE_OFF_TEST === 'PASS', 'gate off failed')
assert(artifact.featureGate.MLB_02Q_R1_GATE_ON_TEST === 'PASS', 'gate on failed')
assert(artifact.boundaries.MLB_02Q_R1_VALUE_BOARD_PUBLICATION === 'NO', 'value board published')
assert(artifact.boundaries.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY === 'NO', 'publication ready should remain no')
assert(artifact.boundaries.productionDml === 0, 'production dml occurred')
assert(artifact.boundaries.productionDdl === 0, 'production ddl occurred')
assert(artifact.boundaries.providerCalls === 0, 'provider calls occurred')
assert(artifact.boundaries.automation === 'OFF' && artifact.boundaries.cronChanges === 0, 'automation changed')
assert(artifact.tests.MLB_02Q_R1_UI_TESTS === 'PASS', 'ui tests failed')
assert(page.includes('notFound()') && page.includes('isPick2MlbValueBoardEnabled()'), 'page is not gated')
assert(service.includes("process.env.PICK2_MLB_VALUE_BOARD_ENABLED === 'true'"), 'gate is not default off')
assert(service.includes("import 'server-only'"), 'service must be server-only')
assert(!service.includes('.insert(') && !service.includes('.update(') && !service.includes('.delete(') && !service.includes('.upsert('), 'service is not read only')
assert(['Official Picks', 'Value Candidates', 'Watchlist', 'Blocked', 'Filters & Sorting', 'Pick Detail', 'Value Score'].every((text) => client.includes(text)), 'client missing required UI text')
assert(loading.includes('MlbValueBoardLoading'), 'loading state missing')
assert(error.includes('No fallback picks'), 'error state must not fabricate fallback picks')
assert(!/\bLOCK\b|BEST BET GUARANTEED|\bSAFE\b|CAN'T MISS|SURE WIN/i.test(client), 'misleading language present')
assert(audit.includes('VALUE BOARD NOT PUBLICLY ENABLED'), 'audit missing publication boundary')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\\s*=|THE_ODDS_API_KEY\\s*=|ODDS_API_KEY\\s*=|CRON_SECRET\\s*=|Bearer\\s+[A-Za-z0-9._-]{20,})/.test(JSON.stringify(artifact) + audit + page + client + service), 'possible secret exposed')

console.log(JSON.stringify({
  validator: 'mlb-data-02q-r1-value-board-ui-implementation-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  rows: artifact.currentData.totalBoardRows,
  publication: artifact.boundaries.valueBoardPublication,
}, null, 2))
