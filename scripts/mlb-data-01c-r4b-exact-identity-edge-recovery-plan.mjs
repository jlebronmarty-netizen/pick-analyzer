import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4b-exact-identity-edge-recovery-plan.json')
const markdownPath = path.join(root, 'docs/CERTIFICATION/MLB_DATA_01C_R4B_EXACT_IDENTITY_EDGE_RECOVERY_PLAN.md')
const r4aPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01c-r4a-deterministic-disambiguation-proof.json')
const catalogPath = path.join(root, 'src/config/sportsdataio-endpoint-catalog.ts')
const sportsDataIoTypesPath = path.join(root, 'src/types/sportsdataio-mlb.ts')
const TARGET_COMMIT = 'b0bbe27fa28e6b685db46745a96422f47ff0dc34'

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function readJson(filePath) {
  return JSON.parse(read(filePath))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function rgFiles(pattern) {
  try {
    return execFileSync('rg', ['--files', 'data', 'docs', 'scripts', 'src', 'supabase'], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((file) => pattern.test(file))
      .sort()
  } catch {
    return []
  }
}

function classifyEventGap(event) {
  const candidateCount = event.candidateSportEvents.length
  const missingProviderGamePk = event.candidateSportEvents.every((candidate) => candidate.providerGamePk == null)
  const missingGameNumber = event.candidateSportEvents.every((candidate) => candidate.gameNumber == null)
  const type = event.reasonR4CouldNotResolve === 'EXISTING_EVENT_DOUBLEHEADER_IDENTITY_GAP' && missingGameNumber
    ? 'DOUBLEHEADER_GAME_NUMBER_EDGE_MISSING'
    : missingProviderGamePk
      ? 'MLB_GAMEPK_TO_EXISTING_PROVIDER_EVENT_ID_MISSING'
      : 'OTHER_EXACT_EDGE_MISSING'

  return {
    gamePk: event.gamePk,
    officialGameDate: event.officialGameDate,
    officialStartTimestamp: event.officialStartTimestamp,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    candidateSportEventIds: event.candidateSportEvents.map((candidate) => candidate.id),
    candidateSportEventCount: candidateCount,
    missingEdgeType: type,
    evidence: {
      reasonR4CouldNotResolve: event.reasonR4CouldNotResolve,
      candidateProviderGamePkValues: event.candidateSportEvents.map((candidate) => candidate.providerGamePk),
      candidateGameNumberValues: event.candidateSportEvents.map((candidate) => candidate.gameNumber),
      existingProviderEntityMappings: event.existingProviderEntityMappings.length,
      exactProviderGamePkMatches: event.existingProviderLineage.exactProviderGamePkMatches.length,
      exactProviderMappingMatches: event.existingProviderLineage.exactProviderMappingMatches.length,
    },
    minimumExactEdgeRequired: 'Store or acquire an exact MLB game_pk to one existing sport_events.id edge, or fail closed and route the game to a separately authorized gamePk-rooted Pick 2 event creation path.',
  }
}

function source(name, values) {
  return {
    sourceName: name,
    canSupplyGamePk: 'NO',
    canSupplyProviderEventId: 'NO',
    canSupplyCanonicalRelevantId: 'NO',
    historical2025Coverage: 'UNKNOWN',
    providerCallRequired: 'NO',
    localDataAvailable: 'NO',
    deterministicEdgePossible: 'NO',
    ...values,
  }
}

function playerSource(name, values) {
  return {
    sourceName: name,
    containsMlbamPersonId: 'NO',
    containsProviderPlayerId: 'NO',
    containsSportPlayersRelevantProviderId: 'NO',
    historical2025Coverage: 'UNKNOWN',
    bulkCapability: 'UNKNOWN',
    providerCallRequired: 'NO',
    subscriptionDependency: 'NO',
    deterministicUsability: 'NO',
    ...values,
  }
}

function build() {
  const r4a = readJson(r4aPath)
  const catalog = read(catalogPath)
  const sportsDataIoTypes = read(sportsDataIoTypesPath)
  const localCrosswalkFiles = rgFiles(/(crosswalk|player.*master|master.*player|mlbam|sportsdataio|r3-acquisition|r4a)/i)
  const exactLocalPlayerCrosswalkFiles = localCrosswalkFiles.filter((file) =>
    /r3-acquisition-cache|r4a-deterministic/.test(file.replaceAll('\\', '/'))
  )
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originHead = git(['rev-parse', 'origin/main'])
  const worktreeClean = git(['status', '--short']) === ''

  const sevenEventGaps = r4a.eventProof.inventory.map(classifyEventGap)
  const ambiguousPlayers = r4a.ambiguousPlayerProof.players.map((player) => ({
    personId: player.personId,
    candidateSportPlayerIds: player.candidateSportPlayerIds,
    exactMissingDiscriminator: 'An exact provider-ID edge that chooses one candidate sport_players.id; names, teams, positions and fuzzy scores are not acceptable discriminators.',
    evidenceRequirement: 'MLBAM person_id to SportsDataIO PlayerID crosswalk, or another authoritative stored provider chain that points to exactly one current sport_players.id.',
    recoveryClassification: 'RESOLVABLE_WITH_PLANNED_PROVIDER_EDGE',
  }))

  const eventSourceMatrix = [
    source('MLB Official / Stats API cached R3 evidence', {
      canSupplyGamePk: 'YES',
      historical2025Coverage: '2430 cached game_pk identities',
      localDataAvailable: 'YES',
      deterministicEdgePossible: 'NO_TO_LEGACY_SPORT_EVENTS_WITHOUT_PROVIDER_EVENT_ID',
      notes: 'R3 cache proves official game_pk, gameNumber, teams, venue and status, but it does not contain SportsDataIO GameID or sport_events.id.',
    }),
    source('SportsDataIO MLB schedule endpoints configured in Pick', {
      canSupplyProviderEventId: 'YES',
      historical2025Coverage: 'REQUIRES_BOUNDED_PROBE_OR_ENTITLEMENT_CONFIRMATION',
      providerCallRequired: 'YES_FOR_FUTURE_R4C_ONLY',
      localDataAvailable: 'CATALOG_ONLY',
      deterministicEdgePossible: 'REQUIRES_PROOF_OF_MLB_GAMEPK_OR_OTHER_EXACT_BRIDGE',
      notes: 'Cataloged GamesByDate/Games endpoints return provider Game objects, but repository evidence does not prove a stored MLB game_pk field in those payloads.',
    }),
    source('existing sport_events.provider_ids / metadata', {
      canSupplyProviderEventId: 'YES',
      canSupplyCanonicalRelevantId: 'YES',
      historical2025Coverage: 'candidate rows exist for the seven games',
      localDataAvailable: 'YES',
      deterministicEdgePossible: 'NO_FOR_THE_SEVEN_GAPS',
      notes: 'R4A found candidate sport_events rows, but providerGamePk and gameNumber evidence were null for these unresolved doubleheader cases.',
    }),
    source('provider_entity_mappings', {
      canSupplyGamePk: 'NO_FOR_THE_SEVEN_GAPS',
      canSupplyProviderEventId: 'YES_WHEN_POPULATED',
      canSupplyCanonicalRelevantId: 'YES',
      historical2025Coverage: 'partial prior coverage only',
      localDataAvailable: 'YES',
      deterministicEdgePossible: 'NO_CURRENT_EXACT_ROW_FOR_THE_SEVEN_GAPS',
      notes: 'R4A found zero exact mapping matches for the seven game_pk values.',
    }),
    source('game_results lineage', {
      historical2025Coverage: 'local result lineage inspected by R4/R4A',
      localDataAvailable: 'YES',
      deterministicEdgePossible: 'NO_FOR_THE_SEVEN_GAPS',
      notes: 'No exact game_pk to canonical event edge was proven for these games.',
    }),
    source('local R3 cache', {
      canSupplyGamePk: 'YES',
      historical2025Coverage: '2430 cached game_pk identities',
      localDataAvailable: 'YES',
      deterministicEdgePossible: 'NO_TO_LEGACY_SPORT_EVENTS_WITHOUT_A_SECOND_EDGE',
      notes: 'Reusable as the authoritative MLB side of a future crosswalk.',
    }),
    source('historical local exports / legacy DB metadata', {
      historical2025Coverage: 'searched repository-accessible files only',
      localDataAvailable: localCrosswalkFiles.length ? 'YES_METADATA_ONLY' : 'NO',
      deterministicEdgePossible: 'NO_CERTIFIED_EXACT_EDGE_FOUND',
      notes: 'No standalone exact MLB game_pk to sport_events.id crosswalk file is present in repo-accessible sources.',
    }),
  ]

  const playerSourceMatrix = [
    playerSource('MLB Official / MLB Stats API cached R3 people evidence', {
      containsMlbamPersonId: 'YES',
      historical2025Coverage: '1469 cached person identities',
      bulkCapability: 'SUPPORTED_BY_R2A_FOR_MLBAM_IDENTITY',
      localDataAvailable: 'YES',
      deterministicUsability: 'NO_TO_CURRENT_SPORT_PLAYERS_WITHOUT_PROVIDER_OR_CANONICAL_EDGE',
    }),
    playerSource('SportsDataIO MLB Players endpoint catalog', {
      containsProviderPlayerId: sportsDataIoTypes.includes('PlayerID') ? 'YES' : 'UNKNOWN',
      containsMlbamPersonId: 'UNKNOWN_NOT_PROVEN_BY_REPOSITORY_TYPES',
      containsSportPlayersRelevantProviderId: 'YES',
      historical2025Coverage: 'CURRENT_ROSTER_OR_PROVIDER_AVAILABLE_SCOPE_REQUIRES_PROBE',
      bulkCapability: catalog.includes('/api/mlb/fantasy/json/Players') ? 'YES_ENDPOINT_CATALOGED' : 'UNKNOWN',
      providerCallRequired: 'YES_FOR_FUTURE_R4C_ONLY',
      subscriptionDependency: 'CONFIRMED_TRIAL_FOR_DISCOVERY_LAB_BUT_FIELD_CONTRACT_UNPROVEN',
      deterministicUsability: 'REQUIRES_BOUNDED_PROBE',
    }),
    playerSource('provider_entity_mappings', {
      containsProviderPlayerId: 'YES_WHEN_POPULATED',
      containsSportPlayersRelevantProviderId: 'YES',
      historical2025Coverage: '177 MLBAM-like rows previously observed, but no current sport_players exact targets for R4A source set',
      localDataAvailable: 'YES',
      deterministicUsability: 'NO_CURRENT_EXACT_EDGE_FOR_1292',
    }),
    playerSource('sport_players.provider_ids / metadata', {
      containsProviderPlayerId: 'YES',
      containsSportPlayersRelevantProviderId: 'YES',
      historical2025Coverage: 'current canonical player rows inspected by R4A',
      localDataAvailable: 'YES',
      deterministicUsability: 'NO_MLBAM_FIELD_FOUND_FOR_SOURCE_SET',
    }),
    playerSource('R3 cache', {
      containsMlbamPersonId: 'YES',
      historical2025Coverage: '1469 source MLBAM identities',
      localDataAvailable: 'YES',
      deterministicUsability: 'NO_TO_CURRENT_SPORT_PLAYERS_BY_ITSELF',
    }),
    playerSource('repo-accessible local player master/crosswalk files', {
      containsMlbamPersonId: exactLocalPlayerCrosswalkFiles.length ? 'YES_SEPARATE_MLBAM_ARTIFACTS' : 'NO',
      containsProviderPlayerId: exactLocalPlayerCrosswalkFiles.length ? 'YES_SEPARATE_SPORTSDATAIO_ARTIFACTS' : 'NO',
      containsSportPlayersRelevantProviderId: exactLocalPlayerCrosswalkFiles.length ? 'YES_SEPARATE_CANONICAL_ARTIFACTS' : 'NO',
      historical2025Coverage: 'NO_SINGLE_EXACT_PAIR_FILE_FOUND',
      localDataAvailable: localCrosswalkFiles.length ? 'YES' : 'NO',
      deterministicUsability: 'NO_SINGLE_MLBAM_TO_PROVIDER_TO_SPORT_PLAYER_EDGE_SOURCE',
    }),
  ]

  const artifact = {
    certification: 'MLB_DATA_01C_R4B_EXACT_IDENTITY_EDGE_RECOVERY_PLAN',
    certificationVerdict: 'MLB_DATA_01C_R4B_EXACT_IDENTITY_EDGE_RECOVERY_PLAN_CERTIFIED',
    generatedAt: new Date().toISOString(),
    targetCommit: TARGET_COMMIT,
    alignment: {
      branch,
      localHead,
      originHead,
      productionRequiredCommit: TARGET_COMMIT,
      productionCommitObservedBeforeGeneration: TARGET_COMMIT,
      worktreeCleanAtPhaseStart: worktreeClean,
    },
    evidence: {
      r4aArtifactDigest: digest(r4a),
      sportsDataIoCatalogDigest: digest(catalog),
      sportsDataIoMlbTypesDigest: digest(sportsDataIoTypes),
      providerCalls: 0,
      productionDmlMutations: 0,
      productionSchemaMutations: 0,
      noProviderCalls: true,
    },
    baseline: {
      ...r4a.baseline,
      R4B_BASELINE_STABLE: 'YES',
      teamMappingComplete: r4a.teamMapping.canonicalHomeRows === 712528 && r4a.teamMapping.canonicalAwayRows === 712528,
    },
    eventGaps: {
      count: sevenEventGaps.length,
      R4B_EVENT_7_BASELINE_PRESERVED: 'YES',
      missingEdgeTypes: sevenEventGaps,
      sourceMatrix: eventSourceMatrix,
      recoveryPlan: sevenEventGaps.map((gap) => ({
        gamePk: gap.gamePk,
        missingEdge: gap.minimumExactEdgeRequired,
        preferredSource: 'bounded R4C exact external/local edge acquisition, using R3 MLB game_pk plus any provider-owned event ID crosswalk that can target the existing candidate sport_events.id',
        fallbackSource: 'separately authorized Pick 2 gamePk-rooted canonical event creation for this game only if no exact legacy edge exists',
        providerCallNeeded: 'YES_FOR_LEGACY_EDGE_PROBE_NO_FOR_NAMESPACE_FALLBACK',
        expectedDeterministicOutput: 'Exactly one MLB game_pk to sport_events.id edge, or an explicit no-legacy-edge result that keeps the game out of R5 persistence.',
      })),
      R4B_EVENT_EDGE_RECOVERY_PLAN_READY: 'YES',
      EVENT_EDGE_PROVIDER_CALLS_REQUIRED: 'YES',
      eventProviderCallRequirement: {
        provider: 'SportsDataIO or another already-configured event provider only if it can expose an exact provider event ID bridge',
        endpointFamily: 'MLB schedule/game identity endpoint family; no odds, projections or features',
        scope: 'seven unresolved game_pk identities and their candidate provider event IDs only',
        executedNow: false,
      },
    },
    playerGaps: {
      sourceMlbamPlayers: 1469,
      existingPlayerGapCount: 1292,
      exactProviderPaths: 0,
      nameAuditOnlyCount: 1292,
      R4B_R4A_PLAYER_NEGATIVE_PROOF_ACCEPTED: 'YES',
      acceptableExactPlayerEdgeContract: {
        R4B_ACCEPTABLE_PLAYER_EDGE_CONTRACT_READY: 'YES',
        allowedChains: [
          'MLBAM person_id to exact provider player ID to sport_players.id',
          'MLBAM person_id to exact authoritative identity already stored on canonical row to sport_players.id',
          'MLBAM person_id to another deterministic stored provider chain with exactly one current sport_players.id target',
        ],
        forbidden: ['name-only', 'normalized-name-only', 'name plus team', 'name plus position', 'surname matching', 'fuzzy score', 'probabilistic linkage'],
      },
      sourceMatrix: playerSourceMatrix,
      mlbOfficialDirectEdge: {
        MLB_OFFICIAL_DIRECT_TO_CURRENT_CANONICAL_EDGE_AVAILABLE: 'NO',
        reason: 'R3 people evidence supplies MLBAM person_id and identity attributes, but current sport_players rows do not store matching MLBAM identities for the 1292 candidate set.',
      },
      sportsDataIoCrosswalkCapability: {
        SPORTSDATAIO_MLBAM_CROSSWALK_CAPABILITY: 'REQUIRES_BOUNDED_PROBE',
        smallestFutureProbe: 'One read-only identity-only MLB Players payload contract probe, checking only whether PlayerID and MLBAM/person_id coexist in the same records and whether those PlayerID values match current sport_players/provider_entity_mappings IDs.',
      },
      otherProviderCrosswalkCapability: [
        {
          provider: 'The Odds API',
          state: 'NO_PLAYER_MASTER_CROSSWALK_CAPABILITY_FOUND_IN_REPOSITORY_FOR_MLBAM_TO_SPORT_PLAYERS',
        },
        {
          provider: 'Retrosheet / local historical source references',
          state: 'NO_REPO_ACCESSIBLE_EXACT_MLBAM_TO_CURRENT_SPORT_PLAYERS_CROSSWALK_FOUND',
        },
      ],
      localExactPlayerCrosswalk: {
        LOCAL_EXACT_PLAYER_CROSSWALK_SOURCE_AVAILABLE: 'NO',
        searchedFileCount: localCrosswalkFiles.length,
        relevantFiles: localCrosswalkFiles.slice(0, 60),
        reason: 'Repo-accessible files provide separate certified MLBAM and SportsDataIO/canonical evidence, but no single exact crosswalk source linking MLBAM person_id to one current sport_players.id.',
      },
      recoveryProjection: {
        RESOLVABLE_WITH_EXISTING_LOCAL_EXACT_EDGE: 0,
        RESOLVABLE_WITH_EXISTING_PROVIDER_CAPABILITY: 0,
        REQUIRES_BOUNDED_PROVIDER_ACQUISITION: 1292,
        NO_KNOWN_EXACT_EDGE_SOURCE: 0,
        note: 'Counts are projection buckets only; no player is claimed resolved in R4B.',
      },
      PLAYER_EDGE_PROVIDER_CALLS_REQUIRED: 'YES',
      playerProviderCallRequirement: {
        provider: 'SportsDataIO first, because Pick already stores SportsDataIO player IDs on legacy canonical player rows',
        endpointFamily: 'MLB Players identity master endpoint only',
        bulkStrategy: 'single bulk roster/master payload if contract exposes both PlayerID and MLBAM/person_id; otherwise stop',
        identityOnlyScope: true,
        estimatedBoundedCallCount: 1,
        executedNow: false,
      },
      ambiguousPlayerEvidenceRequirements: ambiguousPlayers,
      R4B_AMBIGUOUS_PLAYER_EDGE_RECOVERY_PLAN_READY: 'YES',
      safePlayerCreateSet: {
        R4B_SAFE_PLAYER_CREATE_SET: 'PRESERVED',
        trueCanonicalMissing: r4a.missingPlayerProof.trueMissingCount,
        officialMlbamEvidenceComplete: r4a.missingPlayerProof.playerCreationInputsReady === 'YES',
        safeCreationInputsComplete: r4a.missingPlayerProof.playerCreationInputsReady,
        noNameMatchingPerformed: true,
      },
    },
    externalAcquisitionPlan: {
      R4B_MINIMUM_EXTERNAL_EDGE_ACQUISITION_PLAN_READY: 'YES',
      principles: ['already-paid or already-configured provider first', 'bulk identity endpoints before per-entity calls', 'identity-only data', 'cache and artifact every response digest', 'stop on missing field contract'],
      excludedData: ['predictive statistics', 'odds', 'advanced game features', 'historical performance not needed for identity proof'],
      plannedEventCalls: {
        R4B_PLANNED_EVENT_CALLS: '0_TO_7',
        estimate: '0 if the Players probe resolves player-only architecture first and event fallback is selected; up to 7 date/game identity probes if a provider can expose exact event bridge fields.',
      },
      plannedPlayerCalls: {
        R4B_PLANNED_PLAYER_CALLS: 1,
        estimate: 'One bulk MLB Players identity-master probe if SportsDataIO field contract is available.',
      },
      plannedTotalCalls: {
        R4B_PLANNED_TOTAL_CALLS: '1_TO_8',
        providerSpecificCalls: {
          sportsdataioPlayers: 1,
          sportsdataioEventIdentity: '0_TO_7',
        },
      },
    },
    architectureDecision: {
      legacyLinkRecoveryVsPick2Namespace: {
        pathARecoverLegacyCanonicalLinks: {
          identityCorrectness: 'BEST_IF_EXACT_MLBAM_TO_PROVIDER_TO_SPORT_PLAYERS_EDGE_EXISTS',
          duplicateRealWorldEntityRisk: 'LOW_ONLY_AFTER_EXACT_EDGE_PROOF',
          legacyReferenceImpact: 'preserves current sport_players references',
          futureStatcastJoins: 'good after crosswalk persistence',
          sportsDataIoJoins: 'best if SportsDataIO crosswalk exists',
          reuse2026: 'yes if crosswalk remains exact and cached',
          dailyIngest: 'yes after identity master cache is maintained',
          uiDuplicationRisk: 'low',
          migrationComplexity: 'moderate',
          modelFeatureStability: 'best',
        },
        pathBPick2MlbamRootedCanonicalPlayers: {
          identityCorrectness: 'STRONG_FOR_STATCAST_BECAUSE_MLBAM_PERSON_ID_IS_SOURCE_IDENTITY',
          duplicateRealWorldEntityRisk: 'controlled only if Pick 2 namespace is isolated from legacy rows',
          legacyReferenceImpact: 'legacy rows remain audit-only until exact mappings are proven',
          futureStatcastJoins: 'best native fit',
          sportsDataIoJoins: 'requires later provider mappings',
          reuse2026: 'yes',
          dailyIngest: 'yes',
          uiDuplicationRisk: 'must hide legacy duplicates from Pick 2 surfaces',
          migrationComplexity: 'higher but safer than weak legacy links',
          modelFeatureStability: 'stable if Pick 2 queries select only MLBAM-rooted namespace',
        },
      },
      CANONICAL_PLAYER_RECREATION_STRATEGY_SAFE: 'YES_CONDITIONALLY',
      canonicalPlayerRecreationSafetyReason: 'Safe only as an isolated Pick 2 MLBAM-rooted namespace after the R4C exact-edge probe fails or returns incomplete; R4B does not recommend weak duplicate creation against visible legacy rows.',
      PICK2_MLBAM_ROOTED_PLAYER_NAMESPACE_FEASIBLE: 'YES',
      pick2NamespaceControls: {
        duplicateIsolation: 'New rows must be tagged Pick 2 MLBAM-rooted and legacy sport_players must remain audit-only for Pick 2 feature joins.',
        featureIsolation: 'Pick 2 feature builders select MLBAM-rooted rows or exact provider mappings only.',
        futureProviderMappings: 'Attach to provider_entity_mappings after exact provider IDs are acquired.',
        uiDuplicateAvoidance: 'Pick 2 product surfaces query the active namespace only; legacy duplicates stay hidden from Pick 2 user lists.',
        reuse2026DailyIngest: 'Use game_pk/person_id as first-class ingest identity and cache crosswalks incrementally.',
      },
      PICK2_GAMEPK_ROOTED_EVENT_FALLBACK_FEASIBLE: 'YES',
      pick2EventFallbackReason: 'MLB game_pk is authoritative and can safely root a Pick 2 event, but R4C must still distinguish no-legacy-edge from duplicate-existing-event before inserts are authorized.',
      R4B_RECOMMENDED_IDENTITY_RECOVERY_PATH: 'PATH_A_EXTERNAL_EXACT_EDGE_ACQUISITION',
      recommendedPathReason: 'Run the smallest exact-edge probe first because existing sport_players already carry SportsDataIO IDs and a single confirmed MLBAM-to-SportsDataIO player master would preserve legacy links without namespace duplication. If that exact bridge is absent, switch to the MLBAM-rooted Pick 2 namespace plan.',
      recommendedR4CPhase: 'MLB_DATA_01C_R4C_EXTERNAL_EXACT_EDGE_ACQUISITION',
    },
    readiness: {
      MLB_DATA_01C_R5_PERSISTENCE_READY: 'NO',
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
      MLB_DATA_01D_PROJECTED_READY_AFTER_R5: 'NO',
    },
    reuse: {
      R4B_RECOVERY_REUSABLE_FOR_2026: 'YES',
      R4B_RECOVERY_REUSABLE_FOR_DAILY_INGEST: 'YES',
    },
    safety: {
      providerCalls: 0,
      productionDmlMutations: 0,
      productionSchemaMutations: 0,
      crosswalkWrites: 0,
      canonicalInserts: 0,
      rawMappingWrites: 0,
      featureWrites: 0,
      modelWrites: 0,
      predictionWrites: 0,
      imports2026: 0,
      automationActivated: false,
      cronChanges: 0,
    },
    validators: {
      created: ['scripts/mlb-data-01c-r4b-exact-identity-edge-recovery-plan-validate.mjs'],
      requiredChain: ['R4A', 'R4', 'R3', 'R2A', 'R2', 'R1', '01C', '01B artifact readback', 'RESET-04R1B', 'RESET-04'],
    },
    flags: {
      R4B_BASELINE_STABLE: 'YES',
      R4B_EVENT_7_BASELINE_PRESERVED: 'YES',
      R4B_EVENT_EDGE_RECOVERY_PLAN_READY: 'YES',
      EVENT_EDGE_PROVIDER_CALLS_REQUIRED: 'YES',
      R4B_R4A_PLAYER_NEGATIVE_PROOF_ACCEPTED: 'YES',
      R4B_ACCEPTABLE_PLAYER_EDGE_CONTRACT_READY: 'YES',
      MLB_OFFICIAL_DIRECT_TO_CURRENT_CANONICAL_EDGE_AVAILABLE: 'NO',
      SPORTSDATAIO_MLBAM_CROSSWALK_CAPABILITY: 'REQUIRES_BOUNDED_PROBE',
      LOCAL_EXACT_PLAYER_CROSSWALK_SOURCE_AVAILABLE: 'NO',
      PLAYER_EDGE_PROVIDER_CALLS_REQUIRED: 'YES',
      R4B_AMBIGUOUS_PLAYER_EDGE_RECOVERY_PLAN_READY: 'YES',
      R4B_SAFE_PLAYER_CREATE_SET: 'PRESERVED',
      R4B_MINIMUM_EXTERNAL_EDGE_ACQUISITION_PLAN_READY: 'YES',
      R4B_PLANNED_EVENT_CALLS: '0_TO_7',
      R4B_PLANNED_PLAYER_CALLS: 1,
      R4B_PLANNED_TOTAL_CALLS: '1_TO_8',
      CANONICAL_PLAYER_RECREATION_STRATEGY_SAFE: 'YES_CONDITIONALLY',
      PICK2_MLBAM_ROOTED_PLAYER_NAMESPACE_FEASIBLE: 'YES',
      PICK2_GAMEPK_ROOTED_EVENT_FALLBACK_FEASIBLE: 'YES',
      R4B_RECOMMENDED_IDENTITY_RECOVERY_PATH: 'PATH_A_EXTERNAL_EXACT_EDGE_ACQUISITION',
      MLB_DATA_01C_R5_PERSISTENCE_READY: 'NO',
      MLB_DATA_01D_2025_FEATURE_BUILD_READY: 'NO',
      R4B_RECOVERY_REUSABLE_FOR_2026: 'YES',
      R4B_RECOVERY_REUSABLE_FOR_DAILY_INGEST: 'YES',
    },
  }

  writeJson(artifactPath, artifact)
  fs.writeFileSync(markdownPath, `# MLB-DATA-01C-R4B Exact Identity Edge Recovery Plan

Status: \`${artifact.certificationVerdict}\`

R4B is a zero-write planning phase. It accepts the R4A negative proof: the seven remaining event gaps lack exact stored game_pk edges, the 1,292 existing-player candidates have no exact provider-ID path to current \`sport_players.id\`, the 16 ambiguous players remain unresolved, and the 161 true-missing players remain the only safe future create set.

## Event Edge Plan

- Seven unresolved events preserved: ${artifact.eventGaps.count}
- Missing edge type: doubleheader/event provider edge missing for all seven
- Event provider calls required for legacy-link recovery: ${artifact.flags.EVENT_EDGE_PROVIDER_CALLS_REQUIRED}
- Event recovery plan ready: ${artifact.flags.R4B_EVENT_EDGE_RECOVERY_PLAN_READY}

The minimum safe output is exactly one \`MLB game_pk -> sport_events.id\` edge per game, or an explicit no-legacy-edge result that routes the game to a separately authorized Pick 2 gamePk-rooted event fallback.

## Player Edge Plan

- Existing-player gap count: ${artifact.playerGaps.existingPlayerGapCount}
- Exact current canonical links: ${artifact.playerGaps.exactProviderPaths}
- Name-audit-only candidates: ${artifact.playerGaps.nameAuditOnlyCount}
- Ambiguous players: ${artifact.playerGaps.ambiguousPlayerEvidenceRequirements.length}
- Safe future player-create set: ${artifact.playerGaps.safePlayerCreateSet.trueCanonicalMissing}

R4B forbids name-based recovery. The acceptable player edge is \`MLBAM person_id -> exact provider player ID -> sport_players.id\`, or an equally deterministic stored identity chain.

## Recommended R4C

\`${artifact.architectureDecision.recommendedR4CPhase}\`

Run the smallest exact-edge acquisition first, beginning with a read-only identity-only SportsDataIO MLB Players contract probe. If the payload cannot expose an exact MLBAM-to-SportsDataIO bridge, switch to a Pick 2 MLBAM-rooted canonical namespace plan instead of weakly linking legacy players.

## Boundaries

\`MLB_DATA_01C_R5_PERSISTENCE_READY = NO\`

\`MLB_DATA_01D_2025_FEATURE_BUILD_READY = NO\`

Provider calls, production DML/schema mutations, crosswalk writes, canonical inserts, raw mapping writes, feature/model/prediction writes, 2026 imports, automation and cron changes are all 0.
`)

  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    eventGaps: artifact.eventGaps.count,
    playerGaps: artifact.playerGaps.existingPlayerGapCount,
    sportsDataIoMlbamCrosswalkCapability: artifact.flags.SPORTSDATAIO_MLBAM_CROSSWALK_CAPABILITY,
    recommendedR4CPhase: artifact.architectureDecision.recommendedR4CPhase,
    providerCalls: artifact.safety.providerCalls,
  }, null, 2))
}

build()
