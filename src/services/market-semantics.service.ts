import 'server-only'

export type SupportedMarketType =
  | 'moneyline'
  | 'spread'
  | 'run_line'
  | 'total'
  | 'team_total'
  | 'first_five_moneyline'
  | 'first_five_spread'
  | 'first_five_total'
export type MarketOutcomeModel = 'binary' | 'push_capable'

export type MarketSemantics = {
  market: SupportedMarketType | 'unsupported'
  model: MarketOutcomeModel
  binary: boolean
  pushCapable: boolean
  outcomeCount: 2 | 3
  supportsPush: boolean
  pushProbabilityKnown: boolean
  pushProbability: number | null
  pushProbabilityLabel: 'not_applicable' | 'unknown_push_probability'
  classificationReason: string
}

function finite(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function canonicalMarket(value: unknown): MarketSemantics['market'] {
  const market = String(value ?? '').toLowerCase()
  if (market === 'moneyline') return 'moneyline'
  if (market === 'spread' || market === 'run_line') return 'spread'
  if (market === 'total') return 'total'
  if (market === 'team_total' || market === 'team_totals') return 'team_total'
  if (market === 'first_five_moneyline' || market === 'first5_moneyline' || market === 'f5_moneyline') return 'first_five_moneyline'
  if (market === 'first_five_spread' || market === 'first_five_run_line' || market === 'first5_run_line' || market === 'f5_run_line') return 'first_five_spread'
  if (market === 'first_five_total' || market === 'first5_total' || market === 'f5_total') return 'first_five_total'
  return 'unsupported'
}

function isWholeNumberLine(line: number | null) {
  return line !== null && Math.abs(line - Math.round(line)) < 0.001
}

export function classifyMarketSemantics({
  market,
  line,
}: {
  market: unknown
  line?: unknown
}): MarketSemantics {
  const canonical = canonicalMarket(market)
  const numericLine = finite(line)
  const pushCapable = !['moneyline', 'first_five_moneyline', 'unsupported'].includes(canonical) && isWholeNumberLine(numericLine)
  if (pushCapable) {
    return {
      market: canonical,
      model: 'push_capable',
      binary: false,
      pushCapable: true,
      outcomeCount: 3,
      supportsPush: true,
      pushProbabilityKnown: false,
      pushProbability: null,
      pushProbabilityLabel: 'unknown_push_probability',
      classificationReason: 'Whole-number spread/run-line, total, team-total and first-five line markets can land exactly on the line.',
    }
  }
  return {
    market: canonical,
    model: 'binary',
    binary: true,
    pushCapable: false,
    outcomeCount: 2,
    supportsPush: false,
    pushProbabilityKnown: false,
    pushProbability: null,
    pushProbabilityLabel: 'not_applicable',
    classificationReason:
      canonical === 'moneyline' || canonical === 'first_five_moneyline'
        ? 'Moneyline-style markets have two graded sides in this product surface.'
        : canonical === 'unsupported'
          ? 'Unsupported market is not modeled for product recommendations.'
          : canonical === 'team_total'
            ? 'Fractional team totals cannot land exactly on the listed line.'
            : canonical === 'first_five_spread' || canonical === 'first_five_total'
              ? 'Fractional first-five line markets cannot land exactly on the listed line.'
              : 'Fractional spread/run-line and total markets cannot land exactly on the listed line.',
  }
}

export function validateMarketSemanticsFixtures() {
  const fixtures = [
    ['moneyline binary', classifyMarketSemantics({ market: 'moneyline', line: null }).binary],
    ['run line +1.5 binary', classifyMarketSemantics({ market: 'spread', line: 1.5 }).binary],
    ['run line -1.5 binary', classifyMarketSemantics({ market: 'run_line', line: -1.5 }).binary],
    ['run line +1 push capable', classifyMarketSemantics({ market: 'spread', line: 1 }).pushCapable],
    ['run line -1 push capable', classifyMarketSemantics({ market: 'run_line', line: -1 }).pushCapable],
    ['total 7 push capable', classifyMarketSemantics({ market: 'total', line: 7 }).pushCapable],
    ['total 7.5 binary', classifyMarketSemantics({ market: 'total', line: 7.5 }).binary],
    ['total 8 push capable', classifyMarketSemantics({ market: 'total', line: 8 }).pushCapable],
    ['total 8.5 binary', classifyMarketSemantics({ market: 'total', line: 8.5 }).binary],
    ['total 9 push capable', classifyMarketSemantics({ market: 'total', line: 9 }).pushCapable],
    ['total 9.5 binary', classifyMarketSemantics({ market: 'total', line: 9.5 }).binary],
    ['team total 3.5 binary', classifyMarketSemantics({ market: 'team_total', line: 3.5 }).binary],
    ['team total 4 push capable', classifyMarketSemantics({ market: 'team_total', line: 4 }).pushCapable],
    ['first five moneyline binary', classifyMarketSemantics({ market: 'first_five_moneyline', line: null }).binary],
    ['first five run line 0.5 binary', classifyMarketSemantics({ market: 'first_five_run_line', line: 0.5 }).binary],
    ['first five total 4 push capable', classifyMarketSemantics({ market: 'first_five_total', line: 4 }).pushCapable],
    ['push probability unknown', classifyMarketSemantics({ market: 'total', line: 8 }).pushProbabilityLabel === 'unknown_push_probability'],
  ] as const
  const failedChecks = fixtures.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'market_semantics_validation_v1',
    checks: fixtures.length,
    passed: fixtures.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
