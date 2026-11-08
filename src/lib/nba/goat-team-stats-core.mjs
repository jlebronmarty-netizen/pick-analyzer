export const TEAM_STATS_EXPECTED=30;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function normalizeTeamSeasonAverages(payload,{season,receivedAt}){
 if(!payload||!Array.isArray(payload.data)||!Number.isInteger(season)||!Number.isFinite(Date.parse(receivedAt)))throw Error('NBA_GOAT_TEAM_STATS_PAYLOAD_INVALID');
 if(payload.data.length!==TEAM_STATS_EXPECTED)throw Error('NBA_GOAT_TEAM_STATS_TEAM_COUNT_INVALID');
 const seen=new Set(),rows=[];
 for(const item of payload.data){
  const team=item?.team,stats=item?.stats;
  if(!team||!Number.isInteger(team.id)||!team.full_name||item.season!==season||item.season_type!=='regular'||!stats)throw Error('NBA_GOAT_TEAM_STATS_IDENTITY_INVALID');
  if(seen.has(team.id)||[stats.w,stats.l,stats.gp].some(v=>!Number.isInteger(v)||v<0)||stats.gp!==stats.w+stats.l||!finite(stats.pts)||!finite(stats.plus_minus)||!finite(stats.w_pct)||stats.w_pct<0||stats.w_pct>1)throw Error('NBA_GOAT_TEAM_STATS_VALUES_INVALID');
  seen.add(team.id);
  const allowed=Number((stats.pts-stats.plus_minus).toFixed(4));
  if(!finite(allowed)||allowed<50||allowed>180||stats.pts<50||stats.pts>180)throw Error('NBA_GOAT_TEAM_STATS_POINTS_INVALID');
  rows.push({team_name:team.full_name,sport_key:'basketball_nba',season:String(season),wins:stats.w,losses:stats.l,ties:0,home_wins:0,home_losses:0,away_wins:0,away_losses:0,last_5_wins:0,last_5_losses:0,last_10_wins:0,last_10_losses:0,streak:null,win_percentage:stats.w_pct,updated_at:receivedAt,raw_data:{source¶»§q«^