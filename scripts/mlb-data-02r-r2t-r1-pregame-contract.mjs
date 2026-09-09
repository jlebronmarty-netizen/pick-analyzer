import { scanRawRows, updateStatsFromGame, addDailyRows } from './mlb-data-02h-2026-current-foundation.mjs'
import { buildVector } from './mlb-data-02f-moneyline-prediction-generation-prep.mjs'
import { featureManifest, inferChampion, FEATURE_SET, FEATURE_VERSION, FEATURE_TABLES } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

export const CONTRACT = 'MLB_02R_R2T_R1_PREGAME_EVIDENCE_V1'
const ensure = (condition, code) => { if (!condition) throw new Error(`R2TR1_BLOCK:${code}`) }
const time = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const id = (value) => Number.isSafeInteger(value) && value > 0
const day = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') && time(`${value}T00:00:00Z`) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const before = (value, upper) => time(value) && Date.parse(value) <= Date.parse(upper)
const previousDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
export function operatingDate(timestamp) {
  ensure(time(timestamp), 'INVALID_ASOF')
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp))
}

export function resolvePregameTarget({ native, runAsOf, eligibleGamePks, mode = 'PRODUCTION' }) {
  ensure(['PRODUCTION', 'TEST'].includes(mode), 'MODE')
  ensure(time(runAsOf), 'RUN_ASOF')
  ensure(id(native?.game_pk) && eligibleGamePks?.includes(native.game_pk), 'GAME_SCOPE')
  ensure(day(native.game_date) && native.metadata?.officialDate === native.game_date, 'OFFICIAL_DATE')
  ensure(native.season === 2026 && native.game_date.startsWith('2026-'), 'CERTIFIED_BUILDER_SEASON')
  ensure(time(native.scheduled_at) && Date.parse(native.scheduled_at) > Date.parse(runAsOf), 'STARTED_GAME')
  ensure(native.home_team_id && native.away_team_id && native.home_team_id !== native.away_team_id, 'NATIVE_TEAM_IDENTITY')
  ensure(native.game_type === 'R', 'GAME_TYPE')
  ensure(['N', 'Y', 'S'].includes(native.doubleheader) && id(native.game_number), 'DOUBLEHEADER_IDENTITY')
  ensure(['Scheduled', 'Pre-Game', 'Warmup'].includes(native.official_status) && native.metadata?.abstractGameState === 'Preview', 'PREGAME_STATUS')
  ensure(native.source === 'mlb_official' || (mode === 'TEST' && native.source === 'INJECTED_TEST'), 'TARGET_SOURCE')
  ensure(native.source_payload_digest && before(native.created_at, runAsOf) && before(native.updated_at, runAsOf), 'TARGET_OBSERVATION_ASOF')
  ensure(Date.parse(native.updated_at) >= Date.parse(native.created_at), 'TARGET_OBSERVATION_ORDER')
  const performanceCutoff = [native.game_date, operatingDate(runAsOf)].sort()[0]
  return { contract: CONTRACT, mode, gamePk: native.game_pk, gameDate: native.game_date, scheduledAt: native.scheduled_at,
    homeTeamId: native.home_team_id, awayTeamId: native.away_team_id, gameType: native.game_type,
    doubleheader: native.doubleheader, gameNumber: native.game_number, runAsOf,
    performanceCutoff, asOfDate: previousDay(performanceCutoff), eligibleGamePks: [...eligibleGamePks].sort((a, b) => a - b),
    pregameStatus: 'PREGAME_SAFE_FROZEN', source: 'public.pick2_mlb_games', sourceRowId: native.game_pk,
    sourceDigest: native.source_payload_digest, observationTimestamp: native.updated_at,
    timestampSemantics: 'persisted observation upper bound; not a fabricated provider publication timestamp', native }
}

export function resolveStarterContext(target, candidates = null) {
  const evidence = candidates ?? ['home', 'away'].map((side) => ({ game_pk: target.gamePk,
    team_id: target[`${side}TeamId`], mlbam_pitcher_id: target.native.metadata?.[`${side}ProbablePitcher`]?.id ?? null,
    status: target.native.metadata?.[`${side}ProbablePitcher`]?.id ? 'PROBABLE' : 'UNKNOWN',
    source: target.mode === 'TEST' ? 'INJECTED_TEST' : 'MLB_OFFICIAL_SCHEDULE',
    source_timestamp: target.observationTimestamp, observed_at: target.observationTimestamp, as_of: target.runAsOf }))
  for (const row of evidence) {
    ensure(row.game_pk === target.gamePk && [target.homeTeamId, target.awayTeamId].includes(row.team_id), 'STARTER_GAME_TEAM_LINKAGE')
    ensure(['MLB_OFFICIAL_SCHEDULE', 'CANONICAL_CONFIRMED_STARTER'].includes(row.source) || (target.mode === 'TEST' && row.source === 'INJECTED_TEST'), 'STARTER_SOURCE')
    ensure(before(row.source_timestamp, target.runAsOf) && before(row.observed_at, target.runAsOf) && before(row.as_of, target.runAsOf), 'STARTER_ASOF')
    ensure(before(row.source_timestamp, row.observed_at) && before(row.observed_at, row.as_of), 'STARTER_TIMESTAMP_ORDER')
    ensure(['CONFIRMED', 'PROBABLE', 'UNKNOWN', 'CHANGED'].includes(row.status), 'STARTER_STATUS')
  }
  const selected = {}
  for (const side of ['home', 'away']) {
    const rows = evidence.filter((row) => row.team_id === target[`${side}TeamId`]).sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at))
    ensure(rows.length, 'STARTER_MISSING')
    const latest = rows[0]
    ensure(latest.status !== 'CHANGED', 'STARTER_CHANGED')
    ensure(latest.status !== 'UNKNOWN' && id(latest.mlbam_pitcher_id), 'STARTER_MISSING')
    const frozenPitcher = target.native.metadata?.[`${side}ProbablePitcher`]?.id
    ensure(!frozenPitcher || frozenPitcher === latest.mlbam_pitcher_id, 'STARTER_CHANGED')
    const contemporaneous = rows.filter((row) => Date.parse(row.observed_at) === Date.parse(latest.observed_at))
    ensure(contemporaneous.every((row) => row.mlbam_pitcher_id === latest.mlbam_pitcher_id && !['UNKNOWN', 'CHANGED'].includes(row.status)), 'STARTER_CONFLICT')
    // Confirmed outranks probable only within the latest observation. An older
    // confirmed assignment cannot override a later probable replacement.
    selected[side] = contemporaneous.find((row) => row.status === 'CONFIRMED') ?? latest
  }
  ensure(selected.home.mlbam_pitcher_id !== selected.away.mlbam_pitcher_id, 'STARTER_TEAM_CONFLICT')
  return selected
}

export function resolveLineupContext(target, evidence = null, { required = false } = {}) {
  if (!evidence || evidence.status === 'NO_LINEUP_EVIDENCE') {
    ensure(!required, 'LINEUP_REQUIRED')
    return { status: 'NO_LINEUP_EVIDENCE', relevantBatters: [], vectorDependentFeatures: 0,
      policy: 'OTHER_CERTIFIED_BEHAVIOR', rule: '02H future_schedule_no_lineup: no batter rows and empty first-inning lineup; moneyline V1 does not consume lineup inputs' }
  }
  ensure(['CONFIRMED_LINEUP', 'PROJECTED_LINEUP'].includes(evidence.status), 'LINEUP_STATUS')
  ensure(evidence.game_pk === target.gamePk && before(evidence.source_timestamp, target.runAsOf) && before(evidence.observed_at, target.runAsOf), 'LINEUP_ASOF_LINKAGE')
  ensure(evidence.source === 'MLB_OFFICIAL' || (target.mode === 'TEST' && evidence.source === 'INJECTED_TEST'), 'LINEUP_SOURCE')
  ensure(Array.isArray(evidence.batters) && evidence.batters.length > 0 && evidence.batters.every((row) => id(row.mlbam_batter_id) && [target.homeTeamId, target.awayTeamId].includes(row.team_id)), 'BATTER_MISSING')
  ensure(new Set(evidence.batters.map((row) => row.mlbam_batter_id)).size === evidence.batters.length, 'BATTER_DUPLICATE')
  // No projected-lineup provider/model is certified for required inputs in V1.
  ensure(!required || evidence.status === 'CONFIRMED_LINEUP', 'PROJECTED_LINEUP_NOT_CERTIFIED_FOR_REQUIRED_INPUT')
  return { ...evidence, relevantBatters: [], observedBatterIds: evidence.batters.map((row) => row.mlbam_batter_id),
    vectorDependentFeatures: 0, policy: 'OTHER_CERTIFIED_BEHAVIOR', rule: 'audited context only; no extra V1 numeric feature or future batter persistence is implied' }
}

export function resolveFeatureEntities(target, starters, lineup) {
  ensure(starters.home.game_pk === target.gamePk && starters.away.game_pk === target.gamePk, 'ENTITY_GAME_LINKAGE')
  return { gamePk: target.gamePk, teams: [target.homeTeamId, target.awayTeamId],
    starters: [starters.home.mlbam_pitcher_id, starters.away.mlbam_pitcher_id], relevantBatters: lineup.relevantBatters,
    bullpenTeams: [target.homeTeamId, target.awayTeamId], matchupGame: target.gamePk, firstInningGame: target.gamePk }
}

export function pregameFeatureSourceMatrix() {
  return featureManifest().map((entry) => ({ ...entry, physicalSource: FEATURE_TABLES[entry.domain] ?? 'certified_home_field_constant',
    builder: entry.domain === 'certified_definition' ? 'certified manifest constant' : '02H addDailyRows(false) -> 02F buildVector',
    rowSelectionKey: entry.domain === 'starter' ? '(target_game_pk, mlbam_pitcher_id, feature_version)' : entry.domain === 'certified_definition' ? 'MLB_ML_FEATURE_SET_V1:index75' : '(target_game_pk, team_id, feature_version)',
    entityIds: entry.domain === 'starter' ? 'provenance-resolved home/away MLBAM starter IDs' : entry.domain === 'certified_definition' ? [] : 'canonical home/away team IDs',
    requiredAsOf: 'source_game_date < min(target official date, run operating date); observed/ingested/created timestamps <= run_as_of < first pitch',
    missingDataRule: 'missing entity/row/field blocks; explicit legitimate null uses certified median; nonfinite blocks',
    starterDependency: entry.domain === 'starter', lineupDependency: false, startingLineup: false, expectedLineup: false,
    individualBatterIdentity: false, lineupComposition: false, recentBatterState: false,
    safetyRule: 'No target-game performance rows, no same-day performance, no post-asof evidence' }))
}

export const MISSING_EVIDENCE_POLICY = Object.freeze({
  starterUnknown: 'BLOCK_GAME', starterChanged: 'BLOCK_GAME',
  lineupUnavailableForMoneylineV1: 'OTHER_CERTIFIED_BEHAVIOR: no lineup inputs; empty batter domain',
  lineupUnavailableWhereRequired: 'BLOCK_GAME', requiredBatterMissing: 'BLOCK_GAME',
  requiredFeatureRowAbsent: 'BLOCK_GAME', staleFeatureRow: 'BLOCK_GAME', postStartSource: 'BLOCK_GAME',
  explicitNullableNumericValue: 'ALLOW_WITH_CERTIFIED_IMPUTATION',
  projectedLineup: 'OTHER_CERTIFIED_BEHAVIOR: context only; not certified for required numeric inputs',
})

export function expandAllGameTargets(contexts) {
  const unique = new Map()
  for (const context of contexts) {
    const identity = context.target.gamePk
    ensure(!unique.has(identity), 'DUPLICATE_TARGET_GAME')
    unique.set(identity, context)
  }
  const targets = { snapshots: [], team: [], starter: [], bullpen: [], batter: [], matchup: [], firstInning: [] }
  for (const { target, starters } of [...unique.values()].sort((a, b) => a.target.gamePk - b.target.gamePk)) {
    for (const [domain, entities] of [['team', [target.homeTeamId, target.awayTeamId]], ['starter', [starters.home.mlbam_pitcher_id, starters.away.mlbam_pitcher_id]], ['bullpen', [target.homeTeamId, target.awayTeamId]]]) {
      for (const entity of entities) {
        targets[domain].push({ gamePk: target.gamePk, entity, featureVersion: FEATURE_VERSION })
        targets.snapshots.push({ gamePk: target.gamePk, family: domain, entity })
        if (domain === 'team') targets.snapshots.push({ gamePk: target.gamePk, family: 'offense', entity })
      }
    }
    for (const domain of ['matchup', 'firstInning']) {
      targets[domain].push({ gamePk: target.gamePk, featureVersion: FEATURE_VERSION })
      targets.snapshots.push({ gamePk: target.gamePk, family: domain, entity: target.gamePk })
    }
  }
  return { targets, maximumCandidateCaps: Object.fromEntries(Object.entries(targets).map(([domain, rows]) => [domain, rows.length])),
    writeCapRule: 'future per-domain insert cap equals INSERT_ELIGIBLE count after canonical snapshot resolution; REUSE_NO_OP consumes zero; any BLOCK_CONFLICT stops' }
}

export function buildPregameFeatureRows({ target, starters, rawRows, dependencyGamePks }) {
  ensure(rawRows?.length && dependencyGamePks?.length, 'RAW_HISTORY_MISSING')
  const allowed = new Set(dependencyGamePks)
  for (const row of rawRows) {
    ensure(allowed.has(Number(row.game_pk)) && Number(row.game_pk) !== target.gamePk, 'RAW_SCOPE')
    ensure(day(row.game_date) && row.game_date < target.performanceCutoff && row.game_year === Number(target.gameDate.slice(0, 4)), 'RAW_SOURCE_DATE')
    ensure(before(row.ingested_at, target.runAsOf) && before(row.created_at, target.runAsOf), 'RAW_AVAILABILITY_ASOF')
    ensure(row.canonical_home_team_id && row.canonical_away_team_id && id(row.mlbam_pitcher_id) && id(row.mlbam_batter_id) && row.raw_payload_digest, 'RAW_IDENTITY')
    ensure(id(row.at_bat_number) && id(row.pitch_number) && id(row.inning), 'RAW_PITCH_SHAPE')
    for (const field of ['release_speed', 'launch_speed', 'estimated_woba_using_speedangle', 'post_home_score', 'post_away_score']) {
      ensure(row[field] === null || Number.isFinite(row[field]), 'RAW_NONFINITE_VALUE')
    }
  }
  // Match the stored 02I input's database text ordering (verified by R2T-R2).
  // JS code-point comparison puts :10: before :1: and changes which pitcher
  // the unchanged builder first encounters. This is source ordering, not math.
  const sorted = [...rawRows].sort((a, b) => a.id.localeCompare(b.id, 'en-US', { numeric: false }))
  const scan = scanRawRows(sorted)
  ensure(!scan.duplicatePitchIdentities && !scan.pitcherNull && !scan.batterNull, 'RAW_DUPLICATE_OR_MISSING_ID')
  ensure(scan.games.length === allowed.size, 'DEPENDENCY_GAME_MISSING')
  for (const game of scan.games) {
    ensure([game.homeTeamId, game.awayTeamId].some((team) => [target.homeTeamId, target.awayTeamId].includes(team)) ||
      game.pitchers.has(starters.home.mlbam_pitcher_id) || game.pitchers.has(starters.away.mlbam_pitcher_id), 'RAW_DEPENDENCY_SCOPE')
  }
  const history = { teamBatting: new Map(), pitcher: new Map(), batter: new Map(), bullpen: new Map() }
  for (const game of scan.games.sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)) updateStatsFromGame(history, game)
  const game = { gamePk: target.gamePk, gameDate: target.gameDate, homeTeamId: target.homeTeamId, awayTeamId: target.awayTeamId,
    homeStarter: starters.home.mlbam_pitcher_id, awayStarter: starters.away.mlbam_pitcher_id, homeBatters: [], awayBatters: [] }
  const rows = { snapshots: [], team: [], starter: [], bullpen: [], batter: [], matchup: [], firstInning: [], offense: 0 }
  ensure(addDailyRows(rows, game, target.asOfDate, history, { sampleSizes: [] }, false), 'REQUIRED_HISTORY_MISSING')
  const dependencyDigest = sha256(sorted.map((row) => [row.id, row.raw_payload_digest, row.ingested_at, row.created_at]))
  return { rows, game, provenance: { source: 'public.pick2_raw_mlb_statcast_pitches', dependencyGamePks: [...allowed].sort((a, b) => a - b),
    rawRows: sorted.length, dependencyDigest, latestSourceDate: [...new Set(sorted.map((row) => row.game_date))].sort().at(-1),
    latestAvailableAt: sorted.reduce((latest, row) => [latest, row.ingested_at, row.created_at].sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1), '1970-01-01T00:00:00Z'),
    runAsOf: target.runAsOf, performanceCutoff: target.performanceCutoff,
    rowSelectionRule: 'complete games involving target teams or starter appearances; same-season prior-date only; all raw rows observed before run_as_of',
    auxiliaryBatterDomain: 'EMPTY_NOT_REQUIRED_BY_MLB_ML_FEATURE_SET_V1', builder: '02H addDailyRows persistBatter=false' } }
}

export function assemblePregameVector({ target, starters, built }) {
  const { rows, game, provenance } = built
  ensure(game.gamePk === target.gamePk, 'VECTOR_GAME_LINKAGE')
  const snapshotById = new Map(rows.snapshots.map((row) => [row.id, row]))
  ensure(snapshotById.size === rows.snapshots.length, 'DUPLICATE_SNAPSHOT_ID')
  for (const snapshot of rows.snapshots) {
    ensure(snapshot.target_game_pk === target.gamePk && snapshot.feature_version === FEATURE_VERSION && snapshot.feature_date === target.gameDate && snapshot.as_of_date === target.asOfDate && before(snapshot.as_of_timestamp, target.runAsOf), 'SNAPSHOT_SCOPE_OR_ASOF')
    ensure(snapshot.input_digest === sha256({ native: snapshot.native_identity_metadata, sample: snapshot.sample_sizes, features: snapshot.features }), 'SNAPSHOT_DIGEST')
  }
  for (const [domain, list] of Object.entries(rows).filter(([key]) => key !== 'snapshots' && key !== 'offense')) {
    ensure(Array.isArray(list), 'FEATURE_DOMAIN')
    for (const row of list) {
      ensure(row.target_game_pk === target.gamePk && row.feature_version === FEATURE_VERSION, 'FEATURE_VERSION_OR_SCOPE')
      ensure(row.feature_date === target.gameDate && row.as_of_date === target.asOfDate && before(row.as_of_timestamp, target.runAsOf), 'STALE_FEATURE_ROW')
      const snapshot = snapshotById.get(row.feature_snapshot_id)
      ensure(snapshot && snapshot.target_game_pk === row.target_game_pk && snapshot.feature_version === row.feature_version, 'FEATURE_SNAPSHOT_LINKAGE')
      const subject = domain === 'team' ? `team:${row.team_id}` : domain === 'bullpen' ? `bullpen:${row.team_id}` : domain === 'starter' ? `mlbam_pitcher:${row.mlbam_pitcher_id}` : domain === 'batter' ? `mlbam_batter:${row.mlbam_batter_id}` : `game:${target.gamePk}`
      const family = domain === 'firstInning' ? 'first_inning' : domain
      ensure(snapshot.subject_id === subject && snapshot.native_identity_metadata.family === family, 'SNAPSHOT_ENTITY_LINKAGE')
      if (['team', 'bullpen'].includes(domain)) ensure([target.homeTeamId, target.awayTeamId].includes(row.team_id), 'FEATURE_ENTITY_LINKAGE')
      if (domain === 'starter') ensure([starters.home.mlbam_pitcher_id, starters.away.mlbam_pitcher_id].includes(row.mlbam_pitcher_id), 'FEATURE_ENTITY_LINKAGE')
      if (['matchup', 'firstInning'].includes(domain)) ensure(row.home_team_id === target.homeTeamId && row.away_team_id === target.awayTeamId, 'FEATURE_ENTITY_LINKAGE')
    }
  }
  ensure(rows.team.length === 2 && rows.starter.length === 2 && rows.bullpen.length === 2 && rows.matchup.length === 1 && rows.firstInning.length === 1, 'FEATURE_ROW_MISSING')
  const first = rows.firstInning[0]
  ensure(first.home_starter_mlbam_pitcher_id === starters.home.mlbam_pitcher_id && first.away_starter_mlbam_pitcher_id === starters.away.mlbam_pitcher_id, 'STARTER_CHANGED')
  const maps = { first: new Map([[target.gamePk, first]]) }
  for (const [domain, key] of [['team', 'team_id'], ['starter', 'mlbam_pitcher_id'], ['bullpen', 'team_id']]) {
    maps[domain] = new Map(rows[domain].map((row) => [`${target.gamePk}|${row[key]}`, row]))
    ensure(maps[domain].size === 2, 'DUPLICATE_FEATURE_ENTITY')
  }
  const manifest = featureManifest()
  const lineage = manifest.map((entry) => {
    const sides = entry.side === null ? [] : entry.side === 'home_minus_away' ? ['home', 'away'] : [entry.side]
    const sourceRows = sides.map((side) => maps[entry.domain].get(`${target.gamePk}|${entry.domain === 'starter' ? starters[side].mlbam_pitcher_id : target[`${side}TeamId`]}`))
    for (const row of sourceRows) ensure(row && Object.hasOwn(row, entry.field) && (row[entry.field] === null || Number.isFinite(row[entry.field])), 'MISSING_OR_NONFINITE_FEATURE')
    return { index: entry.index, name: entry.name, domain: entry.domain, gamePk: target.gamePk,
      sources: sourceRows.map((row) => ({ table: FEATURE_TABLES[entry.domain], entity: row.team_id ?? row.mlbam_pitcher_id,
        plannedSnapshotIdentity: snapshotById.get(row.feature_snapshot_id).deterministic_identity,
        featureDate: row.feature_date, asOf: row.as_of_timestamp, field: entry.field, sourceValue: row[entry.field] })),
      rawDependencyDigest: provenance.dependencyDigest, availableAt: provenance.latestAvailableAt }
  })
  const values = buildVector(game, maps)
  ensure(values.length === 76, 'FEATURE_COUNT')
  values.forEach((value, index) => { ensure(value === null || Number.isFinite(value), 'NONFINITE_VECTOR'); Object.assign(lineage[index], { rawValue: value, finalNumericValue: value ?? manifest[index].median, imputed: value === null }) })
  return { gamePk: target.gamePk, runAsOf: target.runAsOf, mode: 'PREGAME_READ_ONLY_RECONSTRUCTION', values,
    featureNames: manifest.map((row) => row.name), featureSetVersion: FEATURE_SET, sourceDigest: sha256(lineage), lineage, liveEvidenceCertified: true }
}

export function runPregameModelDryPath({ target, starters, rawRows, dependencyGamePks }) {
  const built = buildPregameFeatureRows({ target, starters, rawRows, dependencyGamePks })
  const vector = assemblePregameVector({ target, starters, built })
  return { built, vector, inference: inferChampion({ vector }), writes: 0, providerCalls: 0, liveExecutionEnabled: false }
}

export function buildAllPregameFeatureRows({ contexts, runDate, runAsOf }) {
  ensure(operatingDate(runAsOf) === runDate, 'RUN_DATE_FREEZE')
  const inventory = expandAllGameTargets(contexts)
  const rows = { snapshots: [], team: [], starter: [], bullpen: [], batter: [], matchup: [], firstInning: [], offense: 0 }
  const games = []
  for (const { target, starters, dependencies } of [...contexts].sort((a, b) => a.target.gamePk - b.target.gamePk)) {
    ensure(target.runAsOf === runAsOf && target.gameDate === runDate, 'CURRENT_SLATE_FREEZE')
    const verified = resolvePregameTarget({ native: target.native, runAsOf, eligibleGamePks: contexts.map(c => c.target.gamePk) })
    for (const key of ['gamePk', 'gameDate', 'scheduledAt', 'homeTeamId', 'awayTeamId', 'performanceCutoff', 'asOfDate', 'sourceDigest']) ensure(target[key] === verified[key], 'TARGET_CONTEXT_DRIFT')
    resolveStarterContext(verified, Object.values(starters))
    const built = buildPregameFeatureRows({ target, starters, rawRows: dependencies.rows, dependencyGamePks: dependencies.dependencyGamePks })
    const vector = assemblePregameVector({ target, starters, built })
    for (const domain of Object.keys(rows)) {
      if (domain === 'offense') rows.offense += built.rows.offense
      else rows[domain].push(...built.rows[domain])
    }
    games.push({ target, starters, built, vector, inference: inferChampion({ vector }) })
  }
  for (const [domain, cap] of Object.entries(inventory.maximumCandidateCaps)) ensure(rows[domain].length === cap, 'ALL_GAME_ROW_CAP')
  return { rows, games, inventory }
}
