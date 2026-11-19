import {combinedDay} from '@/lib/multisport-day';
import type {MlbView} from '@/components/pick2/mlb-presentation';
import MultisportDayView from './MultisportDayView';
export default async function MultisportDay({view}:{view:MlbView}){
 const {getMultisportModelReport}=await import('@/services/multisport-model-read.service');
 const {research,nhl,ncaab,soccer,tableTennis,ufc,freeSports,readWarnings}=await getMultisportModelReport();
 const day=combinedDay(view,nhl,research,ncaab,soccer,tableTennis,ufc,freeSports);
 day.warnings=[...new Set([...readWarnings,...day.warnings])];
 return <MultisportDayView day={day} mlb={view}/>;
}
