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

type SettlementFixture = {
  sport: 'NBA' | 'MLB' | 'NFL' | 'NHL' | 'Soccer'
  marketLabel: string
  supported: boolean
  contractOnly: boolean
  input: SettlementInput | null
  decision: SettlementDecision | null
  rule: string
  warning: string | null
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

function fixture({
  sport,
  marketLabel,
  input,
  rule,
  warning = null,
  contractOnly = false,
}: {
  sport: SettlementFixture['sport']
  marketLabel: string
  input: SettlementInput | null
  rule: string
  warning?: string | null
  contractOnly?: boolean
}): SettlementFixture {
  return {
    sport,
    marketLabel,
    supported: Boolean(input) && !contractOnly,
    contractOnly,
    input,
    decision: input && !contractOnly ? settleMarket(input) : null,
    rule,
    warning,
  }
}

function buildSettlementFixtureCoverage(): SettlementFixture[] {
  return [
    fixture({
      sport: 'NBA',
      marketLabel: 'moneyline',
      input: { market: 'moneyline', selection: 'Home', selectedScore: 112, opponentScore: 108, eventStatus: 'completed' },
      rule: 'Full-game moneyline includes the final completed score.',
    }),
    fixture({
      sport: 'NBA',
      marketLabel: 'spread',
      input: { market: 'spread', selection: 'Away +4.5', selectedScore: 104, opponentScore: 108, line: 4.5, eventStatus: 'completed' },
      rule: 'Spread grades selected score plus line against opponent score.',
    }),
    fixture({
      sport: 'NBA',
      marketLabel: 'total',
      input: { market: 'total', selection: 'Over 220.5', selectedScore: 114, opponentScore: 110, line: 220.5, eventStatus: 'completed' },
      rule: 'Total grades selected over/under against combined score.',
    }),
    fixture({
      sport: 'NBA',
      marketLabel: 'first half',
      input: { market: 'spread', selection: 'Home -1.5 1H', selectedScore: 58, opponentScore: 55, line: -1.5, eventStatus: 'completed' },
      rule: 'Period markets can reuse spread/total primitives only when period scores are supplied.',
    }),
    fixture({
      sport: 'NBA',
      marketLabel: 'first quarter',
      input: { market: 'total', selection: 'Under 56.5 1Q', selectedScore: 27, opponentScore: 26, line: 56.5, eventStatus: 'completed' },
      rule: 'Quarter markets require quarter-specific scores and must not use full-game scores.',
    }),
    fixture({
      sport: 'NBA',
      marketLabel: 'overtime inclusion',
      input: { market: 'moneyline', selection: 'Home incl OT', selectedScore: 121, opponentScore: 119, eventStatus: 'completed', overtimePolicy: 'include' },
      rule: 'Overtime policy is an explicit contract field; sport adapters must supply the right score basis.',
    }),
    fixture({
      sport: 'MLB',
      marketLabel: 'moneyline',
      input: { market: 'moneyline', selection: 'Away', selectedScore: 5, opponentScore: 3, eventStatus: 'completed' },
      rule: 'MLB moneyline grades final score when event is completed.',
    }),
    fixture({
      sport: 'MLB',
      marketLabel: 'run line',
      input: { market: 'spread', selection: 'Home -1.5', selectedScore: 6, opponentScore: 4, line: -1.5, eventStatus: 'completed' },
      rule: 'Run line uses spread primitive with baseball naming.',
    }),
    fixture({
      sport: 'MLB',
      marketLabel: 'total',
      input: { market: 'total', selection: 'Under 8.5', selectedScore: 4, opponentScore: 3, line: 8.5, eventStatus: 'completed' },
      rule: 'MLB totals use combined final score unless a period-specific score basis is supplied.',
    }),
    fixture({
      sport: 'MLB',
      marketLabel: 'first five innings',
      input: { market: 'total', selection: 'Over 4.5 F5', selectedScore: 3, opponentScore: 2, line: 4.5, eventStatus: 'completed' },
      rule: 'First-five markets require first-five score inputs and must not use full-game scores.',
    }),
    fixture({
      sport: 'MLB',
      marketLabel: 'extra innings',
      input: { market: 'moneyline', selection: 'Away incl extras', selectedScore: 7, opponentScore: 6, eventStatus: 'completed', overtimePolicy: 'include' },
      rule: 'Extra-innings inclusion is represented by the supplied score basis and overtime policy contract.',
    }),
    fixture({
      sport: 'MLB',
      marketLabel: 'postponed/suspended/void',
      input: { market: 'moneyline', selection: 'Home', selectedScore: null, opponentScore: null, eventStatus: 'postponed' },
      rule: 'Postponed games void unless sport-specific reschedule rules are supplied.',
    }),
    fixture({
      sport: 'NFL',
      marketLabel: 'moneyline',
      input: { market: 'moneyline', selection: 'Home', selectedScore: 24, opponentScore: 17, eventStatus: 'completed' },
      rule: 'NFL moneyline grades final score.',
    }),
    fixture({
      sport: 'NFL',
      marketLabel: 'spread',
      input: { market: 'spread', selection: 'Away +7', selectedScore: 20, opponentScore: 27, line: 7, eventStatus: 'completed' },
      rule: 'Whole-number spread can push.',
    }),
    fixture({
      sport: 'NFL',
      marketLabel: 'total',
      input: { market: 'total', selection: 'Over 44.5', selectedScore: 27, opponentScore: 24, line: 44.5, eventStatus: 'completed' },
      rule: 'NFL total grades combined score.',
    }),
    fixture({
      sport: 'NFL',
      marketLabel: 'first half',
      input: { market: 'spread', selection: 'Home -3 1H', selectedScore: 14, opponentScore: 10, line: -3, eventStatus: 'completed' },
      rule: 'First-half markets require first-half score basis.',
    }),
    fixture({
      sport: 'NFL',
      marketLabel: 'overtime',
      input: { market: 'moneyline', selection: 'Home incl OT', selectedScore: 30, opponentScore: 27, eventStatus: 'completed', overtimePolicy: 'include' },
      rule: 'Overtime inclusion/exclusion must be explicit from market metadata.',
    }),
    fixture({
      sport: 'NFL',
      marketLabel: 'push',
      input: { market: 'spread', selection: 'Away +7', selectedScore: 20, opponentScore: 27, line: 7, eventStatus: 'completed' },
      rule: 'Adjusted score equal to opponent score is a push.',
    }),
    fixture({
      sport: 'NHL',
      marketLabel: 'moneyline including OT/shootout',
      input: { market: 'moneyline', selection: 'Home incl OT/SO', selectedScore: 4, opponentScore: 3, eventStatus: 'completed', overtimePolicy: 'include' },
      rule: 'NHL moneyline may include OT/shootout when score basis supplies it.',
    }),
    fixture({
      sport: 'NHL',
      marketLabel: 'regulation moneyline',
      input: { market: 'moneyline', selection: 'Home regulation', selectedScore: 2, opponentScore: 2, eventStatus: 'completed', overtimePolicy: 'exclude' },
      rule: 'Regulation moneyline can push/tie depending market contract; no three-way sportsbook semantics are inferred.',
      warning: 'Three-way regulation markets need explicit draw semantics before production grading.',
    }),
    fixture({
      sport: 'NHL',
      marketLabel: 'puck line',
      input: { market: 'spread', selection: 'Away +1.5', selectedScore: 2, opponentScore: 3, line: 1.5, eventStatus: 'completed' },
      rule: 'Puck line uses spread primitive.',
    }),
    fixture({
      sport: 'NHL',
      marketLabel: 'total',
      input: { market: 'total', selection: 'Under 6', selectedScore: 3, opponentScore: 3, line: 6, eventStatus: 'completed' },
      rule: 'Whole-number NHL totals can push.',
    }),
    fixture({
      sport: 'NHL',
      marketLabel: 'first period',
      input: { market: 'total', selection: 'Over 1.5 1P', selectedScore: 1, opponentScore: 1, line: 1.5, eventStatus: 'completed' },
      rule: 'First-period markets require period score basis.',
    }),
    fixture({
      sport: 'Soccer',
      marketLabel: '1X2 home',
      input: { market: 'moneyline', selection: 'Home', selectedScore: 2, opponentScore: 1, eventStatus: 'completed', overtimePolicy: 'exclude' },
      rule: 'Soccer 1X2 needs regulation-time score basis and explicit draw handling.',
      warning: 'Current primitive treats tied moneyline as push; production 1X2 draw settlement needs sport adapter semantics.',
    }),
    fixture({
      sport: 'Soccer',
      marketLabel: 'draw',
      input: { market: 'moneyline', selection: 'Draw', selectedScore: 1, opponentScore: 1, eventStatus: 'completed', overtimePolicy: 'exclude' },
      rule: 'Draw is contract-noted but not production-complete in generic moneyline primitive.',
      warning: 'Draw selection needs a dedicated soccer adapter before production grading.',
      contractOnly: true,
    }),
    fixture({
      sport: 'Soccer',
      marketLabel: 'double chance',
      input: null,
      rule: 'Double chance remains unsupported unless a current contract exists.',
      warning: 'Unsupported market returns contract-only rather than fabricated grading.',
      contractOnly: true,
    }),
    fixture({
      sport: 'Soccer',
      marketLabel: 'total',
      input: { market: 'total', selection: 'Under 2.5', selectedScore: 1, opponentScore: 1, line: 2.5, eventStatus: 'completed', overtimePolicy: 'exclude' },
      rule: 'Soccer totals require regulation/extra-time inclusion from market metadata.',
    }),
    fixture({
      sport: 'Soccer',
      marketLabel: 'first half',
      input: { market: 'total', selection: 'Over 0.5 1H', selectedScore: 1, opponentScore: 0, line: 0.5, eventStatus: 'completed' },
      rule: 'First-half soccer totals require first-half score basis.',
    }),
    fixture({
      sport: 'Soccer',
      marketLabel: 'extra time/penalties',
      input: null,
      rule: 'Extra time and penalties must be included or excluded according to explicit market contract.',
      warning: 'No generic production grading without result-type metadata.',
      contractOnly: true,
    }),
    fixture({
      sport: 'Soccer',
      marketLabel: 'postponed/canceled/abandoned',
      input: { market: 'moneyline', selection: 'Home', selectedScore: null, opponentScore: null, eventStatus: 'cancelled' },
      rule: 'Canceled or void statuses are void in the generic primitive.',
    }),
    fixture({
      sport: 'Soccer',
      marketLabel: 'two-leg aggregate',
      input: null,
      rule: 'Two-leg aggregate must not be confused with match settlement.',
      warning: 'Aggregate/qualification markets require dedicated metadata and remain contract-only.',
      contractOnly: true,
    }),
  ]
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
  const fixtureCoverage = buildSettlementFixtureCoverage()
  const supportedFixtureDecisions = fixtureCoverage.filter((item) => item.decision)

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
    fixtureCoverage: {
      mode: 'settlement_core_multi_sport_fixture_coverage_v1',
      checked: fixtureCoverage.length,
      supported: fixtureCoverage.filter((item) => item.supported).length,
      contractOnly: fixtureCoverage.filter((item) => item.contractOnly).length,
      wins: supportedFixtureDecisions.filter((item) => item.decision?.outcome === 'win').length,
      losses: supportedFixtureDecisions.filter((item) => item.decision?.outcome === 'loss').length,
      pushes: supportedFixtureDecisions.filter((item) => item.decision?.outcome === 'push').length,
      voids: supportedFixtureDecisions.filter((item) => item.decision?.outcome === 'void').length,
      pending: supportedFixtureDecisions.filter((item) => item.decision?.outcome === 'pending').length,
      warnings: fixtureCoverage
        .map((item) => item.warning)
        .filter((item): item is string => Boolean(item)),
      fixtures: fixtureCoverage,
    },
    decisions,
    integrationStatus:
      'Settlement primitives are available. NBA settlement remains compatible and should adopt shared primitives incrementally only where behavior matches exactly.',
  }
}
