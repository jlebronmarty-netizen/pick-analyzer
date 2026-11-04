/** Portable Edge Lab calculations. No I/O, training, betting, NHL or legacy writes.
 * Mathematical ports of the source modules listed in provenance.json.
 * New input/cohort versions: this is not a claim of unchanged production serving.
 */
export const COHORT = 'EDGE_LAB_RESTART_20261104';
export const SOCCER_MODEL = 'SOCCER_V0_PICK_PORT_1';
export const TT_MODELS = ['TT_ML_V1_PICK_PORT_1','TT_TOTAL_V1_PICK_PORT_1','TT_SETS_OE_V1_PICK_PORT_1'];
export const MLB_MODEL = 'PE_ML_V1_PICK_PORT_1';
export const MLB_ALPHA = 0.309074924388078;
export const MLB_Q_HOME = 0.797833837140924;
const fail = message => { throw new Error(message); };
const finite = x => typeof x === 'number' && Number.isFinite(x);
export const normalize = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function playerKey(name){ const key=normalize(name).split(/\s+/).filter(Boolean).sort().join('|');return key||fail('INVALID_PLAYER'); }
export function soccerDistribution(home, away){
 if(!finite(home)||!finite(away)||home<=0||away<=0||home>4||away>4)fail('INVALID_GOAL_MEANS');
 const poisson=(lambda,n)=>{let p=Math.exp(-lambda);for(let k=1;k<=n;k++)p*=lambda/k;return p;};
 let h=0,d=0,a=0,o=0,u=0,b=0,mass=0;
 for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const p=poisson(home,i)*poisson(away,j);mass+=p;if(i>j)h+=p;else if(i===j)d+=p;else a+=p;if(i+j>2.5)o+=p;else u+=p;if(i>0&&j>0)b+=p;}
 return {expectedGoalsHome:home,expectedGoalsAway:away,oneXTwo:{home:h/mass,draw:d/mass,away:a/mass},total25:{over:o/mass,under:u/mass},btts:{yes:b/mass,no:1-b/mass}};
}
export function soccerProjection(history, homeName, awayName){
 const teams=new Map();let hg=0,ag=0,n=0;
 const empty=()=>({homeGames:0,awayGames:0,homeFor:0,homeAgainst:0,awayFor:0,awayAgainst:0});
 for(const row of history){
  if(!Number.isInteger(row.homeGoals)||!Number.isInteger(row.awayGoals)||Math.min(row.homeGoals,row.awayGoals)<0||row.homeTeam===row.awayTeam)fail('INVALID_HISTORY');
  const h=teams.get(row.homeTeam)??empty(),a=teams.get(row.awayTeam)??empty();
  h.homeGames++;h.homeFor+=row.homeGoals;h.homeAgainst+=row.awayGoals;a.awayGames++;a.awayFor+=row.awayGoals;a.awayAgainst+=row.homeGoals;
  teams.set(row.homeTeam,h);teams.set(row.awayTeam,a);hg+=row.homeGoals;ag+=row.awayGoals;n++;
 }
 const h=teams.get(homeName)??empty(),a=teams.get(awayName)??empty();
 const lh=(hg+8*1.45)/(n+8),la=(ag+8*1.15)/(n+8);
 const shrunk=(v,c,avg)=>(v+3*avg)/(c+3);
 const hm=Math.max(.2,Math.min(4,lh*(shrunk(h.homeFor,h.homeGames,lh)/lh)*(shrunk(a.awayAgainst,a.awayGames,lh)/lh)));
 const am=Math.max(.2,Math.min(4,la*(shrunk(a.awayFor,a.awayGames,la)/la)*(shrunk(h.homeAgainst,h.homeGames,la)/la)));
 return {...soccerDistribution(hm,am),warmupComplete:h.homeGames>=5&&a.awayGames>=5&&n>=20,history:{league:n,homeSplit:h.homeGames,awaySplit:a.awayGames}};
}
export function tableTennisProjection(finals, input){
 const ratings={},hist={},seen=new Set();let matches=0,total=0,odd=0;
 const before=Date.parse(input.scheduledAt),asOf=Date.parse(input.asOf);if(!finite(before)||!finite(asOf)||before<=asOf)fail('NOT_PREGAME');
 const selected=finals.filter(r=>Date.parse(r.scheduledAt)<asOf&&Date.parse(r.capturedAt)<=asOf).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.sourceMatchId.localeCompare(b.sourceMatchId));
 for(const r of selected){
  const id=r.source+':'+r.sourceMatchId;if(seen.has(id))fail('DUPLICATE_FINAL');seen.add(id);
  if(!Number.isInteger(r.setsA)||!Number.isInteger(r.setsB)||Math.max(r.setsA,r.setsB)!==3||Math.min(r.setsA,r.setsB)<0||Math.min(r.setsA,r.setsB)>2||!Number.isInteger(r.totalPoints)||r.totalPoints<=0)fail('INVALID_FINAL');
  const a=playerKey(r.playerA),b=playerKey(r.playerB);if(a===b)fail('AMBIGUOUS_PLAYER');
  const ra=ratings[a]??1500,rb=ratings[b]??1500,p=1/(1+10**((rb-ra)/400)),delta=24*((r.setsA>r.setsB?1:0)-p);
  ratings[a]=ra+delta;ratings[b]=rb-delta;const isOdd=(r.setsA+r.setsB)%2===1;
  for(const key of [a,b]){hist[key]??={matches:0,total:0,odd:0};hist[key].matches++;hist[key].total+=r.totalPoints;hist[key].odd+=Number(isOdd);}
  matches++;total+=r.totalPoints;odd+=Number(isOdd);
 }
 const a=playerKey(input.playerA),b=playerKey(input.playerB);if(a===b)fail('AMBIGUOUS_PLAYER');
 const ah=hist[a]??{matches:0},bh=hist[b]??{matches:0};
 if(ah.matches<3||bh.matches<3)return {status:'ABSTAIN',reason:'insufficient_player_history',historyA:ah.matches,historyB:bh.matches};
 const p=1/(1+10**(((ratings[b]??1500)-(ratings[a]??1500))/400)),weight=ah.matches+bh.matches;
 return {status:'FORECAST',historyA:ah.matches,historyB:bh.matches,probabilityA:p,probabilityB:1-p,projectedTotal:(((ah.total/ah.matches+bh.total/bh.matches)/2)*weight+(total/matches)*4)/(weight+4),probabilityOdd:(ah.odd+bh.odd+(odd/matches)*8)/(weight+8)};
}
export function mlbMean(f){
 for(const k of ['teamPriorRpg','opponentPriorRa'])if(!finite(f[k])||f[k]<0)fail('INVALID_MLB_INPUT');
 for(const k of ['teamPriorGames','opponentPriorGames'])if(!Number.isInteger(f[k])||f[k]<20)fail('INSUFFICIENT_MLB_HISTORY');
 const mean=.38*f.teamPriorRpg+.62*f.opponentPriorRa;if(mean<=0)fail('INVALID_MLB_MEAN');return mean;
}
function nbSupport(mean){
 if(!finite(mean)||mean<0)fail('INVALID_MLB_MEAN');const r=1/MLB_ALPHA,p=r/(r+mean),values=[p**r];let sum=values[0];
 for(let k=1;k<=80&&1-sum>1e-12;k++){values[k]=values[k-1]*((k-1+r)/k)*(1-p);sum+=values[k];}
 if(1-sum>1e-12)fail('NB_TAIL_TOO_LARGE');return values.map(x=>x/sum);
}
export function mlbMoneyline(homeMean,awayMean){
 const h=nbSupport(homeMean),a=nbSupport(awayMean);let home=0,tie=0,away=0;
 for(let i=0;i<h.length;i++)for(let j=0;j<a.length;j++){const p=h[i]*a[j];if(i>j)home+=p;else if(i===j)tie+=p;else away+=p;}
 return {home:home+MLB_Q_HOME*tie,away:away+(1-MLB_Q_HOME)*tie,qHome:MLB_Q_HOME,regulation:{home,tie,away}};
}
export function statisticalOutcome(f, final){
 if(final.id!==f.event_id||final.home!==f.home_name||final.away!==f.away_name)return {status:'DISPUTE',reason:'IDENTITY_CHANGED'};
 if(Date.parse(final.scheduled_at)!==Date.parse(f.scheduled_at))return {status:'DISPUTE',reason:'SCHEDULE_CHANGED'};
 if(!final.completed)return {status:'PENDING'};
 if(!Number.isInteger(final.home_score)||!Number.isInteger(final.away_score)||Math.min(final.home_score,final.away_score)<0)return {status:'NOT_VERIFIABLE'};
 const actual=f.market==='1X2'?(final.home_score>final.away_score?'HOME':final.home_score<final.away_score?'AWAY':'DRAW'):(final.home_score+final.away_score>2.5?'OVER':'UNDER');
 if(!['1X2','TOTAL_2_5'].includes(f.market))return {status:'NOT_VERIFIABLE'};
 return {status:f.selection===actual?'W':'L',actual};
}
export function metric(rows){const wins=rows.filter(r=>r.status==='W').length,losses=rows.filter(r=>r.status==='L').length;return {wins,losses,evaluable:wins+losses,accuracy:wins+losses?wins/(wins+losses):null};}
