import 'server-only';
import { cache } from 'react';
import { getQualifiedPlaysReport } from './qualified-plays-read.service';
import { getMlbOfficialPerformance } from './pick2-mlb-performance-read.service';
import { getNhlExternalReport } from './nhl-external-read.service';
import { getSportsCenterReport } from './sports-center.service';
import { mlbModelCohorts,nhlModelCohort,type SportModelCard } from '@/lib/sport-model-overview';
import {getNcaabDailyReport} from './ncaab-daily.service';
import {ncaabModelCohort} from '@/lib/ncaab-checkpoint';
import {getSoccerShadowReport} from './soccer-shadow-read.service';
import {getTableTennisReport} from './table-tennis-read.service';
import {getEdgeLabOverviewCards} from './edge-lab-overview-read.service';
export const getMultisportModelReport=cache(async()=>{
  const [research,official,nhl,soccer,tableTennis,ncaab,edgeLabCards]=await Promise.all([getQualifiedPlaysReport({includeEntries:true}),getMlbOfficialPerformance().catch(()=>null),getNhlExternalReport(),getSoccerShadowReport(),getTableTennisReport(),getNcaabDailyReport(),getEdgeLabOverviewCards()]);
  const cards:SportModelCard[]=[
    {key:'mlb',label:'MLB',href:'/mlb/overview',classification:'Producción + forward research',cohorts:mlbModelCohorts(research,official)},
    {key:'nhl',label:'NHL',href:'/nhl',classification:'MODEL_ONLY',cohorts:[nhlModelCohort(nhl)]},
    ...edgeLabCards,
    ...getSportsCenterReport().sports.filter(s=>!['mlb','nhl','soccer','table-tennis','ncaaf'].includes(s.key)).map(s=>({key:s.key,label:s.label,href:s.key==='nba'?'/nba-market-data':'/sports-center/'+s.key,classification:s.key==='nba'?'Cuotas · modelo separado':s.status,cohorts:[]})),
    {key:'ncaab',label:'NCAAB',href:'/ncaab',classification:'Experimental · proceso diario FREE',cohorts:[ncaabModelCohort(ncaab)]},
  ];
  return {cards,research,nhl,ncaab,soccer,tableTennis,readAt:new Date().toISOString()};
});
