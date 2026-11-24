import type {NcaabEventArchiveEvidence} from '@/lib/ncaab-archived-evidence';

export type NcaabManualMetric = {value:number|null;games:number};
export type NcaabManualStats = {
  fieldGoalPct:NcaabManualMetric;threePointPct:NcaabManualMetric;freeThrowPct:NcaabManualMetric;
  rebounds:NcaabManualMetric;assists:NcaabManualMetric;turnovers:NcaabManualMetric;
};
export type NcaabManualPeriod = {period:1|2;games:number;pointsFor:number|null;pointsAgainst:number|null};
export type NcaabManualAggregate = {
  games:number;wins:number;losses:number;pointsFor:number|null;pointsAgainst:number|null;margin:number|null;
  stats:NcaabManualStats;periods:NcaabManualPeriod[];
};
export type NcaabManualRecentGame = {
  eventId:string;scheduledAt:string;date:string;opponentId:string;opponentName:string;
  venue:'HOME'|'AWAY'|'NEUTRAL'|'UNKNOWN';pointsFor:number;pointsAgainst:number;result:'W'|'L';
  sourceId:string;capturedAt:string;
  periods:{period:number;pointsFor:number;pointsAgainst:number}[];
  stats:{fieldGoalsMade:number|null;fieldGoalsAttempted:number|null;threePointersMade:number|null;
    threePointersAttempted:number|null;freeThrowsMade:number|null;freeThrowsAttempted:number|null;
    rebounds:number|null;assists:number|null;turnovers:number|null};
  detailCapturedAt:string|null;
};
export type NcaabManualTeam = {
  id:string;name:string;abbreviation:string|null;conference:string|null;
  reportedRecord:{overall:string|null;home:string|null;away:string|null;conference:string|null;
    capturedAt:string;sourceId:string;eventId:string}|null;
  archive:NcaabManualAggregate&{completeSeason:boolean;from:string|null;through:string|null;
    home:NcaabManualAggregate;away:NcaabManualAggregate;neutral:NcaabManualAggregate};
  last10:NcaabManualAggregate&{complete:boolean;sequenceVerified:boolean;expectedGames:number|null;
    coverage:'COMPLETE_TEN'|'SEASON_UNDER_TEN'|'PARTIAL'|'NO_HISTORY'};
  recentGames:NcaabManualRecentGame[];
  rest:{lastGameAt:string|null;daysOff:number|null;verified:boolean};
  warnings:string[];
};
export type NcaabManualFixture = {
  eventId:string;scheduledAt:string;date:string;homeId:string;awayId:string;homeName:string;awayName:string;
  state:'PREGAME'|'LIVE'|'FINAL'|'POSTPONED'|'CANCELLED'|'UNKNOWN';neutralSite:boolean|null;
  homeScore:number|null;awayScore:number|null;capturedAt:string;sourceId:string;
  forecast:{model:string;emittedAt:string;homePoints:number|null;awayPoints:number|null;
    homeProbability:number|null;awayProbability:number|null;projectedMargin:number|null;projectedTotal:number|null;
    winnerTeamId:string|null;status:'EXPERIMENTAL'}|null;
  markets:NcaabEventArchiveEvidence;
};
export type NcaabManualDataReport = {
  schemaVersion:'NCAAB_MANUAL_DATA_V1';sport:'NCAAB';status:'READY'|'PARTIAL'|'EMPTY'|'UNAVAILABLE';
  date:string;timezone:'America/Puerto_Rico';readAt:string;seasonEndingYear:number;
  readOnly:true;providerCalls:0;databaseWrites:0;predictionAdjustment:false;modelPromoted:false;
  source:{name:'Archivo ESPN de Pick';slateCapturedAt:string|null;latestCapturedAt:string|null;
    archiveFrom:string|null;archiveThrough:string|null;sourceDates:string[];missingDates:string[]};
  coverage:{games:number;teams:number;archivedFinals:number;sourceReceipts:number;
    teamsWithCompleteLast10:number;teamsWithVerifiedSeason:number;gamesWithPeriods:number;gamesWithDetailedStats:number;
    excludedEvents:number;readComplete:boolean};
  fixtures:NcaabManualFixture[];teams:NcaabManualTeam[];warnings:string[];
};
