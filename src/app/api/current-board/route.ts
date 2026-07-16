import { NextRequest } from 'next/server'
import { apiError, apiOk, errorMessage, parseIntegerParam, requestId } from '@/lib/api-contract'
import {
  getCurrentBoard,
  mapLegacyBoardMode,
  validateCurrentBoardDeterministicFixtures,
} from '@/services/current-board.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  try {
    const { searchParams } = new URL(request.url)
    const includeValidation = searchParams.get('includeValidation') === 'true'
    const board = await getCurrentBoard({
      sportKey: searchParams.get('sportKey') ?? 'baseball_mlb',
      mode: mapLegacyBoardMode(searchParams.get('mode')),
      limit: parseIntegerParam({ value: searchParams.get('limit'), fallback: 100, min: 1, max: 200 }),
    })

    return apiOk(
      {
        ...board,
        validation: includeValidation ? validateCurrentBoardDeterministicFixtures() : undefined,
      },
      id
    )
  } catch (error) {
    return apiError({
      id,
      code: 'INTERNAL_ERROR',
      message: errorMessage(error, 'Unknown current board error'),
      status: 500,
    })
  }
}
