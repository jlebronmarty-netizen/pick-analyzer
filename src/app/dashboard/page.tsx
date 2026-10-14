import DashboardShell from '@/components/dashboard/DashboardShell'
import DashboardSection from '@/components/dashboard/DashboardSection'
import TodayDecisionPanel from '@/components/dashboard/TodayDecisionPanel'
import DashboardDeveloperGroups from '@/components/dashboard/DashboardDeveloperGroups'
import AdvancedEvidenceDisclosure from '@/components/dashboard/AdvancedEvidenceDisclosure'
import OfficialPerformanceOverview from '@/components/dashboard/OfficialPerformanceOverview'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardSection
        id="today"
        eyebrow="Pick Analyzer"
        title="Today's picks & performance"
        description="Official recommendations, model edge and settled results, sport by sport."
      >
        <Suspense fallback={<p role="status" className="text-sm text-slate-400">Loading certified performance…</p>}>
          <OfficialPerformanceOverview />
        </Suspense>
        <TodayDecisionPanel />
      </DashboardSection>
      <AdvancedEvidenceDisclosure>
        <DashboardDeveloperGroups />
      </AdvancedEvidenceDisclosure>
    </DashboardShell>
  )
}
