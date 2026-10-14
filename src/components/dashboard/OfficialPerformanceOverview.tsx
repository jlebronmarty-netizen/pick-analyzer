import {getMultisportModelReport} from '@/services/multisport-model-read.service';
import SportModelOverview from './SportModelOverview';

export default async function OfficialPerformanceOverview() {
  const report=await getMultisportModelReport();
  return <SportModelOverview cards={report.cards}/>;
}
