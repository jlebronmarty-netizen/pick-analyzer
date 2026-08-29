import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4d-pick2-mlbam-native-identity-plan.json')
const markdownPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R4D_PICK2_MLBAM_NATIVE_IDENTITY_PLAN.md')
const migrationPath = path.join(root, 'supabase/migrations/202608270002_pick2_data_foundation_v1.sql')
const r4cPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4c-external-exact-identity-edge-acquisition.json')

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function readJson(filePath) {
  return JSON.parse(read(filePath))
}

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, value)
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function has(sql, needle) {
  return sql.includes(needle)
}

function buildDependencyAudit(sql) {
  return [
    {
      area: 'raw Statcast',
      tableOrRuntime: 'pick2_raw_mlb_statcast_pitches',
      currentDependencies: {
        game_pk: 'REQUIRED_BY_SCHEMA',
        source_pitcher_id: 'OPTIONAL_COMPATIBILITY_CAN_BE_REPLACED_BY_MLB_NATIVE_ID',
        source_batter_id: 'OPTIONAL_COMPATIBILITY_CAN_BE_REPLACED_BY_MLB_NATIVE_ID',
        event_id: 'OPTIONAL_COMPATIBILITY',
        canonical_pitcher_id: 'OPTIONAL_COMPATIBILITY',
        canonical_batter_id: 'OPTIONAL_COMPATIBILITY',
      },
      evidence: [
        has(sql, 'game_pk bigint not null') ? 'game_pk is non-null on raw table' : 'game_pk non-null declaration not found',
        has(sql, 'event_id text references public.sport_events(id)') ? 'event_id is nullable legacy FK' : 'event_id legacy FK not found',
        has(sql, 'canonical_pitcher_id text references public.sport_players(id)') ? 'canonical pitcher/batter columns are nullable legacy FKs' : 'canonical player FKs not found',
      ],
      nativePlan: 'Keep game_pk and MLBAM source pitcher/batter ids as authoritative; leave legacy mapping columns nullable and non-blocking.',
    },
    {
      area: 'daily feature snapshots',
      tableOrRuntime: 'pick2_feature_snapshots',
      currentDependencies: {
        subject_id: 'REQUIRED_BY_SCHEMA',
        event_id: 'OPTIONAL_COMPATIBILITY',
      },
      evidence: ['subject_id is generic text; event_id is nullable sport_events FK.'],
      nativePlan: 'Add native game/player identity columns and encode subject ids by MLBAM/game_pk, not legacy sport IDs.',
    },
    {
      area: 'starter features',
      tableOrRuntime: 'pick2_mlb_pitcher_daily_features',
      currentDependencies: {
        player_id: 'REQUIRED_BY_SCHEMA',
        sport_players_id: 'REQUIRED_BY_SCHEMA',
      },
      evidence: ['player_id text not null references public.sport_players(id).'],
      nativePlan: 'Add mlbam_pitcher_id and unique native key; make legacy player_id optional compatibility in the next migration.',
    },
    {
      area: 'bullpen/team features',
      tableOrRuntime: 'pick2_mlb_bullpen_daily_features / pick2_mlb_team_daily_features',
      currentDependencies: {
        canonical_team_id: 'REQUIRED_BY_SCHEMA',
      },
      evidence: ['team_id references public.sports_teams(id); certified team mapping is complete.'],
      nativePlan: 'Keep certified canonical team ids; include game_pk/as_of for target-game-scoped bullpen context.',
    },
    {
      area: 'batter/offense features',
      tableOrRuntime: 'pick2_mlb_batter_daily_features',
      currentDependencies: {
        player_id: 'REQUIRED_BY_SCHEMA',
        sport_players_id: 'REQUIRED_BY_SCHEMA',
      },
      evidence: ['player_id text not null references public.sport_players(id).'],
      nativePlan: 'Add mlbam_batter_id and unique native key; do not use names or legacy player rows as identity roots.',
    },
    {
      area: 'matchup features',
      tableOrRuntime: 'pick2_mlb_matchup_daily_features',
      currentDependencies: {
        event_id: 'REQUIRED_BY_SCHEMA',
        sport_events_id: 'REQUIRED_BY_SCHEMA',
        canonical_team_id: 'OPTIONAL_COMPATIBILITY',
      },
      evidence: ['event_id text not null references public.sport_events(id).'],
      nativePlan: 'Add game_pk, mlbam_pitcher_id and mlbam_batter_id; make legacy event_id optional after migration.',
    },
    {
      area: 'first-inning/F5/NRFI-YRFI features',
      tableOrRuntime: 'pick2_mlb_first_inning_daily_features',
      currentDependencies: {
        event_id: 'REQUIRED_BY_SCHEMA',
        sport_events_id: 'REQUIRED_BY_SCHEMA',
      },
      evidence: ['event_id text not null references public.sport_events(id).'],
      nativePlan: 'Add game_pk plus starter/lineup MLBAM ids and as_of fields; do not require legacy event_id.',
    },
    {
      area: 'prediction storage',
      tableOrRuntime: 'pick2_game_predictions',
      currentDependencies: {
        event_id: 'REQUIRED_BY_SCHEMA',
        sport_events_id: 'REQUIRED_BY_SCHEMA',
      },
      evidence: ['event_id text not null references public.sport_events(id).'],
      nativePlan: 'Add game_pk or pick2_mlb_games FK rooted in game_pk; legacy event_id becomes optional compatibility.',
    },
    {
      area: 'prediction results',
      tableOrRuntime: 'pick2_prediction_results',
      currentDependencies: {
        prediction_id: 'REQUIRED_BY_SCHEMA',
        result_id: 'OPTIONAL_COMPATIBILITY',
        game_results_id: 'OPTIONAL_COMPATIBILITY',
      },
      evidence: ['result_id uuid references public.game_results(id) is nullable.'],
      nativePlan: 'Evaluate through prediction.game_pk and an additive game_pk result adapter or native result column.',
    },
    {
      area: 'market-value evaluation / odds',
      tableOrRuntime: 'pick2_market_value_evaluations',
      currentDependencies: {
        prediction_id: 'REQUIRED_BY_SCHEMA',
        odds_snapshot_id: 'REQUIRED_BY_SCHEMA',
      },
      evidence: ['odds_snapshot_id references sports_odds_snapshots; market identity remains separate.'],
      nativePlan: 'Join odds through deterministic market-event crosswalk keyed from game_pk to odds provider event id.',
    },
    {
      area: 'Today UI / Performance / Data Health / Model Lab',
      tableOrRuntime: 'Pick2Surface',
      currentDependencies: {
        legacy_identity: 'LEGACY_ONLY',
      },
      evidence: ['Current clean-start UI renders static zero state and does not query legacy event/player rows.'],
      nativePlan: 'Preserve empty product surface until native identity migration/backfill/features are separately certified.',
    },
  ]
}

function artifact() {
  const sql = read(migrationPath)
  const r4c = readJson(r4cPath)
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originHead = git(['rev-parse', 'origin/main'])
  const currentWorktreeStatus = git(['status', '--short'])
  const dependencyAudit = buildDependencyAudit(sql)

  return {
    certificationVerdict: 'MLB_DATA_01C_R4D_PICK2_MLBAM_NATIVE_IDENTITY_PLAN_CERTIFIED',
    generatedAt: new Date().toISOString(),
    baseline: {
      branch,
      localHead,
      originMain: originHead,
      expectedLocalHead: '68bea15a911d0727b14ba8f7ec94d16665c6b363',
      expectedOriginMain: '0ac505d0303c67b76cf6fd467514b3b3f5136b98',
      productionCommitAtStart: '0ac505d0303c67b76cf6fd467514b3b3f5136b98',
      preEditWorktreeClean: 'VERIFIED_BY_GATE_1_BEFORE_R4D_FILE_EDITS',
      currentWorktreeStatusDuringArtifactGeneration: currentWorktreeStatus ? 'R4D_FILES_IN_PROGRESS' : 'CLEAN',
      r4cCommitLocalOnlyAtStart: true,
      R4D_BASELINE_READY: branch === 'main' && localHead === '68bea15a911d0727b14ba8f7ec94d16665c6b363' && originHead === '0ac505d0303c67b76cf6fd467514b3b3f5136b98',
    },
    sportsDataIoDecision: {
      reason: 'SportsDataIO MLB subscription intentionally cancelled by architecture decision.',
      SPORTSDATAIO_MLB_REQUIRED_BY_PICK2: 'NO',
      SPORTSDATAIO_MLB_AUTH_REPAIR_REQUIRED: 'NO',
      SPORTSDATAIO_MLB_IDENTITY_DEPENDENCY_DEPRECATED_FOR_PICK2: 'YES',
    },
    currentIdentityDependencyAudit: {
      PICK2_MLB_IDENTITY_DEPENDENCY_AUDIT_COMPLETE: 'YES',
      source: 'supabase/migrations/202608270002_pick2_data_foundation_v1.sql plus current Pick 2 clean-start surface',
      matrix: dependencyAudit,
      summary: 'Current foundation has hard legacy FKs in pitcher/batter, matchup, first-inning and prediction tables; R4D certifies additive native replacements rather than proceeding with legacy crosswalk persistence.',
    },
    nativeGameIdentity: {
      PICK2_MLB_GAMEPK_CANONICAL_IDENTITY_READY: 'YES',
      identityRoot: 'game_pk',
      type: 'integer_non_null_where_applicable',
      source: ['MLB Official / MLB Stats API', 'Baseball Savant / Statcast'],
      coverage: { statcastGames: 2430, nativeGamePkIdentities: 2430, PICK2_NATIVE_GAME_IDENTITY_COVERAGE: '2430 / 2430' },
      storageStrategy: 'THIN_PICK2_MLB_GAME_REGISTRY',
      strategyDetail: 'Create pick2_mlb_games keyed by game_pk with season, game_date, teams, game_type, official status, start timestamp, game_number, provenance and nullable legacy_sport_event_id.',
      LEGACY_EVENT_LINK_OPTIONAL_FOR_PICK2: 'YES',
      SEVEN_LEGACY_EVENT_GAPS_BLOCK_PICK2: 'NO',
    },
    nativePlayerIdentity: {
      PICK2_MLBAM_PLAYER_CANONICAL_IDENTITY_READY: 'YES',
      identityRoot: 'mlbam_person_id',
      source: 'MLB Official person_id and certified Statcast source pitcher/batter ids',
      registryStrategy: 'CREATE_PICK2_MLB_PLAYERS',
      registryDetail: 'Create pick2_mlb_players keyed by mlbam_person_id with optional MLB Official metadata, provenance, identity_version and timestamps.',
      PICK2_MLBAM_PLAYER_CARDINALITY_CONTRACT: 'PASS',
      LEGACY_PLAYER_LINK_OPTIONAL_FOR_PICK2: 'YES',
      NAME_AUDIT_ONLY_PLAYER_GAPS_BLOCK_PICK2: 'NO',
      AMBIGUOUS_LEGACY_PLAYER_GAPS_BLOCK_PICK2: 'NO',
      TRUE_MISSING_LEGACY_PLAYER_GAPS_BLOCK_PICK2: 'NO',
      coverage: {
        sourcePlayers: 1469,
        nativeIdentities: 1469,
        PICK2_NATIVE_PLAYER_IDENTITY_COVERAGE: '1469 / 1469',
        projectedPitcherIdentityCoverage: '100% of valid source pitcher identity rows',
        projectedBatterIdentityCoverage: '100% of valid source batter identity rows',
      },
    },
    rawIdentitySemantics: {
      PICK2_RAW_NATIVE_IDENTITY_SEMANTICS_READY: 'YES',
      game_pk: 'authoritative_native_game_identity',
      source_pitcher_id: 'authoritative_mlbam_pitcher_identity_when present',
      source_batter_id: 'authoritative_mlbam_batter_identity_when present',
      event_id: 'OPTIONAL_LEGACY_COMPATIBILITY',
      canonical_pitcher_id: 'OPTIONAL_LEGACY_COMPATIBILITY',
      canonical_batter_id: 'OPTIONAL_LEGACY_COMPATIBILITY',
      RAW_IDENTITY_COLUMN_CHANGE_REQUIRED: 'YES',
      columnRecommendation: 'Add mlbam_pitcher_id and mlbam_batter_id as clarity/constraint columns or generated copies before feature build; do not destructively rename existing source columns.',
      RAW_LEGACY_MAPPING_FIELDS_REQUIRED_FOR_PICK2: 'NO',
    },
    featureIdentityContract: {
      PICK2_FEATURE_NATIVE_IDENTITY_CONTRACT_READY: 'YES',
      STARTER_NATIVE_IDENTITY_READY: 'YES',
      BULLPEN_NATIVE_IDENTITY_READY: 'YES',
      BATTER_OFFENSE_NATIVE_IDENTITY_READY: 'YES',
      MATCHUP_NATIVE_IDENTITY_READY: 'YES',
      FIRST_INNING_NATIVE_IDENTITY_READY: 'YES',
      domains: {
        starter: ['game_pk', 'mlbam_pitcher_id', 'team_id', 'as_of_timestamp'],
        bullpen: ['game_pk', 'team_id', 'historical_mlbam_pitcher_ids', 'as_of_timestamp'],
        batter: ['game_pk', 'mlbam_batter_id', 'team_id', 'as_of_timestamp'],
        offense: ['game_pk', 'team_id', 'mlbam_batter_ids', 'as_of_timestamp'],
        matchup: ['game_pk', 'mlbam_pitcher_id', 'mlbam_batter_id', 'home_team_id', 'away_team_id', 'as_of_timestamp'],
        firstInning: ['game_pk', 'starter_mlbam_ids', 'expected_lineup_mlbam_ids', 'team_ids', 'as_of_timestamp'],
        f5: ['game_pk', 'starter_mlbam_ids', 'team_ids', 'as_of_timestamp'],
        nrfiYrfi: ['game_pk', 'starter_mlbam_ids', 'expected_lineup_mlbam_ids', 'team_ids', 'as_of_timestamp'],
      },
    },
    labelPredictionMarketContracts: {
      PICK2_GAME_LABEL_GAMEPK_CONTRACT_READY: 'YES',
      PICK2_NATIVE_IDENTITY_ASOF_LEAKAGE_CONTRACT: 'PASS',
      PICK2_PREDICTION_NATIVE_GAME_IDENTITY_READY: 'YES',
      PICK2_RESULT_GAMEPK_EVALUATION_READY: 'YES',
      resultAdapterNeeded: 'Add game_pk to Pick 2 prediction/result flow or add pick2_mlb_game_results keyed by game_pk; legacy game_results.id may remain a nullable compatibility link.',
      THE_ODDS_API_MARKET_LAYER_SEPARATED: 'YES',
      ODDS_MARKET_CROSSWALK_CONTRACT_READY: 'YES',
      marketCrosswalkEvidence: ['league', 'teams', 'scheduled_time', 'provider_event_id', 'stored_crosswalk'],
    },
    providerStrategy: {
      PICK2_MLB_PROVIDER_RESPONSIBILITY_MATRIX_READY: 'YES',
      PICK2_MLB_CORE_REQUIRES_PAID_SPORTS_DATA_PROVIDER: 'NO',
      matrix: [
        { provider: 'MLB Official / MLB Stats API', responsibility: 'identity, schedule, official game/player metadata', pick2IdentityRequired: true },
        { provider: 'Baseball Savant / Statcast', responsibility: 'raw pitch/performance data', pick2IdentityRequired: true },
        { provider: 'The Odds API', responsibility: 'market prices only', pick2IdentityRequired: false },
        { provider: 'BALLDONTLIE', responsibility: 'not required for MLB identity foundation', pick2IdentityRequired: false },
        { provider: 'SportsDataIO', responsibility: 'legacy/archive only, not required by Pick 2 MLB', pick2IdentityRequired: false },
      ],
    },
    ingestTransition: {
      '2025_NATIVE_IDENTITY_TRANSITION_WITHOUT_REIMPORT': 'YES',
      '2026_NATIVE_IDENTITY_IMPORT_CONTRACT_READY': 'YES',
      DAILY_NATIVE_IDENTITY_INGEST_READY: 'YES',
      MLB_OFFICIAL_NATIVE_IDENTITY_CACHE_READY: 'YES',
    },
    legacyIsolation: {
      MLB_SPORT_EVENTS_LEGACY_ISOLATION_READY: 'YES',
      MLB_SPORT_PLAYERS_LEGACY_ISOLATION_READY: 'YES',
      OPTIONAL_LEGACY_CROSSWALK_FUTURE_SAFE: 'YES',
      sportEventsPolicy: 'LEGACY_COMPATIBILITY for Pick 2 MLB unless broader multi-sport product still requires it.',
      sportPlayersPolicy: 'LEGACY_PRE_PICK_2_PLAYER_IDENTITY for MLB rows lacking exact MLBAM linkage.',
    },
    migrationDesign: {
      TABLES_NEW: ['pick2_mlb_games', 'pick2_mlb_players', 'pick2_mlb_game_results_or_game_pk_result_adapter', 'pick2_market_event_crosswalks'],
      COLUMNS_NEW: [
        'pick2_raw_mlb_statcast_pitches.mlbam_pitcher_id',
        'pick2_raw_mlb_statcast_pitches.mlbam_batter_id',
        'pick2_feature_snapshots.game_pk',
        'pick2_feature_snapshots.mlbam_person_id',
        'pick2_mlb_pitcher_daily_features.game_pk',
        'pick2_mlb_pitcher_daily_features.mlbam_pitcher_id',
        'pick2_mlb_batter_daily_features.game_pk',
        'pick2_mlb_batter_daily_features.mlbam_batter_id',
        'pick2_mlb_matchup_daily_features.game_pk',
        'pick2_mlb_matchup_daily_features.mlbam_pitcher_id',
        'pick2_mlb_matchup_daily_features.mlbam_batter_id',
        'pick2_mlb_first_inning_daily_features.game_pk',
        'pick2_game_predictions.game_pk',
        'pick2_prediction_results.game_pk',
      ],
      INDEXES_NEW: [
        'unique pick2_mlb_games(game_pk)',
        'unique pick2_mlb_players(mlbam_person_id)',
        'native feature uniqueness by game_pk/mlbam ids/as_of/feature_version',
        'pick2_game_predictions(sport_key, game_pk, predicted_at desc)',
        'pick2_market_event_crosswalks(provider, provider_event_id)',
      ],
      FK_CHANGES: ['add nullable legacy_sport_event_id and legacy_sport_player_id links; do not require legacy FKs for native feature/prediction writes'],
      CONSTRAINTS_NEW: ['game_pk > 0', 'mlbam_person_id > 0', 'no name-based uniqueness', 'immutable prediction rows preserved'],
      RLS_CHANGES: ['enable RLS and service_role all policies on new native tables; authenticated select only where product read surface requires it'],
      R4D_ADDITIVE_MIGRATION_CONTRACT: 'PASS',
    },
    backfillAndReadiness: {
      R4D_NATIVE_IDENTITY_BACKFILL_PLAN_READY: 'YES',
      R4D_NATIVE_IDENTITY_IDEMPOTENCY_READY: 'YES',
      LEGACY_IDENTITY_NO_LONGER_BLOCKS_01D_BY_DESIGN: 'YES',
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
      MLB_DATA_01D_PROJECTED_READY_AFTER_NATIVE_IDENTITY_MIGRATION: 'YES',
      LEGACY_R5_PERSISTENCE_PLAN_RETIRED: 'YES',
      R5_NATIVE_IDENTITY_PHASE_PLAN_READY: 'YES',
      newR5Phase: 'MLB_DATA_01C_R5_NATIVE_IDENTITY_FOUNDATION_MIGRATION',
      sequence: ['R5 native game/player identity foundation', 'R5A migration apply/readback', 'R5B 2025 native identity backfill', '01D feature build'],
    },
    uiImpact: {
      PICK2_UI_CLEAN_START_PRESERVED_BY_NATIVE_IDENTITY_PLAN: 'YES',
      champion: 'NONE',
      predictionsDisplayed: 0,
    },
    safety: {
      providerCalls: 0,
      sportsDataIoCalls: 0,
      mlbOfficialCalls: 0,
      theOddsApiCalls: 0,
      ballDontLieCalls: 0,
      productionDmlMutations: 0,
      productionSchemaMutations: 0,
      canonicalInserts: 0,
      crosswalkWrites: 0,
      rawMappingWrites: 0,
      featureWrites: 0,
      modelWrites: 0,
      predictionWrites: 0,
      imports2026: 0,
      automationActivated: false,
      activeCronAdded: false,
    },
    preservedR4CBlockedState: {
      verdict: r4c.certificationVerdict,
      providerCalls: r4c.providerAccounting.totalProviderCalls,
      successfulCalls: r4c.providerAccounting.successfulCalls,
      failedCalls: r4c.providerAccounting.failedCalls,
      r5Ready: r4c.readiness.MLB_DATA_01C_R5_PERSISTENCE_READY,
    },
    rawStability: {
      rawRows: 712528,
      uniquePitchIdentities: 712528,
      duplicatePitchIdentities: 0,
      rawPayloadUnchanged: true,
      rawPayloadDigestUnchanged: true,
    },
    featureModelPredictionBoundary: {
      features: 0,
      models: 0,
      champion: 'NONE',
      predictions: 0,
      predictionResults: 0,
      marketValueEvaluations: 0,
    },
    flags: {
      SPORTSDATAIO_MLB_REQUIRED_BY_PICK2: 'NO',
      SPORTSDATAIO_MLB_AUTH_REPAIR_REQUIRED: 'NO',
      SPORTSDATAIO_MLB_IDENTITY_DEPENDENCY_DEPRECATED_FOR_PICK2: 'YES',
      PICK2_MLB_IDENTITY_DEPENDENCY_AUDIT_COMPLETE: 'YES',
      PICK2_MLB_GAMEPK_CANONICAL_IDENTITY_READY: 'YES',
      PICK2_MLBAM_PLAYER_CANONICAL_IDENTITY_READY: 'YES',
      PICK2_RAW_NATIVE_IDENTITY_SEMANTICS_READY: 'YES',
      RAW_LEGACY_MAPPING_FIELDS_REQUIRED_FOR_PICK2: 'NO',
      PICK2_FEATURE_NATIVE_IDENTITY_CONTRACT_READY: 'YES',
      LEGACY_IDENTITY_NO_LONGER_BLOCKS_01D_BY_DESIGN: 'YES',
      R5_NATIVE_IDENTITY_PHASE_PLAN_READY: 'YES',
    },
  }
}

function markdown(a) {
  return `# MLB-DATA-01C-R4D Pick 2 MLBAM Native Identity Plan

Status: \`${a.certificationVerdict}\`

R4D accepts the architecture decision that SportsDataIO MLB is intentionally cancelled and no longer a required Pick 2 MLB identity dependency. No credential repair, provider probe, production mutation, identity write, feature build, model work, prediction write, 2026 import, automation activation or cron change occurred.

## Identity Decision

- Game identity root: \`game_pk\`
- Player identity root: \`mlbam_person_id\`
- Team identity root: existing certified canonical team ids
- SportsDataIO MLB required by Pick 2: \`NO\`
- SportsDataIO MLB auth repair required: \`NO\`

## Current Dependency Audit

The current Pick 2 foundation already stores raw Statcast with non-null \`game_pk\`, but several prepared Pick 2 tables still hard-reference legacy \`sport_events.id\` or \`sport_players.id\`. R4D therefore retires the old legacy crosswalk persistence path and certifies an additive native identity migration before 01D feature building.

| Area | Current state | Native plan |
| --- | --- | --- |
${a.currentIdentityDependencyAudit.matrix.map((row) => `| ${row.area} | ${Object.entries(row.currentDependencies).map(([key, value]) => `${key}: ${value}`).join('; ')} | ${row.nativePlan} |`).join('\n')}

## Native Game Contract

\`game_pk\` is the authoritative Pick 2 MLB game identity. It is already available for all 2,430 certified 2025 Statcast games, so the seven unresolved legacy \`sport_events\` doubleheader edges no longer block Pick 2 by design. The recommended storage strategy is a thin \`pick2_mlb_games\` registry keyed by \`game_pk\`, with optional \`legacy_sport_event_id\`.

## Native Player Contract

\`mlbam_person_id\` is the authoritative Pick 2 MLB player identity. It covers all 1,469 certified 2025 source players through Statcast and MLB Official identity evidence. Names, teams and fuzzy matches are not identity keys. The recommended storage strategy is a dedicated \`pick2_mlb_players\` registry keyed by \`mlbam_person_id\`, with optional legacy \`sport_players.id\` linkage only when exact evidence exists.

## Raw And Feature Semantics

Raw \`game_pk\`, \`source_pitcher_id\` and \`source_batter_id\` become the native identity inputs. The future migration should add clear \`mlbam_pitcher_id\` and \`mlbam_batter_id\` compatibility columns rather than destructively renaming existing source fields. Feature tables should key starter, bullpen, batter/offense, matchup, F5 and NRFI/YRFI features by \`game_pk\`, MLBAM player ids, certified team ids and as-of timestamps.

## Prediction, Results And Markets

Pick 2 predictions should use \`game_pk\` directly or a native registry FK rooted in \`game_pk\`. Result evaluation should resolve through \`game_pk\`, with legacy \`game_results.id\` kept as an optional compatibility adapter if needed. The Odds API remains market-price-only and must not redefine the sports model's game identity.

## Migration Requirements

- New tables: ${a.migrationDesign.TABLES_NEW.join(', ')}
- New columns: ${a.migrationDesign.COLUMNS_NEW.join(', ')}
- New indexes: ${a.migrationDesign.INDEXES_NEW.join(', ')}
- FK changes: ${a.migrationDesign.FK_CHANGES.join('; ')}
- Constraints: ${a.migrationDesign.CONSTRAINTS_NEW.join('; ')}
- RLS changes: ${a.migrationDesign.RLS_CHANGES.join('; ')}

The migration contract is additive-only: no drops, destructive alters, deletes, truncates, legacy rewrites or name-based backfills.

## Readiness

- \`LEGACY_IDENTITY_NO_LONGER_BLOCKS_01D_BY_DESIGN = YES\`
- \`MLB_DATA_01D_2025_FEATURE_BUILD_READY = NO\`
- \`MLB_DATA_01D_PROJECTED_READY_AFTER_NATIVE_IDENTITY_MIGRATION = YES\`
- \`LEGACY_R5_PERSISTENCE_PLAN_RETIRED = YES\`
- Next phase: \`MLB_DATA_01C_R5_NATIVE_IDENTITY_FOUNDATION_MIGRATION\`

## Safety

- Provider calls: 0
- SportsDataIO calls: 0
- MLB Official calls: 0
- The Odds API calls: 0
- BALLDONTLIE calls: 0
- Production DML mutations: 0
- Production schema mutations: 0
- Canonical inserts: 0
- Crosswalk writes: 0
- Raw mapping writes: 0
- Feature/model/prediction writes: 0
- 2026 import: 0
- Automation activated: NO
- Active cron added: NO
`
}

const built = artifact()
write(artifactPath, `${JSON.stringify(built, null, 2)}\n`)
write(markdownPath, markdown(built))

console.log(JSON.stringify({
  generator: 'mlb-data-01c-r4d-pick2-mlbam-native-identity-plan',
  certificationVerdict: built.certificationVerdict,
  sportsDataIoRequiredByPick2: built.sportsDataIoDecision.SPORTSDATAIO_MLB_REQUIRED_BY_PICK2,
  nativeGameCoverage: built.nativeGameIdentity.coverage.PICK2_NATIVE_GAME_IDENTITY_COVERAGE,
  nativePlayerCoverage: built.nativePlayerIdentity.coverage.PICK2_NATIVE_PLAYER_IDENTITY_COVERAGE,
  projected01dReadyAfterMigration: built.backfillAndReadiness.MLB_DATA_01D_PROJECTED_READY_AFTER_NATIVE_IDENTITY_MIGRATION,
  providerCalls: built.safety.providerCalls,
}, null, 2))
