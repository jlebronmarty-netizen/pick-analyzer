import { notFound } from 'next/navigation'
import DashboardShell from '@/components/dashboard/DashboardShell'
import MlbValueBoardClient from '@/components/pick2/MlbValueBoardClient'
import { getPreparedPick2MlbValueBoard, isPick2MlbValueBoardEnabled } from '@/services/pick2-mlb-value-board.service'

export const dynamic = 'force-dynamic'

export default async function MlbValueBoardPage() {
  if (!isPick2MlbValueBoardEnabled()) notFound()

  const board = await getPreparedPick2MlbValueBoard()

  return (
    <DashboardShell>
      <MlbValueBoardClient board={board} />
    </DashboardShell>
  )
}
