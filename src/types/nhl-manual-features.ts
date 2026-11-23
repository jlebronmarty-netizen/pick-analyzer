export type NhlManualFeatureTeam = {
  abbrev:string;
  season:{record:string|null;games:number|null;points:number|null;goalsForPerGame:number|null;goalsAgainstPerGame:number|null;throughDate:string|null};
  last10:{record:string|null;games:number|null;complete:boolean;sequenceVerified:boolean;goalsForPerGame:number|null;goalsAgainstPerGame:number|null;shotsForPerGame:number|null;shotsAgainstPerGame:number|null;recentEventIds:string[];periods:{period:number;games:number|null;goalsForPerGame:number|null;goalsAgainstPerGame:number|null;shotsForPerGame:number|null;shotsAgainstPerGame:number|null;goalsCoverage:number|null;shotsCoverage:number|null}[]};
  specialTeams:{powerPlayPct:number|null;penaltyKillPct:number|null;currentGamesMatch:boolean;capturedAt:string|null};
  rest:{daysOff:number|null;backToBack:boolean|null;verified:boolean};
  goalie:{name:string|null;status:string;checkedAt:string|null};
};

export type NhlManualFeaturesReport = {
  status:'READY'|'EMPTY'|'NOT_INSTALLED'|'READ_UNAVAILABLE'|'SOURCE_SCAN_CAPPED';
  date:string;readAt:string;readOnly:true;predictionAdjustment:false;modelPromoted:false;
  summary:{snapshots:number;games:number;pregameGames:number;bothLast10Complete:number;bothGoaliesConfirmed:number;latestAvailableAsOf:string|null}|null;
  fixtures:{eventId:string;scheduledAt:string;availableAsOf:string;sourceGeneratedAt:string;sourceRunId:string;sourceSnapshotSha256:string;phase:string;teams:{away:NhlManualFeatureTeam;home:NhlManualFeatureTeam};coverage:{bothLast10Complete:boolean;bothGoaliesConfirmed:boolean;standingsCurrent:boolean;standingsThrough:string|null}}[];
  warnings:string[];
};
