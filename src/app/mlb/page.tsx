import DashboardShell from '@/components/dashboard/DashboardShell'
import Link from 'next/link'
import MlbDecisionBoard from '@/components/mlb/MlbDecisionBoard'
import { getMlbDecisionBoard } from '@/services/mlb-decision-board.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MlbDecisionBoardPage() {
  const initialData = await getMlbDecisionBoard()

  return (
    <DashboardShell>
      <Link href="/mlb/overview" className="inline-block rounded-lg border border-teal-400/40 px-4 py-2 text-sm font-semibold text-teal-300">MLB general · Pick, Edge, Equilizer y fórmulas →</Link>
      <MlbDecisionBoard initialData={initialData} />
    </DashboardShell>
  )
}
