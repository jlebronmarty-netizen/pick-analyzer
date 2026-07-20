import DashboardShell from '@/components/dashboard/DashboardShell'
import DashboardSection from '@/components/dashboard/DashboardSection'
import UserTodayPanel from '@/components/dashboard/UserTodayPanel'
import DashboardDeveloperGroups from '@/components/dashboard/DashboardDeveloperGroups'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardSection
        id="today"
        eyebrow="User Mode"
        title="Today"
        description="A simple betting briefing built for a 10-second read."
      >
        <UserTodayPanel />
      </DashboardSection>
      <DashboardDeveloperGroups />
    </DashboardShell>
  )
}
