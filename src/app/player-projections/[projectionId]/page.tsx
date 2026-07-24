import MlbPlayerProjectionDetailClient from '@/components/dashboard/MlbPlayerProjectionDetailClient'

export const dynamic = 'force-dynamic'

export default async function PlayerProjectionDetailPage({ params }: { params: Promise<{ projectionId: string }> }) {
  const { projectionId } = await params
  return <MlbPlayerProjectionDetailClient projectionId={decodeURIComponent(projectionId)} />
}
