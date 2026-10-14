import DashboardShell from "@/components/dashboard/DashboardShell";
import MlbEngineHub from "@/components/dashboard/MlbEngineHub";
import { getMlbEngineHub } from "@/services/mlb-engine-hub-read.service";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function MlbOverviewPage() {
  const report = await getMlbEngineHub();
  return <DashboardShell><MlbEngineHub {...report} /></DashboardShell>;
}
