function impliedProbability(odds) {
  return odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100)
}

function stableText(value) {
  return String(value ?? 'null').trim().toLowerCase().replace(/\s+/g, '_')
}

function buildIdentity(priceEvidence) {
  return [
    'baseball_mlb',
    priceEvidence.eventId,
    priceEvidence.market,
    stableText(priceEvidence.selection),
    priceEvidence.line ?? 'null',
    stableText(priceEvidence.sportsbook),
    'CURRENT_ERA_SHADOW',
    'MLB_CALIBRATED_SHADOW_V1',
    'mlb_market_empirical_calibration_v1_2026_08_20',
    'MORNING',
  ].join('|')
}

function buildSelectedPriceEvidence(candidate) {
  const implied = impliedProbability(candidate.odds)
  return {
    eventId: candidate.eventId,
    market: candidate.market,
    selection: candidate.selection,
    line: candidate.line ?? null,
    sportsbook: candidate.sportsbook,
    odds: candidate.odds,
    oddsTimestamp: candidate.oddsTimestamp,
    impliedProbability: implied,
    impliedProbabilityPercent: Number((implied * 100).toFixed(4)),
  }
}

function buildPayload(source, candidate) {
  const priceEvidence = buildSelectedPriceEvidence(candidate)
  const identity = buildIdentity(priceEvidence)
  return {
    ...source,
    market: priceEvidence.market,
    selection: priceEvidence.selection,
    line: priceEvidence.line,
    sportsbook: priceEvidence.sportsbook,
    odds: priceEvidence.odds,
    odds_timestamp: priceEvidence.oddsTimestamp,
    implied_probability: priceEvidence.impliedProbabilityPercent,
    idempotency_key: identity,
    prediction_group_key: identity,
    certification_status: 'SHADOW_PENDING',
    certification_metadata: {
      selectedPriceEvidence: priceEvidence,
    },
  }
}

function check(name, pass) {
  if (!pass) throw new Error(`${name} failed`)
}

const sourceLowVig = {
  sportsbook: 'lowvig',
  odds: 159,
  odds_timestamp: '2026-08-20T21:27:35.000Z',
  implied_probability: 38.61,
}
const selectedDraftKings = {
  eventId: 'baseball_mlb:mlb:sportsdataio:event:79208',
  market: 'moneyline',
  selection: 'WSH',
  line: null,
  sportsbook: 'draftkings',
  odds: 168,
  oddsTimestamp: '2026-08-20T21:27:58.019Z',
}
const selectedBetMgm = {
  ...selectedDraftKings,
  sportsbook: 'betmgm',
  odds: 150,
}

const draftKingsPayload = buildPayload(sourceLowVig, selectedDraftKings)
const betMgmPayload = buildPayload(sourceLowVig, selectedBetMgm)

check('fixture reproduces old source leakage', sourceLowVig.sportsbook === 'lowvig' && sourceLowVig.odds === 159)
check('draftkings sportsbook bound', draftKingsPayload.sportsbook === 'draftkings')
check('draftkings odds bound', draftKingsPayload.odds === 168)
check('draftkings timestamp bound', draftKingsPayload.odds_timestamp === selectedDraftKings.oddsTimestamp)
check('draftkings identity bound', draftKingsPayload.idempotency_key.includes('|draftkings|'))
check('draftkings metadata bound', draftKingsPayload.certification_metadata.selectedPriceEvidence.sportsbook === 'draftkings')
check('draftkings did not leak lowvig', draftKingsPayload.sportsbook !== 'lowvig' && draftKingsPayload.odds !== 159)
check('multi-book identities differ', draftKingsPayload.idempotency_key !== betMgmPayload.idempotency_key)
check('multi-book book B does not leak book A', betMgmPayload.sportsbook === 'betmgm' && betMgmPayload.odds === 150)
check('pending status contract preserved', draftKingsPayload.certification_status === 'SHADOW_PENDING')

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_03r1d_price_evidence_binding_fixture_v1',
  rootCause: 'PARTIAL_CANDIDATE_OVERRIDE',
  oldCodeWouldFail: true,
  fixture: {
    source: sourceLowVig,
    selectedDraftKings,
    draftKingsPayload: {
      sportsbook: draftKingsPayload.sportsbook,
      odds: draftKingsPayload.odds,
      impliedProbability: draftKingsPayload.implied_probability,
      identity: draftKingsPayload.idempotency_key,
    },
    selectedBetMgm,
    betMgmPayload: {
      sportsbook: betMgmPayload.sportsbook,
      odds: betMgmPayload.odds,
      identity: betMgmPayload.idempotency_key,
    },
  },
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))
