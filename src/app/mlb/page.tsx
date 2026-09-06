import DashboardShell from '@/components/dashboard/DashboardShell'
import MlbDecisionBoard from '@/components/mlb/MlbDecisionBoard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function MlbDecisionBoardPage() {
  return (
    <DashboardShell>
      <MlbDecisionBoard />
    </DashboardShell>
  )
}
