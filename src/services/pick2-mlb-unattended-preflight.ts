import 'server-only'
import certificate from '../../docs/CERTIFICATION/MLB_DATA_02R_R2T_R3_LIVE_REENABLEMENT_CERTIFICATION.json' with { type: 'json' }

export async function runMlbOperationalSchemaPreflight() {
  if (certificate.certificationVerdict !== 'MLB_DATA_02R_R2T_R3_LIVE_REENABLEMENT_CERTIFIED'
    || certificate.champion !== 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
    || certificate.featureSet !== 'MLB_ML_FEATURE_SET_V1' || certificate.featureCount !== 76
    || certificate.policy !== 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1') throw Error('PREFLIGHT_VERSION_CONTRACT')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url !== 'https://ynuocvexviorgdjrfthw.supabase.co' || !key) throw Error('PREFLIGHT_CREDENTIALS')
  const response = await fetch(`${url}/functions/v1/mlb-operational-preflight`, {
    headers: { authorization: `Bearer ${key}`, apikey: key }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(35000),
  }).catch(() => { throw Error('PREFLIGHT_CONNECTION') })
  if (!response.ok) throw Error('PREFLIGHT_HTTP')
  const result = await response.json()
  const lead = Date.parse(result.checkedAt) - Date.now()
  if (!Number.isFinite(lead) || lead > 15000) throw Error('PREFLIGHT_CLOCK')
  if (lead > 0) await new Promise(resolve => setTimeout(resolve, lead + 50))
  const age = Date.now() - Date.parse(result.checkedAt)
  if (result.status !== 'PASS' || result.projectRef !== 'ynuocvexviorgdjrfthw'
    || age < 0 || age > 15 * 60_000 || result.columnsCompared !== 406 || result.preservedConstraintsCompared !== 116
    || result.requiredIndexesCompared !== 84 || result.nativeSnapshotUniqueIndexes !== 6
    || result.orphanSnapshotReferences !== 0 || result.invalidIndexes !== 0 || result.schemaCompatible !== true
    || result.ddlDigest !== '3f2df0f2baf8b4cd405bc10560c47eadc143198df85a80fb3577b4b03d5b1f46'
    || result.connection?.transaction !== 'READ_ONLY' || result.connection?.serverOnly !== true) throw Error('PREFLIGHT_SCHEMA_CONTRACT')
  return { ...result, champion: certificate.champion, featureSet: certificate.featureSet, featureCount: 76, policy: certificate.policy }
}
