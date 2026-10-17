import {combinedDay} from '@/lib/multisport-day';
import type {MlbView} from '@/components/pick2/mlb-presentation';
import MultisportDayView from './MultisportDayView';
export default async function MultisportDay({view}:{view:MlbView}){
 const {getMultisportModelReport}=await import('@/services/multisport-model-read.service');
 const {research,nhl,ncaab,soccer,tableTennis}=await getMultisportModelReport();
 return <MultisportDayView day={combinedDay(view,nhl,research,ncaab,soccer,tableTennis)} mlb={view}/>;
}
