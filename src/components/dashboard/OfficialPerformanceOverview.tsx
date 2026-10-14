import { getOfficialPerformanceOverview } from "@/services/official-performance-overview.service";
import OfficialPerformanceOverviewView from "./OfficialPerformanceOverviewView";

export default async function OfficialPerformanceOverview() {
  const report = await getOfficialPerformanceOverview();
  return <OfficialPerformanceOverviewView {...report} />;
}
