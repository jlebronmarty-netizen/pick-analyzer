// Read-only projection over existing canonical identities. No provider or DML API.
export function resolveStoredOfficialTeamAliases(nativeRows, canonicalTeams) {
  const canonical = new Set(canonicalTeams.map((row) => row.id))
  const aliases = new Map()
  for (const row of nativeRows) {
    if (row.source !== 'mlb_official') continue
    for (const side of ['home', 'away']) {
      const officialId = row.metadata?.[`${side}MlbTeamId`]
      const canonicalId = row[`${side}_team_id`]
      if (!Number.isSafeInteger(officialId) || officialId <= 0 || !canonical.has(canonicalId)) continue
      if (aliases.has(officialId) && aliases.get(officialId).canonicalId !== canonicalId) {
        throw new Error('R2TR2_NATIVE_BLOCK:AMBIGUOUS_TEAM_ALIAS')
      }
      aliases.set(officialId, { canonicalId, source: 'pick2_mlb_games.metadata', sourceGamePk: row.game_pk })
    }
  }
  return aliases
}

export function bindStoredNativeContext(native, aliases) {
  const projected = structuredClone(native)
  for (const side of ['home', 'away']) {
    const officialId = native.metadata?.[`${side}MlbTeamId`] ?? native.metadata?.mlb_official_identity?.[`${side}_mlb_team_id`]
    const mapped = aliases.get(officialId)?.canonicalId
    if (native[`${side}_team_id`] && mapped && native[`${side}_team_id`] !== mapped) {
      throw new Error('R2TR2_NATIVE_BLOCK:TEAM_ALIAS_CONFLICT')
    }
    projected[`${side}_team_id`] ??= mapped ?? null
    projected.metadata ??= {}
    projected.metadata[`${side}ProbablePitcher`] ??= native.metadata?.starter_evidence?.[`${side}ProbablePitcher`] ?? null
  }
  // Missing gameType/officialDate/abstractGameState cannot be manufactured from
  // a calendar date, a digest, or another game's observation.
  return projected
}

export function inventoryNativeGaps(nativeRows, aliases) {
  const definitions = [
    ['home_team_id', (r) => r.home_team_id, 'target/team/bullpen/first-inning identity', 'Stored MLB Official ID -> existing canonical alias'],
    ['away_team_id', (r) => r.away_team_id, 'target/team/bullpen/first-inning identity', 'Stored MLB Official ID -> existing canonical alias'],
    ['game_type', (r) => r.game_type, 'R1 certified regular-season target gate', 'Same-game MLB Official gameType; unavailable in inspected current native rows'],
    ['metadata.officialDate', (r) => r.metadata?.officialDate, 'R1 explicit official-date provenance', 'Same-game preserved MLB Official officialDate; no UTC-date guess'],
    ['metadata.abstractGameState', (r) => r.metadata?.abstractGameState, 'R1 pregame status provenance', 'Same-game preserved MLB Official abstractGameState; no status guess'],
    ['metadata.homeProbablePitcher.id', (r) => r.metadata?.homeProbablePitcher?.id, 'home starter identity/provenance', 'Existing metadata.starter_evidence.homeProbablePitcher; unknown stays blocked'],
    ['metadata.awayProbablePitcher.id', (r) => r.metadata?.awayProbablePitcher?.id, 'away starter identity/provenance', 'Existing metadata.starter_evidence.awayProbablePitcher; unknown stays blocked'],
    ['game_pk', (r) => r.game_pk, 'all target/FK scope', 'Existing canonical native primary key'],
    ['scheduled_at', (r) => r.scheduled_at, 'pre-start cutoff', 'Existing observed scheduled_at'],
    ['game_date', (r) => r.game_date, 'target feature date', 'Existing stored game_date; does not independently recover omitted provenance'],
    ['doubleheader', (r) => r.doubleheader, 'doubleheader disambiguation', 'Existing native doubleheader'],
    ['game_number', (r) => r.game_number, 'doubleheader disambiguation', 'Existing native game_number'],
    ['source_payload_digest', (r) => r.source_payload_digest, 'source identity', 'Existing stored digest; cannot reverse into missing payload fields'],
    ['season', (r) => r.season, 'certified builder season', 'Existing native season'],
    ['official_status', (r) => r.official_status, 'scheduled/pregame status guard', 'Existing native detailed status'],
    ['source', (r) => r.source, 'MLB Official provenance', 'Existing native source'],
    ['created_at', (r) => r.created_at, 'observation availability', 'Existing database observation timestamp'],
    ['updated_at', (r) => r.updated_at, 'latest observed starter/target availability', 'Existing database observation timestamp'],
  ]
  return definitions.map(([field, value, consumer, safeSource]) => {
    const missingGamePks = nativeRows.filter((row) => value(row) == null).map((row) => row.game_pk)
    const unresolvedGamePks = nativeRows.filter((row) => value(bindStoredNativeContext(row, aliases)) == null).map((row) => row.game_pk)
    return { field, physicalSource: `public.pick2_mlb_games.${field}`, consumer, safeSource,
      inspectedRows: nativeRows.length, missingGamePks, unresolvedGamePks,
      state: !missingGamePks.length ? 'PRESENT' : !unresolvedGamePks.length ? 'CODE_MAPPING_AVAILABLE' : 'MISSING_SAME_GAME_EVIDENCE',
      repairRequired: missingGamePks.length > 0,
      productionRepair: unresolvedGamePks.length > 0 ? 'SEPARATE_AUTHORIZATION_AND_SOURCE_EVIDENCE_REQUIRED' : 'NONE_FOR_READ_PROJECTION' }
  })
}
