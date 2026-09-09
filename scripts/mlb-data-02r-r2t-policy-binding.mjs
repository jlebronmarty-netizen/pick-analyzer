import fs from 'node:fs'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { R2F_POLICY_VERSION, evaluateOfficialPickPolicy } from './mlb-data-02r-r2f-wave12-interfaces.mjs'

export const POLICY_CONFIG_DIGEST = '27f1edf91f27b68d79928ac6bea6e22f537ff073f4090fb2c5a8dc5795922d60'
const block = (condition, reason) => { if (!condition) throw new Error(`R2T_POLICY_BLOCK:${reason}`) }

export function loadCertifiedPolicy(artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json', 'utf8'))) {
  const policy = artifact.policy
  block(policy?.version === R2F_POLICY_VERSION && policy.MLB_02P_POLICY_VERSION === R2F_POLICY_VERSION, 'VERSION')
  const config = policy.config
  block(config?.digest === POLICY_CONFIG_DIGEST && sha256({ ...config, digest: undefined }) === POLICY_CONFIG_DIGEST, 'CONFIG_DIGEST')
  block(sha256(policy.selectedThresholds) === sha256(config.thresholds), 'THRESHOLDS')
  const modelRange = artifact.model?.probabilityRange
  block(modelRange?.min === 0.388320117502 && modelRange?.max === 0.611679882498, 'MODEL_RANGE')
  return { version: policy.version, config, thresholds: config.thresholds, modelRange }
}

// Preserve the certified evaluator and best-executable-price collapse. Validate
// the physical readback inputs first; Number(null) must never manufacture data.
export function evaluateCertifiedPolicy({ values, runAsOf }) {
  const policy = loadCertifiedPolicy()
  const bySide = new Map()
  for (const row of values) {
    for (const field of ['model_probability', 'consensus_edge', 'unit_ev', 'book_count', 'market_dispersion', 'american_odds']) {
      block(row[field] !== null && row[field] !== undefined && Number.isFinite(Number(row[field])), `MISSING_NUMERIC:${field}`)
    }
    block(['HOME', 'AWAY'].includes(row.side), 'SIDE')
    block(Number.isInteger(Number(row.book_count)) && Number(row.book_count) > 0, 'BOOK_COUNT')
    block(['FRESH', 'AGING', 'STALE'].includes(row.market_freshness), 'FRESHNESS')
    const key = `${row.game_pk}:${row.side}`
    const current = bySide.get(key)
    if (!current || Number(row.unit_ev) > Number(current.unit_ev) || (Number(row.unit_ev) === Number(current.unit_ev) && Number(row.american_odds) > Number(current.american_odds))) bySide.set(key, row)
  }
  return [...bySide.values()].map(candidate => ({ candidate, ...evaluateOfficialPickPolicy({ candidate, policy, runAsOf }).artifact }))
}
