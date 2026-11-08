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
  rows.push({team_name:team.full_name,sport_key:'basketball_nba',season:String(season),wins:stats.w,losses:stats.l,ties:0,home_wins:0,home_losses:0,away_wins:0,away_losses:0,last_5_wins:0,last_5_losses:0,last_10_wins:0,last_10_losses:0,streak:null,win_percentage:stats.w_pct,updated_at:receivedAt,raw_data:{source:'balldontlie_team_season_averages',version:'NBA_GOAT_TEAM_STATS_V1',providerTeamId:String(team.id),seasonType:'regular',gamesPlayed:stats.gp,points_per_game:stats.pts,opponent_points_per_game:allowed,net_rating:stats.plus_minus,source_received_at:receivedAt,production_eligible:true,trial:false,scrambled:false,recentSplit:'OVERALL_FALLBACK_NOT_FABRICATED',homeAwaySplit:'OVERALL_FALLBACK_NOT_FABRICATED'}});
 }
 return rows.sort((a,b)=>a.team_name.localeCompare(b.team_name));
}
export function teamStatsFresh(rows,now=new Date(),maxAgeMs=21600000){
 if(!Array.isArray(rows)||rows.length!==TEAM_STATS_EXPECTED||!Number.isFinite(now.getTime()))return false;
 const names=new Set();
 return rows.every(r=>{const t=Date.parse(r.updated_at);if(!r.team_name||names.has(r.team_name)||!Number.isFinite(t)||t>now.getTime()||now.getTime()-t>maxAgeMs||r.raw_data?.source!=='balldontlie_team_season_averages'||r.raw_data?.production_eligible!==true)return false;names.add(r.team_name);return true;});
}
