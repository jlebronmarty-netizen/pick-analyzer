// NBA Decision Board V1: read-only, evidence-driven, non-calibrated.
import {rankNbaPreferredSides} from './decision-preference-core.mjs';
import {indexEvidence, teamWindow, playerWindow, readableWindow, marketQuality} from './decision-integrity.mjs';
import {hasValidatedInputs} from '../data-quality/window.mjs';
export const BOARD_VERSION='NBA_DECISION_BOARD_SHADOW_V2_INTEGRITY';
export const BOARD_PERIODS=Object.freeze(['ft','q1','q2','q3','q4','h1','h2']);
const supportedStats=Object.freeze({
 points:['pts'],rebounds:['reb'],assists:['ast'],threes:['fg3m'],
 points_rebounds:['pts','reb'],points_assists:['pts','ast'],
 rebounds_assists:['reb','ast'],points_rebounds_assists:['pts','reb','ast']
});
const num=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const avg=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const round=x=>Math.round(x*100)/100;
const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:null;
const prDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const normalizeTeam=name=>{
 const s=String(name??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
 return s==='la clippers'?'los angeles clippers':s;
};
function observedGame(entry){
 const g=entry?.game??entry;
 if(!g||String(g.status_state).toLowerCase()!=='final'||!iso(g.datetime))return null;
 const qh=[g.home_q1,g.home_q2,g.home_q3,g.home_q4].map(num),
 qa=[g.visitor_q1,g.visitor_q2,g.visitor_q3,g.visitor_q4].map(num);
 if([...qh,...qa].some(v=>!Number.isSafeInteger(v)||v<0))return null;
 const ho=['home_ot1','home_ot2','home_ot3'].reduce((v,k)=>v+(num(g[k])??0),0);
 const ao=['visitor_ot1','visitor_ot2','visitor_ot3'].reduce((v,k)=>v+(num(g[k])??0),0);
 if(qh.reduce((a,b)=>a+b,0)+ho!==num(g.home_team_score)||
    qa.reduce((a,b)=>a+b,0)+ao!==num(g.visitor_team_score))return null;
 const ht=num(g.home_team?.id),at=num(g.visitor_team?.id);
 if(!Number.isSafeInteger(ht)||!Number.isSafeInteger(at))return null;
 return {id:num(g.id),day:String(g.date),t:Date.parse(g.datetime),home:ht,away:at,qh,qa,ho,ao};
}
function periodValue(g,side,period){
 const q=side==='home'?g.qh:g.qa,ot=side==='home'?g.ho:g.ao;
 if(/^q[1-4]$/.test(period))return q[Number(period[1])-1];
 if(period==='h1')return q[0]+q[1];
 if(period==='h2')return q[2]+q[3]+ot;
 if(period==='ft')return q.reduce((a,b)=>a+b,0)+ot;
 return null;
}
function pastScores(history,id,period,currentDay){
 return history.filter(g=>g.t<currentDay&&(g.home===id||g.away===id)).sort((a,b)=>b.t-a.t)
   .map(g=>{const own=g.home===id?'home':'away',other=own==='home'?'away':'home';
     return {scored:periodValue(g,own,period),allowed:periodValue(g,other,period)};});
}
export function projectedPeriod(game,history,period){
 const h=pastScores(history,num(game.home_team?.id),period,Date.parse(game.datetime));
 const a=pastScores(history,num(game.visitor_team?.id),period,Date.parse(game.datetime));
 if(h.length<5||a.length<5)return {ready:false,reason:'INSUFFICIENT_TEAM_HISTORY',nHome:h.length,nAway:a.length};
 const weighted=(xs,key)=>.4*avg(xs.slice(0,5).map(x=>x[key]))+.6*avg(xs.slice(0,10).map(x=>x[key]));
 const home=.5*weighted(h,'scored')+.5*weighted(a,'allowed');
 const away=.5*weighted(a,'scored')+.5*weighted(h,'allowed');
 return {ready:true,home:round(home),away:round(away),total:round(home+away),margin:round(home-away),
   nHome:h.length,nAway:a.length,
   homeL5:round(avg(h.slice(0,5).map(x=>x.scored))),homeL10:round(avg(h.slice(0,10).map(x=>x.scored))),
   awayL5:round(avg(a.slice(0,5).map(x=>x.scored))),awayL10:round(avg(a.slice(0,10).map(x=>x.scored))),
   method:'40% L5 + 60% L10; 50% ataque propio + 50% defensa rival'};
}
function oddsLabel(q){return num(q.american_odds??q.american_odds_approx);}
function eventKey(g){return String(g.id);}
function sideName(g,side){return side==='home'?g.home_team.full_name:side==='away'?g.visitor_team.full_name:side;}
function latestUniqueQuotes(list,keyFn){
 const sorted=list.slice().sort((a,b)=>Date.parse(b.source_received_at??'')-Date.parse(a.source_received_at??''));
 const seen=new Map(),res=[];
 for(const q of sorted){
  const key=keyFn(q),prior=seen.get(key);
  if(prior){
   if(Date.parse(prior.source_received_at)===Date.parse(q.source_received_at) &&
      (prior.line!==q.line || prior.american_odds!==q.american_odds || prior.contract!==q.contract))
     prior.ambiguousPrice=true;
   continue;
  }
  const copy={...q};seen.set(key,copy);res.push(copy);
 }
 return res;
}
export function matchHoopsCapture(games,capture){
 const sourceGames=capture?.games??[],mapped=new Map(),unmatched=[];
 const used=new Set();
 for(const g of games){
  const m=sourceGames.filter(h=>normalizeTeam(h.home_team)===normalizeTeam(g.home_team.full_name) &&
    normalizeTeam(h.away_team)===normalizeTeam(g.visitor_team.full_name) &&
    iso(h.start_time) && h.start_timezone_verified===true &&
    Math.abs(Date.parse(h.start_time)-Date.parse(g.datetime))<=30*60000);
  if(m.length!==1 || used.has(m[0]?.provider_game_id)){unmatched.push(String(g.id));continue;}
  mapped.set(String(m[0].provider_game_id),g);used.add(m[0].provider_game_id);
 }
 return {mapped,unmatched};
}
export function buildPlayerProjection(quote,playerHistory,gameStart,asOf){
 const statistic=String(quote.statistic??'');
 const parts=supportedStats[statistic];
 const line=num(quote.line),id=num(quote.player_id),side=String(quote.side).toLowerCase();
 if(!parts||!Number.isSafeInteger(id)||line===null||!['over','under'].includes(side)||
    !['FULL_GAME_LABEL_OT_UNVERIFIED','FULL_GAME_INCLUDING_OT'].includes(quote.period) ||
    !['STRICT_GREATER_THAN','STRICT_LESS_THAN'].includes(quote.contract) ||
    quote.contract!==(side==='over'?'STRICT_GREATER_THAN':'STRICT_LESS_THAN'))
   return {ready:false,reason:'UNSUPPORTED_PROP_CONTRACT'};
 const seen=new Set(),clean=[];
 for(const r of playerHistory) {
  const game=num(r.provider_game_id);
  if(num(r.player_id)!==id || !Number.isSafeInteger(game)||seen.has(game) ||
    !iso(r.game_datetime)||Date.parse(r.game_datetime)>=gameStart||
    !iso(r.source_captured_at)||Date.parse(r.source_captured_at)>asOf||
    (num(r.minutes_played)??0)<10)continue;
  const points=parts.map(p=>num(r[p]));
  if(points.some(v=>v===null||v<0||!Number.isSafeInteger(v)))continue;
  seen.add(game);clean.push({time:Date.parse(r.game_datetime),value:points.reduce((a,b)=>a+b,0),teamId:num(r.team_id),minutes:num(r.minutes_played)});
 }
 clean.sort((a,b)=>b.time-a.time);
 if(clean.length<5)return {ready:false,reason:'INSUFFICIENT_PLAYER_HISTORY',n:clean.length};
 const current=clean.slice(0,10),first=current.slice(0,5),l5=avg(first.map(x=>x.value)),l10=avg(current.map(x=>x.value));
 const proj=(parts.length===1?.65:.4)*l5+(parts.length===1?.35:.6)*l10;
 const win=v=>side==='over'?v>line:v<line;
 return {ready:true,projection:round(proj),l5:round(l5),l10:round(l10),
   minutesL5:round(avg(first.map(x=>x.minutes))),minutesL10:round(avg(current.map(x=>x.minutes))),
   hit5:first.filter(x=>win(x.value)).length,hit10:current.filter(x=>win(x.value)).length,
   n:current.length,lastTeamId:current[0].teamId,
   method:parts.length===1?'65% L5 + 35% L10':'40% L5 + 60% L10',
   note:'Historial descriptivo; no probabilidad calibrada.'};
}
function freshness(capturedAt,now,minutes){
 const age=(now-Date.parse(capturedAt??''))/60000;
 return Number.isFinite(age)&&age>=0&&age<=minutes?'RECENT':'STALE_OR_FUTURE';
}
function baseRow(g,market,period,side,source,q,projection,advantage,extra={}){
 const label=side==='home'||side==='away'?sideName(g,side):side==='over'?'Over':'Under';
 return {id:String(source)+':'+g.id+':'+period+':'+market+':'+side+':'+String(q.quote_id)+':'+String(q.player_id??''),
  market,period,gameId:g.id,matchup:g.visitor_team.full_name+' @ '+g.home_team.full_name,
  startsAt:g.datetime,label,selection:label,line:num(q.line),odds:oddsLabel(q),
  source,capturedAt:q.source_received_at,quoteId:q.quote_id??null,projection:projection===null?null:round(projection),
  advantage:advantage===null?null:round(advantage),probability:null,expectedValue:null,
  classification:'PASAR',reason:'PROJECTION_NOT_CALIBRATED',qualityScore:null,
  calibration:'UNVALIDATED_SHADOW',regionVerified:false,executionAvailable:false,...extra};
}
/** @param {any} input */
export function buildNbaDecisionBoard({
 scheduleGames=[],historyFinals=[],goatMainQuotes=[],goatPropQuotes=[],playerHistory=[],playerNames={},
 calendar=null,manifests=[],contexts=[],pregame=null,hoopsCapture=null,asOf=new Date().toISOString()
}={}){
 const now=Date.parse(asOf);
 if(!Number.isFinite(now))throw new Error('INVALID_ASOF');
 const day=prDay(asOf);
 const games=scheduleGames.filter(g=>iso(g?.datetime)&&prDay(g.datetime)===day&&g.postponed!==true&&['scheduled','in_progress'].includes(g.status_state))
    .sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime));
 const evidenceIndex=indexEvidence({calendar,playerHistory,manifests,contexts,pregame,asOf});
 const history=(calendar?.games??historyFinals).map(observedGame).filter(Boolean);
 const validFinalIds=new Set(history.map(g=>g.id));
 const historyEvidence={};
 const windowKey=(game,player,stat)=>[game.id,player,stat].join('|');
 const computedPlayers=new Map();
 const rows={ml:[],spread:[],total:[],props:[],periods:[]},projected={};
 const {mapped:hoopsMap,unmatched}=matchHoopsCapture(games,hoopsCapture?.normalized??hoopsCapture);
 const goGameIds=new Set(games.map(g=>String(g.id)));
 const dedupMain=latestUniqueQuotes(goatMainQuotes.filter(q=>goGameIds.has(String(q.provider_game_id))),
   q=>[q.provider_game_id,q.market,q.side].join('|'));
 const dedupProps=latestUniqueQuotes(goatPropQuotes.filter(q=>goGameIds.has(String(q.provider_game_id))),
   q=>[q.provider_game_id,q.player_id,q.statistic,q.side,q.line,q.period].join('|'));
 const sourceHoops=hoopsCapture?.normalized??hoopsCapture??{};
 for(const g of games){
  const homeWindow=teamWindow(evidenceIndex,g,g.home_team.id,validFinalIds);
  const awayWindow=teamWindow(evidenceIndex,g,g.visitor_team.id,validFinalIds);
  const teamKey=windowKey(g,'teams','all');
  historyEvidence[teamKey]={home:homeWindow,away:awayWindow};
  const teamWindows=[homeWindow,awayWindow];
  const priorIds=new Set(teamWindows.flatMap(h=>h.included.map(x=>x.id)));
  const prior=history.filter(h=>priorIds.has(h.id));
  const p={};
  for(const period of BOARD_PERIODS) p[period]=teamWindows.every(readableWindow)
    ? projectedPeriod(g,prior,period) : {ready:false,reason:teamWindows.find(h=>!readableWindow(h)).status};
  projected[g.id]=p;
  for(const q of dedupMain.filter(x=>String(x.provider_game_id)===String(g.id))) {
   if(!['moneyline','spread','total'].includes(q.market))continue;
   if(!['home','away','over','under'].includes(q.side))continue;
   const stat=p.ft,tab=q.market==='moneyline'?'ml':q.market;
   let proj=null,edge=null;
   if(stat.ready){
    if(q.market==='moneyline')proj=q.side==='home'?stat.margin:-stat.margin;
    if(q.market==='spread'){proj=q.side==='home'?stat.margin:-stat.margin;if(num(q.line)!==null)edge=proj+num(q.line);}
    if(q.market==='total'){proj=stat.total;if(num(q.line)!==null)edge=q.side==='over'?proj-num(q.line):num(q.line)-proj;}
   }
   const row=baseRow(g,q.market,'ft',q.side,'GOAT',q,proj,edge,{method:stat.ready?stat.method:null,
    l5:stat.ready?round((stat.homeL5+stat.awayL5)):null,l10:stat.ready?round(stat.homeL10+stat.awayL10):null,
    sample:stat.ready?Math.min(stat.nHome,stat.nAway):null,reason:stat.ready?'NO_CALIBRATED_PROBABILITY':stat.reason,
    dataQuality:marketQuality(q,g,evidenceIndex,teamWindows),historyKey:teamKey,
    quoteFreshness:freshness(q.source_received_at,now,180)});
   rows[tab].push(row);
  }
  for(const q of dedupProps.filter(x=>String(x.provider_game_id)===String(g.id))) {
   if(!['over','under'].includes(q.side)||!['FULL_GAME_LABEL_OT_UNVERIFIED','FULL_GAME_INCLUDING_OT'].includes(q.period))continue;
   const key=windowKey(g,q.player_id,q.statistic);
   if(!computedPlayers.has(key)){
    const window=playerWindow(evidenceIndex,g,num(q.player_id),supportedStats[q.statistic]??[]);
    historyEvidence[key]={player:window};
    const ids=new Set(window.included.map(x=>x.id));
    computedPlayers.set(key,{window,records:(evidenceIndex.compact.get(num(q.player_id))??[])
      .filter(r=>ids.has(r.provider_game_id)&&r.season===g.season&&Date.parse(r.materialized_at)<=now)});
   }
   const {window,records}=computedPlayers.get(key);
   const evidence=readableWindow(window)?buildPlayerProjection(q,records,Date.parse(g.datetime),now):
    {ready:false,reason:window.status,n:window.included.length};
   const teamValid=evidence.ready && [num(g.home_team.id),num(g.visitor_team.id)].includes(evidence.lastTeamId);
   const proj=teamValid?evidence.projection:null,edge=proj===null?null:q.side==='over'?proj-num(q.line):num(q.line)-proj;
   const name=playerNames[String(q.player_id)]??'Jugador ID '+q.player_id;
   const row=baseRow(g,'props','ft',q.side,'GOAT',q,proj,edge,{
    label:name+' · '+q.statistic+' '+q.side.toUpperCase(),playerName:name,playerId:num(q.player_id),
    historyKey:key,dataQuality:marketQuality(q,g,evidenceIndex,[window]),
    statistic:q.statistic,l5:evidence.ready?evidence.l5:null,l10:evidence.ready?evidence.l10:null,
    minutesL5:evidence.minutesL5??null,minutesL10:evidence.minutesL10??null,
    hit5:evidence.hit5??null,hit10:evidence.hit10??null,sample:evidence.n??null,
    method:evidence.method??null,reason:!teamValid?'PLAYER_IDENTITY_OR_HISTORY_UNVERIFIED':'NO_CALIBRATED_PROBABILITY',
    quoteFreshness:freshness(q.source_received_at,now,180)});
   rows.props.push(row);
  }
 }
 for(const q of sourceHoops.quotes??[]){
  const g=hoopsMap.get(String(q.provider_game_id));if(!g||!BOARD_PERIODS.includes(q.period))continue;
  if(!['moneyline','spread','total','team_total_home','team_total_away'].includes(q.market))continue;
  if(!['home','away','over','under'].includes(q.side))continue;
  const period=projected[g.id][q.period];let projection=null,edge=null;
  if(period.ready){
   if(q.market==='moneyline')projection=q.side==='home'?period.margin:-period.margin;
   else if(q.market==='spread'){projection=q.side==='home'?period.margin:-period.margin;edge=projection+num(q.line);}
   else {projection=q.market==='total'?period.total:q.market==='team_total_home'?period.home:period.away;
     if(num(q.line)!==null)edge=q.side==='over'?projection-num(q.line):num(q.line)-projection;}
  }
  const row=baseRow(g,q.market,q.period,q.side,'HoopsAPI',q,projection,edge,{
   l5:period.ready?period.homeL5+period.awayL5:null,l10:period.ready?period.homeL10+period.awayL10:null,
   sample:period.ready?Math.min(period.nHome,period.nAway):null,
   method:period.ready?period.method:null,
   reason:period.ready?'NO_CALIBRATED_PROBABILITY':period.reason,
   historyKey:windowKey(g,'teams','all'),
   dataQuality:marketQuality(q,g,evidenceIndex,Object.values(historyEvidence[windowKey(g,'teams','all')])),
   quoteFreshness:freshness(q.source_received_at,now,360),
   label:(q.market==='team_total_home'?g.home_team.full_name+' ':q.market==='team_total_away'?g.visitor_team.full_name+' ':'')+
     (q.side==='home'||q.side==='away'?sideName(g,q.side):q.side==='over'?'Over':'Under')});
  if(q.period==='ft'&&['moneyline','spread','total'].includes(q.market)){
   // GOAT is preferred for full-game; only use HoopsAPI if GOAT has no exact market + side.
   const tab=q.market==='moneyline'?'ml':q.market;
   if(!rows[tab].some(x=>x.gameId===g.id&&x.market===q.market&&x.selection===row.selection))rows[tab].push(row);
  }else rows.periods.push(row);
 }
 const all=[...rows.ml,...rows.spread,...rows.total,...rows.props,...rows.periods];
 for(const r of all){
  if(!hasValidatedInputs(r)){r.reason=r.dataQuality.status;continue;}
  if(r.projection===null||r.advantage===null||r.quoteFreshness!=='RECENT'||r.sample<5)continue;
  const historic=typeof r.hit10==='number'&&r.sample>=8?r.hit10/r.sample:null;
  const scale=r.market==='props'?Math.max(1,r.projection*.25):r.period==='ft'?12:7;
  const gap=r.advantage/scale;
  // A review priority is NOT a calibrated win probability or a positive EV claim.
  if(gap>=.2&&(historic===null||historic>=.65)){
   r.classification='VIGILAR';r.reason='UNVALIDATED_NUMERIC_GAP';
   r.qualityScore=round(50+Math.min(30,Math.max(0,gap)*14)+(historic===null?0:historic*14)+Math.min(6,r.sample/3));
  }
 }
 const ranked=rankNbaPreferredSides(rows,asOf);
 const counts=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length]));
 return {version:BOARD_VERSION,asOf,day,historyEvidence,summary:{
  qualityCounts:all.reduce((counts,r)=>{const k=r.dataQuality.status;counts[k]=(counts[k]??0)+1;return counts;},{}),
  games:games.length,historyGames:history.length,markets:counts,preferredMarkets:ranked.summary.preferredByMarket,
  rawSideCount:ranked.summary.evaluatedSides,withoutPreferredContract:ranked.summary.withNoPreferredContract,
  watchCandidates:ranked.top25.length,
  calibratedPicks:0,matchedHoopsGames:hoopsMap.size,unmatchedHoopsGameIds:unmatched,
  latestHoopsCapture:sourceHoops.captured_at??null,
  providerCalls:0,dbWrites:0,sourcePolicy:'ARCHIVED_ONLY',noAutomaticPromotion:true
 },games:games.map(g=>({id:g.id,home:g.home_team.full_name,away:g.visitor_team.full_name,
   startsAt:g.datetime,status:g.status_state,projection:projected[g.id]})),
 rows,preferredRows:ranked.rows,preferenceVersion:ranked.version,top25:ranked.top25,warnings:[
  'Solo se muestra un lado preferido por contrato con una señal estadística favorable; los contratos sin señal se omiten y cuentan como PASAR.',
  'Orden de revisión SHADOW basado en condiciones verificables, no en probabilidades calibradas.',
  'No son picks oficiales; sin demostración de valor esperado ni disponibilidad en FanDuel Puerto Rico.',
  'Cuotas y lesiones pueden cambiar; las capturas se muestran con su hora.',
  'Player props Q1 y mercados especiales sin historial equivalente quedan sin predicción.',
 ]};
}
