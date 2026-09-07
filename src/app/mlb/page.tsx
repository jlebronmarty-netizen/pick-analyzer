import DashboardShell from '@/components/dashboard/DashboardShell'
import MlbDecisionBoard from '@/components/mlb/MlbDecisionBoard'
import { getMlbDecisionBoard } from '@/services/mlb-decision-board.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MlbDecisionBoardPage() {
  const initialData = await getMlbDecisionBoard()

  return (
    <DashboardShell>
      <MlbDecisionBoard initialData={initialData} />
    </DashboardShell>
  )
}
