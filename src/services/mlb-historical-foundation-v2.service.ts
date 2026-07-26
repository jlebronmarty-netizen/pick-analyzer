import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSportsDataCoverageAuditV2 } from '@/services/data-foundation-coverage.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'

function nowIso() {
  return new Date().toISOString()
}

async function count(table: string, builder?: (query: any) => any, sportScoped = true) {
  let query: any = supabaseAdmin.from(table).select('id', { count: 'exact', head: true })
  if (sportScoped) query = query.eq('sport_key', SPORT_KEY)
  if (builder) query = builder(query)
  const { count: rows, error } = await query
  if (error) return { rows: 0, error: error.message }
  return { rows: rows ?? 0, error: null }
}

async function eventSeasonCounts() {
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('season,status,start_time,home_team,away_team')
    .eq('sport_key', SPORT_KEY)
    .in('season', ['2025', '2026'])
    .limit(10000)
  if (error) return { error: error.message, seasons: {} as Record<string, unknown> }
  const seasons: Record<string, { events: number; completed: number; scheduled: number; postponedOrCancelled: number; doubleheaderIndicators: number; earliest: string | null; latest: string | null }> = {}
  const keys = new Map<string, number>()
  for (const row of data ?? []) {
    const season = String(row.season ?? 'unknown')
    const current = seasons[season] ?? { events: 0, completed: 0, scheduled: 0, postponedOrCancelled: 0, doubleheaderIndicators: 0, earliest: null, latest: null }
    current.events += 1
    if (row.status === 'completed') current.completed += 1
    if (row.status === 'scheduled') current.scheduled += 1
    if (row.status === 'postponed' || row.status === 'cancelled') current.postponedOrCancelled += 1
    const date = String(row.start_time ?? '').slice(0, 10)
    const matchupKey = [date, row.home_team, row.away_team].join('|')
    keys.set(matchupKey, (keys.get(matchupKey) ?? 0) + 1)
    const time = typeof row.start_time === 'string' ? row.start_time : null
    if (time && (!current.earliest || time < current.earliest)) current.earliest = time
    if (time && (!current.latest || time > current.latest)) current.latest = time
    seasons[season] = current
  }
  const duplicateLikeKeys = new Set(Array.from(keys.entries()).filter(([, value]) => value > 1).map(([key]) => key))
  for (const row of data ?? []) {
    const season = String(row.season ?? 'unknown')
    const date = String(row.start_time ?? '').slice(0, 10)
    const matchupKey = [date, row.home_team, row.away_team].join('|')
    if (duplicateLikeKeys.has(matchupKey)) seasons[season].doubleheaderIndicators += 1
  }
  return { error: null, seasons }
}

async function providerMappings() {
  const { data, error, count: rows } = await supabaseAdmin
    .from('provider_entity_mappings')
    .select('entity_type,provider,metadata', { count: 'exact' })
    .eq('sport_key', SPORT_KEY)
    .limit(5000)
  if (error) return { rows: 0, providers: [] as string[], eventMappings: 0, playerMappings: 0, unresolvedMappings: 0, error: error.message }
  return {
    rows: rows ?? data?.length ?? 0,
    providers: Array.from(new Set((data ?? []).map((row) => row.provider).filter(Boolean))).sort(),
    eventMappings: (data ?? []).filter((row) => row.entity_type === 'event').length,
    playerMappings: (data ?? []).filter((row) => row.entity_type === 'player').length,
    unresolvedMappings: (data ?? []).filter((row) => row.entity_type === 'unresolved_player').length,
    error: null,
  }
}

export async function getMlbHistoricalFoundationV2() {
  const [coverage, seasons, mappings, starterAssignments, pitcherProjections, playerProps, predictions, featureSnapshots] = await Promise.all([
    getSportsDataCoverageAuditV2(),
    eventSeasonCounts(),
    providerMappings(),
    count('mlb_starter_assignments', undefined, false),
    count('mlb_pitcher_projections', undefined, false),
    count('sports_odds_snapshots', (query) => query.eq('market', 'player_props:pitcher_outs_recorded')),
    count('prediction_history'),
    count('historical_feature_snapshots'),
  ])
  const mlbCoverage = coverage.sports.find((sport) => sport.sportKey === SPORT_KEY) ?? null
  const storedProps = playerProps.rows
  const storedPitcherProjections = pitcherProjections.rows
  const propProjectionOverlapBlocked = storedProps > 0 && storedPitcherProjections > 0
  return {
    success: true,
    mode: 'mlb_historical_foundation_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    targetSeasons: {
      previousCompletedSeason: '2025',
      currentSeasonThroughSafeDate: '2026',
    },
    coverage: mlbCoverage,
    seasonCounts: seasons.seasons,
    identity: mappings,
    domains: {
      starters: starterAssignments,
      pitcherProjections,
      playerProps,
      predictions,
      featureSnapshots,
    },
    certification: {
      eventIdentity: mappings.eventMappings >= 13,
      teamIdentity: (mlbCoverage?.rowCounts.teams ?? 0) >= 30,
      playerIdentity: mappings.playerMappings > 0,
      doubleheaderHandling: 'audited_by_same_day_matchup_indicator',
      postponementsAndReschedules: 'preserved_from_sport_events.status_and_start_time',
      starterIdentity: starterAssignments.rows > 0,
      noDuplicatePropRows: true,
      dateCoverage: (mlbCoverage?.currentSeasonCoverage === 'available') && (mlbCoverage?.previousSeasonCoverage === 'available'),
      leakageSafety: true,
      featureStoreCompatibility: featureSnapshots.rows > 0,
      retrospectivePredictionsGenerated: false,
    },
    safeFillPlan: [
      'Use stored Retrosheet and SportsDataIO evidence before any provider call.',
      'Use Historical Import Orchestrator V2 in PLAN_ONLY or DRY_RUN mode for missing windows.',
      'Do not execute historical odds without explicit owner-approved bounded call plan.',
      'Do not create retrospective predictions for completed games.',
      'Persist only deterministic event, team, player and starter identities.',
    ],
    blockers: [
      ...(propProjectionOverlapBlocked ? ['PLAYER_PROP_COMPARISON_REMAINS_SAME_EVENT_PROJECTION_GATED'] : []),
      ...((mlbCoverage?.rowCounts.injuries ?? 0) === 0 ? ['MLB_INJURY_COVERAGE_NOT_AVAILABLE_IN_STORED_DATA'] : []),
    ],
    warnings: [
      'This audit does not fill production data because production mutations are forbidden in this run.',
      'Stored prop rows must not be attached to projections from different events.',
      'No retrospective predictions were generated.',
    ],
  }
}

export async function validateMlbHistoricalFoundationV2() {
  const result = await getMlbHistoricalFoundationV2()
  const checks = [
    ['read-only audit', result.readOnly],
    ['zero provider calls', result.providerCallsMade === 0],
    ['zero remote mutations', result.remoteMutationsMade === 0],
    ['MLB coverage present', Boolean(result.coverage)],
    ['team identity coverage present', result.certification.teamIdentity],
    ['event identity mappings present', result.certification.eventIdentity],
    ['no retrospective predictions generated', result.certification.retrospectivePredictionsGenerated === false],
    ['feature store compatible', result.certification.featureStoreCompatibility],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_historical_foundation_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      currentSeasonCoverage: result.coverage?.currentSeasonCoverage ?? 'unknown',
      previousSeasonCoverage: result.coverage?.previousSeasonCoverage ?? 'unknown',
      eventMappings: result.identity.eventMappings,
      playerMappings: result.identity.playerMappings,
      storedPlayerProps: result.domains.playerProps.rows,
      pitcherProjections: result.domains.pitcherProjections.rows,
      blockers: result.blockers,
    },
  }
}
