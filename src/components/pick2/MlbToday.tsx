import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import OfficialPerformanceOverview from "@/components/dashboard/OfficialPerformanceOverview";
import { getMlbOperationalView } from "@/services/pick2-operational-read.service";
import { TodayContent } from "./MlbTodayContent";
export { TodayContent } from "./MlbTodayContent";
export default async function MlbToday() {
  return (
    <DashboardShell>
      <TodayContent
        view={await getMlbOperationalView()}
        performance={
          <Suspense
            fallback={<p role="status">Loading official performance…</p>}
          >
            <OfficialPerformanceOverview />
          </Suspense>
        }
      />
    </DashboardShell>
  );
}
