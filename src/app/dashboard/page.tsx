import DashboardShell from '@/components/dashboard/DashboardShell'
import DashboardSection from '@/components/dashboard/DashboardSection'
import ProductTodayPanel from '@/components/dashboard/ProductTodayPanel'
import DashboardDeveloperGroups from '@/components/dashboard/DashboardDeveloperGroups'

export default function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardSection
        id="today"
        eyebrow="Today"
        title="Should I Bet Today?"
        description="A concise AI briefing, current MLB board, daily timeline and system health."
      >
        <ProductTodayPanel />
      </DashboardSection>
      <DashboardDeveloperGroups />
    </DashboardShell>
  )
}
