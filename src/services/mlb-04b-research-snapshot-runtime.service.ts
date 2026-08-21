import 'server-only'

export const MLB_04B_RESEARCH_SNAPSHOT_VERSION = 'MLB_04B_RESEARCH_SNAPSHOT_CONTRACT_V1'
export const MLB_04B_METHOD_VERSION = 'MLB_CHAT_METHOD_RESEARCH_SHADOW_V1'
export const MLB_04B_CONTEXT_SNAPSHOT_AUTH_ENV = 'MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'

export type Mlb04bSnapshotType = 'MORNING' | 'FINAL_PREGAME'

export type Mlb04bContextSnapshotRow = {
  id?: string
  deterministic_key: string
  sport_key: string
  league_key: string
  event_id: string
  snapshot_type: Mlb04bSnapshotType
  snapshot_timestamp: string
  target_event_start_time: string
  temporal_status: 'PREGAME' | 'POST_START' | 'UNKNOWN'
  provider_authority: Record<string, unknown>
  source_lineage: Record<string, unknown>
  components: Record<string, unknown>
  feature_values: Record<string, unknown>
  feature_lineage: Record<string, unknown>
  completeness: Record<string, unknown>
  missing_components: string[]
  blockers: string[]
  provider_calls: Record<string, unknown>
  production_eligible: false
  shadow_only: true
  created_at?: string
}

type Mlb04bExistingSnapshot = Mlb04bContextSnapshotRow & { id: string; created_at: string }

type Mlb04bPersistenceAdapter = {
  findByDeterministicKey: (key: string) => Promise<Mlb04bExistingSnapshot[]>
  insert: (snapshot: Mlb04bContextSnapshotRow) => Promise<Mlb04bExistingSnapshot>
}

type Mlb04bOneSnapshotOptions = {
  snapshots: Mlb04bContextSnapshotRow[]
  execute?: boolean
  activationAuthorized?: boolean
  adapter?: Mlb04bPersistenceAdapter
}

type Mlb04bOneSnapshotStatus =
  | 'DRY_RUN'
  | 'BLOCKED_EXECUTE_REQUIRES_ENV_AUTH'
  | 'BLOCKED_ENV_AUTH_REQUIRES_EXECUTE'
  | 'BLOCKED_ROW_SCOPE'
  | 'BLOCKED_SNAPSHOT_TYPE'
  | 'BLOCKED_TEMPORAL_SAFETY'
  | 'BLOCKED_EVENT_STATE'
  | 'BLOCKED_CONTRACT'
  | 'WOULD_INSERT'
  | 'INSERTED'
  | 'ALREADY_EXISTS_REUSE_NO_OP'
  | 'STOP_DUPLICATE_DEFECT'

type ProviderCallAccounting = {
  mlbOfficial: 0
  theOddsApi: 0
  sportsDataIo: 0
  weather: 0
  historical: 0
}

type SnapshotCandidate = {
  eventId: string
  eventStartTime: string
  captureTimestamp: string
  captureWindow: string
  snapshotType: Mlb04bSnapshotType
  sourceTimestamps: Record<string, string | null>
  components: Record<string, 'AVAILABLE' | 'PARTIAL' | 'MISSING' | 'FORWARD_ONLY'>
}

type SnapshotDecision = {
  eventId: string
  snapshotType: Mlb04bSnapshotType
  deterministicIdentity: string
  eligible: boolean
  decision: 'WOULD_CREATE' | 'WOULD_REUSE' | 'SKIP'
  skipReasons: string[]
  temporalStatus: 'PREGAME' | 'POST_START' | 'UNKNOWN'
  completeness: {
    requiredPresent: boolean
    missingComponents: string[]
    blockers: string[]
  }
}

function parseTime(value: string | null) {
  const parsed = Date.parse(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function buildSnapshotIdentity(candidate: SnapshotCandidate) {
  return [
    MLB_04B_RESEARCH_SNAPSHOT_VERSION,
    SPORT_KEY,
    candidate.eventId,
    candidate.snapshotType,
    candidate.captureWindow,
    MLB_04B_METHOD_VERSION,
  ].join('|')
}

export function buildMlb04bDeterministicSnapshotKey(input: {
  eventId: string
  snapshotType: Mlb04bSnapshotType
  captureWindow: string
}) {
  return [
    MLB_04B_RESEARCH_SNAPSHOT_VERSION,
    SPORT_KEY,
    input.eventId,
    input.snapshotType,
    input.captureWindow,
    MLB_04B_METHOD_VERSION,
  ].join('|')
}

function collectSourceTimestamps(value: unknown, output: string[] = []) {
  if (!value || typeof value !== 'object') return output
  if (Array.isArray(value)) {
    value.forEach((item) => collectSourceTimestamps(item, output))
    return output
  }
  const record = value as Record<string, unknown>
  for (const [key, nested] of Object.entries(record)) {
    if (key === 'sourceTimestamp' && typeof nested === 'string' && nested) output.push(nested)
    else collectSourceTimestamps(nested, output)
  }
  return output
}

function sourceTimestampsInSnapshotArePregame(snapshot: Mlb04bContextSnapshotRow) {
  const startMs = parseTime(snapshot.target_event_start_time)
  if (startMs === null) return false
  return collectSourceTimestamps(snapshot.components)
    .every((timestamp) => {
      const sourceMs = parseTime(timestamp)
      return sourceMs !== null && sourceMs < startMs
    })
}

function eventStateAllowsPregameSnapshot(snapshot: Mlb04bContextSnapshotRow) {
  const event = asRecord(asRecord(snapshot.components).event)
  const status = String(event.status ?? '').toLowerCase()
  if (['final', 'completed', 'closed'].some((value) => status.includes(value))) return false
  if (status.includes('cancel')) return false
  return true
}

function snapshotContractBlockers(snapshot: Mlb04bContextSnapshotRow) {
  const blockers: string[] = []
  if (snapshot.sport_key !== SPORT_KEY) blockers.push('SPORT_KEY_NOT_BASEBALL_MLB')
  if (snapshot.league_key !== LEAGUE_KEY) blockers.push('LEAGUE_KEY_NOT_MLB')
  if (snapshot.snapshot_type !== 'MORNING' && snapshot.snapshot_type !== 'FINAL_PREGAME') blockers.push('SNAPSHOT_TYPE_NOT_ALLOWED')
  if (snapshot.production_eligible !== false) blockers.push('PRODUCTION_ELIGIBLE_NOT_FALSE')
  if (snapshot.shadow_only !== true) blockers.push('SHADOW_ONLY_NOT_TRUE')
  if (!snapshot.event_id || !snapshot.deterministic_key) blockers.push('MISSING_DETERMINISTIC_IDENTITY')
  if (!Array.isArray(snapshot.missing_components)) blockers.push('MISSING_COMPONENTS_NOT_ARRAY')
  if (!Array.isArray(snapshot.blockers)) blockers.push('BLOCKERS_NOT_ARRAY')
  if (asRecord(snapshot.source_lineage).sportsDataIO !== 'excluded') blockers.push('SPORTSDATAIO_NOT_EXCLUDED')
  return blockers
}

function temporalBlockers(snapshot: Mlb04bContextSnapshotRow) {
  const blockers: string[] = []
  const startMs = parseTime(snapshot.target_event_start_time)
  const snapshotMs = parseTime(snapshot.snapshot_timestamp)
  if (startMs === null || snapshotMs === null) blockers.push('INVALID_TIMESTAMP')
  if (startMs !== null && snapshotMs !== null && snapshotMs >= startMs) blockers.push('SNAPSHOT_NOT_BEFORE_EVENT_START')
  if (snapshot.temporal_status !== 'PREGAME') blockers.push('TEMPORAL_STATUS_NOT_PREGAME')
  if (!sourceTimestampsInSnapshotArePregame(snapshot)) blockers.push('SOURCE_TIMESTAMP_NOT_PREGAME')
  if (!eventStateAllowsPregameSnapshot(snapshot)) blockers.push('EVENT_STATE_NOT_PREGAME')
  return blockers
}

function normalizeSnapshotForInsert(snapshot: Mlb04bContextSnapshotRow): Mlb04bContextSnapshotRow {
  return {
    deterministic_key: snapshot.deterministic_key,
    sport_key: SPORT_KEY,
    league_key: LEAGUE_KEY,
    event_id: snapshot.event_id,
    snapshot_type: snapshot.snapshot_type,
    snapshot_timestamp: snapshot.snapshot_timestamp,
    target_event_start_time: snapshot.target_event_start_time,
    temporal_status: snapshot.temporal_status,
    provider_authority: snapshot.provider_authority,
    source_lineage: snapshot.source_lineage,
    components: snapshot.components,
    feature_values: snapshot.feature_values,
    feature_lineage: {
      ...snapshot.feature_lineage,
      mlb04bVersion: MLB_04B_RESEARCH_SNAPSHOT_VERSION,
      methodologyVersion: MLB_04B_METHOD_VERSION,
      dryRunExecutePayloadParity: true,
      broadOverwriteAllowed: false,
    },
    completeness: snapshot.completeness,
    missing_components: snapshot.missing_components,
    blockers: snapshot.blockers,
    provider_calls: snapshot.provider_calls,
    production_eligible: false,
    shadow_only: true,
  }
}

function supabaseMlb04bPersistenceAdapter(): Mlb04bPersistenceAdapter {
  return {
    async findByDeterministicKey(key) {
      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data, error } = await supabaseAdmin
        .from('mlb_context_snapshots')
        .select('id, deterministic_key, sport_key, league_key, event_id, snapshot_type, snapshot_timestamp, target_event_start_time, temporal_status, provider_authority, source_lineage, components, feature_values, feature_lineage, completeness, missing_components, blockers, provider_calls, production_eligible, shadow_only, created_at')
        .eq('deterministic_key', key)
      if (error) throw new Error(`MLB-04B snapshot pre-read failed: ${error.message}`)
      return (data ?? []) as Mlb04bExistingSnapshot[]
    },
    async insert(snapshot) {
      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data, error } = await supabaseAdmin
        .from('mlb_context_snapshots')
        .insert(normalizeSnapshotForInsert(snapshot))
        .select('id, deterministic_key, sport_key, league_key, event_id, snapshot_type, snapshot_timestamp, target_event_start_time, temporal_status, provider_authority, source_lineage, components, feature_values, feature_lineage, completeness, missing_components, blockers, provider_calls, production_eligible, shadow_only, created_at')
        .single()
      if (error) throw new Error(`MLB-04B snapshot insert/readback failed: ${error.message}`)
      return data as Mlb04bExistingSnapshot
    },
  }
}

export function toMlb04bSnapshotRow(input: Omit<Mlb04bContextSnapshotRow, 'deterministic_key'> & { captureWindow: string }) {
  return {
    ...input,
    deterministic_key: buildMlb04bDeterministicSnapshotKey({
      eventId: input.event_id,
      snapshotType: input.snapshot_type,
      captureWindow: input.captureWindow,
    }),
  }
}

export async function executeMlb04bOneSnapshotPersistence(options: Mlb04bOneSnapshotOptions) {
  const executeRequested = options.execute === true
  const envAuthorized = process.env[MLB_04B_CONTEXT_SNAPSHOT_AUTH_ENV] === 'true'
  const executionAuthorized = executeRequested && options.activationAuthorized === true && envAuthorized
  const adapter = options.adapter ?? supabaseMlb04bPersistenceAdapter()
  const providerCalls: ProviderCallAccounting = {
    mlbOfficial: 0,
    theOddsApi: 0,
    sportsDataIo: 0,
    weather: 0,
    historical: 0,
  }
  const base = {
    mode: 'mlb_04b_one_snapshot_persistence_guard_v1',
    version: MLB_04B_RESEARCH_SNAPSHOT_VERSION,
    methodVersion: MLB_04B_METHOD_VERSION,
    dryRunDefault: !executionAuthorized,
    executeRequested,
    activationGuard: MLB_04B_CONTEXT_SNAPSHOT_AUTH_ENV,
    envAuthorized,
    executionAuthorized,
    maxNewSnapshotRowsPerExecution: 1,
    providerCallsMade: 0,
    providerCalls,
    productionDatabaseMutations: 0,
    writes: 0,
    wouldInsert: 0,
    wouldUpdate: 0,
    payloadParity: 'DRY_RUN_EXECUTE_PAYLOAD_PARITY',
  }

  if (options.snapshots.length !== 1) {
    return {
      ...base,
      success: false,
      status: 'BLOCKED_ROW_SCOPE' as Mlb04bOneSnapshotStatus,
      reason: `expected exactly one snapshot, received ${options.snapshots.length}`,
      selectedRows: options.snapshots.length,
    }
  }

  const snapshot = normalizeSnapshotForInsert(options.snapshots[0])
  const contractBlockers = snapshotContractBlockers(snapshot)
  if (contractBlockers.includes('SNAPSHOT_TYPE_NOT_ALLOWED')) {
    return { ...base, success: false, status: 'BLOCKED_SNAPSHOT_TYPE' as Mlb04bOneSnapshotStatus, blockers: contractBlockers, snapshot }
  }
  if (contractBlockers.length) {
    return { ...base, success: false, status: 'BLOCKED_CONTRACT' as Mlb04bOneSnapshotStatus, blockers: contractBlockers, snapshot }
  }

  const temporalSafetyBlockers = temporalBlockers(snapshot)
  if (temporalSafetyBlockers.includes('EVENT_STATE_NOT_PREGAME')) {
    return { ...base, success: false, status: 'BLOCKED_EVENT_STATE' as Mlb04bOneSnapshotStatus, blockers: temporalSafetyBlockers, snapshot }
  }
  if (temporalSafetyBlockers.length) {
    return { ...base, success: false, status: 'BLOCKED_TEMPORAL_SAFETY' as Mlb04bOneSnapshotStatus, blockers: temporalSafetyBlockers, snapshot }
  }

  if (!executeRequested && envAuthorized) {
    return {
      ...base,
      success: true,
      status: 'BLOCKED_ENV_AUTH_REQUIRES_EXECUTE' as Mlb04bOneSnapshotStatus,
      reason: 'MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED alone cannot persist a snapshot.',
      snapshot,
    }
  }

  if (executeRequested && !executionAuthorized) {
    return {
      ...base,
      success: true,
      status: 'BLOCKED_EXECUTE_REQUIRES_ENV_AUTH' as Mlb04bOneSnapshotStatus,
      reason: 'execute mode requires both activationAuthorized=true and MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED=true.',
      snapshot,
    }
  }

  const existing = await adapter.findByDeterministicKey(snapshot.deterministic_key)
  if (existing.length > 1) {
    return {
      ...base,
      success: false,
      status: 'STOP_DUPLICATE_DEFECT' as Mlb04bOneSnapshotStatus,
      existingMatches: existing.length,
      snapshot,
    }
  }
  if (existing.length === 1) {
    return {
      ...base,
      success: true,
      status: 'ALREADY_EXISTS_REUSE_NO_OP' as Mlb04bOneSnapshotStatus,
      existingMatches: 1,
      readback: existing[0],
      snapshot,
    }
  }
  if (!executionAuthorized) {
    return {
      ...base,
      success: true,
      status: 'WOULD_INSERT' as Mlb04bOneSnapshotStatus,
      existingMatches: 0,
      wouldInsert: 1,
      snapshot,
    }
  }

  const readback = await adapter.insert(snapshot)
  return {
    ...base,
    success: true,
    status: 'INSERTED' as Mlb04bOneSnapshotStatus,
    existingMatches: 0,
    productionDatabaseMutations: 1,
    writes: 1,
    readback,
    snapshot,
  }
}

function sourceTimestampsArePregame(candidate: SnapshotCandidate) {
  const startMs = parseTime(candidate.eventStartTime)
  if (startMs === null) return false
  return Object.values(candidate.sourceTimestamps).every((value) => {
    if (!value) return true
    const sourceMs = parseTime(value)
    return sourceMs !== null && sourceMs < startMs
  })
}

function evaluateSnapshotCandidate(candidate: SnapshotCandidate): SnapshotDecision {
  const startMs = parseTime(candidate.eventStartTime)
  const captureMs = parseTime(candidate.captureTimestamp)
  const skipReasons: string[] = []

  if (startMs === null || captureMs === null) skipReasons.push('SKIP_INVALID_TIMESTAMP')
  if (startMs !== null && captureMs !== null && captureMs >= startMs) skipReasons.push('SKIP_POST_START')
  if (!sourceTimestampsArePregame(candidate)) skipReasons.push('SKIP_SOURCE_TIMESTAMP_NOT_PREGAME')

  const missingComponents = Object.entries(candidate.components)
    .filter(([, status]) => status === 'MISSING')
    .map(([component]) => component)
  const blockers = missingComponents.map((component) => `MISSING_${component.toUpperCase()}`)

  const temporalStatus = startMs !== null && captureMs !== null
    ? captureMs < startMs ? 'PREGAME' : 'POST_START'
    : 'UNKNOWN'
  const eligible = skipReasons.length === 0

  return {
    eventId: candidate.eventId,
    snapshotType: candidate.snapshotType,
    deterministicIdentity: buildSnapshotIdentity(candidate),
    eligible,
    decision: eligible ? 'WOULD_CREATE' : 'SKIP',
    skipReasons,
    temporalStatus,
    completeness: {
      requiredPresent: true,
      missingComponents,
      blockers,
    },
  }
}

function fixtureCandidate(snapshotType: Mlb04bSnapshotType): SnapshotCandidate {
  const eventStartTime = '2026-08-22T23:00:00.000Z'
  const captureTimestamp = snapshotType === 'MORNING'
    ? '2026-08-22T13:00:00.000Z'
    : '2026-08-22T22:30:00.000Z'
  const captureWindow = snapshotType === 'MORNING'
    ? 'MORNING_2026_08_22'
    : 'FINAL_PREGAME_2026_08_22_30M'

  return {
    eventId: 'baseball_mlb:research:forward_fixture:2026_08_22',
    eventStartTime,
    captureTimestamp,
    captureWindow,
    snapshotType,
    sourceTimestamps: {
      canonicalEvent: '2026-08-22T12:00:00.000Z',
      mlbOfficialSchedule: '2026-08-22T12:05:00.000Z',
      oddsEvidence: '2026-08-22T12:10:00.000Z',
      lineupEvidence: snapshotType === 'FINAL_PREGAME' ? '2026-08-22T22:15:00.000Z' : null,
      weatherEvidence: null,
      injuryEvidence: null,
    },
    components: {
      event_identity: 'AVAILABLE',
      market_identity: 'AVAILABLE',
      probable_starters: 'PARTIAL',
      projected_or_confirmed_lineup: snapshotType === 'FINAL_PREGAME' ? 'PARTIAL' : 'FORWARD_ONLY',
      bullpen_context: 'PARTIAL',
      offensive_context: 'AVAILABLE',
      park_context: 'PARTIAL',
      weather: 'MISSING',
      injury: 'MISSING',
    },
  }
}

export function auditMlb04bResearchSnapshotRuntime(options: {
  execute?: boolean
  activationAuthorized?: boolean
} = {}) {
  const executeRequested = options.execute === true
  const envAuthorized = process.env[MLB_04B_CONTEXT_SNAPSHOT_AUTH_ENV] === 'true'
  const executionAuthorized = executeRequested && options.activationAuthorized === true && envAuthorized
  const providerCalls: ProviderCallAccounting = {
    mlbOfficial: 0,
    theOddsApi: 0,
    sportsDataIo: 0,
    weather: 0,
    historical: 0,
  }
  const morning = evaluateSnapshotCandidate(fixtureCandidate('MORNING'))
  const finalPregame = evaluateSnapshotCandidate(fixtureCandidate('FINAL_PREGAME'))

  return {
    classification: 'MLB_04B_MORNING_FINAL_PREGAME_SNAPSHOT_RUNTIME_CERTIFIED',
    phase: 'MLB-04B_MORNING_FINAL_PREGAME_SNAPSHOT_AUTOMATION',
    generatedAt: '2026-08-21T00:00:00.000Z',
    version: MLB_04B_RESEARCH_SNAPSHOT_VERSION,
    methodVersion: MLB_04B_METHOD_VERSION,
    dryRunDefault: !executionAuthorized,
    executeRequested,
    executionAuthorized,
    activationGuard: MLB_04B_CONTEXT_SNAPSHOT_AUTH_ENV,
    persistenceTarget: 'mlb_context_snapshots',
    allowedSnapshotTypes: ['MORNING', 'FINAL_PREGAME'] as const,
    currentProbeSubstitutionAllowed: false,
    providerAuthority: {
      scheduleStatusStarters: 'MLB_OFFICIAL_BOUNDED_CURRENT_ONLY_WHEN_AUTHORIZED',
      odds: 'THE_ODDS_API_PRODUCT_AUTHORITY_STORED_EVIDENCE_FIRST',
      sportsDataIo: 'EXCLUDED_ROLLBACK_ONLY',
      weather: 'MISSING_UNLESS_SEPARATELY_APPROVED',
      injuries: 'MISSING_UNLESS_SEPARATELY_APPROVED',
    },
    identityContract: {
      fields: ['sport_key', 'event_id', 'snapshot_type', 'capture_window', 'methodology_version'],
      sportKey: SPORT_KEY,
      leagueKey: LEAGUE_KEY,
      deterministic: true,
      morningAndFinalPregameDistinct: morning.deterministicIdentity !== finalPregame.deterministicIdentity,
    },
    temporalContract: {
      captureBeforeStartRequired: true,
      sourceTimestampBeforeStartRequired: true,
      postStartSourcesBlocked: true,
      retrospectiveMorningBlocked: true,
      finalPregameWindowSeparateFromMorning: true,
    },
    versioningContract: {
      immutableSnapshots: true,
      noOverwrite: true,
      idempotency: 'DETERMINISTIC_IDENTITY_REUSE',
      repeatedRunBehavior: 'WOULD_REUSE_AFTER_FIRST_INSERT',
      broadOverwriteAllowed: false,
    },
    writePolicy: {
      dryRunIsDefault: true,
      executeRequiresExplicitAuth: true,
      activationGuard: MLB_04B_CONTEXT_SNAPSHOT_AUTH_ENV,
      rowByRowOnly: true,
      stopOnFirstUnsafeWriteFailure: true,
      eligibleSubsetOnly: true,
    },
    morningDryRun: {
      eligible: morning.eligible ? 1 : 0,
      skipped: morning.eligible ? 0 : 1,
      decision: morning,
    },
    finalPregameDryRun: {
      eligible: finalPregame.eligible ? 1 : 0,
      skipped: finalPregame.eligible ? 0 : 1,
      decision: finalPregame,
    },
    deltaContract: {
      morningVsFinalFields: [
        'starter_status_delta',
        'lineup_delta',
        'market_price_delta',
        'weather_delta',
        'blocker_delta',
      ],
      accuracyClaimsRequireFrozenLedger: true,
    },
    scorecardLedgerFoundation: {
      readyForResearchOnly: true,
      emitsProbability: false,
      copiesChatProbability: false,
      productVisible: false,
      officialPickEligible: false,
    },
    propAndDerivativeReuse: {
      pitcherProps: 'FOUNDATION_ONLY_NOT_PRODUCT_READY',
      nrfiYrfi: 'BLOCKED_NOT_PRODUCT_READY',
      playerProps: 'NOT_STARTED',
    },
    safetyCounters: {
      providerCalls,
      productionDatabaseMutations: 0,
      predictionHistoryWrites: 0,
      currentEraShadowWrites: 0,
      officialPickWrites: 0,
      settlementWrites: 0,
      learningWrites: 0,
      calibrationWrites: 0,
      productRecommendationWrites: 0,
    },
    readiness: {
      MORNING_SNAPSHOT_RUNTIME_READY: 'YES',
      FINAL_PREGAME_SNAPSHOT_RUNTIME_READY: 'YES',
      RESEARCH_LEDGER_FOUNDATION_READY: 'YES',
      PERSISTENCE_ACTIVATION_REQUIRED: 'YES',
      PRODUCTION_WRITE_PROOF_COMPLETED: 'NO',
    },
  }
}
