import 'server-only'

import { SPORTS } from '@/config/sports.config'

type SeasonModel = 'calendar_year' | 'cross_year' | 'season_year_with_cross_year_postseason' | 'competition_specific' | 'event_driven'
type SeasonType = 'preseason' | 'regular' | 'postseason' | 'playoffs' | 'tournament' | 'event'
type GovernanceStatus = 'implemented_contract' | 'migration_ready_future' | 'blocked_pending_data'

type CompetitionGovernance = {
  sportKey: string
  leagueKey: string
  competitionKey: string
  displayName: string
  active: boolean
  timezone: string
  country?: string
  region?: string
  seasonModel: SeasonModel
  currentSeasonId: string
  previousSeasonId: string
  supportedSeasonTypes: SeasonType[]
  seasonStart: string | null
  seasonEnd: string | null
  providerIds: Record<string, string>
  sourceProvenance: string[]
  governanceStatus: GovernanceStatus
  notes: string[]
}

type CompetitionSeed = {
  key: string
  sportKey: string
  displayName: string
  active: boolean
  country?: string
  region?: string
  providerIds: Record<string, string>
}

const STATIC_RULES: Record<string, Omit<CompetitionGovernance, 'displayName' | 'active' | 'providerIds' | 'country' | 'region'>> = {
  mlb: {
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    competitionKey: 'mlb',
    timezone: 'America/New_York',
    seasonModel: 'calendar_year',
    currentSeasonId: '2026',
    previousSeasonId: '2025',
    supportedSeasonTypes: ['preseason', 'regular', 'postseason'],
    seasonStart: '2026-03-25',
    seasonEnd: '2026-11-05',
    sourceProvenance: ['sports.config.ts', 'multi-sport-registry.service.ts', 'stored sport_events.season'],
    governanceStatus: 'implemented_contract',
    notes: ['Calendar-year season; postseason remains part of the same season ID.'],
  },
  nba: {
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    competitionKey: 'nba',
    timezone: 'America/New_York',
    seasonModel: 'cross_year',
    currentSeasonId: '2025-26',
    previousSeasonId: '2024-25',
    supportedSeasonTypes: ['preseason', 'regular', 'playoffs'],
    seasonStart: '2025-10-01',
    seasonEnd: '2026-06-30',
    sourceProvenance: ['sports.config.ts', 'multi-sport-registry.service.ts', 'stored sport_events.season'],
    governanceStatus: 'implemented_contract',
    notes: ['Cross-year season; playoffs occur in the ending calendar year.'],
  },
  nfl: {
    sportKey: 'americanfootball_nfl',
    leagueKey: 'nfl',
    competitionKey: 'nfl',
    timezone: 'America/New_York',
    seasonModel: 'season_year_with_cross_year_postseason',
    currentSeasonId: '2026',
    previousSeasonId: '2025',
    supportedSeasonTypes: ['preseason', 'regular', 'playoffs'],
    seasonStart: '2026-08-01',
    seasonEnd: '2027-02-15',
    sourceProvenance: ['sports.config.ts', 'multi-sport-registry.service.ts'],
    governanceStatus: 'implemented_contract',
    notes: ['Season ID is the kickoff year; playoffs and championship may occur in the next calendar year.'],
  },
  nhl: {
    sportKey: 'icehockey_nhl',
    leagueKey: 'nhl',
    competitionKey: 'nhl',
    timezone: 'America/New_York',
    seasonModel: 'cross_year',
    currentSeasonId: '2025-26',
    previousSeasonId: '2024-25',
    supportedSeasonTypes: ['preseason', 'regular', 'playoffs'],
    seasonStart: '2025-10-01',
    seasonEnd: '2026-06-30',
    sourceProvenance: ['sports.config.ts', 'multi-sport-registry.service.ts'],
    governanceStatus: 'implemented_contract',
    notes: ['Cross-year season; goalie/starter readiness is a future data-domain concern.'],
  },
  soccer_generic: {
    sportKey: 'soccer',
    leagueKey: 'soccer_generic',
    competitionKey: 'soccer_generic',
    timezone: 'competition_timezone_required',
    seasonModel: 'competition_specific',
    currentSeasonId: 'competition_specific',
    previousSeasonId: 'competition_specific',
    supportedSeasonTypes: ['regular', 'playoffs', 'tournament'],
    seasonStart: null,
    seasonEnd: null,
    sourceProvenance: ['sports.config.ts', 'multi-sport-registry.service.ts'],
    governanceStatus: 'migration_ready_future',
    notes: ['Soccer must be governed competition by competition; global soccer coverage is not claimed.'],
  },
  bsn_pr: {
    sportKey: 'basketball_bsn',
    leagueKey: 'bsn_pr',
    competitionKey: 'bsn_pr',
    timezone: 'America/Puerto_Rico',
    seasonModel: 'calendar_year',
    currentSeasonId: '2026',
    previousSeasonId: '2025',
    supportedSeasonTypes: ['regular', 'playoffs'],
    seasonStart: null,
    seasonEnd: null,
    sourceProvenance: ['sports.config.ts', 'multi-sport-registry.service.ts', 'official_bsn_homepage stored evidence'],
    governanceStatus: 'implemented_contract',
    notes: ['Custom league adapter; exact season windows remain source-evidence driven.'],
  },
  atp: {
    sportKey: 'tennis',
    leagueKey: 'atp',
    competitionKey: 'atp',
    timezone: 'event_timezone_required',
    seasonModel: 'event_driven',
    currentSeasonId: 'event_driven_2026',
    previousSeasonId: 'event_driven_2025',
    supportedSeasonTypes: ['tournament', 'event'],
    seasonStart: '2026-01-01',
    seasonEnd: '2026-12-31',
    sourceProvenance: ['sports.config.ts', 'multi-sport-registry.service.ts'],
    governanceStatus: 'migration_ready_future',
    notes: ['Tournament and surface metadata are required before production prediction use.'],
  },
  wta: {
    sportKey: 'tennis',
    leagueKey: 'wta',
    competitionKey: 'wta',
    timezone: 'event_timezone_required',
    seasonModel: 'event_driven',
    currentSeasonId: 'event_driven_2026',
    previousSeasonId: 'event_driven_2025',
    supportedSeasonTypes: ['tournament', 'event'],
    seasonStart: '2026-01-01',
    seasonEnd: '2026-12-31',
    sourceProvenance: ['sports.config.ts', 'multi-sport-registry.service.ts'],
    governanceStatus: 'migration_ready_future',
    notes: ['Tournament and surface metadata are required before production prediction use.'],
  },
  ufc: {
    sportKey: 'mma_ufc',
    leagueKey: 'ufc',
    competitionKey: 'ufc',
    timezone: 'event_timezone_required',
    seasonModel: 'event_driven',
    currentSeasonId: 'event_driven_2026',
    previousSeasonId: 'event_driven_2025',
    supportedSeasonTypes: ['event'],
    seasonStart: '2026-01-01',
    seasonEnd: '2026-12-31',
    sourceProvenance: ['sports.config.ts', 'multi-sport-registry.service.ts'],
    governanceStatus: 'migration_ready_future',
    notes: ['Fight cards, bouts, divisions and weigh-in metadata are event-level governance domains.'],
  },
}

const COMPETITIONS: readonly CompetitionSeed[] = [
  { key: 'mlb', sportKey: 'baseball_mlb', displayName: 'Major League Baseball', active: true, country: 'US', region: 'North America', providerIds: { 'the-odds-api': 'baseball_mlb' } },
  { key: 'bsn_pr', sportKey: 'basketball_bsn', displayName: 'Baloncesto Superior Nacional', active: true, country: 'PR', region: 'Puerto Rico', providerIds: { supabase: 'basketball_bsn' } },
  { key: 'nba', sportKey: 'basketball_nba', displayName: 'National Basketball Association', active: true, country: 'US', region: 'North America', providerIds: { 'the-odds-api': 'basketball_nba' } },
  { key: 'nfl', sportKey: 'americanfootball_nfl', displayName: 'National Football League', active: true, country: 'US', region: 'North America', providerIds: { 'the-odds-api': 'americanfootball_nfl' } },
  { key: 'nhl', sportKey: 'icehockey_nhl', displayName: 'National Hockey League', active: true, country: 'US', region: 'North America', providerIds: { 'the-odds-api': 'icehockey_nhl' } },
  { key: 'soccer_generic', sportKey: 'soccer', displayName: 'Soccer', active: true, region: 'Global', providerIds: { 'the-odds-api': 'soccer' } },
  { key: 'atp', sportKey: 'tennis', displayName: 'ATP Tennis', active: true, region: 'Global', providerIds: { 'the-odds-api': 'tennis_atp' } },
  { key: 'wta', sportKey: 'tennis', displayName: 'WTA Tennis', active: true, region: 'Global', providerIds: { 'the-odds-api': 'tennis_wta' } },
  { key: 'ufc', sportKey: 'mma_ufc', displayName: 'Ultimate Fighting Championship', active: true, region: 'Global', providerIds: { 'the-odds-api': 'mma_mixed_martial_arts' } },
]

function nowIso() {
  return new Date().toISOString()
}

export function getSeasonCompetitionGovernanceV2() {
  const competitions = COMPETITIONS.map((league) => {
    const rule = STATIC_RULES[league.key] ?? null
    if (!rule) {
      return {
        sportKey: league.sportKey,
        leagueKey: league.key,
        competitionKey: league.key,
        displayName: league.displayName,
        active: league.active,
        timezone: 'competition_timezone_required',
        country: league.country,
        region: league.region,
        seasonModel: 'competition_specific' as const,
        currentSeasonId: 'unclassified',
        previousSeasonId: 'unclassified',
        supportedSeasonTypes: ['regular'] as SeasonType[],
        seasonStart: null,
        seasonEnd: null,
        providerIds: league.providerIds,
        sourceProvenance: ['multi-sport-registry.service.ts'],
        governanceStatus: 'blocked_pending_data' as const,
        notes: ['No explicit V2 season rule exists yet.'],
      }
    }
    return {
      ...rule,
      displayName: league.displayName,
      active: league.active,
      country: league.country,
      region: league.region,
      providerIds: league.providerIds,
    }
  })

  const sportDefinitions = SPORTS.filter((sport) => sport.key !== 'all').map((sport) => ({
    sportKey: sport.key,
    label: sport.label,
    configuredSeasonFormat: sport.seasonFormat,
    normalizedSeasonModel: competitions.find((competition) => competition.sportKey === sport.key)?.seasonModel ?? 'competition_specific',
    productionReady: sport.productionReady,
    leagueKeys: sport.leagueKeys,
  }))

  return {
    success: true,
    mode: 'season_competition_governance_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    migrationRequiredToRead: false,
    activationRequired: false,
    competitions,
    sportDefinitions,
    summary: {
      competitionsGoverned: competitions.length,
      implementedContracts: competitions.filter((competition) => competition.governanceStatus === 'implemented_contract').length,
      migrationReadyFuture: competitions.filter((competition) => competition.governanceStatus === 'migration_ready_future').length,
      blockedPendingData: competitions.filter((competition) => competition.governanceStatus === 'blocked_pending_data').length,
      eventDrivenCompetitions: competitions.filter((competition) => competition.seasonModel === 'event_driven').length,
      competitionSpecificCompetitions: competitions.filter((competition) => competition.seasonModel === 'competition_specific').length,
    },
    warnings: [
      'Governance V2 is a read-only contract and does not apply production SQL.',
      'Soccer remains competition-specific; no global soccer season is claimed.',
      'Tennis and UFC remain event-driven; team-season assumptions are invalid for those sports.',
    ],
  }
}

export function validateSeasonCompetitionGovernanceV2() {
  const governance = getSeasonCompetitionGovernanceV2()
  const competitions = governance.competitions
  const checks = [
    ['MLB calendar-year season model', competitions.some((competition) => competition.leagueKey === 'mlb' && competition.seasonModel === 'calendar_year')],
    ['NBA cross-year season model', competitions.some((competition) => competition.leagueKey === 'nba' && competition.seasonModel === 'cross_year')],
    ['NFL postseason can cross calendar year', competitions.some((competition) => competition.leagueKey === 'nfl' && competition.seasonModel === 'season_year_with_cross_year_postseason')],
    ['Soccer is competition-specific', competitions.some((competition) => competition.sportKey === 'soccer' && competition.seasonModel === 'competition_specific')],
    ['Tennis is event-driven', competitions.filter((competition) => competition.sportKey === 'tennis').every((competition) => competition.seasonModel === 'event_driven')],
    ['UFC is event-driven', competitions.some((competition) => competition.sportKey === 'mma_ufc' && competition.seasonModel === 'event_driven')],
    ['normal GET uses zero provider calls', governance.providerCallsMade === 0],
    ['normal GET uses zero remote mutations', governance.remoteMutationsMade === 0],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'season_competition_governance_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
