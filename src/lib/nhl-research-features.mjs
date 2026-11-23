// Stored-data NHL research. This module never writes a prediction or calls a provider.
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {nhlScoreDistribution,NHL_CHALLENGER_VERSION} from './nhl-challenger-poisson-core.mjs';
import {NHL_LATE_V6} from './nhl-late-v6-core.mjs';
import {normalizeNhlHistoricalGoalieContext} from './nhl-asof-goalie-rest-core.mjs';
import {selectEspnNhlProbablesAsOf} from './nhl-espn-free-goalie-probables-v5.mjs';
import {nhlPairedGoalieAsOfEvidence} from './nhl-goalie-prior-form-asof-v7.mjs';
import {selectNhlSpecialTeamsAsOf} from './nhl-special-teams-asof-core.mjs';

export const NHL_FEATURE_RESEARCH_VERSION='NHL_STORED_FEATURE_ABLATIONS_V1';
// This is the frozen DATA cutoff, not a timestamp at which a new forecast was issued.
// The variants were prepared during the audit, after the historical outcomes existed.
export const NHL_FEATURE_RESEARCH_REGISTERED_AT='2026-11-23T15:52:27.459Z';
// Dates were derived once from the original audit's chronological date groups.
// Keep them fixed: future live reads must not choose new splits or fit to new games.
export const NHL_FEATURE_RESEARCH_SPLITS=Object.freeze({
 shots:{trainingThrough:'2026-11-17',selectionThrough:'2026-11-19'},
 goalie:{trainingThrough:'2026-11-19',selectionThrough:'2026-11-21'},
 specialTeams:{trainingThrough:'2026-11-18',selectionThrough:'2026-11-19'},
 opponent:{trainingThrough:'2026-11-17',selectionThrough:'2026-11-19'},
 rest:{trainingThrough:'2026-11-17',selectionThrough:'2026-11-19'},
});
const HOUR=3600000,DAY=24*HOUR;
const ms=x=>{const n=Date.parse(String(x??''));return Number.isFinite(n)?n:null;};
const iso=x=>ms(x)===null?null:new Date(ms(x)).toISOString();
const integer=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const finite=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const round=(x,d=5)=>Number.isFinite(x)?Number(x.toFixed(d)):null;
const text=x=>typeof x==='string'?x:typeof x?.default==='string'?x.default:'';
const arr=x=>Array.isArray(x)?x:[];
const secs=x=>{const m=/^(\d+):([0-5]\d)$/.exec(String(x??''));return m?Number(m[1])*60+Number(m[2]):null;};
const clamp=x=>Math.min(6.5,Math.max(.6,x));
const eventId=x=>/^nhl:202602\d{4}$/.test(String(x??''));
const key=(event,team)=>event+':'+team;
const sum=(rows,field)=>rows.every(x=>finite(x[field])!==null)?rows.reduce((s,x)=>s+x[field],0):null;
const stat=(rows,field)=>mean(rows.map(x=>x[field]).filter(x=>finite(x)!==null));
const emptyMetrics=()=>({games:0,totalMAE:null,marginMAE:null,moneylineBrier:null});
const exclusion=(eventId,scope,reason)=>({eventId:String(eventId??'UNKNOWN'),scope,reason});

/** Normalize actual performance separately from the official final scoreboard.
 * The SO deciding goal belongs to the final contract score, never to a player/goalie.
 * Missing numerics stay null; backup goalies with zero playing time remain identifiable.
 */
export function normalizeNhlResearchContexts(contexts,cutoff){
 const now=ms(cutoff),counts=new Map(),exclusions=[],missing=new Map(),games=[],teamGames=[],skaterGames=[],goalieGames=[];
 const miss=field=>missing.set(field,(missing.get(field)??0)+1);
 for(const r of arr(contexts))counts.set(r?.event_id,(counts.get(r?.event_id)??0)+1);
 let duplicatePlayerRows=0;
 for(const r of arr(contexts)){
  const id=r?.event_id,b=r?.boxscore??{},start=ms(b.startTimeUTC),capture=ms(r?.boxscore_captured_at);
  const reject=reason=>exclusions.push(exclusion(id,'normalization',reason));
  if((counts.get(id)??0)>1){reject('DUPLICATE_CONTEXT_EVENT');continue;}
  if(now===null||!eventId(id)||Number(b.id)!==Number(String(id).slice(4))||
    b.season!==20262027||b.gameType!==2||!['OFF','FINAL'].includes(b.gameState)||
    start===null||capture===null||capture<=start||capture>now){reject('INVALID_FINAL_CONTEXT_OR_CAPTURE');continue;}
  const h=b.homeTeam??{},a=b.awayTeam??{},hg=integer(h.score),ag=integer(a.score);
  if(integer(h.id)===null||integer(a.id)===null||h.id===a.id||hg===null||ag===null||hg===ag){reject('INVALID_TEAM_OR_FINAL_SCORE');continue;}
  const endType=b.periodDescriptor?.periodType??b.gameOutcome?.lastPeriodType;
  if(!['REG','OT','SO'].includes(endType)||
    (b.gameOutcome?.lastPeriodType&&b.gameOutcome.lastPeriodType!==endType)||
    (r?.pbp_period?.periodType&&r.pbp_period.periodType!==endType)||
    (endType!=='REG'&&Math.abs(hg-ag)!==1)){
   reject('UNVERIFIED_REGULATION_OVERTIME_SHOOTOUT_LABEL');continue;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(b.gameDate??''))){reject('MISSING_OFFICIAL_GAME_DATE');continue;}
  const shootoutBonus=endType==='SO'?1:0,homeBonus=shootoutBonus&&hg>ag?1:0,awayBonus=shootoutBonus&&ag>hg?1:0;
  const base={eventId:id,gameDate:b.gameDate,scheduledAt:iso(b.startTimeUTC),capturedAt:iso(r.boxscore_captured_at),endType,
   homeId:h.id,awayId:a.id,homeScore:hg,awayScore:ag,homeGoals:hg-homeBonus,awayGoals:ag-awayBonus,
   shootoutBonus,sourceVersion:r.source_version??null,pbpCapturedAt:iso(r.pbp_captured_at),
   // Reuse the existing strict historical-goalie parser, not a today's-starter guess.
   historicalGoalieContext:normalizeNhlHistoricalGoalieContext({eventId:id,boxscore:b,capturedAt:r.boxscore_captured_at})};
  games.push(base);
  const playerCounts=new Map();
  for(const side of ['homeTeam','awayTeam'])for(const p of [
   ...arr(b.playerByGameStats?.[side]?.forwards),...arr(b.playerByGameStats?.[side]?.defense),...arr(b.playerByGameStats?.[side]?.goalies)])
   playerCounts.set(p.playerId,(playerCounts.get(p.playerId)??0)+1);
  for(const side of ['home','away']){
   const team=side==='home'?h:a,opponent=side==='home'?a:h,sideBox=b.playerByGameStats?.[side+'Team'];
   const ownGoals=side==='home'?base.homeGoals:base.awayGoals,otherGoals=side==='home'?base.awayGoals:base.homeGoals;
   const rawSkaters=[...arr(sideBox?.forwards),...arr(sideBox?.defense)],rawGoalies=arr(sideBox?.goalies);
   const common={eventId:id,teamId:team.id,opponentId:opponent.id,side,gameDate:b.gameDate,
    scheduledAt:base.scheduledAt,capturedAt:base.capturedAt};
   const normalizedSkaters=[];
   for(const p of rawSkaters){
    if(integer(p.playerId)===null||(playerCounts.get(p.playerId)??0)>1){duplicatePlayerRows+=Number((playerCounts.get(p.playerId)??0)>1);miss('invalidOrDuplicateSkaterIdentity');continue;}
    const row={...common,playerId:p.playerId,name:text(p.name),position:p.position??null,toiSeconds:secs(p.toi),
     goals:integer(p.goals),assists:integer(p.assists),points:integer(p.points),shotsOnGoal:integer(p.sog),
     powerPlayGoals:integer(p.powerPlayGoals),hits:integer(p.hits),blockedShots:integer(p.blockedShots)};
    for(const field of ['toiSeconds','goals','shotsOnGoal'])if(row[field]===null)miss('skater.'+field);
    skaterGames.push(row);normalizedSkaters.push(row);
   }
   for(const p of rawGoalies){
    if(integer(p.playerId)===null||(playerCounts.get(p.playerId)??0)>1){duplicatePlayerRows+=Number((playerCounts.get(p.playerId)??0)>1);miss('invalidOrDuplicateGoalieIdentity');continue;}
    const row={...common,playerId:p.playerId,name:text(p.name),toiSeconds:secs(p.toi),shotsAgainst:integer(p.shotsAgainst),
     goalsAgainst:integer(p.goalsAgainst),saves:integer(p.saves),startedHistoricalGame:p.starter===true};
    const accounting=row.shotsAgainst!==null&&row.goalsAgainst!==null&&row.saves!==null&&row.shotsAgainst===row.goalsAgainst+row.saves;
    for(const field of ['toiSeconds','shotsAgainst','goalsAgainst','saves'])if(row[field]===null)miss('goalie.'+field);
    if(!accounting){miss('goalie.shotAccounting');exclusions.push(exclusion(id,'goalieSource','INCONSISTENT_SHOTS_SAVES_GOALS:'+p.playerId));}
    goalieGames.push({...row,played:row.toiSeconds!==null&&row.toiSeconds>0,accountingValid:accounting,
     savePct:accounting&&row.shotsAgainst>0?round(row.saves/row.shotsAgainst):null,
     upcomingStarterConfirmed:false});
   }
   const shotsFor=integer(team.sog),shotsAgainst=integer(opponent.sog);
   if(shotsFor===null)miss('team.shotsFor');if(shotsAgainst===null)miss('team.shotsAgainst');
   const skaterGoals=sum(normalizedSkaters,'goals'),skaterShots=sum(normalizedSkaters,'shotsOnGoal');
   if(skaterGoals!==ownGoals)miss('team.skaterGoalReconciliation');
   if(skaterShots!==shotsFor){miss('team.skaterShotReconciliation');exclusions.push(exclusion(id,'teamShots','SKATER_TEAM_SHOT_MISMATCH:'+team.id));}
   const goalsReliable=rawSkaters.length>=10&&normalizedSkaters.length===rawSkaters.length&&skaterGoals===ownGoals;
   const shotsReliable=shotsFor!==null&&shotsAgainst!==null&&skaterShots===shotsFor;
   const finalGoalsFor=side==='home'?hg:ag,finalGoalsAgainst=side==='home'?ag:hg;
   teamGames.push({...common,team:text(team.abbrev)||text(team.commonName),endType,
    finalGoalsFor,finalGoalsAgainst,goalsFor:ownGoals,goalsAgainst:otherGoals,
    regulationGoalsFor:ownGoals-(endType==='OT'&&finalGoalsFor>finalGoalsAgainst?1:0),
    shotsFor,shotsAgainst,shootingPct:goalsReliable&&shotsReliable&&shotsFor>0?round(ownGoals/shotsFor):null,
    shootoutBonusFor:side==='home'?homeBonus:awayBonus,performanceGoalsVerified:goalsReliable,
    shotsVerified:shotsReliable,skaterRows:normalizedSkaters.length,goalieRows:rawGoalies.length,
    powerPlayGoals:sum(normalizedSkaters,'powerPlayGoals')});
  }
  const pair=teamGames.slice(-2);
  // A disputed opponent SOG total also affects this team's shots conceded.
  if(pair.some(g=>!g.shotsVerified))for(const g of pair){g.shotsVerified=false;g.shootingPct=null;}
 }
 return {games,teamGames,skaterGames,goalieGames,exclusions,
  duplicates:[...counts.values()].filter(n=>n>1).reduce((s,n)=>s+n,0)+duplicatePlayerRows,
  missingFields:[...missing].sort((a,b)=>a[0].localeCompare(b[0])).map(([field,count])=>({field,count}))};
}

/** Every certified calendar day needs a successful, SHA-verified saved official
 * score receipt. A union of observed games cannot certify a missing-game absence. */
export function readNhlResearchSchedules(sources,cutoff){
 const snapshots=[],exclusions=[];const now=ms(cutoff);
 for(const r of arr(sources)){
  const match=/^https:\/\/api-web\.nhle\.com\/v1\/score\/(\d{4}-\d{2}-\d{2})$/.exec(String(r?.source_url??''));
  if(!match)continue;
  const at=ms(r.captured_at),body=r.body??{};
  if(now===null||at===null||at>now||body.http_status!==200||body.error||body.encoding!=='gzip/base64'||
    typeof body.raw!=='string'||body.raw.length>4000000||!/^[0-9a-f]{64}$/.test(body.sha256??'')){
   exclusions.push(exclusion(r.id,'schedule','INVALID_SAVED_SCORE_RECEIPT'));continue;
  }
  try{
   const raw=gunzipSync(Buffer.from(body.raw,'base64'),{maxOutputLength:2000000}).toString('utf8');
   if(createHash('sha256').update(raw).digest('hex')!==body.sha256)throw Error('HASH');
   const payload=JSON.parse(raw);
   if(payload.currentDate!==match[1]||!Array.isArray(payload.games)||payload.games.length>30)throw Error('DAY');
   const games=[],seen=new Set();
   for(const g of payload.games){
    if(g.gameType!==2)continue;
    if(!/^202602\d{4}$/.test(String(g.id))||seen.has(g.id)||ms(g.startTimeUTC)===null||
      integer(g.homeTeam?.id)===null||integer(g.awayTeam?.id)===null||g.homeTeam.id===g.awayTeam.id)throw Error('GAME');
    seen.add(g.id);games.push({eventId:'nhl:'+g.id,scheduledAt:iso(g.startTimeUTC),homeId:g.homeTeam.id,
     awayId:g.awayTeam.id,status:g.gameState,scheduleState:g.gameScheduleState??null});
   }
   snapshots.push({date:match[1],capturedAt:iso(r.captured_at),sourceId:r.id,sha256:body.sha256,games});
  }catch{exclusions.push(exclusion(r.id,'schedule','SCORE_PAYLOAD_HASH_OR_SCHEMA_REJECTED'));}
 }
 snapshots.sort((a,b)=>ms(a.capturedAt)-ms(b.capturedAt)||String(a.sourceId).localeCompare(String(b.sourceId)));
 return {snapshots,exclusions};
}

function calendarAsOf(snapshots,decision){
 const dates=new Map();
 for(const snap of snapshots){if(ms(snap.capturedAt)>=decision)continue;const old=dates.get(snap.date);
  if(!old||ms(snap.capturedAt)>ms(old.capturedAt))dates.set(snap.date,snap);
  else if(ms(snap.capturedAt)===ms(old.capturedAt)&&snap.sha256!==old.sha256)dates.set(snap.date,{...old,conflict:true});
 }
 return dates;
}
function certifyWindow({history,target,teamId,n,calendar}){
 if(history.length<n)return {ok:false,reason:'INSUFFICIENT_OBSERVED_PRIOR_GAMES'};
 const selected=history.slice(0,n),first=selected.at(-1).gameDate,targetDay=target.gameDate;
 const firstDay=Date.parse(first+'T00:00:00Z'),lastDay=Date.parse(targetDay+'T00:00:00Z');
 if(!Number.isFinite(firstDay)||!Number.isFinite(lastDay)||lastDay<firstDay||lastDay-firstDay>60*DAY)
  return {ok:false,reason:'CALENDAR_WINDOW_UNVERIFIED'};
 const targetReceipt=calendar.get(targetDay);
 if(!targetReceipt||targetReceipt.conflict||!targetReceipt.games.some(g=>g.eventId===target.eventId&&g.scheduledAt===target.scheduledAt&&
   g.homeId===target.homeId&&g.awayId===target.awayId))return {ok:false,reason:'TARGET_NOT_IN_ASOF_DAILY_SCHEDULE'};
 const scheduled=new Map();
 for(let day=firstDay;day<=lastDay;day+=DAY){
  const date=new Date(day).toISOString().slice(0,10),snap=calendar.get(date);
  if(!snap||snap.conflict)return {ok:false,reason:'MISSING_ASOF_DAILY_SCHEDULE'};
  for(const g of snap.games){
   if(![g.homeId,g.awayId].includes(teamId)||ms(g.scheduledAt)>=ms(target.scheduledAt)||
     ['PPD','CNCL'].includes(g.scheduleState))continue;
   const old=scheduled.get(g.eventId);
   if(old&&old.scheduledAt!==g.scheduledAt)return {ok:false,reason:'CONFLICTED_PRIOR_SCHEDULE'};
   scheduled.set(g.eventId,g);
  }
 }
 const ordered=[...scheduled.values()].sort((a,b)=>ms(b.scheduledAt)-ms(a.scheduledAt)||a.eventId.localeCompare(b.eventId)).slice(0,n);
 if(ordered.length!==n||ordered.some((g,i)=>g.eventId!==selected[i].eventId||g.scheduledAt!==selected[i].scheduledAt))
  return {ok:false,reason:'MISSING_OR_CHANGED_PRIOR_MATCH'};
 return {ok:true,eventIds:selected.map(g=>g.eventId),sourceDates:[...calendar.keys()].filter(d=>d>=first&&d<=targetDay).sort()};
}
function pairedCI(values,seed){
 if(values.length<3)return null;
 let state=seed>>>0;const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
 const estimates=[];
 for(let b=0;b<2000;b++){let total=0;for(let i=0;i<values.length;i++)total+=values[Math.floor(random()*values.length)];estimates.push(total/values.length);}
 estimates.sort((a,b)=>a-b);
 return {lower:round(estimates[Math.floor(.025*(estimates.length-1))]),upper:round(estimates[Math.floor(.975*(estimates.length-1))]),
  method:'PAIRED_GAME_PERCENTILE_BOOTSTRAP_2000',confidence:.95,independentGames:values.length,
  limitation:'Small-sample descriptive interval; recurring teams and dates may remain dependent.'};
}
function metrics(rows,predict){
 if(!rows.length)return emptyMetrics();
 const values=rows.map(r=>{
  const [h,a]=predict(r),dist=nhlScoreDistribution(h,a),y=Number(r.actual[0]>r.actual[1]);
  return {total:Math.abs(h+a-r.actual[0]-r.actual[1]),margin:Math.abs(h-a-r.actual[0]+r.actual[1]),
   brier:dist?(dist.homeMoneylineProxy-y)**2:null};
 });
 return {games:rows.length,totalMAE:round(mean(values.map(x=>x.total))),marginMAE:round(mean(values.map(x=>x.margin))),
  moneylineBrier:round(mean(values.map(x=>x.brier).filter(x=>x!==null)))};
}

const VARIANTS=[
 {id:'shots',label:'Volumen de tiros',definition:'For each side: mean of its observed prior SOG-for average and the opponent observed SOG-against average; >=3 prior archived games on both sides.',limitation:'Observed archive form; no assumption that these are the actual last five scheduled games.'},
 {id:'goalie',label:'Forma previa del portero probable',definition:'For each side: one minus opposing probable goalie shot-weighted prior save percentage, using the existing team-qualified unique-name V7 match, >=50 prior shots.',limitation:'Probable only; NHL/ESPN crosswalk is a research candidate and not independently certified.'},
 {id:'specialTeams',label:'Power play frente a penalty kill',definition:'For each side: (own captured PP percentage + 1 - opponent captured PK percentage)/2 from the latest valid <=36h as-of snapshot.',limitation:'Season-to-date rates; power-play opportunity volume is not inferred from penalties.'},
 {id:'opponent',label:'Calidad observada del rival',definition:'For each side: negative of the opponent prior physical goal differential per observed game, excluding the SO bonus; >=3 archived games per team.',limitation:'Strength in this observed archive; not full-season standings or a validated schedule adjustment.'},
 {id:'rest',label:'Descanso con calendario verificado',definition:'For each side: min(7, hours between target start and actual previous scheduled start /24); all intervening daily slates must be saved before cutoff.',limitation:'Unknown if even one intervening official daily slate is missing; observed gaps alone are insufficient.'},
];

function evaluateAblation(variant,rows,exclusions){
 const ordered=rows.filter(r=>r.features[variant.id]?.every(x=>finite(x)!==null))
  .sort((a,b)=>ms(a.scheduledAt)-ms(b.scheduledAt)||a.eventId.localeCompare(b.eventId));
 // Whole official game dates keep one slate together. A label-time embargo also
 // removes delayed training outcomes before fitting; no future label is backdated.
 const {trainingThrough:trainEnd,selectionThrough:selectionEnd}=NHL_FEATURE_RESEARCH_SPLITS[variant.id];
 const proposedTrain=ordered.filter(r=>r.gameDate<=trainEnd),selection=ordered.filter(r=>r.gameDate>trainEnd&&r.gameDate<=selectionEnd),
  later=ordered.filter(r=>r.gameDate>selectionEnd);
 const firstEvaluation=Math.min(...[...selection,...later].map(r=>ms(r.frozenAt)));
 const purged=proposedTrain.filter(r=>ms(r.outcomeObservedAt)>=firstEvaluation),train=proposedTrain.filter(r=>ms(r.outcomeObservedAt)<firstEvaluation);
 for(const r of purged)exclusions.push(exclusion(r.eventId,variant.id+'Training','LABEL_CAPTURE_AFTER_EVALUATION_DECISION'));
 const common={...variant,availableGames:ordered.length,trainingGames:train.length,selectionGames:selection.length,laterGames:later.length,
  trainingUntil:train.at(-1)?.scheduledAt??null,selectionUntil:selection.at(-1)?.scheduledAt??null,
  laterFrom:later[0]?.scheduledAt??null,baseline:emptyMetrics(),candidate:emptyMetrics(),difference:{totalMAE:null,marginMAE:null,moneylineBrier:null},
  interval95:{totalMAE:null,marginMAE:null},coefficient:null,ridgePenalty:10,interceptFitted:false,
  eventIds:{training:train.map(r=>r.eventId),selection:selection.map(r=>r.eventId),later:later.map(r=>r.eventId)},
  purgedTrainingGames:purged.length,purgedTrainingEventIds:purged.map(r=>r.eventId),
  variantsTested:1,parameterSearch:false,independentHoldoutPassed:false,officialPick:false};
 if(train.length<10||selection.length<3||later.length<5)return {...common,status:'INSUFFICIENT_CHRONOLOGICAL_SAMPLE',
  reason:'Se requieren al menos 10 partidos de entrenamiento, 3 intermedios y 5 posteriores; las fechas están fijadas y las etiquetas tardías se excluyen.'};
 const values=train.flatMap(r=>r.features[variant.id]),center=mean(values),scale=Math.sqrt(mean(values.map(x=>(x-center)**2)));
 if(!Number.isFinite(scale)||scale<1e-10)return {...common,status:'NO_TRAINING_VARIATION',reason:'La variable no presenta variación medible en el entrenamiento.'};
 let xy=0,xx=0;
 for(const r of train)for(let side=0;side<2;side++){
  const z=(r.features[variant.id][side]-center)/scale;xy+=z*(r.actual[side]-r.base[side]);xx+=z*z;
 }
 const beta=xy/(xx+10),predict=r=>r.base.map((p,i)=>clamp(p+beta*(r.features[variant.id][i]-center)/scale));
 const baseline=metrics(later,r=>r.base),candidate=metrics(later,predict);
 const totalDifferences=[],marginDifferences=[];
 for(const r of later){const p=predict(r),t=r.actual[0]+r.actual[1],m=r.actual[0]-r.actual[1];
  totalDifferences.push(Math.abs(p[0]+p[1]-t)-Math.abs(r.base[0]+r.base[1]-t));
  marginDifferences.push(Math.abs(p[0]-p[1]-m)-Math.abs(r.base[0]-r.base[1]-m));
 }
 return {...common,status:'EXPLORATORY_CHRONOLOGICAL_TEST',baseline,candidate,
  difference:{totalMAE:round(candidate.totalMAE-baseline.totalMAE),marginMAE:round(candidate.marginMAE-baseline.marginMAE),
   moneylineBrier:round(candidate.moneylineBrier-baseline.moneylineBrier)},
  interval95:{totalMAE:pairedCI(totalDifferences,20261123),marginMAE:pairedCI(marginDifferences,20261124)},
  coefficient:round(beta,8),trainingCenter:round(center,8),trainingScale:round(scale,8),
  training:{baseline:metrics(train,r=>r.base),candidate:metrics(train,predict)},
  selection:{baseline:metrics(selection,r=>r.base),candidate:metrics(selection,predict)},
  reason:'Una diferencia negativa favorece al candidato solo en esta muestra posterior. El coeficiente usa únicamente entrenamiento; no se selecciona una combinación ni se promueve el modelo.',
  observations:later.map(r=>({eventId:r.eventId,frozenAt:r.frozenAt,baseline:r.base,candidate:predict(r).map(x=>round(x)),actual:r.actual}))};
}

/** Public pure report builder. The canonical decision is late V6 if available,
 * otherwise early V1, chosen without outcomes or feature availability. Comparisons
 * always use the SAME frozen Poisson projection and same games for each ablation. */
export function buildNhlFeatureResearch({contexts=[],sources=[],predictions=[],outcomes=[],early=[],late=[],goalies=[],specialTeams=[],cutoff}={}){
 const now=ms(cutoff),featureCutoff=now===null?null:new Date(Math.min(now,ms(NHL_FEATURE_RESEARCH_REGISTERED_AT))).toISOString(),
  featureAt=ms(featureCutoff),normalized=normalizeNhlResearchContexts(contexts,cutoff),
  researchNormalized=normalizeNhlResearchContexts(arr(contexts).filter(c=>ms(c.boxscore_captured_at)!==null&&ms(c.boxscore_captured_at)<=featureAt),featureCutoff),
  schedule=readNhlResearchSchedules(arr(sources).filter(s=>ms(s.captured_at)!==null&&ms(s.captured_at)<=featureAt),featureCutoff),
  exclusions=[...normalized.exclusions,...schedule.exclusions];
 const gameMap=new Map(researchNormalized.games.map(g=>[g.eventId,g])),teamMap=new Map();
 const soundGoalies=new Set(researchNormalized.goalieGames.filter(g=>g.accountingValid&&g.toiSeconds!==null).map(g=>key(g.eventId,g.teamId)+':'+g.playerId));
 const goalieContexts=arr(contexts).filter(c=>gameMap.has(c.event_id)).map(c=>({...c,boxscore:{...c.boxscore,
  playerByGameStats:Object.fromEntries(['homeTeam','awayTeam'].map(side=>[side,{...c.boxscore.playerByGameStats?.[side],
   goalies:arr(c.boxscore.playerByGameStats?.[side]?.goalies).filter(p=>soundGoalies.has(key(c.event_id,c.boxscore[side].id)+':'+p.playerId))}]))}}));
 for(const g of researchNormalized.teamGames){if(!teamMap.has(g.teamId))teamMap.set(g.teamId,[]);teamMap.get(g.teamId).push(g);}
 const outMap=new Map(),outCounts=new Map(),asOfOutcomes=arr(outcomes).filter(o=>ms(o.observed_at)!==null&&ms(o.observed_at)<=featureAt);
 for(const o of asOfOutcomes)outCounts.set(o?.event_id,(outCounts.get(o?.event_id)??0)+1);
 for(const o of asOfOutcomes){if(outCounts.get(o?.event_id)!==1){exclusions.push(exclusion(o?.event_id,'outcome','DUPLICATE_OUTCOME_EVENT'));continue;}
  const b=o.body??{},at=ms(o.observed_at),start=ms(b.scheduledAt);
  if(at!==null&&at>featureAt)continue;
  if(!eventId(o.event_id)||b.eventId!==o.event_id||at===null||start===null||at<=start||
    (Object.prototype.hasOwnProperty.call(b,'capturedAt')&&(ms(b.capturedAt)===null||ms(b.capturedAt)!==at))||
    integer(b.homeId)===null||integer(b.awayId)===null||b.homeId===b.awayId||integer(b.homeScore)===null||integer(b.awayScore)===null||b.homeScore===b.awayScore){
   exclusions.push(exclusion(o.event_id,'outcome','INVALID_FINAL_OR_OBSERVED_TIME'));continue;}
  outMap.set(o.event_id,o);
 }
 const decisions=new Map();let duplicateFrozen=0;const reserved=new Set();
 for(const [family,rows] of [['early',early],['late',late]]){
  const eligible=[];
  for(const r of arr(rows)){
   if(ms(r.frozen_at)!==null&&ms(r.frozen_at)>featureAt){reserved.add(r.event_id);continue;}
   if(ms(r.created_at)!==null&&ms(r.created_at)>featureAt){exclusions.push(exclusion(r.event_id,family,'FROZEN_ROW_PERSISTED_AFTER_RESEARCH_CUTOFF'));continue;}
   eligible.push(r);
  }
  const counts=new Map();for(const r of eligible)counts.set(r.event_id,(counts.get(r.event_id)??0)+1);
  for(const r of eligible){
   const frozen=ms(r.frozen_at),created=ms(r.created_at),start=ms(r.scheduled_at),source=ms(r.source_completed_at),h=finite(r.projection?.homeGoals),a=finite(r.projection?.awayGoals);
   if(counts.get(r.event_id)>1){duplicateFrozen++;exclusions.push(exclusion(r.event_id,family,'DUPLICATE_FROZEN_EVENT'));continue;}
   if(now===null||!eventId(r.event_id)||r.model_version!==(family==='early'?NHL_CHALLENGER_VERSION:NHL_LATE_V6)||
     frozen===null||created===null||created>=start||start===null||source===null||source>frozen||frozen>now||start-frozen<HOUR||
     integer(r.home_team_id)===null||integer(r.away_team_id)===null||r.home_team_id===r.away_team_id||
     r.official_pick!==false||r.production_eligible!==false||r.status!=='FROZEN_RESEARCH'||h===null||a===null||!nhlScoreDistribution(h,a)){
    exclusions.push(exclusion(r.event_id,family,'INVALID_FROZEN_PROJECTION_OR_CUTOFF'));continue;
   }
   if(family==='late'||!decisions.has(r.event_id))decisions.set(r.event_id,{...r,family});
  }
 }
 const rows=[],windows={observed5:0,observed10:0,certified5:0,certified10:0,restCertified:0};
 const variables=VARIANTS.map(v=>({id:v.id,label:v.label,definition:v.definition,availableGames:0,usedByOriginal:false,limitation:v.limitation}));
 for(const d of [...decisions.values()].sort((a,b)=>ms(a.scheduled_at)-ms(b.scheduled_at)||a.event_id.localeCompare(b.event_id))){
  const truth=outMap.get(d.event_id),b=truth?.body,t=gameMap.get(d.event_id),freeze=ms(d.frozen_at),start=ms(d.scheduled_at);
  if(!truth){exclusions.push(exclusion(d.event_id,'featureEvaluation','NO_VALID_FINAL_BY_AUDIT'));continue;}
  if(ms(b.scheduledAt)!==start||b.homeId!==d.home_team_id||b.awayId!==d.away_team_id||
    (t&&(t.homeScore!==b.homeScore||t.awayScore!==b.awayScore||t.homeId!==b.homeId||t.awayId!==b.awayId||ms(t.scheduledAt)!==start))){
   exclusions.push(exclusion(d.event_id,'featureEvaluation','FINAL_IDENTITY_OR_CONTEXT_CONFLICT'));continue;
  }
  const target={eventId:d.event_id,scheduledAt:iso(d.scheduled_at),gameDate:t?.gameDate??null,homeId:d.home_team_id,awayId:d.away_team_id,
   home:d.home_team??d.market_proxies?.frozenTeams?.home,away:d.away_team??d.market_proxies?.frozenTeams?.away};
  const getHistory=id=>(teamMap.get(id)??[]).filter(g=>g.eventId!==d.event_id&&ms(g.capturedAt)<freeze&&ms(g.scheduledAt)+4*HOUR<freeze)
   .sort((a,b)=>ms(b.scheduledAt)-ms(a.scheduledAt)||a.eventId.localeCompare(b.eventId));
  const h=getHistory(target.homeId),a=getHistory(target.awayId),allHistory=[h,a],calendar=calendarAsOf(schedule.snapshots,freeze);
  if(h.length>=5&&a.length>=5)windows.observed5++;
  if(h.length>=10&&a.length>=10)windows.observed10++;
  const certified={};
  for(const n of [1,5,10])certified[n]=allHistory.map((history,i)=>certifyWindow({history,target,teamId:i===0?target.homeId:target.awayId,n,calendar}));
  if(certified[5].every(x=>x.ok))windows.certified5++;
  if(certified[10].every(x=>x.ok))windows.certified10++;
  const features={},details={};
  const observedH=h.filter(x=>x.shotsVerified&&x.performanceGoalsVerified),observedA=a.filter(x=>x.shotsVerified&&x.performanceGoalsVerified);
  if(observedH.length>=3&&observedA.length>=3){
   features.shots=[(stat(observedH,'shotsFor')+stat(observedA,'shotsAgainst'))/2,(stat(observedA,'shotsFor')+stat(observedH,'shotsAgainst'))/2];
   details.shots={homeGames:observedH.map(g=>g.eventId),awayGames:observedA.map(g=>g.eventId),completeScheduleAssumed:false};
  }else exclusions.push(exclusion(d.event_id,'shots','FEWER_THAN_THREE_VALID_PRIOR_TEAM_BOXSCORES'));
  const reliableH=h.filter(x=>x.performanceGoalsVerified),reliableA=a.filter(x=>x.performanceGoalsVerified);
  if(reliableH.length>=3&&reliableA.length>=3)features.opponent=[-mean(reliableA.map(g=>g.goalsFor-g.goalsAgainst)),-mean(reliableH.map(g=>g.goalsFor-g.goalsAgainst))];
  else exclusions.push(exclusion(d.event_id,'opponent','INSUFFICIENT_PRIOR_GOAL_DIFFERENTIAL'));
  const pp=selectNhlSpecialTeamsAsOf({snapshots:arr(specialTeams).filter(s=>ms(s.captured_at)<freeze),game:target,asOf:iso(d.frozen_at)});
  if(pp.status==='ASOF_SPECIAL_TEAMS_EVIDENCE'){
   features.specialTeams=[(pp.home.powerPlayPct+1-pp.away.penaltyKillPct)/2,(pp.away.powerPlayPct+1-pp.home.penaltyKillPct)/2];
   details.specialTeams={snapshotId:pp.snapshotId,capturedAt:pp.capturedAt};
  }else exclusions.push(exclusion(d.event_id,'specialTeams',pp.reason??'NO_ASOF_PP_PK'));
  const goalieEvidence=selectEspnNhlProbablesAsOf({snapshots:arr(goalies).filter(s=>ms(s.captured_at)<freeze),game:target,decisionAt:iso(d.frozen_at)});
  const goalieForm=nhlPairedGoalieAsOfEvidence({game:target,goalieEvidence,decisionAt:iso(d.frozen_at),
   boxscoreRows:goalieContexts.filter(c=>ms(c.boxscore_captured_at)<freeze&&ms(c.boxscore?.startTimeUTC)+4*HOUR<freeze)});
  if(goalieForm.status==='BOTH_PRIOR_FORMS_AVAILABLE'){
   features.goalie=[1-goalieForm.away.priorSavePct,1-goalieForm.home.priorSavePct];
   details.goalie={sourceSnapshotId:goalieEvidence.sourceSnapshotId,observedAt:goalieEvidence.observedAt,
    home:goalieForm.home,away:goalieForm.away,confirmedStarter:false,crosswalkCertified:false};
  }else exclusions.push(exclusion(d.event_id,'goalie',goalieEvidence.reason??goalieForm.reason??'INCOMPLETE_PRIOR_PROBABLE_GOALIE_FORM'));
  if(certified[1].every(x=>x.ok)){
   windows.restCertified++;features.rest=[h,a].map(hist=>Math.min(7,(start-ms(hist[0].scheduledAt))/DAY));
   details.rest={previousGames:[h[0].eventId,a[0].eventId],hoursSincePrevious:[h,a].map(hist=>round((start-ms(hist[0].scheduledAt))/HOUR)),
    sourceDates:certified[1].map(x=>x.sourceDates),completeDailyScheduleEvidence:true};
  }else exclusions.push(exclusion(d.event_id,'rest',certified[1].find(x=>!x.ok)?.reason??'REST_UNVERIFIED'));
  for(const v of variables)if(features[v.id])v.availableGames++;
  if(!target.gameDate){exclusions.push(exclusion(d.event_id,'featureEvaluation','NO_OFFICIAL_GAME_DATE_FOR_CHRONOLOGICAL_SPLIT'));continue;}
  rows.push({eventId:d.event_id,gameDate:target.gameDate,family:d.family,scheduledAt:iso(d.scheduled_at),frozenAt:iso(d.frozen_at),outcomeObservedAt:iso(truth.observed_at),
   base:[d.projection.homeGoals,d.projection.awayGoals],actual:[b.homeScore,b.awayScore],features,details,
   priorObserved:{home:h.length,away:a.length},certifiedWindows:{five:certified[5].every(x=>x.ok),ten:certified[10].every(x=>x.ok)}});
 }
 const ablations=VARIANTS.map(v=>evaluateAblation(v,rows,exclusions)),byDate=new Map(),byTeam=new Map();
 for(const g of normalized.games)byDate.set(g.gameDate,(byDate.get(g.gameDate)??0)+1);
 for(const g of normalized.teamGames){const item=byTeam.get(g.teamId)??{teamId:g.teamId,team:g.team,games:0};item.games++;byTeam.set(g.teamId,item);}
 const homeAway=['home','away'].map(side=>{const r=normalized.teamGames.filter(g=>g.side===side),valid=r.filter(g=>g.performanceGoalsVerified&&g.shotsVerified);
  const goals=sum(valid,'goalsFor'),shots=sum(valid,'shotsFor');return {side,games:r.length,performanceGames:valid.length,
   finalGoalsPerGame:round(stat(r,'finalGoalsFor')),goalsPerGame:round(stat(valid,'goalsFor')),shotsPerGame:round(stat(valid,'shotsFor')),
   shootingPct:shots>0?round(goals/shots):null};});
 return {version:NHL_FEATURE_RESEARCH_VERSION,status:normalized.games.length?'EXPLORATORY_RESEARCH':'EMPTY',auditedAt:iso(cutoff),
  researchCutoff:featureCutoff,coverage:{games:normalized.games.length,teamGames:normalized.teamGames.length,skaterGames:normalized.skaterGames.length,
   uniqueSkaters:new Set(normalized.skaterGames.map(r=>r.playerId)).size,goalieGames:normalized.goalieGames.length,
   playedGoalieGames:normalized.goalieGames.filter(g=>g.played).length,uniqueGoalies:new Set(normalized.goalieGames.map(r=>r.playerId)).size,
   byDate:[...byDate].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,games])=>({date,games})),
   byTeam:[...byTeam.values()].sort((a,b)=>a.teamId-b.teamId),missingFields:normalized.missingFields,duplicates:normalized.duplicates+duplicateFrozen,
   excludedGames:new Set(normalized.exclusions.filter(r=>r.scope==='normalization').map(r=>r.eventId)).size,
   quarantinedStatisticGames:new Set(normalized.exclusions.filter(r=>r.scope!=='normalization').map(r=>r.eventId)).size,
   researchSnapshotGames:researchNormalized.games.length,
   scheduleReceipts:schedule.snapshots.length,scheduleDays:new Set(schedule.snapshots.map(s=>s.date)).size},
  descriptive:{homeAway,endTypes:['REG','OT','SO'].map(type=>({type,games:normalized.games.filter(g=>g.endType===type).length}))},
  variables,cohort:{decisions:decisions.size,settled:rows.length,earlyDecisions:rows.filter(r=>r.family==='early').length,
   lateDecisions:rows.filter(r=>r.family==='late').length,training:null,selection:null,later:null,
   splitPolicy:'Fechas cronológicas fijadas por variable, agrupando jornadas completas y excluyendo etiquetas capturadas después de la decisión de evaluación. Se prefiere V6 tardío; en su ausencia V1 temprano, una vez por partido.',
   futureHoldoutAfter:NHL_FEATURE_RESEARCH_REGISTERED_AT,futureHoldoutGames:reserved.size,
   futureHoldoutScored:false,futureCandidateForecastsIssued:0,independentHoldoutPassed:false},ablations,windowCoverage:windows,
  variantRegistry:{registeredVersion:NHL_FEATURE_RESEARCH_VERSION,variants:VARIANTS.map(v=>v.id),ridgePenalty:10,
   dataCutoff:NHL_FEATURE_RESEARCH_REGISTERED_AT,protocolPreparedDuringAudit:true,
   prospectiveForecastsIssued:0,lockedDateBoundaries:NHL_FEATURE_RESEARCH_SPLITS,
   trainMinimum:10,selectionMinimum:3,laterMinimum:5,featureCoefficientCount:1,selectionOptimized:false,combinedCandidateTested:false,
   noInterceptCorrection:true,noProductionMutation:true},
  exclusions,propsReadiness:{skaterStatRows:normalized.skaterGames.length,goalieStatRows:normalized.goalieGames.length,
   status:'STATISTICS_ONLY',missing:['Líneas y precios pareados de props capturados antes del partido','Identidad jugador/equipo verificada al capturar la cuota',
    'Período exacto y reglas de overtime/shootout','Reglas de participación, DNP y anulación por portero no titular',
    'Pronósticos previos inmutables y liquidación separada','Validación cronológica independiente']},
  limitations:['Los resultados de noviembre son exploratorios. La muestra futura comienza después del corte registrado y no se utiliza para volver a ajustar estas pruebas.',
   'La referencia es la proyección Poisson guardada en el corte de cada partido; las decisiones tempranas y tardías disponían de información diferente.',
   'Cada prueba compara exactamente los mismos partidos. Las diferencias entre cohortes no establecen qué variable causa una mejora.',
   'Los coeficientes usan resultados anteriores disponibles antes de las decisiones evaluadas, penalización ridge fija de 10 y ninguna búsqueda de parámetros.',
   'Goles y tiros de desempeño incluyen overtime y excluyen el gol decisivo añadido en shootout; las etiquetas de evaluación usan el marcador final oficial.',
   'El historial observado no equivale automáticamente a L5/L10. Descanso y ventanas completas requieren todas las capturas diarias intermedias antes del pronóstico.',
   'La identidad del portero es una coincidencia histórica por nombre y equipo. Un probable nunca se convierte en confirmado a partir del boxscore posterior.',
   'Estas pruebas no certifican contratos, ROI ejecutable, ventaja frente a Circa/FanDuel ni promociones de modelos.'],
  normalized:{teamGames:normalized.teamGames,skaterGames:normalized.skaterGames,goalieGames:normalized.goalieGames},
  decisionFeatures:rows,providerCalls:0,databaseWrites:0,officialPicksChanged:false};
}
