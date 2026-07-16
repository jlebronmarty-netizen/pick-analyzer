import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { runAiBetFinder, validateAiBetFinderDeterministicFixtures } from '@/services/ai-bet-finder.service'

const actions = ['SEARCH', 'COMPARE', 'EXPLAIN', 'BUILD_TICKET', 'WHAT_CHANGED'] as const

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    const body = await request.json().catch(() => ({}))
    const action = typeof body.action === 'string' && actions.includes(body.action as never)
      ? body.action
      : undefined
    const result = await runAiBetFinder({
      action,
      query: typeof body.query === 'string' ? body.query : '',
      candidateIds: Array.isArray(body.candidateIds) ? body.candidateIds.map(String) : undefined,
      mode: typeof body.mode === 'string' ? body.mode : undefined,
    })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown AI Bet Finder error'),
      status: 500,
    })
  }
}

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('validate') === 'true') {
      return apiOk(validateAiBetFinderDeterministicFixtures(), id)
    }
    const result = await runAiBetFinder({ query: searchParams.get('q') ?? 'Most likely today' })
    return apiOk(result, id)
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown AI Bet Finder error'),
      status: 500,
    })
  }
}
