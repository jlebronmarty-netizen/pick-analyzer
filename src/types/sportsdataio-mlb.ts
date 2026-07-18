export type SportsDataIoMlbGame = {
  GameID?: number | null
  GameId?: number | null
  DateTime?: string | null
  DateTimeUTC?: string | null
  Day?: string | null
  GameDate?: string | null
  AwayTeam?: string | null
  AwayTeamKey?: string | null
  AwayTeamName?: string | null
  HomeTeam?: string | null
  HomeTeamKey?: string | null
  HomeTeamName?: string | null
  AwayTeamProbablePitcherID?: number | null
  HomeTeamProbablePitcherID?: number | null
  AwayTeamStartingPitcherID?: number | null
  HomeTeamStartingPitcherID?: number | null
  AwayTeamStartingPitcher?: string | null
  HomeTeamStartingPitcher?: string | null
  AwayTeamOpener?: boolean | null
  HomeTeamOpener?: boolean | null
  ForecastTempLow?: number | null
  ForecastTempHigh?: number | null
  ForecastDescription?: string | null
  ForecastWindChill?: number | null
  ForecastWindSpeed?: number | null
  ForecastWindDirection?: number | null
  StadiumID?: number | null
  [key: string]: unknown
}

export const SPORTSDATAIO_MLB_DOCUMENTED_STARTER_FIELDS = [
  'AwayTeamProbablePitcherID',
  'HomeTeamProbablePitcherID',
  'AwayTeamStartingPitcherID',
  'HomeTeamStartingPitcherID',
  'AwayTeamStartingPitcher',
  'HomeTeamStartingPitcher',
  'AwayTeamOpener',
  'HomeTeamOpener',
] as const

export const SPORTSDATAIO_MLB_PREVIOUSLY_AUDITED_WRONG_STARTER_FIELDS = [
  'AwayProbablePitcherID',
  'HomeProbablePitcherID',
  'AwayStartingPitcherID',
  'HomeStartingPitcherID',
  'AwayProbablePitcher',
  'HomeProbablePitcher',
  'AwayStartingPitcher',
  'HomeStartingPitcher',
  'AwayPitcher',
  'HomePitcher',
  'AwayPitcherHand',
  'HomePitcherHand',
  'AwayProbablePitcherHand',
  'HomeProbablePitcherHand',
  'AwayStarterConfirmed',
  'HomeStarterConfirmed',
  'AwayPitcherConfirmed',
  'HomePitcherConfirmed',
  'PitcherChanged',
] as const

export const SPORTSDATAIO_MLB_DOCUMENTED_WEATHER_FIELDS = [
  'ForecastTempLow',
  'ForecastTempHigh',
  'ForecastDescription',
  'ForecastWindChill',
  'ForecastWindSpeed',
  'ForecastWindDirection',
] as const

export const SPORTSDATAIO_MLB_DOCUMENTED_VENUE_FIELDS = ['StadiumID'] as const

export const SPORTSDATAIO_MLB_STADIUM_FIELDS = [
  'StadiumID',
  'Name',
  'City',
  'State',
  'Country',
  'Capacity',
  'Surface',
  'LeftField',
  'MidLeftField',
  'LeftCenterField',
  'MidLeftCenterField',
  'CenterField',
  'MidRightCenterField',
  'RightCenterField',
  'MidRightField',
  'RightField',
  'GeoLat',
  'GeoLong',
  'Altitude',
  'HomePlateDirection',
  'Type',
] as const

export const SPORTSDATAIO_MLB_PLAYER_DETAIL_FIELDS = [
  'PlayerID',
  'FirstName',
  'LastName',
  'Position',
  'ThrowHand',
  'InjuryStatus',
] as const

export const SPORTSDATAIO_MLB_PLAYER_SEASON_PITCHING_FIELDS = [
  'ERA',
  'WHIP',
  'StrikeoutsPerNineInnings',
  'WalksPerNineInnings',
  'HitsAllowed',
  'EarnedRuns',
  'HomeRuns',
  'PitchesThrown',
  'InningsPitchedDecimal',
] as const

export const SPORTSDATAIO_MLB_PROJECTED_PLAYER_GAME_FIELDS = [
  'Started',
  'InjuryStatus',
  'GameID',
] as const
