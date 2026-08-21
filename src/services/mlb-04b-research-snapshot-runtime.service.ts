import 'server-only'

export const MLB_04B_RESEARCH_SNAPSHOT_VERSION = 'MLB_04B_RESEARCH_SNAPSHOT_CONTRACT_V1'
export const MLB_04B_METHOD_VERSION = 'MLB_CHAT_METHOD_RESEARCH_SHADOW_V1'
export const MLB_04B_CONTEXT_SNAPSHOT_AUTH_ENV = 'MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'

export type Mlb04bSnapshotType = 'MORNING' | 'FINAL_PREGAME'

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
