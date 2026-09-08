// Audit/preview only. This module has no database or provider client.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

export const PROJECT = 'MLB_DATA_02R_R2T_R2A_NATIVE_SAME_GAME_EVIDENCE_RECOVERY_AND_REPAIR_PLAN'
const PRIOR = 'docs/CERTIFICATION/MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION.json'
const CACHE = 'docs/CERTIFICATION/mlb-data-01c-r3-acquisition-cache.json'
const MAPPING = 'docs/CERTIFICATION/mlb-data-01c-2025-canonical-mapping.json'
const TABLE = 'public.pick2_mlb_games'
const labels = {
  A: 'RECOVERABLE_FROM_CANONICAL_EXISTING_DATA', B: 'RECOVERABLE_FROM_PERSISTED_SOURCE_METADATA',
  C: 'RECOVERABLE_FROM_EXISTING_CACHE', D: 'REQUIRES_FUTURE_AUTHORITATIVE_PROVIDER_READ',
  E: 'IRRECOVERABLE_WITH_CURRENT_EVIDENCE', F: 'CONFLICT_REQUIRES_MANUAL_REVIEW',
}
const get = (row, key) => key.split('.').reduce((value, part) => value?.[part], row)
const own = (row, key) => { const parts = key.split('.'); const last = parts.pop(); const parent = parts.reduce((value, part) => value?.[part], row); return parent != null && Object.hasOwn(parent, last) }
const types = {
  home_team_id: 'text FK sports_teams.id', away_team_id: 'text FK sports_teams.id', game_type: 'MLB Official gameType string; R1 accepts R only',
  'metadata.officialDate': 'MLB Official YYYY-MM-DD date', 'metadata.abstractGameState': 'verbatim MLB Official abstractGameState string',
  'metadata.homeProbablePitcher.id': 'positive MLBAM integer', 'metadata.awayProbablePitcher.id': 'positive MLBAM integer',
  game_pk: 'positive bigint primary key', scheduled_at: 'timestamptz', game_date: 'date', doubleheader: 'N/Y/S string',
  game_number: 'positive integer', source_payload_digest: 'SHA-256 text', season: 'integer', official_status: 'verbatim detailed MLB status text',
  source: 'provider text', created_at: 'timestamptz', updated_at: 'timestamptz',
}

export function validatePreviewMutation(mutation, native) {
  assert.equal(mutation.table, TABLE, 'UNEXPECTED_TABLE')
  assert.equal(mutation.rowIdentity.game_pk, native.game_pk, 'GAME_SCOPE')
  assert.equal(mutation.evidenceSource.gamePk, native.game_pk, 'SAME_GAME_EVIDENCE_REQUIRED')
  assert.equal(mutation.preconditions.expectedNativeRowDigest, sha256(native), 'ROW_CHANGED_REVIEW_REQUIRED')
  assert.equal(mutation.preconditions.expectedSourcePayloadDigest, native.source_payload_digest, 'SOURCE_CHANGED')
  assert.equal(mutation.executed, false, 'PREVIEW_ONLY')
  assert.ok(mutation.newValue != null, 'UNRESOLVED_VALUE_NOT_A_MUTATION')
  if (mutation.column === 'metadata') {
    assert.ok(mutation.jsonPath?.length === 1 && ['homeProbablePitcher', 'awayProbablePitcher'].includes(mutation.jsonPath[0]), 'UNEXPECTED_METADATA_TARGET')
    assert.ok(!Object.hasOwn(native.metadata, mutation.jsonPath[0]), 'IMMUTABLE_CONFLICT')
    assert.deepEqual(mutation.newValue, native.metadata.starter_evidence[mutation.jsonPath[0]], 'SAME_GAME_STARTER_REQUIRED')
    assert.ok(Number.isSafeInteger(mutation.newValue.id) && mutation.newValue.id > 0, 'UNKNOWN_STARTER')
  } else {
    assert.ok(['home_team_id', 'away_team_id'].includes(mutation.column), 'UNEXPECTED_COLUMN')
    assert.equal(native[mutation.column], null, 'IMMUTABLE_CONFLICT')
    assert.equal(mutation.newValue, mutation.evidenceSource.canonicalId, 'ALIAS_EVIDENCE_MISMATCH')
    const side = mutation.column.startsWith('home') ? 'home' : 'away'
    assert.equal(mutation.evidenceSource.officialId, native.metadata.mlb_official_identity[`${side}_mlb_team_id`], 'SAME_GAME_TEAM_ID_REQUIRED')
  }
  return true
}

// Entity translation only: current game's exact official team ID selects a
// cached team entity, then the EXISTING 01C canonical alias and DB crosswalk.
// No other game's teams, date, state, type or starter assignment is copied.
export function aliasProposal(native, side, cache, mapping, search) {
  const officialId = native.metadata?.mlb_official_identity?.[`${side}_mlb_team_id`]
  if (!Number.isSafeInteger(officialId) || officialId <= 0) return { category: 'D', reason: 'SAME_GAME_OFFICIAL_TEAM_ID_MISSING', value: null }
  const entities = []
  for (const [cacheKey, record] of Object.entries(cache.gameIdentities)) {
    if (record.provider !== 'mlb_stats_api' || !record.responseDigest || !record.retrievedAt) continue
    for (const entitySide of ['home', 'away']) {
      const entity = record[entitySide]
      if (Number(entity?.id) === officialId) entities.push({ entity, cacheKey, entitySide, retrievedAt: record.retrievedAt, responseDigest: record.responseDigest })
    }
  }
  if (!entities.length) return { category: 'D', reason: 'EXISTING_TEAM_ALIAS_EVIDENCE_ABSENT', value: null }
  const abbreviations = [...new Set(entities.map((row) => row.entity.abbreviation))]
  if (abbreviations.length !== 1 || !abbreviations[0]) return { category: 'F', reason: 'OFFICIAL_ENTITY_ALIAS_CONFLICT', value: null }
  const abbreviation = abbreviations[0]
  const catalog = mapping.teamCanonicalInventory
  const canonicalAbbreviation = catalog.sourceAliases[abbreviation] ?? abbreviation
  const entries = catalog.teams.filter((row) => row.canonicalAbbreviation === canonicalAbbreviation && row.classification === 'MAPPED')
  const ids = [...new Set(entries.map((row) => row.canonicalTeamId))]
  if (ids.length !== 1) return { category: 'F', reason: 'CANONICAL_ALIAS_NOT_UNIQUE', value: null }
  const canonical = search.sources.canonicalTeams.rows.find((row) => row.id === ids[0])
  const crosswalks = search.sources.teamCrosswalks.rows.filter((row) => row.internal_id === ids[0] && row.provider === 'sportsdataio' && row.provider_id === canonical?.provider_ids?.sportsdataio)
  if (!canonical || crosswalks.length !== 1) return { category: 'F', reason: 'EXISTING_CANONICAL_CROSSWALK_NOT_UNIQUE', value: null }
  const representative = entities.sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt) || a.cacheKey.localeCompare(b.cacheKey))[0]
  return { category: 'C', value: ids[0], reason: 'EXACT_SAME_GAME_OFFICIAL_ID_THROUGH_EXISTING_ENTITY_ALIAS_AND_CANONICAL_CROSSWALK',
    evidence: { gamePk: native.game_pk, sameGameField: `metadata.mlb_official_identity.${side}_mlb_team_id`, officialId,
      sameGameSourceDigest: native.source_payload_digest, sameGameObservedNoLaterThan: native.updated_at,
      cachedEntityPath: `${CACHE}#gameIdentities.${representative.cacheKey}.${representative.entitySide}`, cachedEntity: representative.entity,
      cachedEntityObservation: representative.retrievedAt, cacheResponseDigest: representative.responseDigest,
      entityObservationsAgree: entities.length, canonicalMapping: `${MAPPING}#teamCanonicalInventory`,
      canonicalAbbreviation, canonicalId: canonical.id, existingCrosswalkId: crosswalks[0].id,
      canonicalMetadataFlags: { validation_status: canonical.metadata?.validation_status, production_eligible: canonical.metadata?.production_eligible },
      scope: 'Existing ID translation only; no promotion of quarantined provider statistics, no new identity or copied game participation' } }
}

export function buildRepairPlan({ prior, search, cache, mapping }) {
  const games = search.sources.native.rows
  const expected = prior.nativeFieldGapInventory.currentRows.map((row) => row.game_pk).sort((a, b) => a - b)
  assert.deepEqual(games.map((row) => row.game_pk).sort((a, b) => a - b), expected, 'EXACT_15_GAME_SCOPE')
  assert.ok(Object.values(search.sources).every((s) => ['FOUND', 'EMPTY'].includes(s.status)), 'SOURCE_SEARCH_INCOMPLETE')
  assert.equal(prior.storedOutputParity.status, 'PASS', 'PRESERVE_STORED_PARITY')
  assert.equal(cache.provider, 'mlb_stats_api')
  const definitions = prior.nativeFieldGapInventory.fields
  assert.equal(definitions.length, 18)
  const inventory = [], mutations = [], affectedGames = [], aliases = [], starterPlans = []
  for (const native of [...games].sort((a, b) => a.game_pk - b.game_pk)) {
    const proposedAliases = Object.fromEntries(['home', 'away'].map((side) => [side, aliasProposal(native, side, cache, mapping, search)]))
    aliases.push(...Object.entries(proposedAliases).map(([side, proposal]) => ({ gamePk: native.game_pk, side, ...proposal })))
    const perGame = []
    for (const definition of definitions) {
      const field = definition.field, present = own(native, field), currentValue = get(native, field) ?? null
      const isGap = !present || currentValue === null
      let category = null, proposedValue = currentValue, gapStatus = isGap ? present ? 'NULL' : 'MISSING' : null
      let reason = 'Existing same-game native value retained; no repair required'
      let evidence = { table: TABLE, gamePk: native.game_pk, field, source: native.source,
        sourcePayloadDigest: native.source_payload_digest, observedNoLaterThan: native.updated_at }
      if (isGap && ['home_team_id', 'away_team_id'].includes(field)) {
        const proposal = proposedAliases[field.startsWith('home') ? 'home' : 'away']
        category = proposal.category; proposedValue = proposal.value; reason = proposal.reason
        evidence = proposal.evidence ?? evidence
        gapStatus = category === 'F' ? 'CONFLICTING' : category === 'C' ? 'ALIAS_ONLY' : gapStatus
      } else if (isGap && field.includes('ProbablePitcher')) {
        const side = field.includes('home') ? 'home' : 'away'
        const source = native.metadata?.starter_evidence?.[`${side}ProbablePitcher`]
        category = Number.isSafeInteger(source?.id) && source.id > 0 ? 'B' : 'D'
        proposedValue = category === 'B' ? source.id : null
        reason = category === 'B' ? 'Copy the same-game stored probable-pitcher metadata; never relabel confirmed' : 'Same-game stored probable pitcher is null; authoritative future observation required'
        evidence = { ...evidence, field: `metadata.starter_evidence.${side}ProbablePitcher`, value: source ?? null,
          sourceTimestamp: null, timestampSemantics: 'Database persisted-observation upper bound; provider publication time was not stored' }
        starterPlans.push({ gamePk: native.game_pk, side, classification: category === 'B' ? 'PROBABLE' : 'UNKNOWN', mlbamPitcherId: proposedValue,
          observedNoLaterThan: native.updated_at, scheduledAt: native.scheduled_at,
          observedBeforeScheduledStart: Date.parse(native.updated_at) < Date.parse(native.scheduled_at),
          historicalRunAsOfEligibility: 'Not claimed. Require source observation <= the intended run_as_of; future observations cannot be backdated.',
          changedStarterRule: 'A different subsequent pitcher is CHANGED evidence, requiring a new snapshot/run and reconciliation; never overwrite frozen pregame history' })
      } else if (isGap) {
        category = 'D'; proposedValue = null
        reason = 'No allowed same-game source contains the omitted provider field; request future authoritative evidence without backdating'
      }
      const mutableStatus = ['official_status', 'metadata.abstractGameState', 'scheduled_at'].includes(field)
      const policy = mutableStatus ? 'MUTABLE_STATUS_FIELD' : isGap ? category === 'F' ? 'IMMUTABLE_CONFLICT' : category === 'D' ? 'UNKNOWN' : 'SAFE_CANONICAL_ENRICHMENT' : 'IMMUTABLE_CONFLICT'
      const necessity = !isGap ? 'NO_REPAIR_REQUIRED' : category === 'F' ? 'MANUAL_REVIEW_REQUIRED' : category === 'D' || category === 'E' ? 'PROVIDER_RECOVERY_REQUIRED' : 'DATA_REPAIR_REQUIRED'
      const cell = { gamePk: native.game_pk, physicalTable: TABLE, physicalColumn: field.split('.')[0], jsonPath: field.includes('.') ? field.split('.').slice(1) : null,
        logicalField: field, currentValue, valueState: present ? currentValue === null ? 'NULL' : 'PRESENT_VALID' : 'MISSING',
        requiredValueType: types[field], consumer: definition.consumer, whyRequired: definition.consumer,
        isGap, gapStatus, recoveryCategory: category, recoveryClassification: category ? labels[category] : 'NO_GAP',
        proposedValue, evidence, reason, repairNecessity: necessity, mutationPolicy: policy,
        mutationPolicyMeaning: !isGap && !mutableStatus ? 'Present canonical value is retained. A proposed replacement would be an immutable conflict; no actual conflict or mutation is claimed.' : 'Null/absent enrichment requires exact source proof; mutable status changes require a new timestamped observation and separate authorization.',
        futureAction: !isGap ? 'NO_MUTATION' : category === 'B' ? 'METADATA_ENRICHMENT_PREVIEW_ONLY' : category === 'C' ? 'BOUNDED_UPDATE_PREVIEW_ONLY' : 'NO_MUTATION_UNTIL_EVIDENCE_REVIEW' }
      inventory.push(cell); perGame.push(cell)
      if (isGap && ['A', 'B', 'C'].includes(category)) {
        const metadata = field.includes('.')
        const side = field.includes('home') ? 'home' : 'away'
        mutations.push({ table: TABLE, rowIdentity: { game_pk: native.game_pk }, column: metadata ? 'metadata' : field,
          jsonPath: metadata ? [`${side}ProbablePitcher`] : null, logicalField: field,
          oldValue: metadata ? native.metadata?.[`${side}ProbablePitcher`] ?? null : currentValue,
          oldValueState: metadata ? 'MISSING_KEY' : 'NULL',
          newValue: metadata ? structuredClone(native.metadata.starter_evidence[`${side}ProbablePitcher`]) : proposedValue,
          evidenceSource: evidence, evidenceTimestamp: native.updated_at, reason,
          mutationType: metadata ? 'METADATA_ENRICHMENT' : 'BOUNDED_UPDATE',
          preconditions: { exactGamePk: native.game_pk, expectedSourcePayloadDigest: native.source_payload_digest, expectedNativeRowDigest: sha256(native),
            expectedOldValue: metadata ? 'JSON_KEY_ABSENT' : 'SQL_NULL', conflictAction: 'ABORT_ROW_AND_REVIEW; never overwrite non-null or changed state' },
          executed: false })
      }
    }
    affectedGames.push({ gamePk: native.game_pk, gameDate: native.game_date, scheduledAt: native.scheduled_at,
      utcDate: native.scheduled_at.slice(0, 10), puertoRicoDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico' }).format(new Date(native.scheduled_at)),
      dateRule: 'UTC/PR dates are explanatory only; neither fills missing MLB officialDate. Doubleheaders/reschedules require the exact same game_pk/gameNumber observation.',
      homeIdentity: { current: native.home_team_id, officialId: native.metadata.mlb_official_identity.home_mlb_team_id, proposedCanonical: proposedAliases.home.value },
      awayIdentity: { current: native.away_team_id, officialId: native.metadata.mlb_official_identity.away_mlb_team_id, proposedCanonical: proposedAliases.away.value },
      gameType: native.game_type, officialStatus: native.official_status, abstractGameState: native.metadata.abstractGameState ?? null,
      doubleheader: native.doubleheader, gameNumber: native.game_number, starterIdentities: native.metadata.starter_evidence,
      affectedFields: perGame.filter((row) => row.isGap).map((row) => row.logicalField),
      sourcePayloadDigest: native.source_payload_digest, observationTimestamp: native.updated_at,
      dateRecovery: 'PARTIAL: native game_date/scheduled_at present; omitted officialDate needs same-game evidence',
      gameTypeRecovery: 'BLOCKED: no default R', statusRecovery: 'PARTIAL: detailed Scheduled present; abstract state absent',
      reschedulePolicy: 'No reschedule inferred. Future conflicting date/time/game number requires review; retain original observation and frozen feature history.' })
  }
  const gaps = inventory.filter((row) => row.isGap)
  const classifications = Object.fromEntries(Object.entries(labels).map(([key, label]) => [key, { label, count: gaps.filter((row) => row.recoveryCategory === key).length }]))
  return { project: PROJECT, certificationVerdict: `${PROJECT}_CERTIFIED`, scope: 'READ_ONLY_AUDIT_AND_PREVIEW_PLAN_ONLY; data remains unrepaired; R2T-R2 persistence not resumed',
    generatedAt: new Date().toISOString(), priorPackageSha: '6f782635304815e2e0dcafe6e326e5059c3dea4d',
    newPackageSha: 'ENCLOSING_LOCAL_COMMIT: resolve git log -1 --format=%H -- docs/CERTIFICATION/' + PROJECT + '.json',
    scopeClarification: { fieldCatalog: 18, games: games.length, cells: inventory.length, actualGapCells: gaps.length, presentCells: inventory.length - gaps.length,
      note: 'The prior report listed 18 required fields, not 18 missing cells. Valid present fields are not mislabeled missing.' },
    fieldCatalog: definitions.map((row) => ({ field: row.field, requiredType: types[row.field], consumer: row.consumer })),
    exactInventory: inventory, affectedGames, recoveryClassifications: classifications, aliasRecovery: aliases, starterRecovery: starterPlans,
    futureDmlPlan: { status: 'READY_PREVIEW_ONLY', authorized: false, mutations,
      exactMaximumRowUpdates: new Set(mutations.map((row) => row.rowIdentity.game_pk)).size, exactMaximumLogicalFieldPatches: mutations.length,
      batching: 'Coalesce approved field patches into at most one conditional UPDATE per game_pk; do not execute this plan as one UPDATE per field.',
      inserts: 0, deletes: 0, ddl: 0, providerDependentPatchesExcluded: gaps.filter((row) => row.recoveryCategory === 'D').length,
      rule: 'Only known new values are proposed. Provider-dependent fields are excluded, not filled with null placeholders or season/date guesses. Re-read and compare the full original row digest before any future mutation.',
      preserve: ['all unlisted metadata', 'source_payload_digest', 'created_at', 'starter_evidence', 'all snapshots', 'all predictions', 'Official Picks', 'settlement/replay history'],
      timestampPolicy: 'Never backdate updated_at or represent the repair time as original evidence time. Preserve this audited source observation separately from any future write timestamp.',
      postRepairRule: 'Re-read exact native fields and FK targets; re-run R1 binding only. Partial enrichment does not clear remaining provenance blockers.' },
    sourceSearch: { ...search, sourceTables: {
      native: 'pick2_mlb_games', raw: 'pick2_raw_mlb_statcast_pitches', snapshots: 'pick2_feature_snapshots',
      team: 'pick2_mlb_team_daily_features', starter: 'pick2_mlb_pitcher_daily_features', bullpen: 'pick2_mlb_bullpen_daily_features',
      batter: 'pick2_mlb_batter_daily_features', matchup: 'pick2_mlb_matchup_daily_features', firstInning: 'pick2_mlb_first_inning_daily_features',
      marketMappings: 'pick2_mlb_market_event_mappings', predictions: 'pick2_game_predictions', results: 'pick2_mlb_game_results',
      pitcherRollups: 'mlb_statcast_pitcher_game_logs', batterRollups: 'mlb_statcast_batter_game_logs',
      teamCrosswalks: 'provider_entity_mappings', canonicalTeams: 'sports_teams', eventCrosswalks: 'provider_entity_mappings',
      exactEvents: 'sport_events', eventWindow: 'sport_events', contextWindow: 'mlb_context_snapshots',
    }, sources: Object.fromEntries(Object.entries(search.sources).map(([name, value]) => [name, { ...value, rows: name === 'native' || name === 'snapshots' ? value.rows : undefined }])) },
    localSources: { cache: CACHE, mapping: MAPPING, cacheSha256: sha256(cache), mappingSha256: sha256(mapping),
      exactAffectedGamesInCache: Object.values(cache.gameIdentities).filter((row) => expected.includes(Number(row.gamePk))).length,
      mappingScope: '01C whole phase was BLOCKED on other identities; its team MAPPED entries are rechecked against current canonical rows/crosswalks. No phase-wide certification is inferred.',
      excludedDirectories: ['.tmp/', '.worktrees/'], cacheLimitation: 'User-protected directories were not inspected; no claim of an exhaustive search inside them. Recovery categories refer to allowed evidence.' },
    snapshotRejection: { id: search.sources.snapshots.rows[0]?.id ?? null, reason: 'Existing prediction_bundle has digest-only features and empty native_identity_metadata; not authoritative MLB schedule evidence. No mutation proposed.' },
    noCrossGameInference: { status: 'PASS', gameStateSources: 'Only the exact native game_pk observation is used for participation, date/time, status and starter state.',
      identityTranslation: 'Cached official team entity aliases only translate the exact official ID already recorded on the target game. No team/date matching or other-game state is used.',
      excluded: ['neighboring game dates', 'season implies R', 'Scheduled implies Preview', 'another game starter', 'derived snapshot dates as provider evidence', 'date/team fuzzy event matching'] },
    temporalPolicy: { frozenPriorParityAsOf: prior.storedOutputParity.stored.metadata.as_of, priorParityRerun: false,
      originalAffectedRunAsOf: null, eligibility: 'Original affected-run freeze was not established by this audit. An observation is eligible only for an explicitly supplied run_as_of at or after its recorded upper bound and before first pitch.',
      futureProviderRule: 'New MLB Official observations establish state only at their actual observed_at. They cannot certify historical pregame state unless an authoritative timestamped archive independently proves it.' },
    resumePlan: ['Preserve completed stored parity and Champion/76-feature/preprocessing hashes; do not rerun parity unless those inputs or source ordering change.',
      'Resolve outstanding same-game provider evidence through a separately authorized bounded read; no full-season fetch, odds or Statcast acquisition is part of this plan.',
      'Separately authorize any exact known-value enrichment after old-value/digest review; this plan authorizes no DML.',
      'Revalidate R2T-R2 Gate 4 with same-game provenance and individually block UNKNOWN/CHANGED starters; reject conflicting reschedules.',
      'Resume R2T-R2 at Gate 5: real snapshot persistence, then six domains, FK/readback/inference, all-game/downstream integration, checkpoint/resume and idempotency.',
      'Keep LIVE_EXECUTE contained throughout. Only full R2T-R2 certification can lead to separate R3 re-enablement certification.'],
    boundaries: { providerCalls: 0, productionDml: 0, productionDdl: 0, liveExecuteEnabled: false, liveRefresh: false, persistenceResumed: false, training: 0, championChanges: 0, automationChanges: 0, cronChanges: 0, settlement: 0 },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.ok(process.env.R2S_VALIDATION_DIR, 'ISOLATED_OUTPUT_REQUIRED')
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
  const report = buildRepairPlan({ prior: read(PRIOR), search: read(path.join(process.env.R2S_VALIDATION_DIR, 'native-source-search.json')), cache: read(CACHE), mapping: read(MAPPING) })
  fs.writeFileSync(path.join(process.env.R2S_VALIDATION_DIR, 'repair-plan.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ verdict: report.certificationVerdict, scope: report.scopeClarification, classification: report.recoveryClassifications, rowCap: report.futureDmlPlan.exactMaximumRowUpdates, fieldCap: report.futureDmlPlan.exactMaximumLogicalFieldPatches }))
}
