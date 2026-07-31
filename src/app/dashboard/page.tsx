import DashboardShell from '@/components/dashboard/DashboardShell'
import DashboardSection from '@/components/dashboard/DashboardSection'
import TodayDecisionPanel from '@/components/dashboard/TodayDecisionPanel'
import DashboardDeveloperGroups from '@/components/dashboard/DashboardDeveloperGroups'
import AdvancedEvidenceDisclosure from '@/components/dashboard/AdvancedEvidenceDisclosure'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardSection
        id="today"
        eyebrow="Decision Cockpit"
        title="Today"
        description="A focused daily answer: should you bet today, and what is the strongest available opportunity if you review anyway?"
      >
        <TodayDecisionPanel />
      </DashboardSection>
      <AdvancedEvidenceDisclosure>
        <DashboardDeveloperGroups />
      </AdvancedEvidenceDisclosure>
    </DashboardShell>
  )
}
