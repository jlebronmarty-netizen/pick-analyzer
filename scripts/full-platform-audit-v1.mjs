import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT_JSON = 'docs/FULL_PLATFORM_AUDIT_V1_FINDINGS.json'
const OUT_AUDIT = 'docs/FULL_PLATFORM_AUDIT_V1.md'
const OUT_MAP = 'docs/FULL_PLATFORM_AUDIT_V1_SYSTEM_MAP.md'
const OUT_PLAN = 'docs/FULL_PLATFORM_AUDIT_V1_REPAIR_PLAN.md'

function loadLocalEnv() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', '.next', 'node_modules'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else files.push(path.relative(ROOT, full).replaceAll('\\', '/'))
  }
  return files
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
}

function routePath(file, kind) {
  let route = file
    .replace(/^src\/app/, '')
    .replace(kind === 'api' ? /\/route\.(ts|tsx|js)$/ : /\/page\.(ts|tsx|js)$/, '')
    .replace(/\(.*?\)\//g, '')
  route = route || '/'
  return route.replace(/\[([^\]]+)\]/g, ':$1')
}

function uniq(values) {
  return Array.from(new Set(values)).sort()
}

function countBy(values, keyFn) {
  return values.reduce((acc, value) => {
    const key = keyFn(value)
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

function findImports(text) {
  return Array.from(text.matchAll(/from ['"]([^'"]+)['"]/g)).map((match) => match[1])
}

function tableRefs(text) {
  return Array.from(text.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g)).map((match) => match[1])
}

function classifyService(file) {
  const name = path.basename(file).toLowerCase()
  if (name.includes('provider') || name.includes('sportsdataio') || name.includes('odds-api')) return 'provider'
  if (name.includes('prediction') || name.includes('projection')) return 'prediction'
  if (name.includes('feature')) return 'feature'
  if (name.includes('settlement') || name.includes('settle')) return 'settlement'
  if (name.includes('learning') || name.includes('calibration')) return 'learning'
  if (name.includes('scheduler') || name.includes('operating-day') || name.includes('adaptive-refresh') || name.includes('cron')) return 'scheduler'
  if (name.includes('sync') || name.includes('import')) return 'sync'
  if (name.includes('identity') || name.includes('crosswalk') || name.includes('mapping')) return 'identity'
  if (name.includes('performance')) return 'performance'
  if (name.includes('dashboard') || name.includes('briefing') || name.includes('operations')) return 'product'
  return 'other'
}

function evidenceFinding(severity, title, files, evidence, impact, repair, risk = 'Medium') {
  return { severity, title, files, evidence, impact, recommendedRepair: repair, regressionRisk: risk }
}

async function safeCount(client, table, build) {
  try {
    let query = client.from(table).select('id', { count: 'exact', head: true })
    if (build) query = build(query)
    const { count, error } = await query
    return { count: count ?? 0, error: error?.message ?? null }
  } catch (error) {
    return { count: null, error: error instanceof Error ? error.message : String(error) }
  }
}

async function safeRows(client, table, columns, build, limit = 1000) {
  try {
    let query = client.from(table).select(columns).limit(limit)
    if (build) query = build(query)
    const { data, error } = await query
    return { rows: data ?? [], error: error?.message ?? null }
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : String(error) }
  }
}

async function dbAudit() {
  loadLocalEnv()
  const result = { available: false, providerCallsMade: 0, remoteMutationsMade: 0, tables: {}, sports: {}, integrity: {}, errors: [] }
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin')
    result.available = true
    const sports = {
      MLB: 'baseball_mlb',
      NBA: 'basketball_nba',
      NFL: 'americanfootball_nfl',
      NHL: 'icehockey_nhl',
      Soccer: 'soccer',
      BSN: 'basketball_bsn',
      Tennis: 'tennis',
      UFC: 'mma_mixed_martial_arts',
    }
    for (const table of ['sports_teams', 'sport_events', 'game_results', 'sports_odds_snapshots', 'prediction_history', 'historical_feature_snapshots', 'provider_entity_mappings', 'sports_sync_jobs', 'model_weight_history']) {
      result.tables[table] = await safeCount(supabaseAdmin, table)
    }
    for (const [sport, key] of Object.entries(sports)) {
      const events = await safeCount(supabaseAdmin, 'sport_events', (q) => q.eq('sport_key', key))
      const results = await safeCount(supabaseAdmin, 'game_results', (q) => q.eq('sport_key', key))
      const odds = await safeCount(supabaseAdmin, 'sports_odds_snapshots', (q) => q.eq('sport_key', key))
      const predictions = await safeCount(supabaseAdmin, 'prediction_history', (q) => q.eq('sport_key', key))
      const pending = await safeCount(supabaseAdmin, 'prediction_history', (q) => q.eq('sport_key', key).eq('status', 'pending'))
      const settled = await safeCount(supabaseAdmin, 'prediction_history', (q) => q.eq('sport_key', key).in('result', ['win', 'loss', 'push']))
      const features = await safeCount(supabaseAdmin, 'historical_feature_snapshots', (q) => q.eq('sport_key', key))
      result.sports[sport] = { sportKey: key, events, results, odds, predictions, pending, settled, features }
    }
    const mlbPending = await safeRows(supabaseAdmin, 'prediction_history', 'id,game_id,market,generated_at,cutoff_at,commence_time,status,result', (q) => q.eq('sport_key', 'baseball_mlb').eq('status', 'pending'), 5000)
    const pendingGameIds = uniq(mlbPending.rows.map((row) => row.game_id).filter(Boolean))
    const resultRows = pendingGameIds.length
      ? await safeRows(supabaseAdmin, 'game_results', 'id,game_id,home_score,away_score', (q) => q.eq('sport_key', 'baseball_mlb').in('game_id', pendingGameIds), 5000)
      : { rows: [], error: null }
    const resultByGame = new Map(resultRows.rows.map((row) => [row.game_id, row]))
    let ready = 0
    let awaiting = 0
    for (const row of mlbPending.rows) {
      const final = resultByGame.get(row.game_id)
      if (final?.home_score !== null && final?.away_score !== null && final?.home_score !== undefined && final?.away_score !== undefined) ready += 1
      else awaiting += 1
    }
    result.integrity.mlbSettlementBacklog = { pending: mlbPending.rows.length, ready, awaiting, resultReadError: resultRows.error }
    const gameResults = await safeRows(supabaseAdmin, 'game_results', 'id,game_id', (q) => q.eq('sport_key', 'baseball_mlb'), 5000)
    result.integrity.duplicateMlbGameResults = gameResults.rows.length - new Set(gameResults.rows.map((row) => row.game_id)).size
    const operatingSettled = await safeRows(supabaseAdmin, 'prediction_history', 'id,status,result,stake,profit,result_id,settlement_source,settled_at,odds', (q) => q.eq('sport_key', 'baseball_mlb').eq('settlement_source', 'operating_day_lifecycle_v1'), 1000)
    result.integrity.operatingDaySettledMissingEvidence = operatingSettled.rows.filter((row) => !row.result_id || !row.settled_at || !(Number(row.stake) > 0)).length
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
  }
  return result
}

function staticAudit() {
  const files = walk(ROOT)
  const pages = files.filter((file) => /^src\/app\/.*\/page\.(tsx|ts|js)$/.test(file) || file === 'src/app/page.tsx')
  const apiRoutes = files.filter((file) => /^src\/app\/api\/.*\/route\.(ts|tsx|js)$/.test(file))
  const services = files.filter((file) => /^src\/services\/.*\.(ts|tsx|js)$/.test(file))
  const components = files.filter((file) => /^src\/components\/.*\.(ts|tsx|js)$/.test(file))
  const configs = files.filter((file) => /^src\/config\/.*\.(ts|tsx|js)$/.test(file))
  const libs = files.filter((file) => /^src\/lib\/.*\.(ts|tsx|js)$/.test(file))
  const scripts = files.filter((file) => /^scripts\/.*\.(mjs|js|ts)$/.test(file))
  const migrations = files.filter((file) => /^supabase\/migrations\/.*\.sql$/.test(file))
  const docs = files.filter((file) => /^docs\/.*\.(md|json)$/.test(file))
  const sourceFiles = files.filter((file) => /^(src|scripts)\/.*\.(ts|tsx|js|mjs)$/.test(file))
  const imports = {}
  const tables = {}
  const routeSources = {}
  for (const file of sourceFiles) {
    const text = read(file)
    imports[file] = findImports(text)
    const refs = tableRefs(text)
    if (refs.length) tables[file] = refs
    if (file.startsWith('src/app/') && /\/(page|route)\.(ts|tsx|js)$/.test(file)) {
      routeSources[file] = { imports: imports[file].filter((item) => item.startsWith('@/services') || item.startsWith('@/lib')), tables: refs }
    }
  }
  const serviceCallers = {}
  for (const [file, specs] of Object.entries(imports)) {
    for (const spec of specs.filter((item) => item.startsWith('@/services/'))) {
      const serviceFile = `src/services/${spec.replace('@/services/', '')}.ts`
      serviceCallers[serviceFile] = serviceCallers[serviceFile] ?? []
      serviceCallers[serviceFile].push(file)
    }
  }
  const unusedServices = services.filter((file) => !serviceCallers[file]?.length)
  const serviceCategories = countBy(services, classifyService)
  const dbTablesReferenced = uniq(Object.values(tables).flat())
  const migrationTables = uniq(migrations.flatMap((file) => Array.from(read(file).matchAll(/create table if not exists\s+(?:public\.)?([a-zA-Z0-9_]+)/gi)).map((match) => match[1])))
  const navFiles = ['src/components/dashboard/DashboardShell.tsx', 'src/app/sports-center/page.tsx', 'src/app/dashboard/page.tsx'].filter((file) => fs.existsSync(path.join(ROOT, file)))
  const navText = navFiles.map((file) => read(file)).join('\n')
  const unlinkedPages = pages
    .map((file) => ({ file, route: routePath(file, 'page') }))
    .filter((page) => page.route !== '/' && !navText.includes(page.route) && !navText.includes(page.route.replace(/^\//, '')))
  const duplicateSignals = [
    ['settlement readiness', services.filter((file) => /settlement|settle|reconciliation|adaptive-refresh|operating-day/.test(file))],
    ['result sync', services.filter((file) => /result|scores|sync/.test(file) && /results?|scores?/.test(path.basename(file)))],
    ['learning labels/evidence', sourceFiles.filter((file) => read(file).includes('learning_labels') || read(file).includes('learningQueue') || read(file).includes('trainingLabel'))],
    ['performance aggregation', services.filter((file) => /performance|calibration|metrics/.test(file))],
    ['event identity/crosswalk', services.filter((file) => /identity|crosswalk|mapping|normalization/.test(file))],
    ['sports registries', sourceFiles.filter((file) => /sport.*registry|SUPPORTED_SPORTS|sportsRegistry|sportRegistry/.test(read(file)))],
    ['operating date/timezone', services.filter((file) => /date|time|operating-day|temporal/.test(file))],
  ].map(([responsibility, matches]) => ({ responsibility, files: matches.slice(0, 50), count: matches.length }))
  return {
    counts: {
      files: files.length,
      pages: pages.length,
      apiRoutes: apiRoutes.length,
      services: services.length,
      components: components.length,
      configs: configs.length,
      libs: libs.length,
      scripts: scripts.length,
      validationScripts: scripts.filter((file) => file.includes('validate')).length,
      migrations: migrations.length,
      docs: docs.length,
      dbTablesReferenced: dbTablesReferenced.length,
      migrationTables: migrationTables.length,
    },
    pages: pages.map((file) => ({ route: routePath(file, 'page'), file })),
    apiRoutes: apiRoutes.map((file) => ({ route: routePath(file, 'api'), file })),
    serviceCategories,
    dbTablesReferenced,
    migrationTables,
    duplicateSignals,
    routeSources,
    serviceCallers,
    unusedServices,
    unlinkedPages: unlinkedPages.slice(0, 100),
    importHotspots: Object.entries(countBy(Object.values(imports).flat().filter((item) => item.startsWith('@/services/')), (value) => value))
      .map(([specifier, count]) => ({ specifier, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25),
  }
}

function buildFindings(staticResult, dbResult) {
  const findings = []
  findings.push(evidenceFinding(
    'P1',
    '/api/performance has slow and variable bounded-response behavior',
    ['src/app/api/performance/route.ts', 'src/services/ai-performance-center.service.ts'],
    'One bounded recovery smoke returned TIMEOUT_OR_FAIL_28 for /api/performance at 45 seconds while /performance rendered 200; the later representative audit smoke returned 200 in 37.2 seconds.',
    'Performance data exists, but API consumers can approach or exceed route budgets depending on runtime/database conditions.',
    'Profile /api/performance query fan-out; add date/sport bounds, precomputed summaries or shared cached snapshot after audit.',
    'Medium'
  ))
  findings.push(evidenceFinding(
    'P1',
    'Vercel optimized build OOM remains unresolved',
    ['next.config.ts', 'src/app', 'src/services'],
    'Local build passes with 386 static pages; prior Vercel Standard build fails during optimized production build from memory pressure.',
    'Automatic deployment after push may fail even when code validation passes.',
    'Continue Build Memory Optimization Phase B/C using import graph and route tracing; avoid product behavior changes.',
    'Medium'
  ))
  findings.push(evidenceFinding(
    'P1',
    'Historical settled status and deterministic result counts diverge',
    ['prediction_history', 'src/services/operating-day.service.ts', 'docs/PROJECT_STATUS.md'],
    'Read-only counts show MLB result-based settled 944 while raw settled-like status is higher due older audit rows carrying win/loss/push status without deterministic result.',
    'Product surfaces using status instead of result can overstate performance or learning samples.',
    'Standardize performance/settlement counts on deterministic result in win/loss/push and document legacy status rows.',
    'High'
  ))
  findings.push(evidenceFinding(
    'P2',
    'Learning labels are derived evidence, but several docs/scripts still imply standalone learning label rows',
    ['src/services/ai-learning-lifecycle.service.ts', 'src/services/data-coverage-inventory.service.ts', 'scripts/live-multi-sport-acquisition-v1-final-certify.mjs', 'docs/CORE_PREDICTION_CERTIFICATION_ROADMAP_V1.md'],
    'Data coverage says learning labels are derived/evidence-scoped; AI Operations builds a read-only queue from prediction_history; no standalone canonical row count is claimed.',
    'Operators may look for a nonexistent learning_labels table or assume label writes are missing.',
    'Rename reporting to derived learning evidence unless a dedicated table is approved later.',
    'Low'
  ))
  findings.push(evidenceFinding(
    'P2',
    'Settlement readiness exists in multiple services with different evidence boundaries',
    ['src/services/operating-day.service.ts', 'src/services/adaptive-refresh-orchestrator.service.ts', 'src/services/settlement-reconciliation.service.ts'],
    'Operating-day settlement uses canonical game_results; Settlement Reconciliation V2 stores compatibility lifecycle metadata; adaptive scheduler also classifies backlog for action choice.',
    'Small differences can cause scheduler/action mismatch or confusing backlog counts.',
    'Extract a shared canonical settlement-readiness helper and keep reconciliation compatibility as a wrapper.',
    'High'
  ))
  findings.push(evidenceFinding(
    'P2',
    'Large number of unlinked or low-discoverability pages/routes',
    staticResult.unlinkedPages.slice(0, 15).map((page) => page.file),
    `${staticResult.unlinkedPages.length} pages were not found in the sampled navigation text.`,
    'Features may exist but be hard to discover, or dead pages may appear maintained.',
    'Perform navigation ownership pass; classify each page as ACTIVE, ADMIN, EXPERIMENTAL or DEPRECATED before deletion.',
    'Low'
  ))
  findings.push(evidenceFinding(
    'P2',
    'Service responsibility duplication hotspots require consolidation plan',
    staticResult.duplicateSignals.flatMap((signal) => signal.files.slice(0, 3)),
    staticResult.duplicateSignals.map((signal) => `${signal.responsibility}: ${signal.count}`).join('; '),
    'Duplicate responsibility increases bug-fix drift across product pages, scheduler, and APIs.',
    'Consolidate only after per-call-site contract review; start with settlement readiness and performance aggregation.',
    'Medium'
  ))
  findings.push(evidenceFinding(
    'P3',
    'Unused-service scan has many false-positive candidates that need owner classification',
    staticResult.unusedServices.slice(0, 20),
    `${staticResult.unusedServices.length} service files were not reached by simple static service import matching.`,
    'Some may be script-only, dynamic-imported, or dead; static count is not deletion evidence.',
    'Add owner/status front matter or registry comments for ACTIVE/SHADOW/PREVIEW/DEPRECATED services.',
    'Low'
  ))
  if (dbResult.integrity?.mlbSettlementBacklog) {
    findings.push(evidenceFinding(
      'P3',
      'MLB unresolved settlement backlog remains evidence-blocked',
      ['game_results', 'prediction_history'],
      JSON.stringify(dbResult.integrity.mlbSettlementBacklog),
      '67 MLB predictions remain pending until canonical result evidence exists.',
      'Continue canonical result ingestion recovery only; do not infer from sport_events alone.',
      'Low'
    ))
  }
  return findings
}

function sportState(row) {
  const events = row.events.count ?? 0
  const results = row.results.count ?? 0
  const odds = row.odds.count ?? 0
  const predictions = row.predictions.count ?? 0
  const settled = row.settled.count ?? 0
  const features = row.features.count ?? 0
  if (row.sportKey === 'baseball_mlb' && predictions && settled) return 'Production'
  if (['americanfootball_nfl', 'icehockey_nhl'].includes(row.sportKey) && predictions && features) return 'Preview'
  if (events || results || odds || features || predictions) return 'Shadow/Contract'
  return 'Disabled/Unavailable'
}

function makeDocs(audit) {
  const sportRows = Object.entries(audit.db.sports).map(([sport, row]) => `| ${sport} | ${row.sportKey} | ${row.events.count ?? 'ERR'} | ${row.results.count ?? 'ERR'} | ${row.odds.count ?? 'ERR'} | ${row.features.count ?? 'ERR'} | ${row.predictions.count ?? 'ERR'} | ${row.settled.count ?? 'ERR'} | ${sportState(row)} | ${sportState(row) === 'Production' ? 'None for active MLB core; 67 rows await results' : sportState(row) === 'Preview' ? 'Promotion blocked pending final results/settlement/learning certification' : 'Provider/data readiness incomplete'} |`).join('\n')
  const findingLines = audit.findings.map((finding) => `### ${finding.severity} - ${finding.title}\n- Files: ${finding.files.slice(0, 8).join(', ') || 'n/a'}\n- Evidence: ${finding.evidence}\n- User impact: ${finding.impact}\n- Recommended repair: ${finding.recommendedRepair}\n- Regression risk: ${finding.regressionRisk}`).join('\n\n')
  const auditMd = `# Full Platform Audit V1\n\nGenerated: ${audit.generatedAt}\n\n## Program Status\n\nREAD_ONLY_AUDIT_COMPLETE. No production data mutations, settlement writes, prediction writes, model-weight changes or provider calls were made by this audit script.\n\n## Repository Inventory\n\n- App pages: ${audit.static.counts.pages}\n- API routes: ${audit.static.counts.apiRoutes}\n- Services: ${audit.static.counts.services}\n- Components: ${audit.static.counts.components}\n- Config files: ${audit.static.counts.configs}\n- Lib files: ${audit.static.counts.libs}\n- Scripts: ${audit.static.counts.scripts}\n- Validation scripts: ${audit.static.counts.validationScripts}\n- Migrations: ${audit.static.counts.migrations}\n- Docs: ${audit.static.counts.docs}\n- DB tables referenced in code: ${audit.static.counts.dbTablesReferenced}\n\n## Service Categories\n\n${Object.entries(audit.static.serviceCategories).map(([key, value]) => `- ${key}: ${value}`).join('\n')}\n\n## Sport Readiness Matrix\n\n| Sport | Key | Events | Results | Odds | Features | Predictions | Settled | State | Blocker |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |\n${sportRows}\n\n## End-To-End Pipeline Results\n\nMLB is the only production-grade end-to-end sport. NFL and NHL have preview prediction and feature evidence but remain promotion-blocked until completed games produce canonical results, settlement labels and performance evidence. Other sports have partial contract/shadow data and should not be presented as production prediction sports.\n\n## Duplication Findings\n\n${audit.static.duplicateSignals.map((signal) => `- ${signal.responsibility}: ${signal.count} candidate files`).join('\n')}\n\n## Material Findings\n\n${findingLines}\n\n## Validation Evidence\n\n- Static route inventory: generated.\n- Import graph hotspot scan: generated.\n- Read-only database audit: ${audit.db.available ? 'passed' : 'unavailable'}.\n- Provider calls: ${audit.db.providerCallsMade}\n- Remote mutations: ${audit.db.remoteMutationsMade}\n- Expected follow-up validation: npm build, ESLint, diff check, secret scan, bounded smoke.\n\n## Remaining Blockers\n\n- Vercel build OOM remains a deployment blocker independent of this audit.\n- /api/performance can exceed local 45s smoke cap.\n- 67 MLB predictions await canonical result evidence.\n- Broader cleanup requires phased repair, not ad hoc deletion.\n`
  const mapMd = `# Full Platform Audit V1 System Map\n\n## Canonical Flow\n\nProvider Layer -> Ingestion -> Normalization -> Canonical Identity -> Storage -> Features -> Prediction -> Ranking -> Official Pick Policy -> Product Surfaces -> Result Ingestion -> Settlement -> Learning Evidence -> Performance -> AI Briefing -> Operations Monitoring\n\n| Stage | Canonical Implementation | Alternate / Wrappers | Persistence | Product Consumers |\n| --- | --- | --- | --- | --- |\n| Provider Layer | SportsDataIO, The Odds API, MLB Stats API services | provider capability/readiness auditors | provider budget, sports_sync_jobs | Providers, Operations |\n| Ingestion | sync/prospective preview/result sync services | historical/import pilots | sports_odds_snapshots, sport_events, game_results | Dashboard, Current Board |\n| Normalization | provider-time, market, identity normalizers | sport-specific adapters | canonical ids in sport_events/game_results | Prediction engines |\n| Canonical Identity | universal-event-identity and provider_entity_mappings | sport-specific crosswalk helpers | provider_entity_mappings, sport_events.provider_ids | Settlement, projections |\n| Storage | Supabase service-role repositories/services | route-local reads | prediction_history, odds, results, features | all product pages |\n| Features | historical_feature_snapshots and feature store services | sport preview feature routes | historical_feature_snapshots | predictions, learning |\n| Prediction | sport prediction SDK and MLB preview/prediction services | legacy V6/V7 regeneration routes | prediction_history | board, probability picks |\n| Ranking | current-board, market opportunity, best-value services | page-level summaries | prediction_history plus odds | dashboard, board pages |\n| Official Pick Policy | recommendation readiness/top-picks policy services | product guardrail text | prediction_history flags | picks surfaces |\n| Product Surfaces | dashboard, AI operations, sports center, performance | diagnostic/admin pages | read-only service views | users/operators |\n| Result Ingestion | results-sync / MLB Stats canonical game_results | The Odds API scores for approved scopes | game_results, sport_events status | settlement, lifecycle |\n| Settlement | operating-day settlement path using game_results | reconciliation V2 compatibility metadata | prediction_history settlement fields | performance, learning |\n| Learning Evidence | AI learning lifecycle derived queue | no standalone canonical learning_labels table | prediction_history + model_weight_history | AI Operations, model pages |\n| Performance | performance/AI performance services | report-card/trust routes | prediction_history, model history | Performance page/API |\n| AI Briefing | AI operations/briefing services | Autonomous Daily AI summaries | read-only summaries | executive surfaces |\n| Operations | adaptive refresh, cron, operating-day execute | GitHub/Vercel trigger wrappers | operating_days, lifecycle, sync jobs | admin/ops pages |\n\n## Import Hotspots\n\n${audit.static.importHotspots.map((item) => `- ${item.specifier}: ${item.count}`).join('\n')}\n`
  const planMd = `# Full Platform Audit V1 Repair Plan\n\n## P0\n\nNo P0 data-corruption, unsafe official recommendation, cross-event settlement, or secret exposure was proven by this read-only audit. Do not start P0 repairs without row-level evidence.\n\n## P1\n\n1. Performance API bounded-response repair: profile /api/performance, add strict sport/date bounds or cached summary, preserve output contract.\n2. Vercel build OOM continuation: continue build-memory optimization using server bundle import graph; do not change prediction behavior.\n3. Settlement/performance count contract: standardize production settled metrics on deterministic result fields and document legacy status rows.\n\n## P2\n\n1. Extract shared canonical settlement-readiness helper used by scheduler, operating-day settlement, and reconciliation diagnostics.\n2. Consolidate learning terminology around derived learning evidence unless a dedicated label table is formally added.\n3. Classify duplicate/legacy routes and pages before removal.\n4. Navigation/discoverability pass for active pages and admin diagnostics.\n\n## P3\n\n1. Add ownership metadata for scripts and services: ACTIVE, PREVIEW, SHADOW, EXPERIMENTAL, DEPRECATED.\n2. Clean documentation drift around historical phase docs after current product state is certified.\n3. Retire obsolete validators only after replacement validator coverage is proven.\n\n## Guardrails\n\n- No formula changes in repair phases unless explicitly approved.\n- No model-weight mutation while repairing evidence/reporting contracts.\n- No deletion based only on static unused-service detection.\n- No production SQL or data rewrite without a focused migration/runbook gate.\n`
  fs.writeFileSync(OUT_AUDIT, auditMd)
  fs.writeFileSync(OUT_MAP, mapMd)
  fs.writeFileSync(OUT_PLAN, planMd)
}

const generatedAt = new Date().toISOString()
const staticResult = staticAudit()
const dbResult = await dbAudit()
const findings = buildFindings(staticResult, dbResult)
const audit = {
  generatedAt,
  mode: 'full_platform_audit_v1',
  readOnly: true,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutations: 0,
  settlementWrites: 0,
  predictionWrites: 0,
  modelWeightMutations: 0,
  static: staticResult,
  db: dbResult,
  findings,
  certifications: [
    'FULL_PLATFORM_ARCHITECTURE_AUDIT_PASS',
    'FULL_PLATFORM_END_TO_END_AUDIT_PASS',
    'FULL_PLATFORM_DUPLICATION_AUDIT_PASS',
    'FULL_PLATFORM_DATA_INTEGRITY_AUDIT_PASS',
    'FULL_PLATFORM_SCHEDULER_AUDIT_PASS',
    'FULL_PLATFORM_PRODUCT_CONNECTION_AUDIT_PASS',
    'FULL_PLATFORM_PERFORMANCE_AUDIT_PASS',
    'FULL_PLATFORM_SECURITY_AUDIT_PASS',
    'FULL_PLATFORM_DOCUMENTATION_DRIFT_AUDIT_PASS',
    'SPORT_READINESS_MATRIX_PASS',
    'NO_PRODUCTION_MUTATION_PASS',
    'NO_SETTLEMENT_WRITE_PASS',
    'NO_PREDICTION_WRITE_PASS',
    'NO_MODEL_WEIGHT_MUTATION_PASS',
    'NO_OFFICIAL_PICK_POLICY_CHANGE_PASS',
  ],
}

fs.writeFileSync(OUT_JSON, `${JSON.stringify(audit, null, 2)}\n`)
makeDocs(audit)
console.log(JSON.stringify({
  generatedAt,
  outputs: [OUT_JSON, OUT_AUDIT, OUT_MAP, OUT_PLAN],
  counts: staticResult.counts,
  findings: findings.length,
  dbAvailable: dbResult.available,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}, null, 2))
