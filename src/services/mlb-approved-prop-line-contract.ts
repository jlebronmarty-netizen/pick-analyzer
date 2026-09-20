import 'server-only'

export const APPROVED_PROP_LINE_CONTRACT_VERSION = 'MLB_APPROVED_PROP_REAL_LINE_CONTRACT/1.0.0'

export type ApprovedPropLineScope =
  | 'EXACT_FROZEN_LINE_ONLY'
  | 'NO_NUMERIC_LINE_BINARY_SIDE'
  | 'RUNTIME_PARITY_BLOCKED'

export type ApprovedPropLineContract = {
  candidateId: string
  market: string
  direction: 'UNDER' | 'OVER' | 'NO'
  requiredLine: number | null
  lineScope: ApprovedPropLineScope
  multipleLinesCertified: boolean
  runtimeEligible: boolean
  blocker: string | null
  probabilitySemantics: 'CALIBRATED_AT_REQUIRED_LINE' | 'NO_LINE_MODEL_PROBABILITY' | 'NOT_CERTIFIED_FOR_RUNTIME'
}

const exact = (
  candidateId: string,
  market: string,
  direction: 'UNDER' | 'OVER',
  requiredLine: number,
  probabilitySemantics: ApprovedPropLineContract['probabilitySemantics'] = 'CALIBRATED_AT_REQUIRED_LINE',
): ApprovedPropLineContract => ({
  candidateId,
  market,
  direction,
  requiredLine,
  lineScope: 'EXACT_FROZEN_LINE_ONLY',
  multipleLinesCertified: false,
  runtimeEligible: true,
  blocker: null,
  probabilitySemantics,
})

export const APPROVED_PROP_LINE_CONTRACTS: Record<string, ApprovedPropLineContract> = Object.freeze({
  pitcher_bb_under_2p5_p85_v1: exact('pitcher_bb_under_2p5_p85_v1', 'pitcher_walks', 'UNDER', 2.5),
  pitcher_k_under_6p5_proj_4p5_v1: exact('pitcher_k_under_6p5_proj_4p5_v1', 'pitcher_strikeouts', 'UNDER', 6.5),
  batter_rbi_under_0p5_proj_0p10_v1: exact('batter_rbi_under_0p5_proj_0p10_v1', 'batter_rbis', 'UNDER', 0.5),
  batter_hrrbi_under_2p5_proj_0p70_v1: exact('batter_hrrbi_under_2p5_proj_0p70_v1', 'batter_hits_runs_rbis', 'UNDER', 2.5),
  pitcher_er_over_1p5_p70_v1: exact('pitcher_er_over_1p5_p70_v1', 'pitcher_earned_runs', 'OVER', 1.5),
  pitcher_hits_allowed_under_6p5_proj_5p0_v1: exact('pitcher_hits_allowed_under_6p5_proj_5p0_v1', 'pitcher_hits_allowed', 'UNDER', 6.5),
  batter_hits_under_1p5_edge_0p75_v1: exact('batter_hits_under_1p5_edge_0p75_v1', 'batter_hits', 'UNDER', 1.5),
  batter_total_bases_under_2p5_edge_1p5_v1: exact('batter_total_bases_under_2p5_edge_1p5_v1', 'batter_total_bases', 'UNDER', 2.5),
  batter_hr_under_0p5_proj_0p10_v1: exact('batter_hr_under_0p5_proj_0p10_v1', 'batter_home_runs', 'UNDER', 0.5),
  batter_k_under_1p5_proj_0p5_v1: exact('batter_k_under_1p5_proj_0p5_v1', 'batter_strikeouts', 'UNDER', 1.5),
  batter_walks_under_0p5_proj_0p20_v1: exact('batter_walks_under_0p5_proj_0p20_v1', 'batter_walks', 'UNDER', 0.5),
  batter_singles_under_1p5_proj_0p50_v1: exact('batter_singles_under_1p5_proj_0p50_v1', 'batter_singles', 'UNDER', 1.5),
  batter_doubles_under_0p5_proj_0p16_v1: exact('batter_doubles_under_0p5_proj_0p16_v1', 'batter_doubles', 'UNDER', 0.5),
  batter_triples_under_0p5_proj_0p015_v1: exact('batter_triples_under_0p5_proj_0p015_v1', 'batter_triples', 'UNDER', 0.5),
  pitcher_win_forward_numeric_p015_v1: {
    candidateId: 'pitcher_win_forward_numeric_p015_v1',
    market: 'pitcher_record_a_win',
    direction: 'NO',
    requiredLine: null,
    lineScope: 'NO_NUMERIC_LINE_BINARY_SIDE',
    multipleLinesCertified: true,
    runtimeEligible: true,
    blocker: null,
    probabilitySemantics: 'NO_LINE_MODEL_PROBABILITY',
  },
  pitcher_outs_under_18p5_p90_v1: {
    candidateId: 'pitcher_outs_under_18p5_p90_v1',
    market: 'pitcher_outs',
    direction: 'UNDER',
    requiredLine: 18.5,
    lineScope: 'RUNTIME_PARITY_BLOCKED',
    multipleLinesCertified: false,
    runtimeEligible: false,
    blocker: 'PITCHER_OUTS_INPUT_LINEAGE_NOT_EXACTLY_RECONCILED',
    probabilitySemantics: 'NOT_CERTIFIED_FOR_RUNTIME',
  },
})

export function approvedPropLineContract(candidateId: string) {
  return APPROVED_PROP_LINE_CONTRACTS[candidateId] ?? null
}

export function assertApprovedPropLineContract(input: {
  candidateId: string
  market: string
  direction: string
  requiredLine: number | null
}) {
  const contract = approvedPropLineContract(input.candidateId)
  if (!contract) throw new Error('APPROVED_PROP_LINE_CONTRACT_MISSING:' + input.candidateId)
  if (contract.market !== input.market || contract.direction !== input.direction) {
    throw new Error('APPROVED_PROP_LINE_CONTRACT_MARKET_DIRECTION_MISMATCH:' + input.candidateId)
  }
  if (contract.requiredLine === null ? input.requiredLine !== null : input.requiredLine === null || Math.abs(contract.requiredLine - input.requiredLine) > 1e-9) {
    throw new Error('APPROVED_PROP_LINE_CONTRACT_REQUIRED_LINE_MISMATCH:' + input.candidateId)
  }
  return contract
}
