import { getOfficialPerformanceOverview } from "@/services/official-performance-overview.service";
import OfficialPerformanceOverviewView from "./OfficialPerformanceOverviewView";
import NhlHomepageSummary from "./NhlHomepageSummary";
import { getNhlExternalReport } from "@/services/nhl-external-read.service";
import { Suspense } from "react";
import type { NhlReport } from "@/lib/nhl-external-report";
async function NhlResult({pending}:{pending:Promise<NhlReport>}) { return <NhlHomepageSummary report={await pending}/>; }

export default async function OfficialPerformanceOverview() {
  const nhl = getNhlExternalReport();
  const report = await getOfficialPerformanceOverview();
  return <><OfficialPerformanceOverviewView {...report} /><Suspense fallback={<p role="status">Cargando registros NHL…</p>}><NhlResult pending={nhl}/></Suspense></>;
}
