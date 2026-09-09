import DashboardShell from '@/components/dashboard/DashboardShell'
import MlbValueBoardClient from '@/components/pick2/MlbValueBoardClient'
import { getMlbOperationalView } from '@/services/pick2-operational-read.service'

export const dynamic = 'force-dynamic'

export default async function MlbValueBoardPage() {
  const { board, warnings } = await getMlbOperationalView()

  return (
    <DashboardShell>
      {warnings.map(w => <p key={w} role="status" className="p-4 text-amber-200">{w}</p>)}
      <MlbValueBoardClient board={board} />
    </DashboardShell>
  )
}
