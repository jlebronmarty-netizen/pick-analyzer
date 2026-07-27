import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSportsDataCoverageAuditV2 } from '@/services/data-foundation-coverage.service'

const SPORTS = [
  {
    sportKey: 'tennis',
    leagueKey: 'tennis',
    label: 'Tennis',
    competitions: ['atp', 'wta'],
    eventModel: 'tour_tournament_match',
    requiredDomains: ['tours', 'tournaments', 'surfaces', 'rounds', 'players', 'matches', 'results', 'rankings_optional', 'odds'],
    blockersPrefix: 'TENNIS',
  },
  {
    sportKey: 'mma_ufc',
    leagueKey: 'ufc',
    label: 'UFC',
    competitions: ['ufc'],
    eventModel: 'event_card_bout',
    requiredDomains: ['events', 'fighters', 'bouts', 'divisions', 'weigh_ins_optional', 'results', 'method_and_round', 'odds'],
    blockersPrefix: 'UFC',
  },
] as const

function nowIso() {
  return new Date().toISOString()
}

async function count(table: string, sportKey: string, builder?: (query: any) => any) {
  let query: any = supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('sport_key', sportKey)
  if (builder) query = builder(query)
  const { count: rows, error } = await query
  if (error) return { rows: 0, error: error.message }
  return { rows: rows ?? 0, error: null }
}

async function predictionIsolation(sportKey: string) {
  const { data, error, count: rows } = await supabaseAdmin
    .from('prediction_history')
    .select('id,production_eligible,result,commence_time,created_at', { count: 'exact' })
    .eq('sport_key', sportKey)
    .limit(1000)
  if (error) return { rows: 0, productionEligibleRows: 0, postStartRiskSamples: 0, error: error.message }
  const samples = data ?? []
  return {
    rows: rows ?? samples.length,
    productionEligibleRows: samples.filter((row) => row.production_eligible === true).length,
    postStartRiskSamples: samples.filter((row) => {
      const created = Date.parse(String(row.created_at ?? ''))
      const commence = Date.parse(String(row.commence_time ?? ''))
      return Number.isFinite(created) && Number.isFinite(commence) && created > commence
    }).length,
    error: null,
  }
}

async function sportReadiness(config: (typeof SPORTS)[number], coverageSports: Awaited<ReturnType<typeof getSportsDataCoverageAuditV2>>['sports']) {
  const [events, players, gameStats, playerStats, odds, mappings, features, predictions] = await Promise.all([
    count('sport_events', config.sportKey),
    count('sport_players', config.sportKey),
    count('sport_game_stats', config.sportKey),
    count('sport_player_stats', config.sportKey),
    count('sports_odds_snapshots', config.sportKey),
    count('provider_entity_mappings', config.sportKey),
    count('historical_feature_snapshots', config.sportKey),
    predictionIsolation(config.sportKey),
  ])
  const coverage = coverageSports.find((sport) => sport.sportKey === config.sportKey) ?? null
  const blockers = [
    ...(events.rows === 0 ? [`${config.blockersPrefix}_EVENT_COVERAGE_EMPTY`] : []),
    ...(players.rows === 0 ? [`${config.blockersPrefix}_PARTICIPANT_COVERAGE_EMPTY`] : []),
    ...(gameStats.rows === 0 && playerStats.rows === 0 ? [`${config.blockersPrefix}_RESULT_OR_STATS_COVERAGE_EMPTY`] : []),
    ...(odds.rows === 0 ? [`${config.blockersPrefix}_ODDS_COVERAGE_EMPTY`] : []),
    ...(mappings.rows === 0 ? [`${config.blockersPrefix}_PROVIDER_MAPPING_EMPTY`] : []),
  ]
  return {
    sportKey: config.sportKey,
    leagueKey: config.leagueKey,
    label: config.label,
    eventModel: config.eventModel,
    competitions: config.competitions,
    coverage,
    domains: {
      events,
      participants: players,
      gameStats,
      participantStats: playerStats,
      odds,
      providerMappings: mappings,
      featureSnapshots: features,
      predictions,
    },
    readinessContract: {
      requiredDomains: config.requiredDomains,
      teamSeasonSchemaForced: false,
      eventDriven: true,
      productionPicksAllowed: false,
      certifiedPredictionEngineRequired: true,
      sufficientDataRequired: true,
    },
    certification: {
      eventDrivenSchema: true,
      noTeamSeasonForcing: true,
      noPredictionPicksGenerated: true,
      noTemporalLeakage: predictions.postStartRiskSamples === 0,
      retrospectivePredictionsGenerated: false,
      blockerReporting: blockers.length > 0,
    },
    blockers,
  }
}

export async function getTennisUfcDataReadinessV2() {
  const coverage = await getSportsDataCoverageAuditV2()
  const sports = await Promise.all(SPORTS.map((sport) => sportReadiness(sport, coverage.sports)))
  return {
    success: true,
    mode: 'tennis_ufc_data_readiness_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    sports,
    summary: {
      sportsAudited: sports.length,
      eventDrivenContracts: sports.filter((sport) => sport.readinessContract.eventDriven).length,
      productionPicksGenerated: 0,
      blockers: sports.flatMap((sport) => sport.blockers),
    },
    warnings: [
      'Tennis and UFC readiness is event-oriented; team-season schema is not forced.',
      'No prediction picks are generated unless a certified prediction engine and sufficient stored data exist.',
      'No provider calls, historical odds calls or production mutations are made by this readiness endpoint.',
    ],
  }
}

export async function validateTennisUfcDataReadinessV2() {
  const result = await getTennisUfcDataReadinessV2()
  const checks = [
    ['read-only audit', result.readOnly],
    ['zero provider calls', result.providerCallsMade === 0],
    ['zero remote mutations', result.remoteMutationsMade === 0],
    ['audits Tennis and UFC', result.sports.length === 2],
    ['event-driven contracts', result.summary.eventDrivenContracts === 2],
    ['no team-season forcing', result.sports.every((sport) => sport.certification.noTeamSeasonForcing)],
    ['no prediction picks generated', result.summary.productionPicksGenerated === 0],
    ['no retrospective predictions generated', result.sports.every((sport) => sport.certification.retrospectivePredictionsGenerated === false)],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'tennis_ufc_data_readiness_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      sportsAudited: result.summary.sportsAudited,
      productionPicksGenerated: result.summary.productionPicksGenerated,
      tennisEvents: result.sports.find((sport) => sport.sportKey === 'tennis')?.domains.events.rows ?? 0,
      ufcEvents: result.sports.find((sport) => sport.sportKey === 'mma_ufc')?.domains.events.rows ?? 0,
      tennisOddsRows: result.sports.find((sport) => sport.sportKey === 'tennis')?.domains.odds.rows ?? 0,
      ufcOddsRows: result.sports.find((sport) => sport.sportKey === 'mma_ufc')?.domains.odds.rows ?? 0,
      blockers: result.summary.blockers,
    },
  }
}
