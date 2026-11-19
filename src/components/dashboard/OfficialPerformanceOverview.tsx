import {getMultisportModelReport} from '@/services/multisport-model-read.service';
import SportModelOverview from './SportModelOverview';

export default async function OfficialPerformanceOverview() {
  const report=await getMultisportModelReport();
  return <>
    {report.readWarnings.length>0&&<p role="status" className="rounded-xl border border-amber-400/30 p-4 text-sm text-amber-200">Cobertura parcial: {report.readWarnings.join(' · ')}</p>}
    <SportModelOverview cards={report.cards}/>
  </>;
}
