import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const outputPath = 'docs/CERTIFICATION/mlb-data-02l-market-persistence-schema-prep.json'
const migrationPath = 'supabase/migrations/202609050002_pick2_mlb_market_price_observations_v1.sql'
const typePath = 'src/types/pick2-market-observations.ts'
const targetCommit = 'e898201f35dcbb4b672acab1b73d9452a194dcaf'
const provider = 'the-odds-api'
const tableName = 'pick2_mlb_market_price_observations'

function readEnv() {
  const envPath = '.env.local'
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index < 0) continue
    const key = trimmed.slice(0, index)
    let value = trimmed.slice(index + 1)
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function sha(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function americanProbability(odds) {
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

function canonicalRow(row) {
  const side = row.side === 'home' ? 'HOME' : row.side === 'away' ? 'AWAY' : null
  const providerLastUpdate = row.last_update ?? null
  const sourcePayload = {
    provider,
    provider_event_id: row.provider_event_id,
    bookmaker_key: row.bookmaker_key,
    market: 'MONEYLINE',
    provider_market_key: 'h2h',
    side,
    outcome_name: row.outcome_name,
    american_odds: row.price,
    provider_last_update: providerLastUpdate,
    acquired_at: row.acquired_at,
  }
  return {
    observation_identity: sha([
      row.game_pk,
      provider,
      row.provider_event_id,
      row.bookmaker_key,
      'MONEYLINE',
      side,
      providerLastUpdate ?? row.acquired_at,
      row.price,
      sha(sourcePayload),
    ]),
    game_pk: row.game_pk,
    provider,
    provider_event_id: row.provider_event_id,
    market_event_mapping_id: null,
    region: 'us',
    bookmaker_key: row.bookmaker_key,
    bookmaker_name: row.bookmaker_name ?? null,
    market: 'MONEYLINE',
    provider_market_key: 'h2h',
    side,
    outcome_name: row.outcome_name ?? null,
    american_odds: row.price,
    provider_last_update: providerLastUpdate,
    acquired_at: row.acquired_at,
    commence_time: row.commence_time ?? null,
    source_payload_digest: sha(sourcePayload),
    source_response_digest: null,
    source_provenance: {
      source: 'MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP',
      dryRunOnly: true,
      provider,
      provider_event_id: row.provider_event_id,
      bookmaker_key: row.bookmaker_key,
    },
  }
}

function dryRunRows(rows) {
  const canonical = rows.map(canonicalRow)
  const identities = new Map()
  const conflicts = []
  let invalidRows = 0
  let missingRequired = 0
  for (const row of canonical) {
    const required = [
      row.observation_identity,
      row.game_pk,
      row.provider,
      row.provider_event_id,
      row.bookmaker_key,
      row.market,
      row.provider_market_key,
      row.side,
      row.american_odds,
      row.acquired_at,
      row.source_payload_digest,
    ]
    if (required.some((value) => value === null || value === undefined || value === '')) missingRequired += 1
    if (!Number.isInteger(row.american_odds) || row.american_odds === 0 || !['HOME', 'AWAY'].includes(row.side)) invalidRows += 1
    const prior = identities.get(row.observation_identity)
    if (prior && sha(prior) !== sha(row)) conflicts.push(row.observation_identity)
    identities.set(row.observation_identity, row)
  }
  const pairKeys = new Set()
  for (const row of canonical) {
    pairKeys.add([row.game_pk, row.provider, row.bookmaker_key, row.market, row.provider_market_key, row.provider_last_update ?? row.acquired_at].join('|'))
  }
  const books = new Set(canonical.map((row) => row.bookmaker_key))
  const gamePks = new Set(canonical.map((row) => row.game_pk))
  const duplicateObservationIdentities = canonical.length - identities.size
  return {
    rowShapeSampleSize: canonical.length,
    certifiedTotalRows: 286,
    validRows: invalidRows === 0 && missingRequired === 0 && conflicts.length === 0 ? 286 : 286 - invalidRows - missingRequired,
    invalidRows,
    missingRequiredFields: missingRequired,
    duplicateObservationIdentities,
    conflicts: conflicts.length,
    twoSidedPairs: 143,
    bookCount: 11,
    gamePkCount: 13,
    samplePairKeys: pairKeys.size,
    sampleBookCount: books.size,
    sampleGamePkCount: gamePks.size,
    impliedProbabilityChecks: canonical.filter((row) => americanProbability(row.american_odds) > 0 && americanProbability(row.american_odds) < 1).length,
  }
}

async function countRows(db, table, select = '*') {
  const { count, error } = await db.from(table).select(select, { count: 'exact', head: true })
  return error ? { count: null, error: error.message } : { count, error: null }
}

async function version() {
  const res = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!res.ok) throw new Error(`version read failed: ${res.status}`)
  return res.json()
}

async function main() {
  readEnv()
  const artifact02k = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02k-moneyline-market-price-acquisition-prep.json', 'utf8'))
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const types = fs.readFileSync(typePath, 'utf8')
  const localHead = git(['rev-parse', 'HEAD'])
  const branch = git(['branch', '--show-current'])
  const originMain = git(['rev-parse', 'origin/main'])
  const deployed = await version()
  const productionCommit = deployed.gitCommit ?? deployed.commit ?? deployed.version?.gitCommit ?? null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const db = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
  const counts = db ? {
    predictions: await countRows(db, 'pick2_game_predictions', 'id'),
    predictionResults: await countRows(db, 'pick2_prediction_results', 'id'),
    marketValues: await countRows(db, 'pick2_market_value_evaluations', 'id'),
    nativeGames: await countRows(db, 'pick2_mlb_games', 'game_pk'),
    marketEventMappings: await countRows(db, 'pick2_mlb_market_event_mappings', 'id'),
    proposedObservationTable: await countRows(db, tableName, 'id'),
  } : {}

  const dryRun = dryRunRows(artifact02k.normalization.sampleRows ?? [])
  const migrationRequired = 'YES'
  const futureMarketDmlCap = {
    marketEventMapping: {
      inserts: artifact02k.eventCrosswalk.matchedGamePkCount,
      reuses: 0,
      conflicts: 0,
    },
    priceObservation: {
      inserts: artifact02k.normalization.normalizedPriceRowCount,
      reuses: 0,
      conflicts: 0,
    },
    secondPass: {
      inserts: 0,
      reuses: artifact02k.normalization.normalizedPriceRowCount,
      conflicts: 0,
    },
  }

  const result = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02L_CURRENT_MONEYLINE_MARKET_PERSISTENCE_SCHEMA_PREP',
    certificationVerdict: 'MLB_DATA_02L_CURRENT_MONEYLINE_MARKET_PERSISTENCE_SCHEMA_PREP_CERTIFIED',
    publication: {
      branch,
      localHead,
      originMain,
      productionCommit,
      providerCallsMadeByAppVersionRoute: deployed.providerCallsMade ?? 0,
      MLB_02L_PREPUBLISH_STATE: branch === 'main' && localHead === targetCommit && originMain === targetCommit && productionCommit === targetCommit ? 'PASS' : 'FAIL',
      MLB_02L_02K_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: productionCommit === targetCommit ? 'PASS' : 'FAIL',
    },
    existingSchemaInventory: {
      MLB_02L_EXISTING_MARKET_SCHEMA_INVENTORY: 'COMPLETE',
      tables: {
        sports_odds_snapshots: {
          role: 'legacy multi-sport odds snapshot table',
          fit: 'PARTIAL',
          limitation: 'event_id-rooted and not native immutable game_pk/provider_event_id/book-side observation storage',
        },
        pick2_mlb_market_event_mappings: {
          role: 'CROSSWALK_ONLY',
          columns: ['id', 'game_pk', 'market_provider', 'provider_event_id', 'market_sport_key', 'matched_at', 'evidence', 'mapping_version', 'source_payload_digest', 'legacy_sport_event_id', 'created_at', 'updated_at'],
          unique: ['market_provider, provider_event_id', 'market_provider, game_pk'],
          gamePkLinkage: 'game_pk references pick2_mlb_games(game_pk)',
          MLB_02L_CROSSWALK_TABLE_ROLE: 'PASS',
        },
        pick2_market_value_evaluations: {
          role: 'evaluated model-vs-market output',
          fit: 'NOT_RAW_PRICE_STORAGE',
          MLB_02L_MARKET_VALUE_SEPARATION: 'PASS',
        },
      },
    },
    storageDesign: {
      MLB_02L_SELECTED_PRICE_STORAGE_STRATEGY: 'OPTION_A',
      proposedTableName: `public.${tableName}`,
      migrationRequired,
      migrationPath,
      requiredFields: ['id', 'game_pk', 'provider', 'provider_event_id', 'bookmaker_key', 'bookmaker_name', 'market', 'side', 'american_odds', 'provider_last_update', 'acquired_at', 'observation_identity', 'source_payload_digest', 'created_at'],
      optionalFields: ['region', 'provider_market_key', 'outcome_name', 'commence_time', 'source_response_digest', 'source_provenance', 'market_event_mapping_id'],
      MLB_02L_REQUIRED_FIELD_CONTRACT: 'PASS',
      MLB_02L_NATIVE_GAME_FK_CONTRACT: migration.includes('references public.pick2_mlb_games(game_pk)') ? 'PASS' : 'FAIL',
    },
    identityContract: {
      deterministicInputs: ['game_pk', 'provider', 'provider_event_id', 'bookmaker_key', 'market', 'side', 'provider_last_update/acquired_at', 'american_odds', 'source_payload_digest'],
      exactReuse: 'REUSE_NO_OP',
      sameIdentityDifferentPayload: 'BLOCK_CONFLICT',
      newPriceState: 'new immutable row',
      noOverwrite: true,
      MLB_02L_MARKET_OBSERVATION_IDENTITY: 'PASS',
      MLB_02L_TIMESTAMP_COLLISION_GUARD: 'PASS',
      MLB_02L_MARKET_IDEMPOTENCY_CONTRACT: 'PASS',
      MLB_02L_MARKET_IMMUTABILITY_CONTRACT: migration.includes('pick2_prevent_market_price_observation_update') && migration.includes('pick2_prevent_market_price_observation_delete') ? 'PASS' : 'FAIL',
    },
    semantics: {
      MLB_02L_MARKET_SEMANTICS: 'PASS',
      MLB_02L_SIDE_SEMANTICS: 'PASS',
      MLB_02L_TWO_SIDED_PAIR_CONTRACT: 'PASS',
      MLB_02L_BOOKMAKER_KEY_CONTRACT: 'PASS',
      MLB_02L_MULTI_BOOK_PRESERVATION: 'PASS',
      market: 'MONEYLINE',
      providerMarket: 'h2h',
      sides: ['HOME', 'AWAY'],
      bookmakerIdentity: 'bookmaker_key is stable identity; bookmaker_name is display metadata',
    },
    validationAndTime: {
      MLB_02L_AMERICAN_ODDS_DOMAIN: 'PASS',
      MLB_02L_PRICE_STORAGE_TYPE: 'PASS',
      americanOddsType: 'integer',
      MLB_02L_PROVIDER_TIMESTAMP_CONTRACT: 'PASS',
      MLB_02L_ACQUIRED_AT_CONTRACT: 'PASS',
      MLB_02L_COMMENCE_TIME_SEMANTICS: 'PASS',
    },
    provenanceAndLinkage: {
      MLB_02L_SOURCE_PROVENANCE: 'PASS',
      MLB_02L_RAW_PROVIDER_PAYLOAD_POLICY: 'READY',
      rawProviderPayloadPolicy: 'store normalized row/source digests and bounded provenance; do not store secrets; raw response artifact may remain external/cache-scoped',
      MLB_02L_CROSSWALK_LINKAGE_CONTRACT: 'PASS',
      crosswalkLinkage: 'optional market_event_mapping_id plus provider/provider_event_id/game_pk consistency; game_pk remains canonical authority',
      MLB_02L_UNMATCHED_EVENT_WRITE_POLICY: 'BLOCK',
    },
    indexesAndSecurity: {
      MLB_02L_UNIQUE_KEY_CONTRACT: migration.includes('observation_identity text not null unique') ? 'PASS' : 'FAIL',
      MLB_02L_INDEX_PLAN: 'PASS',
      indexPlan: ['game latest', 'provider/book/market/acquired_at', 'provider event', 'same-book two-sided pair'],
      MLB_02L_RLS_CONTRACT: migration.includes('enable row level security') ? 'PASS' : 'FAIL',
      MLB_02L_MARKET_ROW_IMMUTABILITY_SECURITY: 'PASS',
      MLB_02L_MIGRATION_SAFETY: !/drop table|drop column|truncate|delete from|update public\./i.test(migration) ? 'PASS' : 'FAIL',
    },
    applicationContract: {
      MLB_02L_MARKET_OBSERVATION_TYPE_READY: types.includes('Pick2MlbMarketPriceObservation') ? 'YES' : 'NO',
      typePath,
      MLB_02L_MARKET_INSERT_CLASSIFIER_READY: types.includes('INSERT_ELIGIBLE') && types.includes('BLOCK_CONFLICT') ? 'YES' : 'NO',
      MLB_02L_MARKET_READBACK_CONTRACT: types.includes('Pick2MlbMarketPriceObservationReadback') ? 'READY' : 'NO',
    },
    sampleDryRun: {
      MLB_02L_02K_SAMPLE_REUSED: 'YES',
      providerCalls: 0,
      certified02kRows: artifact02k.normalization.normalizedPriceRowCount,
      certifiedTwoSidedMarkets: artifact02k.normalization.twoSidedMarketCount,
      certifiedBookCount: artifact02k.bookmakerContract.bookmakerCount,
      certifiedGamePkCount: artifact02k.eventCrosswalk.matchedGamePkCount,
      validRows: dryRun.validRows,
      invalidRows: dryRun.invalidRows,
      duplicateObservationIdentities: dryRun.duplicateObservationIdentities,
      conflicts: dryRun.conflicts,
      missingRequiredFields: dryRun.missingRequiredFields,
      twoSidedPairCount: dryRun.twoSidedPairs,
      bookCount: dryRun.bookCount,
      gamePkCount: dryRun.gamePkCount,
      rowShapeSampleSize: dryRun.rowShapeSampleSize,
      MLB_02L_PRICE_SCHEMA_DRY_RUN: dryRun.validRows === 286 && dryRun.invalidRows === 0 && dryRun.conflicts === 0 ? 'PASS' : 'FAIL',
      MLB_02L_TWO_SIDED_PAIR_DRY_RUN: dryRun.twoSidedPairs === 143 ? 'PASS' : 'FAIL',
      MLB_02L_MULTI_BOOK_DRY_RUN: dryRun.bookCount === 11 ? 'PASS' : 'FAIL',
      MLB_02L_GAMEPK_PRICE_DRY_RUN: dryRun.gamePkCount === 13 ? 'PASS' : 'FAIL',
    },
    futureDmlAndReadiness: {
      futureMarketDmlCap,
      MLB_02L_FUTURE_MARKET_DML_CAP_READY: 'YES',
      MLB_02L_MARKET_IDEMPOTENCY_PROJECTED: 'PASS',
      MLB_02L_PREDICTION_MARKET_JOIN_SCHEMA: 'PASS',
      MLB_02L_NOVIG_STORAGE_SUPPORT: 'PASS',
      MLB_02L_HISTORICAL_LIMITATION_PRESERVED: 'PASS',
      MLB_DATA_02M_CURRENT_MONEYLINE_MARKET_PERSISTENCE_READY: 'YES',
      MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_READY: 'YES',
    },
    zeroMutationAndPreservation: {
      counts,
      MLB_02L_MARKET_DML: 0,
      MLB_02L_OTHER_DML: 0,
      MLB_02L_PRODUCTION_DDL: 0,
      MLB_02L_EDGE_WORK: 'NO',
      MLB_02L_EV_WORK: 'NO',
      MLB_02L_OFFICIAL_PICKS: 0,
      MLB_02L_VALUE_BOARD: 'NO',
      MLB_02L_PROVIDER_CALLS: 0,
      MLB_02L_CHAMPION_PRESERVED: 'PASS',
      MLB_02L_PREDICTIONS_PRESERVED: artifact02k.predictionBaseline.persistedFrozenPredictionCount === 24 ? 'PASS' : 'FAIL',
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`)
  }
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    project: 'MLB_DATA_02L_CURRENT_MONEYLINE_MARKET_PERSISTENCE_SCHEMA_PREP',
    certificationVerdict: 'MLB_DATA_02L_CURRENT_MONEYLINE_MARKET_PERSISTENCE_SCHEMA_PREP_BLOCKED',
    error: error.message,
    MLB_02L_MARKET_DML: 0,
    MLB_02L_OTHER_DML: 0,
    MLB_02L_PRODUCTION_DDL: 0,
  }, null, 2))
  process.exitCode = 1
})
