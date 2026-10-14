import type {MlbView} from '@/components/pick2/mlb-presentation';
import {matchesSlateFilter,presentationStatus,isStarted} from '@/components/pick2/mlb-presentation';
import type {NhlReport} from './nhl-external-report';
import {nhlDate,nhlOpportunities} from './nhl-view';
import type {QualifiedReport} from './qualified-plays';
import {operationalDailyPicks} from './operational-daily-picks';
import {dailyDisplayRows} from './daily-pick-display';
export type DayGame={key:string;sport:'MLB'|'NHL';eventId:string;title:string;scheduledAt:string;analyzed:boolean;started:boolean;waiting:boolean;official:number;registered:number;value:number;noEdge:boolean;nhl?:{away:string;home:string;awayProbability:number|null;homeProbability:number|null;awayOdds:number|null;homeOdds:number|null;capturedAt:string|null;status:string;selections:string[]}};
export type DayPick={key:string;sport:string;classification:string;matchup:string;selection:string;modelProbability:number|null;projection:number|null;edgePp:number|null;odds:number|null;book:string|null;href:string};
export function combinedDay(view:MlbView,nhl:NhlReport,research:QualifiedReport){
 const games:DayGame[]=view.games.map(g=>({key:'MLB:'+g.gamePk,sport:'MLB',eventId:String(g.gamePk),title:g.away+' at '+g.home,scheduledAt:g.scheduledAt,
  analyzed:g.analysisAvailable||Number.isFinite(g.homeProbability)&&Number.isFinite(g.awayProbability),started:isStarted(g),waiting:matchesSlateFilter(g,view.board.rows,'Waiting'),official:view.board.rows.filter(r=>r.game_pk===g.gamePk&&presentationStatus(r)==='OFFICIAL_PICK').length,
  registered:view.board.rows.filter(r=>r.game_pk===g.gamePk&&presentationStatus(r)==='OFFICIAL_PICK').length,value:view.board.rows.filter(r=>r.game_pk===g.gamePk&&presentationStatus(r)==='VALUE_CANDIDATE').length,noEdge:matchesSlateFilter(g,view.board.rows,'No Edge')}));
 const warnings=[...view.warnings];const daily=operationalDailyPicks(view);
 if(daily.official.status==='UNAVAILABLE')warnings.push('MLB: selecciones y precios canónicos incompletos.');
 const selected:DayPick[]=dailyDisplayRows(daily.official.data,view.date).map(p=>({key:'MLB:official:'+p.predictionId,sport:'MLB',classification:'OFFICIAL_PICK',matchup:p.matchup,selection:p.selection??'Sin selección',modelProbability:p.modelProbability,projection:null,edgePp:p.edgePercentagePoints,odds:p.americanOdds,book:p.sportsbook,href:'/performance'}));
 const edge:DayPick[]=dailyDisplayRows(daily.edge.data,view.date,true).map(p=>({key:'MLB:edge:'+p.predictionId,sport:'MLB',classification:'Informativo · consenso MLB',matchup:p.matchup,selection:p.selection??'Sin selección',modelProbability:p.modelProbability,projection:null,edgePp:p.edgePercentagePoints,odds:p.americanOdds,book:p.sportsbook,href:'/mlb-value-board'}));
 if(research.status==='UNAVAILABLE')warnings.push('MLB: ledger de fórmulas no disponible.');
 else for(const p of research.entries??[]){if(p.date!==view.date)continue;const g=research.groups.find(g=>g.key===p.groupKey);if(!g)continue;const game=games.find(g=>g.sport==='MLB'&&g.eventId===String(p.gamePk));if(game){game.registered++;game.analyzed=true;}selected.push({key:'MLB:research:'+p.id,sport:'MLB',classification:g.engine+' · '+g.phase+' · '+(g.engine==='PICK_EDGE'?'artefacto, no recomendación':'research')+' · '+p.result,matchup:game?.title??'MLB #'+p.gamePk,selection:p.selection,modelProbability:null,projection:p.projection,edgePp:null,odds:null,book:null,href:'/mlb/overview'});}
 if(nhl.status==='AVAILABLE'){
  if(nhl.health.status!=='PASS')warnings.push('NHL: operación de la fuente requiere atención; sin edge vigente.');
  if(nhl.health.coverage!==null&&nhl.health.eligible!==null&&nhl.health.coverage<nhl.health.eligible)warnings.push(`NHL: pronósticos/precios disponibles para ${nhl.health.coverage}/${nhl.health.eligible} partidos futuros.`);
  if(!nhl.games)warnings.push('NHL: calendario completo no disponible; no se infiere de los pronósticos.');
  const opportunities=nhlOpportunities(nhl);
  for(const g of nhl.games??[]){
   const f=nhl.forecasts.find(f=>f.eventId===g.eventId),picks=nhl.history.filter(p=>p.eventId===g.eventId),active=picks.filter(p=>p.status!=='CANCELLED'&&p.status!=='VOID');
   const started=Date.parse(g.scheduledAt)<=Date.parse(nhl.readAt)||/LIVE|PROGRESS|FINAL|COMPLETED|CANCELLED|POSTPONED/i.test(g.status);
   const run=nhl.health.latestRunAt?Date.parse(nhl.health.latestRunAt):NaN,now=Date.parse(nhl.readAt);
   const current=!!f&&nhl.health.status==='PASS'&&Number.isFinite(run)&&now-run<=45*60000&&run<=now+5000&&now-Date.parse(f.capturedAt)<=45*60000;
   const value=opportunities.filter(p=>p.key.startsWith((f?.id??'missing')+':')).length;
   games.push({key:'NHL:'+g.eventId,sport:'NHL',eventId:g.eventId,title:g.eventName,scheduledAt:g.scheduledAt,analyzed:!!f,started,waiting:!started&&!current,official:0,registered:active.length,value,noEdge:current&&!started&&value===0,
    nhl:{away:g.away,home:g.home,awayProbability:f?.awayProbability??null,homeProbability:f?.homeProbability??null,awayOdds:f?.awayOdds??null,homeOdds:f?.homeOdds??null,capturedAt:f?.capturedAt??null,status:g.status,selections:active.map(p=>p.direction+' · '+(p.odds>0?'+':'')+p.odds)}});
  }
  for(const p of nhl.history.filter(p=>nhlDate(p.scheduledAt)===view.date&&!['CANCELLED','VOID'].includes(p.status)))selected.push({key:'NHL:'+p.id,sport:'NHL',classification:'MODEL_ONLY',matchup:p.eventName,selection:p.direction,modelProbability:100*p.modelProbability,projection:null,edgePp:p.edgePp,odds:p.odds,book:p.sportsbook,href:'/nhl'});
  edge.push(...opportunities.map(p=>({key:'NHL:'+p.key,sport:'NHL',classification:'Informativo · par Circa sin margen',matchup:p.eventName,selection:p.selection,modelProbability:p.probability*100,projection:null,edgePp:p.edgePp,odds:p.odds,book:'Circa',href:'/nhl'})));
 }else warnings.push('NHL: fuente no disponible; calendario y selecciones incompletos.');
 const distinct=(rows:DayPick[])=>[...new Map(rows.map(p=>[p.key,p])).values()];
 return {date:view.date,games:games.sort((a,b)=>Date.parse(a.scheduledAt)-Date.parse(b.scheduledAt)||a.key.localeCompare(b.key)),selected:distinct(selected),edge:distinct(edge).sort((a,b)=>(b.edgePp??0)-(a.edgePp??0)||a.key.localeCompare(b.key)),warnings:[...new Set(warnings)],nhlHealth:nhl.status==='AVAILABLE'?nhl.health:null};
}
export const DAY_FILTERS=['All','Picks','Value','No Edge','Waiting','Started'] as const;
export type DayFilter=typeof DAY_FILTERS[number];
export function filterDayGames(games:DayGame[],sport:string,filter:DayFilter){return games.filter(g=>(sport==='ALL'||g.sport===sport)&&(filter==='All'||filter==='Picks'&&g.registered>0||filter==='Value'&&g.value>0||filter==='No Edge'&&g.noEdge||filter==='Waiting'&&g.waiting||filter==='Started'&&g.started));}
