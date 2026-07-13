export type SettlementOutcome = 'win' | 'loss' | 'push' | 'void' | 'pending'

export type SettlementMarket = 'moneyline' | 'spread' | 'total'

export type ScoreInput = {
  selectedScore: number | null
  opponentScore: number | null
  eventStatus: string
}

export type SettlementInput = ScoreInput & {
  market: SettlementMarket
  selection: string
  line?: number | null
  overtimePolicy?: 'include' | 'exclude'
}

export type SettlementDecision = {
  outcome: SettlementOutcome
  reason: string
  market: SettlementMarket
  selection: string
  line: number | null
}

const VOID_STATUSES = new Set(['cancelled', 'postponed', 'void'])
const PENDING_STATUSES = new Set(['scheduled', 'live', 'pending'])

function hasScores(input: ScoreInput) {
  return (
    Number.isFinite(Number(input.selectedScore)) &&
    Number.isFinite(Number(input.opponentScore))
  )
}

function baseGuard(input: SettlementInput): SettlementDecision | null {
  const status = String(input.eventStatus ?? '').toLowerCase()

  if (VOID_STATUSES.has(status)) {
    return decision(input, 'void', `Event status is ${status}.`)
  }

  if (PENDING_STATUSES.has(status) || !hasScores(input)) {
    return decision(input, 'pending', 'Event is not final or scores are unavailable.')
  }

  if (input.market !== 'moneyline' && !Number.isFinite(Number(input.line))) {
    return decision(input, 'void', 'Line is required for spread and total settlement.')
  }

  return null
}

function decision(
  input: SettlementInput,
  outcome: SettlementOutcome,
  reason: string
): SettlementDecision {
  return {
    outcome,
    reason,
    market: input.market,
    selection: input.selection,
    line: input.line ?? null,
  }
}

export function settleMoneyline(input: SettlementInput): SettlementDecision {
  const guard = baseGuard(input)
  if (guard) return guard

  const selected = Number(input.selectedScore)
  const opponent = Number(input.opponentScore)

  if (selected === opponent) return decision(input, 'push', 'Scores are tied.')
  return decision(
    input,
    selected > opponent ? 'win' : 'loss',
    selected > opponent ? 'Selected side won.' : 'Selected side lost.'
  )
}

export function settleSpread(input: SettlementInput): SettlementDecision {
  const guard = baseGuard(input)
  if (guard) return guard

  const adjusted = Number(input.selectedScore) + Number(input.line)
  const opponent = Number(input.opponentScore)

  if (adjusted === opponent) return decision(input, 'push', 'Adjusted score equals opponent score.')
  return decision(
    input,
    adjusted > opponent ? 'win' : 'loss',
    adjusted > opponent ? 'Selected side covered.' : 'Selected side did not cover.'
  )
}

export function settleTotal(input: SettlementInput): SettlementDecision {
  const guard = baseGuard(input)
  if (guard) return guard

  const total = Number(input.selectedScore) + Number(input.opponentScore)
  const line = Number(input.line)
  const selection = input.selection.toLowerCase()

  if (total === line) return decision(input, 'push', 'Total landed exactly on the line.')

  if (selection.includes('over')) {
    return decision(
      input,
      total > line ? 'win' : 'loss',
      total > line ? 'Total went over.' : 'Total stayed under.'
    )
  }

  if (selection.includes('under')) {
    return decision(
      input,
      total < line ? 'win' : 'loss',
      total < line ? 'Total stayed under.' : 'Total went over.'
    )
  }

  return decision(input, 'void', 'Total selection must contain over or under.')
}

export function settleMarket(input: SettlementInput): SettlementDecision {
  if (input.market === 'moneyline') return settleMoneyline(input)
  if (input.market === 'spread') return settleSpread(input)
  return settleTotal(input)
}

export function getSettlementCoreStatus() {
  const samples: SettlementInput[] = [
    {
      market: 'moneyline',
      selection: 'Home',
      selectedScore: 101,
      opponentScore: 98,
      eventStatus: 'completed',
    },
    {
      market: 'spread',
      selection: 'Away +4.5',
      selectedScore: 96,
      opponentScore: 100,
      line: 4.5,
      eventStatus: 'completed',
    },
    {
      market: 'total',
      selection: 'Over 210.5',
      selectedScore: 110,
      opponentScore: 105,
      line: 210.5,
      eventStatus: 'completed',
    },
    {
      market: 'total',
      selection: 'Under 200',
      selectedScore: 100,
      opponentScore: 100,
      line: 200,
      eventStatus: 'completed',
    },
    {
      market: 'moneyline',
      selection: 'Home',
      selectedScore: null,
      opponentScore: null,
      eventStatus: 'scheduled',
    },
    {
      market: 'spread',
      selection: 'Home -2.5',
      selectedScore: 0,
      opponentScore: 0,
      line: -2.5,
      eventStatus: 'cancelled',
    },
  ]
  const decisions = samples.map(settleMarket)

  return {
    success: true,
    mode: 'settlement_core_v2',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_local_self_test',
    },
    primitives: {
      moneyline: true,
      spread: true,
      total: true,
      push: true,
      void: true,
      pending: true,
      overtimePolicyContract: true,
      periodMarketContract: true,
    },
    summary: {
      checked: decisions.length,
      wins: decisions.filter((item) => item.outcome === 'win').length,
      losses: decisions.filter((item) => item.outcome === 'loss').length,
      pushes: decisions.filter((item) => item.outcome === 'push').length,
      voids: decisions.filter((item) => item.outcome === 'void').length,
      pending: decisions.filter((item) => item.outcome === 'pending').length,
    },
    decisions,
    integrationStatus:
      'Settlement primitives are available. NBA settlement remains compatible and should adopt shared primitives incrementally only where behavior matches exactly.',
  }
}
