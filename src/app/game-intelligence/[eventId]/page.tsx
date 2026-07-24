import MlbGameIntelligenceDetailClient from '@/components/dashboard/MlbGameIntelligenceDetailClient'

export const dynamic = 'force-dynamic'

export default async function GameIntelligenceDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  return <MlbGameIntelligenceDetailClient eventId={decodeURIComponent(eventId)} />
}
