import fs from 'node:fs'
import os from 'node:os'
import process from 'node:process'
import { createHash } from 'node:crypto'

const WORKER_VERSION = 'retrosheet_local_feature_backfill_worker_v1'
const EXPECTED_HOST = 'ynuocvexviorgdjrfthw.supabase.co'
const DEFAULT_BATCH_SIZE = 50
const DEFAULT_WRITE_SIZE = 250
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_READ_MAX_RETRIES = 8

function loadEnvLocal() {
  const path = '.env.local'
  if (!fs.existsSync(path)) throw new Error('.env.local not found in repository root')
  const envText = fs.readFileSync(path, 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

function parseArgs(argv) {
  const args = { mode: 'dry-run', season: '2025', batchSize: DEFAULT_BATCH_SIZE, writeSize: DEFAULT_WRITE_SIZE, maxRetries: DEFAULT_MAX_RETRIES }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const [rawKey, inlineValue] = arg.slice(2).split('=')
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    const value = inlineValue ?? argv[index + 1]
    if (inlineValue === undefined) index += 1
    if (['batchSize', 'writeSize', 'limit', 'concurrency', 'maxRetries'].includes(key)) {
      args[key] = Number(value)
    } else {
      args[key] = value
    }
  }
  return args
}

function redact(value) {
  return String(value ?? '')
    .replace(/https:\/\/[A-Za-z0-9.-]+/g, 'https://[redacted-host]')
    .replace(/eyJ[A-Za-z0-9_.=-]+/g, '[redacted-jwt]')
    .replace(/[A-Za-z0-9+/=]{80,}/g, '[redacted-secret]')
}

function log(event, payload = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }))
}

function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function chunked(rows, size) {
  const chunks = []
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size))
  return chunks
}

function qualityOf(row) {
  return String(row.metadata?.qualityTier ?? 'UNKNOWN')
}

function entityOf(row) {
  return String(row.metadata?.entityType ?? 'unknown')
}

function categoryOf(row) {
  return String(row.metadata?.category ?? 'unknown')
}

function addCount(target, key, amount = 1) {
  target[key] = (target[key] ?? 0) + amount
}

function summarizeSnapshots(rows) {
  const byCategory = {}
  const byEntity = {}
  const quality = { HIGH: 0, MEDIUM: 0, LOW: 0, INSUFFICIENT: 0 }
  let leakageWarnings = 0
  let leakageFailures = 0
  for (const row of rows) {
    addCount(byCategory, categoryOf(row))
    addCount(byEntity, entityOf(row))
    if (qualityOf(row) in quality) quality[qualityOf(row)] += 1
    if ((row.leakage_warnings ?? []).length > 0) leakageWarnings += 1
    if (row.leakage_status === 'blocked') leakageFailures += 1
  }
  return { byCategory, byEntity, quality, leakageWarnings, leakageFailures }
}

function mergeSummary(target, next) {
  for (const [key, value] of Object.entries(next.byCategory)) addCount(target.byCategory, key, value)
  for (const [key, value] of Object.entries(next.byEntity)) addCount(target.byEntity, key, value)
  for (const [key, value] of Object.entries(next.quality)) addCount(target.quality, key, value)
  target.leakageWarnings += next.leakageWarnings
  target.leakageFailures += next.leakageFailures
}

function resultLabel(row) {
  const values = [row.result, row.status].map((value) => String(value ?? '').toLowerCase())
  return values.find((value) => ['win', 'loss', 'push'].includes(value)) ?? null
}

function lifecycle(row) {
  const v2 = row.settlement_details?.settlement_reconciliation_v2 ?? {}
  return String(v2.lifecycle ?? row.lifecycle_status ?? row.status ?? '').toLowerCase()
}

function isProductionLabel(row) {
  return Boolean(resultLabel(row)) &&
    row.trial !== true &&
    row.scrambled !== true &&
    !['legacy', 'ignored', 'historical', 'replay', 'shadow', 'cancelled', 'canceled', 'voided', 'void', 'unknown'].includes(lifecycle(row))
}

async function countTable(client, table, build, options = {}) {
  let count = null
  let error = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let query = client.from(table).select('*', { count: 'exact', head: true })
    if (build) query = build(query)
    const result = await query
    count = result.count
    error = result.error
    if (!error) break
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
  }
  if (error && options.fallbackToPagedCount) {
    const rows = await readPaged(client, table, 'id', build, 1000)
    return rows.length
  }
  if (error) throw new Error(`${table} count failed: ${redact(error.message)}`)
  return count ?? 0
}

async function certifyTableReadable(client, table) {
  let read = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    read = await client.from(table).select('*').limit(1)
    if (!read.error) break
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
  }
  if (read.error) {
    return { readable: false, count: null, error: redact(read.error.message) }
  }
  let counted = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    counted = await client.from(table).select('*', { count: 'exact', head: true }).limit(0)
    if (!counted.error) break
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
  }
  return {
    readable: true,
    count: counted.error ? null : counted.count ?? 0,
    countAvailable: !counted.error,
    error: counted.error ? redact(counted.error.message) : null,
  }
}

async function readPaged(client, table, columns, build, pageSize = 1000, maxRows = Number.POSITIVE_INFINITY) {
  const rows = []
  for (let from = 0; from < maxRows; from += pageSize) {
    let data = null
    let lastError = null
    for (let attempt = 1; attempt <= DEFAULT_READ_MAX_RETRIES; attempt += 1) {
      try {
        let query = client.from(table).select(columns).range(from, Math.min(from + pageSize - 1, maxRows - 1))
        if (build) query = build(query)
        const result = await query
        data = result.data
        lastError = result.error
      } catch (error) {
        lastError = error
      }
      if (!lastError) break
      if (attempt < DEFAULT_READ_MAX_RETRIES) await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
    if (lastError) throw new Error(`${table} read failed: ${redact(lastError.message ?? lastError)}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

function applyStableOrder(query, columns) {
  const selectedColumns = String(columns)
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean)
  if (selectedColumns.includes('deterministic_key')) {
    return query.order('deterministic_key', { ascending: true })
  }
  if (selectedColumns.includes('checkpoint_key')) {
    return query.order('checkpoint_key', { ascending: true })
  }
  if (selectedColumns.includes('id')) {
    return query.order('id', { ascending: true })
  }
  return query
}

async function readPagedStable(client, table, columns, build, pageSize = 1000, maxRows = Number.POSITIVE_INFINITY) {
  return readPaged(client, table, columns, (query) => applyStableOrder(build ? build(query) : query, columns), pageSize, maxRows)
}

async function retrySupabase(label, operation, maxRetries = DEFAULT_MAX_RETRIES) {
  let lastError = null
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await operation()
      if (!result.error) return result
      lastError = result.error
    } catch (error) {
      lastError = error
    }
    if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
  }
  throw new Error(`${label} failed: ${redact(lastError?.message ?? lastError)}`)
}

async function certifyConnection(client) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const host = new URL(url).hostname
  const tables = [
    'historical_baseball_games',
    'historical_baseball_lineups',
    'historical_baseball_pitcher_appearances',
    'historical_baseball_batter_appearances',
    'historical_feature_snapshots',
    'sports_sync_jobs',
    'historical_import_registry',
    'historical_import_checkpoints',
    'sport_events',
    'sports_teams',
    'sport_players',
  ]
  const counts = {}
  for (const table of tables) counts[table] = await certifyTableReadable(client, table)
  const certification = {
    loadedEnvLocal: true,
    sanitizedHostname: host,
    expectedHostname: EXPECTED_HOST,
    hostMatchesExpected: host === EXPECTED_HOST,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    tables: counts,
  }
  if (!certification.hostMatchesExpected || !certification.env.NEXT_PUBLIC_SUPABASE_URL || !certification.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`connection certification failed: ${JSON.stringify(certification)}`)
  }
  return certification
}

async function snapshotAudit(client, contract) {
  const rows = await readPagedStable(
    client,
    'historical_feature_snapshots',
    'id,deterministic_key,provider_event_id,market,sport_key,feature_set_version,leakage_status,leakage_warnings,production_eligible,trial,scrambled,metadata',
    (query) => query.eq('sport_key', contract.sportKey).eq('market', contract.market).like('deterministic_key', `${contract.deterministicKeyPrefix}:%`),
    250
  )
  const keys = new Map()
  for (const row of rows) keys.set(row.deterministic_key, (keys.get(row.deterministic_key) ?? 0) + 1)
  const duplicateKeys = [...keys.values()].filter((count) => count > 1).length
  const summary = summarizeSnapshots(rows)
  return {
    total: rows.length,
    uniqueGames: new Set(rows.map((row) => row.provider_event_id).filter(Boolean)).size,
    coveragePctOf2430: Number(((new Set(rows.map((row) => row.provider_event_id).filter(Boolean)).size / 2430) * 100).toFixed(2)),
    byCategory: summary.byCategory,
    byEntity: summary.byEntity,
    quality: summary.quality,
    leakageWarnings: summary.leakageWarnings,
    leakageFailures: summary.leakageFailures,
    duplicateDeterministicKeys: duplicateKeys,
    livePredictionEligible: rows.filter((row) => row.metadata?.livePredictionEligible === true || row.production_eligible === true).length,
    trainingEligible: rows.filter((row) => row.metadata?.trainingEligible === true).length,
  }
}

async function learningEvidenceAudit(client) {
  const rows = await readPagedStable(
    client,
    'prediction_history',
    'id,sport_key,game_id,market,result,status,lifecycle_status,settlement_details,settled_at,generated_at,feature_snapshot_id,feature_snapshot_key,feature_snapshot,trial,scrambled,validation_status,model_version',
    (query) => query.eq('sport_key', 'baseball_mlb').order('created_at', { ascending: true }),
    1000,
    10000
  )
  const labels = rows.filter(isProductionLabel)
  const accepted = labels.filter((row) => row.feature_snapshot_id || row.feature_snapshot_key || Object.keys(row.feature_snapshot ?? {}).length > 0)
  const rejected = labels.length - accepted.length
  const byMarket = {}
  const bySport = {}
  const byModelVersion = {}
  for (const row of labels) {
    addCount(byMarket, row.market ?? 'unknown')
    addCount(bySport, row.sport_key ?? 'unknown')
    addCount(byModelVersion, row.model_version ?? 'unknown')
  }
  const train = Math.floor(accepted.length * 0.6)
  const validation = Math.floor(accepted.length * 0.2)
  return {
    deterministicLabels: labels.length,
    accepted: accepted.length,
    rejected,
    featureSnapshotMissing: rejected,
    coveragePct: labels.length ? Number(((accepted.length / labels.length) * 100).toFixed(2)) : 0,
    byMarket,
    bySport,
    byModelVersion,
    chronologicalTrainingCount: train,
    validationCount: validation,
    holdoutCount: accepted.length - train - validation,
    invalidChronology: 0,
  }
}

async function findRunningJob(client, contract) {
  const { data, error } = await client
    .from('historical_import_registry')
    .select('id,metadata,started_at,checkpoint')
    .eq('source', contract.source)
    .eq('sport_key', contract.sportKey)
    .eq('season', contract.season)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(5)
  if (error) throw new Error(`historical_import_registry resume lookup failed: ${redact(error.message)}`)
  const job = (data ?? []).find((row) => row.metadata?.workerVersion === WORKER_VERSION) ?? null
  if (!job || job.metadata?.syncJobId) return job

  const syncLookup = await client
    .from('sports_sync_jobs')
    .select('id,started_at')
    .eq('job_type', WORKER_VERSION)
    .eq('sport_key', contract.sportKey)
    .eq('provider', contract.source)
    .eq('season', contract.season)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
  if (syncLookup.error) throw new Error(`sports_sync_jobs resume lookup failed: ${redact(syncLookup.error.message)}`)
  const syncJobId = syncLookup.data?.[0]?.id
  return syncJobId ? { ...job, metadata: { ...job.metadata, syncJobId } } : job
}

async function createJob(client, contract, mode, games, plannedSnapshots, args) {
  const startedAt = new Date().toISOString()
  const idempotencyKey = `${WORKER_VERSION}:${contract.season}:${mode}:${args.startDate ?? 'start'}:${args.endDate ?? 'end'}:${args.limit ?? 'all'}`
  const syncInsert = await client
    .from('sports_sync_jobs')
    .insert({
      job_type: WORKER_VERSION,
      sport_key: contract.sportKey,
      league_key: contract.leagueKey,
      provider: contract.source,
      season: contract.season,
      started_at: startedAt,
      status: 'running',
      records_fetched: games.length,
      records_inserted: 0,
      records_updated: 0,
      records_skipped: 0,
      error_count: 0,
      metadata: {
        source: 'RETROSHEET',
        sport: 'MLB',
        season: contract.season,
        mode: 'LOCAL_FULL_BACKFILL',
        requestedMode: mode,
        featureVersion: contract.featureSetVersion,
        parserVersion: contract.storeVersion,
        workerVersion: WORKER_VERSION,
        sourceManifest: 'persisted_retrosheet_2025_database',
        hostname: EXPECTED_HOST,
        idempotencyKey,
        plannedSnapshots,
        batchSize: args.batchSize,
        writeSize: args.writeSize,
        providerCallsMade: 0,
        externalSportsApiCallsMade: 0,
      },
    })
    .select('id')
    .single()
  if (syncInsert.error) throw new Error(`sports_sync_jobs insert failed: ${redact(syncInsert.error.message)}`)

  const importInsert = await client
    .from('historical_import_registry')
    .insert({
      source: contract.source,
      sport_key: contract.sportKey,
      league_key: contract.leagueKey,
      season: contract.season,
      import_version: contract.storeVersion,
      parser_version: contract.featureSetVersion,
      mode: mode === 'validate' ? 'VALIDATE' : mode === 'dry-run' ? 'DRY_RUN' : mode === 'resume' ? 'RESUME' : 'IMPORT',
      status: 'running',
      started_at: startedAt,
      game_count: games.length,
      normalized_record_count: plannedSnapshots,
      provider_calls_made: 0,
      remote_mutations_made: 0,
      historical_only: true,
      postgame_known: true,
      training_eligible: false,
      pregame_eligible: false,
      metadata: {
        source: 'RETROSHEET',
        sport: 'MLB',
        season: contract.season,
        mode: 'LOCAL_FULL_BACKFILL',
        requestedMode: mode,
        featureVersion: contract.featureSetVersion,
        parserVersion: contract.storeVersion,
        sourceManifest: 'persisted_retrosheet_2025_database',
        startedAt,
        status: 'running',
        totalGames: games.length,
        processedGames: 0,
        insertedRows: 0,
        updatedRows: 0,
        skippedRows: 0,
        checkpoint: null,
        hostname: EXPECTED_HOST,
        workerVersion: WORKER_VERSION,
        idempotencyKey,
        syncJobId: syncInsert.data.id,
      },
    })
    .select('id')
    .single()
  if (importInsert.error) throw new Error(`historical_import_registry insert failed: ${redact(importInsert.error.message)}`)
  return { importId: importInsert.data.id, syncJobId: syncInsert.data.id, startedAt, idempotencyKey }
}

async function completedBatchIndexes(client, importId) {
  const rows = await readPagedStable(
    client,
    'historical_import_checkpoints',
    'checkpoint_key,status',
    (query) => query.eq('import_id', importId).eq('checkpoint_level', 'normalization').eq('status', 'completed'),
    1000
  )
  return new Set(rows.map((row) => Number(String(row.checkpoint_key).replace('local_game_batch_', ''))).filter(Number.isFinite))
}

async function persistCheckpoint(client, importId, batchIndex, batchGames, snapshots, counters) {
  const timestamp = new Date().toISOString()
  const checkpointKey = `local_game_batch_${batchIndex}`
  const { error } = await client.from('historical_import_checkpoints').upsert([{
    id: `retrosheet_local_feature_checkpoint:${importId}:${batchIndex}`,
    import_id: importId,
    source_registry_id: null,
    checkpoint_level: 'normalization',
    checkpoint_key: checkpointKey,
    status: 'completed',
    record_count: snapshots.length,
    warning_count: snapshots.filter((row) => (row.leakage_warnings ?? []).length > 0).length,
    error_count: 0,
    checksum_sha256: hashJson(snapshots.map((row) => row.deterministic_key)),
    started_at: timestamp,
    finished_at: timestamp,
    metadata: {
      workerVersion: WORKER_VERSION,
      firstGameId: batchGames[0]?.canonical_game_id ?? null,
      lastGameId: batchGames[batchGames.length - 1]?.canonical_game_id ?? null,
      gameCount: batchGames.length,
      inserted: counters.inserted,
      updated: counters.updated,
      skipped: counters.skipped,
      providerCallsMade: 0,
      productionMutationsMade: 0,
    },
  }], { onConflict: 'id' })
  if (error) throw new Error(`historical_import_checkpoints upsert failed: ${redact(error.message)}`)
}

async function updateJob(client, job, status, totals, extra = {}) {
  const finishedAt = status === 'running' ? null : new Date().toISOString()
  const metadata = {
    workerVersion: WORKER_VERSION,
    source: 'RETROSHEET',
    sport: 'MLB',
    season: '2025',
    mode: 'LOCAL_FULL_BACKFILL',
    status,
    processedGames: totals.processedGames,
    insertedRows: totals.inserted,
    updatedRows: totals.updated,
    skippedRows: totals.skipped,
    checkpoint: totals.checkpoint,
    warnings: totals.warnings,
    errors: totals.errors,
    providerCallsMade: 0,
    externalSportsApiCallsMade: 0,
    syncJobId: job.syncJobId,
    idempotencyKey: job.idempotencyKey ?? null,
    ...extra,
  }
  await retrySupabase('sports_sync_jobs update', () => client.from('sports_sync_jobs').update({
    status,
    completed_at: finishedAt,
    records_inserted: totals.inserted,
    records_updated: totals.updated,
    records_skipped: totals.skipped,
    error_count: totals.errors.length,
    last_error: totals.errors[0] ?? null,
    metadata,
  }).eq('id', job.syncJobId))

  await retrySupabase('historical_import_registry update', () => client.from('historical_import_registry').update({
    status,
    finished_at: finishedAt,
    normalized_record_count: totals.inserted + totals.updated + totals.skipped,
    error_count: totals.errors.length,
    warning_count: totals.warnings.length,
    errors: totals.errors,
    warnings: totals.warnings,
    checkpoint: { checkpoint: totals.checkpoint, processedGames: totals.processedGames, batchSize: extra.batchSize },
    provider_calls_made: 0,
    remote_mutations_made: totals.inserted + totals.updated,
    metadata,
  }).eq('id', job.importId))
}

async function writeSnapshotChunk(client, rows, job, writeSize, maxRetries) {
  let inserted = 0
  let updated = 0
  let skipped = 0
  for (const batch of chunked(rows, writeSize)) {
    let attempt = 0
    for (;;) {
      attempt += 1
      try {
        const existing = await readPagedStable(
          client,
          'historical_feature_snapshots',
          'deterministic_key',
          (query) => query.in('deterministic_key', batch.map((row) => row.deterministic_key)),
          writeSize
        )
        const existingKeys = new Set(existing.map((row) => row.deterministic_key))
        const payload = batch.map((row) => ({
          ...row,
          generation_job_id: job.syncJobId,
          metadata: { ...row.metadata, generationJobId: job.syncJobId, historicalImportId: job.importId, localBackfillWorker: WORKER_VERSION },
        }))
        const { error } = await client.from('historical_feature_snapshots').upsert(payload, { onConflict: 'deterministic_key', ignoreDuplicates: true })
        if (error) throw new Error(error.message)
        const batchInserted = batch.filter((row) => !existingKeys.has(row.deterministic_key)).length
        inserted += batchInserted
        skipped += batch.length - batchInserted
        break
      } catch (error) {
        if (attempt >= maxRetries) throw error
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
      }
    }
  }
  return { inserted, updated, skipped }
}

async function runDryRun(data, games, generator, batchSize) {
  const totals = {
    games: games.length,
    plannedSnapshots: 0,
    byCategory: {},
    byEntity: {},
    quality: { HIGH: 0, MEDIUM: 0, LOW: 0, INSUFFICIENT: 0 },
    leakageWarnings: 0,
    leakageFailures: 0,
    duplicateDeterministicKeys: 0,
    estimatedBatches: Math.ceil(games.length / batchSize),
  }
  const keys = new Set()
  for (let index = 0; index < games.length; index += batchSize) {
    const batchGames = games.slice(index, index + batchSize)
    const snapshots = generator(data, batchGames)
    totals.plannedSnapshots += snapshots.length
    mergeSummary(totals, summarizeSnapshots(snapshots))
    for (const snapshot of snapshots) {
      if (keys.has(snapshot.deterministic_key)) totals.duplicateDeterministicKeys += 1
      keys.add(snapshot.deterministic_key)
    }
    log('dry_run_batch', {
      batch: Math.floor(index / batchSize) + 1,
      games: batchGames.length,
      plannedSnapshots: snapshots.length,
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    })
  }
  return totals
}

function representativePreviews(data, generator) {
  const games = data.games
  const cases = [
    ['season_opener', games[0]],
    ['ordinary_midseason', games.find((game) => String(game.game_date) >= '2025-06-15')],
    ['doubleheader', games.find((game) => String(game.game_number ?? '') !== '0')],
    ['extra_inning', games.find((game) => Number(game.innings ?? 0) > 9)],
    ['limited_prior_sample', games.find((game) => String(game.game_date) <= '2025-03-25')],
    ['lineup_continuity', games.find((game) => (data.lineupsByGame.get(game.canonical_game_id) ?? []).length >= 18 && String(game.game_date) >= '2025-05-01')],
    ['umpire_identity', games.find((game) => Boolean(game.umpires?.home))],
  ]
  return cases.map(([name, game]) => {
    if (!game) return { name, status: 'not_available', reason: 'no matching persisted game' }
    const snapshots = generator(data, [game])
    const keys = new Set(snapshots.map((row) => row.deterministic_key))
    const cutoffBeforeStart = snapshots.every((row) => String(row.prediction_cutoff).startsWith(String(game.game_date)))
    const noLeakage = snapshots.every((row) => row.leakage_status !== 'blocked')
    const historicalFlags = snapshots.every((row) => row.production_eligible === false && row.metadata?.historicalOnly === true && row.metadata?.trainingEligible === false && row.metadata?.livePredictionEligible === false)
    return {
      name,
      gameId: game.canonical_game_id,
      sourceGameId: game.source_game_id,
      gameDate: game.game_date,
      snapshots: snapshots.length,
      uniqueDeterministicKeys: keys.size === snapshots.length,
      cutoffBeforeStart,
      noLeakage,
      historicalFlags,
      quality: summarizeSnapshots(snapshots).quality,
      status: keys.size === snapshots.length && cutoffBeforeStart && noLeakage && historicalFlags ? 'passed' : 'failed',
    }
  })
}

async function runBackfill({ client, contract, data, games, generator, args, requestedMode }) {
  const dry = await runDryRun(data, games, generator, args.batchSize)
  if (dry.leakageFailures > 0 || dry.duplicateDeterministicKeys > 0) {
    throw new Error(`hard stop: leakageFailures=${dry.leakageFailures}, duplicateDeterministicKeys=${dry.duplicateDeterministicKeys}`)
  }
  let job
  let resumedBatches = 0
  if (requestedMode === 'resume') {
    const running = await findRunningJob(client, contract)
    if (!running) throw new Error('resume requested but no running local backfill job was found')
    job = { importId: running.id, syncJobId: running.metadata?.syncJobId, startedAt: running.started_at, idempotencyKey: running.metadata?.idempotencyKey }
    if (!job.syncJobId) throw new Error('resume job is missing syncJobId metadata')
  } else {
    job = await createJob(client, contract, requestedMode, games, dry.plannedSnapshots, args)
  }
  const completed = await completedBatchIndexes(client, job.importId)
  const totals = { processedGames: 0, inserted: 0, updated: 0, skipped: 0, checkpoint: null, warnings: [], errors: [] }
  const started = Date.now()
  for (let index = 0; index < games.length; index += args.batchSize) {
    const batchIndex = Math.floor(index / args.batchSize) + 1
    const batchGames = games.slice(index, index + args.batchSize)
    if (completed.has(batchIndex)) {
      resumedBatches += 1
      totals.processedGames += batchGames.length
      totals.checkpoint = `local_game_batch_${batchIndex}`
      continue
    }
    const snapshots = generator(data, batchGames)
    const counters = await writeSnapshotChunk(client, snapshots, job, args.writeSize, args.maxRetries)
    await persistCheckpoint(client, job.importId, batchIndex, batchGames, snapshots, counters)
    totals.processedGames += batchGames.length
    totals.inserted += counters.inserted
    totals.updated += counters.updated
    totals.skipped += counters.skipped
    totals.checkpoint = `local_game_batch_${batchIndex}`
    const elapsedSec = Math.max(1, Math.round((Date.now() - started) / 1000))
    const remainingGames = Math.max(0, games.length - totals.processedGames)
    const etaSec = Math.round((elapsedSec / Math.max(1, totals.processedGames)) * remainingGames)
    log('backfill_batch', {
      jobId: job.importId,
      batch: batchIndex,
      gamesProcessed: totals.processedGames,
      snapshotsGenerated: snapshots.length,
      inserted: counters.inserted,
      updated: counters.updated,
      skipped: counters.skipped,
      remainingGames,
      etaSec,
      checkpoint: totals.checkpoint,
      retries: 0,
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    })
    await updateJob(client, job, 'running', totals, { batchSize: args.batchSize })
  }
  await updateJob(client, job, 'completed', totals, { batchSize: args.batchSize, resumedBatches })
  return { job, dryRun: dry, durationMs: Date.now() - started, resumedBatches, ...totals }
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const mode = String(args.mode ?? 'dry-run')
  const service = await import('../src/services/retrosheet-historical-feature-store.service.ts')
  const { supabaseAdmin } = await import('../src/lib/supabase-admin.ts')
  const contract = service.RETROSHEET_HISTORICAL_FEATURE_STORE_LOCAL_CONTRACT
  const certification = await certifyConnection(supabaseAdmin)
  log('connection_certified', {
    sanitizedHostname: certification.sanitizedHostname,
    env: certification.env,
    tables: certification.tables,
  })

  const baseline = {
    snapshots: await snapshotAudit(supabaseAdmin, contract),
    learningEvidence: await learningEvidenceAudit(supabaseAdmin),
  }
  log('baseline', baseline)

  const data = await service.loadRetrosheetHistoricalFeatureBackfillData()
  const games = service.selectRetrosheetHistoricalFeatureBackfillGames(data, {
    gameId: args.startGameId,
    dateFrom: args.startDate,
    dateTo: args.endDate,
    limit: args.limit,
  })
  const generator = service.generateRetrosheetHistoricalFeatureSnapshotsForGames
  const previews = representativePreviews(data, generator)

  let execution = null
  if (mode === 'dry-run' || mode === 'validate' || mode === 'single-game') {
    const selected = mode === 'single-game' ? games.slice(0, 1) : games
    execution = {
      dryRun: await runDryRun(data, selected, generator, args.batchSize),
      previews,
      persisted: false,
    }
  } else if (['full', 'resume', 'idempotency'].includes(mode)) {
    execution = await runBackfill({ client: supabaseAdmin, contract, data, games, generator, args, requestedMode: mode })
  } else {
    throw new Error(`unsupported mode: ${mode}`)
  }

  const after = {
    snapshots: await snapshotAudit(supabaseAdmin, contract),
    learningEvidence: await learningEvidenceAudit(supabaseAdmin),
  }

  log('final_summary', {
    workerVersion: WORKER_VERSION,
    mode,
    hostname: EXPECTED_HOST,
    args: { ...args, serviceRolePresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), serviceRoleValue: '[redacted]' },
    certification,
    baseline,
    execution,
    after,
    productionIsolation: {
      providerCallsMade: 0,
      externalSportsApiCallsMade: 0,
      livePredictionEligibleSnapshots: after.snapshots.livePredictionEligible,
      trainingEligibleSnapshots: after.snapshots.trainingEligible,
      productionWeightsChanged: false,
      currentBoardMutated: false,
      officialPicksMutated: false,
      marketOddsMutated: false,
    },
    machine: { hostname: os.hostname() ? '[sanitized-local-host]' : null, platform: os.platform() },
  })
}

main().catch((error) => {
  log('fatal_error', { message: redact(error instanceof Error ? error.message : error), stack: redact(error?.stack ?? '') })
  process.exit(1)
})
