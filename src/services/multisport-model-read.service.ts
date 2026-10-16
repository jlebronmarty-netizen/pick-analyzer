import 'server-only';
import { cache } from 'react';
import { getQualifiedPlaysReport } from './qualified-plays-read.service';
import { getMlbOfficialPerformance } from './pick2-mlb-performance-read.service';
import { getNhlExternalReport } from './nhl-external-read.service';
import { getSportsCenterReport } from './sports-center.service';
import { mlbModelCohorts,nhlModelCohort,type SportModelCard } from '@/lib/sport-model-overview';
import {getNcaabCheckpoint} from './ncaab-checkpoint-read.service';
import {ncaabModelCohort} from '@/lib/ncaab-checkpoint';
import {getSoccerShadowReport} from './soccer-shadow-read.service';
import {soccerModelCohort} from '@/lib/soccer-shadow-report';
export const getMultisportModelReport=cache(async()=>{
  const [research,official,nhl,soccer]=await Promise.all([getQualifiedPlaysReport({includeEntries:true}),getMlbOfficialPerformance().catch(()=>null),getNhlExternalReport(),getSoccerShadowReport()]);
  const ncaab=getNcaabCheckpoint();
  const cards:SportModelCard[]=[
    {key:'mlb',label:'MLB',href:'/mlb/overview',classification:'Producción + forward research',cohorts:mlbModelCohorts(research,official)},
    {key:'nhl',label:'NHL',href:'/nhl',classification:'MODEL_ONLY',cohorts:[nhlModelCohort(nhl)]},
    {key:'soccer',label:'Soccer',href:'/soccer',classification:'SHADOW / RESEARCH',cohorts:[soccerModelCohort(soccer)]},
    ...getSportsCenterReport().sports.filter(s=>!['mlb','nhl','soccer'].includes(s.key)).map(s=>({key:s.key,label:s.label,href:'/sports-center/'+s.key,classification:s.status,cohorts:[]})),
    {key:'ncaab',label:'NCAAB',href:'/ncaab',classification:'Experimental · checkpoint publicado',cohorts:[ncaabModelCohort(ncaab)]},
  ];
  return {cards,research,nhl,ncaab,soccer,readAt:new Date().toISOString()};
});
