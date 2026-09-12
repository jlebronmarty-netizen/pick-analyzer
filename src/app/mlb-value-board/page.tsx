import DashboardShell from '@/components/dashboard/DashboardShell'
import MlbValueBoardClient from '@/components/pick2/MlbValueBoardClient'
import { getMlbOperationalView } from '@/services/pick2-operational-read.service'

export const dynamic = 'force-dynamic'

export default async function MlbValueBoardPage() {
  const { board, games, warnings } = await getMlbOperationalView()

  return (
    <DashboardShell>
      {warnings.length > 0 && <p role="status" className="p-4 text-amber-200">Some analysis is unavailable. Check Data Health for details.</p>}
      <MlbValueBoardClient board={board} games={games} />
    </DashboardShell>
  )
}
