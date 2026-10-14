import 'server-only';
import { cache } from 'react';
import { getQualifiedPlaysReport } from './qualified-plays-read.service';
import { getMlbOfficialPerformance } from './pick2-mlb-performance-read.service';
import { getNhlExternalReport } from './nhl-external-read.service';
import { getSportsCenterReport } from './sports-center.service';
import { mlbModelCohorts,nhlModelCohort,type SportModelCard } from '@/lib/sport-model-overview';
export const getMultisportModelReport=cache(async()=>{
  const [research,official,nhl]=await Promise.all([getQualifiedPlaysReport({includeEntries:true}),getMlbOfficialPerformance().catch(()=>null),getNhlExternalReport()]);
  const cards:SportModelCard[]=[
    {key:'mlb',label:'MLB',href:'/mlb/overview',classification:'Producción + forward research',cohorts:mlbModelCohorts(research,official)},
    {key:'nhl',label:'NHL',href:'/nhl',classification:'MODEL_ONLY',cohorts:[nhlModelCohort(nhl)]},
    ...getSportsCenterReport().sports.filter(s=>!['mlb','nhl'].includes(s.key)).map(s=>({key:s.key,label:s.label,href:'/sports-center/'+s.key,classification:s.status,cohorts:[]})),
    {key:'ncaab',label:'NCAAB',href:'/sports-center',classification:'Investigación · no conectado',cohorts:[]},
  ];
  return {cards,research,nhl,readAt:new Date().toISOString()};
});
