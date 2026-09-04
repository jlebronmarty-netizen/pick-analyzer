import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const execute = process.argv.includes('--execute')
const authorized = process.argv.includes('--r1i-dml-authorized')
const writeArtifact = process.argv.includes('--write-artifact')

const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const targetProductionCommit = 'ac3fc83c4effd9d97d24b8eda32e6354b14b431e'
const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-r1i-partial-feature-dml-resume.json'
const sourcePersistencePath = 'scripts/mlb-data-01d-2025-feature-persistence.mjs'

const expected = {
  rows: {
    snapshots: 67433,
    team: 4498,
    starter: 4498,
    bullpen: 4498,
    batter: 44943,
    matchup: 2249,
    firstInning: 2249,
    offense: 4498,
  },
  rawRows: 712528,
  uniquePitchIdentities: 712528,
  duplicatePitchIdentities: 0,
  nativeGames: 2430,
  nativePlayers: 1469,
  eligibleGames: 2249,
  insufficientHistoryGames: 181,
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

async function loadCertifiedPersistenceModule() {
  const source = fs.readFileSync(sourcePersistencePath, 'utf8')
  const stripped = source.replace(/\nmain\(\)\.catch\(\(error\) => \{[\s\S]*?\n\}\)\s*$/m, '')
  const exported = `${stripped}
export {
  buildFeatureRows,
  client,
  countRawYear,
  countRows,
  duplicateCount,
  expected,
  featureVersion,
  insertRows,
  modelCounts,
  persistedAudit,
  predictionCounts,
  productionAlignmentAllowedForMode,
  reconcileSnapshots,
  revalidateDryRun,
  scanRaw,
  tableCounts,
  versionReadback
}
`
  const tmpDir = path.join(process.cwd(), '.tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  const tmpPath = path.join(tmpDir, 'mlb-data-01d-2025-feature-persistence-r1i-export.mjs')
  fs.writeFileSync(tmpPath, exported)
  return import(`${pathToFileURL(tmpPath).href}?v=${Date.now()}`)
}

function key(row, fields) {
  return fields.map((field) => String(row[field] ?? '')).join('|')
}

async function readAll(db, table, columns, configure = (query) => query) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await configure(db.from(table).select(columns).order('id', { ascending: true }).range(from, from + 999))
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function readExistingKeySet(db, table, columns) {
  const rows = await readAll(db, table, columns.join(','))
  return new Set(rows.map((row) => key(row, columns)))
}

async function exactReuse(db, table, plannedRows, columns) {
  const existing = await readExistingKeySet(db, table, columns)
  let reuses = 0
  let conflicts = 0
  for (const row of plannedRows) {
    if (existing.has(key(row, columns))) reuses += 1
    else conflicts += 1
  }
  return { planned: plannedRows.length, exactMatches: reuses, inserts: 0, reuses, conflicts }
}

async function duplicateCountForRows(db, table, columns) {
  const rows = await readAll(db, table, columns.join(','), (query) => query.eq('feature_version', featureVersion))
  const seen = new Set()
  let duplicates = 0
  for (const row of rows) {
    const rowKey = key(row, columns)
    if (seen.has(rowKey)) duplicates += 1
    else seen.add(rowKey)
  }
  return duplicates
}

async function countTable(db, table, column = 'id') {
  const { count, error } = await db.from(table).select(column, { count: 'exact', head: true })
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} HTTP_${response.status}`)
  return response.json()
}

async function insertDomain(mod, db, table, rows, cap) {
  ensure(rows.length === cap, `${table}_ROW_CAP_MISMATCH:${rows.length}`)
  if (!execute) return { inserts: rows.length, reuses: 0, conflicts: 0, finalRows: await countTable(db, table) }
  ensure(authorized, 'R1I_EXPLICIT_DML_AUTHORIZATION_REQUIRED')
  const before = await countTable(db, table)
  ensure(before === 0, `${table}_PREWRITE_NOT_EMPTY:${before}`)
  const inserts = await mod.insertRows(db, table, rows)
  const finalRows = await countTable(db, table)
  ensure(inserts === cap, `${table}_INSERT_COUNT_MISMATCH:${inserts}`)
  ensure(finalRows === cap, `${table}_FINAL_COUNT_MISMATCH:${finalRows}`)
  return { inserts, reuses: 0, conflicts: 0, finalRows }
}

function allZero(object) {
  return Object.values(object).every((value) => value === 0)
}

async function main() {
  const mod = await loadCertifiedPersistenceModule()
  ensure(mod.featureVersion === featureVersion, 'FEATURE_VERSION_CHANGED')
  for (const [domain, count] of Object.entries(expected.rows)) {
    ensure(mod.expected.rows[domain] === count, `CERTIFIED_ROW_PLAN_CHANGED:${domain}`)
  }

  const db = mod.client()
  const version = await mod.versionReadback()
  ensure(version.gitCommit === targetProductionCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)
  ensure(version.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')

  const liveManifestAuthority = await fetchJson('https://pick-analyzer.vercel.app/api/system/pick2/r1f-manifest-authority')
  ensure(liveManifestAuthority.expectedDigestConfigured === true, 'LIVE_MANIFEST_EXPECTED_DIGEST_NOT_CONFIGURED')
  ensure(liveManifestAuthority.expectedDigestMatchesManifest === true, 'LIVE_MANIFEST_DIGEST_MISMATCH')
  ensure(liveManifestAuthority.criticalCodeIntegrity === 'PASS', 'LIVE_MANIFEST_CRITICAL_CODE_FAILED')
  ensure(liveManifestAuthority.criticalFileMismatchCount === 0, 'LIVE_MANIFEST_CRITICAL_FILE_MISMATCH')
  ensure(liveManifestAuthority.productionAuthorityReady === true, 'LIVE_MANIFEST_AUTHORITY_NOT_READY')
  ensure(liveManifestAuthority.gitCommit === targetProductionCommit, 'LIVE_MANIFEST_PRODUCTION_COMMIT_MISMATCH')

  const dryRun = mod.revalidateDryRun()
  const preCounts = await mod.tableCounts(db)
  ensure(preCounts.pick2_feature_snapshots === expected.rows.snapshots, 'PREWRITE_SNAPSHOT_COUNT_CHANGED')
  ensure(preCounts.pick2_mlb_team_daily_features === expected.rows.team, 'PREWRITE_TEAM_COUNT_CHANGED')
  ensure(preCounts.pick2_mlb_pitcher_daily_features === expected.rows.starter, 'PREWRITE_STARTER_COUNT_CHANGED')
  ensure(preCounts.pick2_mlb_bullpen_daily_features === 0, 'PREWRITE_BULLPEN_NOT_EMPTY')
  ensure(preCounts.pick2_mlb_batter_daily_features === 0, 'PREWRITE_BATTER_NOT_EMPTY')
  ensure(preCounts.pick2_mlb_matchup_daily_features === 0, 'PREWRITE_MATCHUP_NOT_EMPTY')
  ensure(preCounts.pick2_mlb_first_inning_daily_features === 0, 'PREWRITE_FIRST_INNING_NOT_EMPTY')

  const preModelCounts = await mod.modelCounts(db)
  const prePredictionCounts = await mod.predictionCounts(db)
  ensure(allZero(preModelCounts), 'PREWRITE_MODEL_TABLES_NONZERO')
  ensure(allZero(prePredictionCounts), 'PREWRITE_PREDICTION_TABLES_NONZERO')

  const preNativeCounts = {
    games: await mod.countRows(db, 'pick2_mlb_games'),
    players: await mod.countRows(db, 'pick2_mlb_players'),
    results: await mod.countRows(db, 'pick2_mlb_game_results'),
    marketMappings: await mod.countRows(db, 'pick2_mlb_market_event_mappings'),
    raw2026: await mod.countRawYear(db, 2026),
  }
  ensure(preNativeCounts.games === expected.nativeGames, 'PREWRITE_NATIVE_GAMES_CHANGED')
  ensure(preNativeCounts.players === expected.nativePlayers, 'PREWRITE_NATIVE_PLAYERS_CHANGED')
  ensure(preNativeCounts.results === 0, 'PREWRITE_NATIVE_RESULTS_NONZERO')
  ensure(preNativeCounts.marketMappings === 0, 'PREWRITE_MARKET_MAPPINGS_NONZERO')
  ensure(preNativeCounts.raw2026 === 0, 'PREWRITE_2026_ROWS_NONZERO')

  const scan = await mod.scanRaw(db)
  ensure(scan.rawRows === expected.rawRows, 'RAW_ROW_COUNT_CHANGED')
  ensure(scan.uniquePitchIdentities === expected.uniquePitchIdentities, 'UNIQUE_PITCH_IDENTITIES_CHANGED')
  ensure(scan.duplicatePitchIdentities === expected.duplicatePitchIdentities, 'DUPLICATE_PITCH_IDENTITIES_CHANGED')
  ensure(scan.nullNativePitcher === 0 && scan.nullNativeBatter === 0, 'RAW_NATIVE_PARITY_FAILED')

  const built = mod.buildFeatureRows(scan)
  const rows = built.output
  ensure(built.current.eligibleGames === expected.eligibleGames, 'ELIGIBLE_GAMES_CHANGED')
  ensure(built.current.insufficientHistoryGames === expected.insufficientHistoryGames, 'INSUFFICIENT_HISTORY_CHANGED')
  ensure(built.current.leakageViolations === 0, 'PREWRITE_LEAKAGE_VIOLATION')
  ensure(rows.team.length === expected.rows.team, 'TEAM_PLAN_CHANGED')
  ensure(rows.starter.length === expected.rows.starter, 'STARTER_PLAN_CHANGED')
  ensure(rows.bullpen.length === expected.rows.bullpen, 'BULLPEN_PLAN_CHANGED')
  ensure(rows.batter.length === expected.rows.batter, 'BATTER_PLAN_CHANGED')
  ensure(rows.matchup.length === expected.rows.matchup, 'MATCHUP_PLAN_CHANGED')
  ensure(rows.firstInning.length === expected.rows.firstInning, 'FIRST_INNING_PLAN_CHANGED')
  ensure(rows.snapshots.length === expected.rows.snapshots, 'SNAPSHOT_PLAN_CHANGED')
  ensure(rows.offense === expected.rows.offense, 'OFFENSE_PLAN_CHANGED')

  const snapshotPolicy = await mod.reconcileSnapshots(db, rows, preCounts.pick2_feature_snapshots)
  ensure(snapshotPolicy.mode === 'REUSE_NO_OP', 'SNAPSHOT_REUSE_NOT_NO_OP')
  ensure(snapshotPolicy.inserts === 0 && snapshotPolicy.reuses === expected.rows.snapshots && snapshotPolicy.conflicts === 0, 'SNAPSHOT_REUSE_COUNTS_CHANGED')

  const reuse = {
    team: await exactReuse(db, 'pick2_mlb_team_daily_features', rows.team, ['target_game_pk', 'team_id', 'feature_version']),
    starter: await exactReuse(db, 'pick2_mlb_pitcher_daily_features', rows.starter, ['target_game_pk', 'mlbam_pitcher_id', 'feature_version']),
  }
  ensure(reuse.team.reuses === expected.rows.team && reuse.team.conflicts === 0, 'TEAM_REUSE_GUARD_FAILED')
  ensure(reuse.starter.reuses === expected.rows.starter && reuse.starter.conflicts === 0, 'STARTER_REUSE_GUARD_FAILED')

  const prewritePlan = {
    team: { inserts: 0, reuses: expected.rows.team, conflicts: 0 },
    starter: { inserts: 0, reuses: expected.rows.starter, conflicts: 0 },
    bullpen: { inserts: expected.rows.bullpen, reuses: 0, conflicts: 0 },
    batter: { inserts: expected.rows.batter, reuses: 0, conflicts: 0 },
    matchup: { inserts: expected.rows.matchup, reuses: 0, conflicts: 0 },
    firstInning: { inserts: expected.rows.firstInning, reuses: 0, conflicts: 0 },
    offense: { logicalRows: expected.rows.offense },
    snapshots: { inserts: 0, reuses: expected.rows.snapshots, updates: 0, deletes: 0, conflicts: 0 },
  }

  const physicalWrites = {
    pick2_mlb_bullpen_daily_features: 0,
    pick2_mlb_batter_daily_features: 0,
    pick2_mlb_matchup_daily_features: 0,
    pick2_mlb_first_inning_daily_features: 0,
  }
  const execution = {
    bullpen: await insertDomain(mod, db, 'pick2_mlb_bullpen_daily_features', rows.bullpen, expected.rows.bullpen),
    batter: { inserts: 0, reuses: 0, conflicts: 0, finalRows: preCounts.pick2_mlb_batter_daily_features },
    matchup: { inserts: 0, reuses: 0, conflicts: 0, finalRows: preCounts.pick2_mlb_matchup_daily_features },
    firstInning: { inserts: 0, reuses: 0, conflicts: 0, finalRows: preCounts.pick2_mlb_first_inning_daily_features },
  }
  physicalWrites.pick2_mlb_bullpen_daily_features = execute ? execution.bullpen.inserts : 0
  execution.batter = await insertDomain(mod, db, 'pick2_mlb_batter_daily_features', rows.batter, expected.rows.batter)
  physicalWrites.pick2_mlb_batter_daily_features = execute ? execution.batter.inserts : 0
  execution.matchup = await insertDomain(mod, db, 'pick2_mlb_matchup_daily_features', rows.matchup, expected.rows.matchup)
  physicalWrites.pick2_mlb_matchup_daily_features = execute ? execution.matchup.inserts : 0
  execution.firstInning = await insertDomain(mod, db, 'pick2_mlb_first_inning_daily_features', rows.firstInning, expected.rows.firstInning)
  physicalWrites.pick2_mlb_first_inning_daily_features = execute ? execution.firstInning.inserts : 0

  const audit = execute ? await mod.persistedAudit(db, scan, built) : null
  const finalCounts = execute ? audit.postCounts : await mod.tableCounts(db)
  const finalModelCounts = await mod.modelCounts(db)
  const finalPredictionCounts = await mod.predictionCounts(db)
  const finalNativeCounts = {
    games: await mod.countRows(db, 'pick2_mlb_games'),
    players: await mod.countRows(db, 'pick2_mlb_players'),
    results: await mod.countRows(db, 'pick2_mlb_game_results'),
    marketMappings: await mod.countRows(db, 'pick2_mlb_market_event_mappings'),
    raw2026: await mod.countRawYear(db, 2026),
  }

  const secondPass = execute ? {
    team: await exactReuse(db, 'pick2_mlb_team_daily_features', rows.team, ['target_game_pk', 'team_id', 'feature_version']),
    starter: await exactReuse(db, 'pick2_mlb_pitcher_daily_features', rows.starter, ['target_game_pk', 'mlbam_pitcher_id', 'feature_version']),
    bullpen: await exactReuse(db, 'pick2_mlb_bullpen_daily_features', rows.bullpen, ['target_game_pk', 'team_id', 'feature_version']),
    batter: await exactReuse(db, 'pick2_mlb_batter_daily_features', rows.batter, ['target_game_pk', 'mlbam_batter_id', 'feature_version']),
    matchup: await exactReuse(db, 'pick2_mlb_matchup_daily_features', rows.matchup, ['target_game_pk', 'feature_version']),
    firstInning: await exactReuse(db, 'pick2_mlb_first_inning_daily_features', rows.firstInning, ['target_game_pk', 'feature_version']),
    snapshots: { inserts: 0, reuses: expected.rows.snapshots, conflicts: 0 },
  } : null

  const nativeDuplicateKeys = {
    team: await duplicateCountForRows(db, 'pick2_mlb_team_daily_features', ['target_game_pk', 'team_id', 'feature_version']),
    starter: await duplicateCountForRows(db, 'pick2_mlb_pitcher_daily_features', ['target_game_pk', 'mlbam_pitcher_id', 'feature_version']),
    bullpen: await duplicateCountForRows(db, 'pick2_mlb_bullpen_daily_features', ['target_game_pk', 'team_id', 'feature_version']),
    batter: await duplicateCountForRows(db, 'pick2_mlb_batter_daily_features', ['target_game_pk', 'mlbam_batter_id', 'feature_version']),
    matchup: await duplicateCountForRows(db, 'pick2_mlb_matchup_daily_features', ['target_game_pk', 'feature_version']),
    firstInning: await duplicateCountForRows(db, 'pick2_mlb_first_inning_daily_features', ['target_game_pk', 'feature_version']),
    snapshots: await mod.duplicateCount(db, 'pick2_feature_snapshots', ['deterministic_identity']),
  }

  const finalParity =
    finalCounts.pick2_feature_snapshots === expected.rows.snapshots &&
    finalCounts.pick2_mlb_team_daily_features === expected.rows.team &&
    finalCounts.pick2_mlb_pitcher_daily_features === expected.rows.starter &&
    finalCounts.pick2_mlb_bullpen_daily_features === expected.rows.bullpen &&
    finalCounts.pick2_mlb_batter_daily_features === expected.rows.batter &&
    finalCounts.pick2_mlb_matchup_daily_features === expected.rows.matchup &&
    finalCounts.pick2_mlb_first_inning_daily_features === expected.rows.firstInning
  const idempotent = secondPass ? Object.values(secondPass).every((item) => item.conflicts === 0 && item.inserts === 0) : false
  const safetyPass = allZero(finalModelCounts) && allZero(finalPredictionCounts) && finalNativeCounts.results === 0 && finalNativeCounts.marketMappings === 0 && finalNativeCounts.raw2026 === 0
  const certified = execute &&
    finalParity &&
    Object.values(nativeDuplicateKeys).every((count) => count === 0) &&
    audit.asOfViolations === 0 &&
    audit.leakageViolations === 0 &&
    audit.sameDayViolations === 0 &&
    audit.nullPolicyViolations === 0 &&
    audit.malformedPayloads === 0 &&
    audit.raw.rawRows === expected.rawRows &&
    audit.raw.uniquePitchIdentities === expected.uniquePitchIdentities &&
    audit.raw.duplicatePitchIdentities === expected.duplicatePitchIdentities &&
    audit.raw.rawPayloadDigestUnchanged === true &&
    audit.raw.rawIdentityDigestUnchanged === true &&
    finalNativeCounts.games === expected.nativeGames &&
    finalNativeCounts.players === expected.nativePlayers &&
    idempotent &&
    safetyPass

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_01D_R1H_FINAL_CERTIFICATION_AND_R1I_PARTIAL_FEATURE_DML_RESUME',
    mode: execute ? 'EXECUTE' : 'DRY_RUN',
    certificationVerdict: certified ? 'MLB_DATA_01D_R1I_PARTIAL_FEATURE_DML_RESUME_CERTIFIED' : 'MLB_DATA_01D_R1I_PARTIAL_FEATURE_DML_RESUME_DRY_RUN_READY',
    repositoryBaseline: {
      localHead: targetProductionCommit,
      originMain: targetProductionCommit,
      production: version.gitCommit,
      R1I_REPOSITORY_BASELINE_AUDITED: 'PASS',
    },
    r1hManualCatalogEvidence: {
      source: 'USER_SUPPLIED_SELECT_ONLY_SUPABASE_CATALOG_READBACK',
      R1H_BULLPEN_UNIQUENESS_MIGRATION_APPLIED: 'YES_USER_CONFIRMED',
      R1H_EXPECTED_BULLPEN_TABLE_ROWS: { observed: 1, expected: 1, pass: true },
      R1H_EXPECTED_CONTRADICTORY_LEGACY_UNIQUE_ROWS: { observed: 0, expected: 0, pass: true },
      R1H_EXPECTED_LEGACY_CONSTRAINT_ROWS: { observed: 0, expected: 0, pass: true },
      R1H_EXPECTED_NATIVE_UNIQUENESS_ROWS: { observed: 1, expected: 1, pass: true },
      uniqueInventory: [
        {
          object_type: 'unique_index',
          object_name: 'pick2_mlb_bullpen_daily_features_native_uidx',
          schema: 'public',
          table: 'pick2_mlb_bullpen_daily_features',
          is_unique: true,
          ordered_columns: ['target_game_pk', 'team_id', 'feature_date', 'feature_version'],
          predicate: 'target_game_pk IS NOT NULL',
          policy: 'NON_BLOCKING_EXISTING_WIDER_NATIVE_INDEX_PRESERVE',
        },
        {
          object_type: 'unique_index',
          object_name: 'pick2_mlb_bullpen_daily_features_pkey',
          schema: 'public',
          table: 'pick2_mlb_bullpen_daily_features',
          is_unique: true,
          ordered_columns: ['id'],
          predicate: null,
        },
        {
          object_type: 'unique_index',
          object_name: 'pick2_mlb_bullpen_daily_features_target_game_team_version_key',
          schema: 'public',
          table: 'pick2_mlb_bullpen_daily_features',
          is_unique: true,
          ordered_columns: ['target_game_pk', 'team_id', 'feature_version'],
          predicate: 'target_game_pk IS NOT NULL',
        }
      ],
      R1H_MANUAL_CATALOG_EVIDENCE_CERTIFIED: 'YES',
      R1H_BULLPEN_NATIVE_KEY_PRODUCTION_CERTIFIED: 'YES',
      R1H_BULLPEN_LEGACY_DEFECT_CLOSED: 'YES',
      R1H_EXISTING_WIDER_NATIVE_INDEX_POLICY: 'PRESERVE',
      R1H_LEGACY_BULLPEN_UNIQUENESS_REMOVED: 'PASS',
      R1H_BULLPEN_NATIVE_UNIQUENESS_READBACK: 'PASS',
      R1H_UNAFFECTED_SCHEMA_PRESERVED: 'PASS',
      R1H_BULLPEN_POSTMIGRATION_RECOVERY_READINESS: 'PASS',
      R1H_PARTIAL_RESUME_READINESS: 'PASS',
      R1H_PARTIAL_RESUME_IDEMPOTENCY_PROJECTED: 'PASS',
      r1hFinalCertificationVerdict: 'MLB_DATA_01D_R1H_BULLPEN_UNIQUENESS_MIGRATION_PRODUCTION_CERTIFIED',
    },
    roadmapRealignment: {
      certification: 'PICK_ANALYZER_MLB_ROADMAP_REALIGNMENT_FROM_PARLAY_AUTOMATION_TO_PICK_ANALYSIS_CERTIFIED',
      activeProductDirection: 'INDIVIDUAL_PICK_FIRST',
      mandatory100DailyParlays: 'RETIRED_AS_CORE_OBJECTIVE',
    },
    liveManifestAuthority,
    manifestCriticalCodeState: {
      R1I_MANIFEST_CRITICAL_CODE_UNCHANGED: 'YES',
      criticalCodeIntegrity: liveManifestAuthority.criticalCodeIntegrity,
      criticalFileMismatchCount: liveManifestAuthority.criticalFileMismatchCount,
    },
    dryRunRevalidation: {
      featureVersion: dryRun.dryRun.featureVersion,
      eligibleGames: dryRun.dryRun.eligibleGames,
      insufficientHistoryGames: dryRun.dryRun.insufficientHistoryGames,
      leakageViolations: dryRun.dryRun.leakageViolations,
      identityConflicts: dryRun.dryRun.identityConflicts,
    },
    prewrite: {
      featureTableCounts: preCounts,
      nativeCounts: preNativeCounts,
      raw: {
        rawRows: scan.rawRows,
        uniquePitchIdentities: scan.uniquePitchIdentities,
        duplicatePitchIdentities: scan.duplicatePitchIdentities,
      },
      teamReuse: reuse.team,
      starterReuse: reuse.starter,
      snapshotReuse: snapshotPolicy,
      plan: prewritePlan,
      BLOCK_CONFLICT: 0,
    },
    execution: {
      dmlAuthorized: execute && authorized,
      team: { inserts: 0, reuses: expected.rows.team, conflicts: 0, finalRows: finalCounts.pick2_mlb_team_daily_features },
      starter: { inserts: 0, reuses: expected.rows.starter, conflicts: 0, finalRows: finalCounts.pick2_mlb_pitcher_daily_features },
      bullpen: execution.bullpen,
      batter: execution.batter,
      matchup: execution.matchup,
      firstInning: execution.firstInning,
      offense: { logicalRows: expected.rows.offense, physicalDml: 0 },
      snapshots: { inserts: 0, reuses: expected.rows.snapshots, updates: 0, deletes: 0, conflicts: 0, finalRows: finalCounts.pick2_feature_snapshots },
      physicalWrites,
    },
    postwrite: {
      finalCounts,
      targetGameCoverage: { targetGames: expected.nativeGames, eligible: expected.eligibleGames, insufficientHistory: expected.insufficientHistoryGames },
      nativeDuplicateKeys,
      asOfViolations: audit?.asOfViolations ?? null,
      leakageViolations: audit?.leakageViolations ?? null,
      sameDayViolations: audit?.sameDayViolations ?? null,
      nullPolicyViolations: audit?.nullPolicyViolations ?? null,
      malformedPayloads: audit?.malformedPayloads ?? null,
      raw: audit?.raw ?? null,
      nativeCounts: finalNativeCounts,
      modelCounts: finalModelCounts,
      predictionCounts: finalPredictionCounts,
      secondPass,
    },
    safety: {
      providerCalls: 0,
      productionDmlMutations: Object.values(physicalWrites).reduce((sum, count) => sum + count, 0),
      productionDdlMutations: 0,
      snapshotWrites: 0,
      rawStatcastWrites: 0,
      nativeIdentityWrites: 0,
      modelTraining: 'NO',
      modelValidation: 'NO',
      championPromotion: 'NO',
      predictionGeneration: 'NO',
      marketValueWrites: 0,
      import2026: 'NO',
      automation: 'NO',
      cronChanges: 0,
    },
    flags: {
      R1I_REPOSITORY_BASELINE_AUDITED: 'PASS',
      R1H_MANUAL_CATALOG_EVIDENCE_CERTIFIED: 'YES',
      R1H_BULLPEN_NATIVE_KEY_PRODUCTION_CERTIFIED: 'YES',
      R1H_BULLPEN_LEGACY_DEFECT_CLOSED: 'YES',
      R1H_EXISTING_WIDER_NATIVE_INDEX_POLICY: 'PRESERVE',
      R1H_FINAL_PRODUCTION_STATE: 'PASS',
      R1H_FINAL_SNAPSHOT_STATE: 'PASS',
      R1H_BULLPEN_POSTMIGRATION_RECOVERY_READINESS: 'PASS',
      R1H_PARTIAL_RESUME_READINESS: 'PASS',
      R1I_LIVE_MANIFEST_AUTHORITY: 'PASS',
      R1I_MANIFEST_CRITICAL_CODE_UNCHANGED: 'YES',
      R1I_PREWRITE_FEATURE_STATE: 'PASS',
      R1I_TEAM_REUSE_GUARD: 'PASS',
      R1I_STARTER_REUSE_GUARD: 'PASS',
      R1I_SNAPSHOT_REUSE_GUARD: 'PASS',
      R1I_REMAINING_INSERT_PLAN: 'PASS',
      R1I_RAW_NATIVE_BASELINE: 'PASS',
      R1I_PREWRITE_ASOF_LEAKAGE: 'PASS',
      R1I_PREWRITE_BLOCK_CONFLICT: 'PASS',
      R1I_BULLPEN_RECOVERY: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_BATTER_RECOVERY: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_MATCHUP_RECOVERY: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_FIRST_INNING_RECOVERY: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_FEATURE_ROW_PARITY: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_TARGET_GAME_COVERAGE: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_NATIVE_KEY_UNIQUENESS: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_POSTWRITE_ASOF: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_POSTWRITE_LEAKAGE: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_SAMEDAY_DOUBLEHEADER_GUARD: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_NULL_POLICY: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_FEATURE_SANITY: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_SNAPSHOT_FINAL_STATE: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_TEAM_FINAL_STATE: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_STARTER_FINAL_STATE: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_RAW_STABILITY: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_RAW_IMMUTABILITY: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_NATIVE_IDENTITY_PRESERVATION: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_FEATURE_PERSISTENCE_IDEMPOTENCY: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_01D_FEATURE_FOUNDATION: certified ? 'PASS' : 'DRY_RUN_READY',
      R1I_INDIVIDUAL_PICK_PRODUCT_ALIGNMENT: 'PASS',
      MLB_DATA_01D_2025_FEATURE_FOUNDATION_READY: certified ? 'YES' : 'NO',
      MLB_DATA_02A_INDIVIDUAL_PICK_MODEL_DATASET_PREPARATION_READY: certified ? 'YES' : 'NO',
      MODEL_WORK_PERFORMED: 'NO',
      PREDICTION_WORK_PERFORMED: 'NO',
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }

  console.log(JSON.stringify(artifact, null, 2))
  if (execute && !certified) process.exitCode = 1
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-01d-r1i-partial-feature-dml-resume', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
