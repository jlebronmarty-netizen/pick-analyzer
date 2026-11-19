import 'server-only';
import {getUfcFreeReport} from './ufc-free.service';
import {ufcCohort} from '@/lib/ufc/free-v2';
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
import {getNbaGoatModelCard} from './nba-goat-model-read.service';
import {freeSportCards,getFreeSportsReports} from './free-sports.service';
import {readMultisportInputs} from '@/lib/multisport-report-resilience';
export const getMultisportModelReport=cache(async()=>{
  const {research,official,nhl,soccer,tableTennis,ncaab,ufc,edgeLabCards,nbaCard,freeSports,readWarnings}=await readMultisportInputs({
    research:()=>getQualifiedPlaysReport({includeEntries:true}),official:getMlbOfficialPerformance,
    nhl:getNhlExternalReport,soccer:getSoccerShadowReport,tableTennis:getTableTennisReport,
    ncaab:getNcaabDailyReport,ufc:getUfcFreeReport,edgeLabCards:getEdgeLabOverviewCards,
    nbaCard:getNbaGoatModelCard,freeSports:getFreeSportsReports,
  });
  const cards:SportModelCard[]=[
    {key:'mlb',label:'MLB',href:'/mlb/overview',classification:'Producción + forward research',cohorts:mlbModelCohorts(research,official)},
    {key:'nhl',label:'NHL',href:'/nhl',classification:'MODEL_ONLY',cohorts:[nhlModelCohort(nhl)]},
    ...edgeLabCards,
    {key:'ufc',label:'UFC',href:'/ufc',classification:'SHADOW / RESEARCH · FREE',cohorts:[ufcCohort(ufc)]},
    nbaCard,
    ...freeSportCards(freeSports),
    ...getSportsCenterReport().sports.filter(s=>!['mlb','nhl','soccer','table-tennis','ncaaf','ufc','mma_ufc','nba','nfl','bsn','tennis'].includes(s.key)).map(s=>({key:s.key,label:s.label,href:'/sports-center/'+s.key,classification:s.status,cohorts:[]})),
    {key:'ncaab',label:'NCAAB',href:'/ncaab',classification:'Experimental · proceso diario FREE',cohorts:[ncaabModelCohort(ncaab)]},
  ];
  return {cards,research,nhl,ncaab,soccer,tableTennis,ufc,freeSports,readWarnings,readAt:new Date().toISOString()};
});
