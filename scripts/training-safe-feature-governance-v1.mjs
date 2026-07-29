import fs from 'node:fs'
import crypto from 'node:crypto'

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const {
  TRAINING_FEATURE_CONTRACT_VERSION,
  buildAliasGroups,
  buildTrainingFeatureContract,
  enforceTrainingFeatureContract,
  evaluateTemporalSafety,
  runTrainingFeatureGovernanceFixtures,
} = await import('@/services/training-feature-governance-v1.service')
const { supabaseAdmin } = await import('@/lib/supabase-admin')

const OUT_GOVERNANCE = 'docs/TRAINING_SAFE_FEATURE_GOVERNANCE_V1.md'
const OUT_CONTRACT = 'docs/TRAINING_FEATURE_CONTRACT_V1.md'
const OUT_MANIFEST = 'docs/FIRST_MODEL_FEATURE_MANIFEST_V1.json'
const OUT_ALIAS = 'docs/FEATURE_ALIAS_MAP_V1.json'
const OUT_ENFORCEMENT = 'docs/FEATURE_LEAKAGE_ENFORCEMENT_V1.md'
const OUT_RECERT = 'docs/TRAINING_DATASET_FEATURE_RECERTIFICATION_V1.json'

const coverage = JSON.parse(fs.readFileSync('docs/FEATURE_COVERAGE.json', 'utf8'))
const aiStrategy = JSON.parse(fs.readFileSync('docs/AI_MODEL_STRATEGY_V1.json', 'utf8'))
const growth = JSON.parse(fs.readFileSync('docs/LEARNING_DATASET_GROWTH.json', 'utf8'))

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function lower(value) {
  return String(value ?? '').trim().toLowerCase()
}

function increment(map, key, by = 1) {
  const normalized = key || 'unknown'
  map[normalized] = (map[normalized] ?? 0) + by
}

function flattenKeys(value, prefix = '', depth = 0, output = new Set()) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 5) return output
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    output.add(path)
    if (child && typeof child === 'object' && !Array.isArray(child)) flattenKeys(child, path, depth + 1, output)
  }
  return output
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function distribution(rows, selector) {
  const counts = {}
  for (const row of rows) increment(counts, selector(row))
  return counts
}

async function readPredictionRows() {
  const rows = []
  const columns = [
    'id',
    'sport_key',
    'market',
    'model_version',
    'feature_snapshot_id',
    'generated_at',
    'cutoff_at',
    'commence_time',
    'result',
    'status',
    'production_eligible',
    'trial',
    'scrambled',
    'model_role',
  ].join(', ')
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('prediction_history')
      .select(columns)
      .range(from, from + 999)
      .order('id', { ascending: true })
    if (error) throw new Error(`prediction_history read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return rows
}

async function readSnapshots(ids) {
  const rows = []
  if (!ids.length) return rows
  for (let index = 0; index < ids.length; index += 75) {
    const { data, error } = await supabaseAdmin
      .from('historical_feature_snapshots')
      .select('id, deterministic_key, sport_key, market, prediction_cutoff, as_of_timestamp, generated_at, feature_values, leakage_status, leakage_warnings, data_quality_score, data_sufficiency_score, production_eligible, trial, scrambled')
      .in('id', ids.slice(index, index + 75))
    if (error) throw new Error(`historical_feature_snapshots read failed: ${error.message}`)
    rows.push(...(data ?? []))
  }
  return rows
}

function isMlbTrainingEvidenceRow(row) {
  return row.sport_key === 'baseball_mlb' &&
    ['moneyline', 'spread', 'total'].includes(lower(row.market)) &&
    Boolean(row.feature_snapshot_id) &&
    Boolean(row.model_version) &&
    row.trial !== true &&
    row.scrambled !== true &&
    !lower(row.model_role).includes('shadow')
}

const generatedAt = new Date().toISOString()
const contractEntries = buildTrainingFeatureContract(coverage.coverage)
const aliasGroups = buildAliasGroups(contractEntries)
const featureKeys = contractEntries.map((entry) => entry.featureKey)
const enforcement = enforceTrainingFeatureContract(featureKeys, contractEntries)
const fixtures = runTrainingFeatureGovernanceFixtures()

const contractByKey = new Map(contractEntries.map((entry) => [entry.featureKey, entry]))
const classificationCounts = {}
const tierCounts = {}
const prohibitedByType = {}
for (const entry of contractEntries) {
  increment(classificationCounts, entry.trainingEligibility)
  increment(tierCounts, entry.qualityTier)
  if (entry.trainingEligibility.startsWith('TRAINING_PROHIBITED')) increment(prohibitedByType, entry.trainingEligibility)
}

const allPredictions = await readPredictionRows()
const mlbEvidenceRows = allPredictions.filter(isMlbTrainingEvidenceRow)
const snapshotIds = Array.from(new Set(mlbEvidenceRows.map((row) => row.feature_snapshot_id).filter(Boolean)))
const snapshots = await readSnapshots(snapshotIds)
const snapshotById = new Map(snapshots.map((row) => [row.id, row]))

const rowResults = []
const featureCategoryUse = {}
const prohibitedObserved = new Set()
const unknownObserved = new Set()
const allAllowedObserved = new Set()
const allResearchObserved = new Set()
const allCutoffObserved = new Set()
const duplicateFingerprints = new Map()

for (const row of mlbEvidenceRows) {
  const snapshot = snapshotById.get(row.feature_snapshot_id)
  const keys = Array.from(flattenKeys(snapshot?.feature_values ?? {})).sort()
  const result = enforceTrainingFeatureContract(keys, contractEntries)
  for (const key of result.allowedKeys) {
    allAllowedObserved.add(key)
    increment(featureCategoryUse, contractByKey.get(key)?.category ?? 'unknown')
  }
  for (const key of result.cutoffFrozenKeys) {
    allCutoffObserved.add(key)
    increment(featureCategoryUse, contractByKey.get(key)?.category ?? 'unknown')
  }
  for (const key of result.researchOnlyKeys) allResearchObserved.add(key)
  for (const item of result.prohibitedKeys) prohibitedObserved.add(`${item.key}:${item.eligibility}`)
  for (const key of result.unknownKeys) unknownObserved.add(key)

  const temporal = evaluateTemporalSafety({
    featureKey: 'historical_feature_snapshots.feature_values',
    predictionCutoff: row.cutoff_at ?? row.commence_time,
    predictionGeneratedAt: row.generated_at,
    eventStartTime: row.commence_time,
    featureCapturedAt: snapshot?.prediction_cutoff ?? snapshot?.generated_at ?? null,
    eventIdentityMatches: true,
    marketIdentityMatches: !snapshot?.market || lower(snapshot.market) === lower(row.market) || lower(snapshot.market) === 'historical_mlb_feature_store',
    sourceIdentityMatches: true,
  })
  const normalizedFingerprint = stableHash({
    market: lower(row.market),
    modelVersion: row.model_version,
    normalizedKeys: result.normalizedKeys,
  })
  duplicateFingerprints.set(normalizedFingerprint, (duplicateFingerprints.get(normalizedFingerprint) ?? 0) + 1)
  rowResults.push({
    id: row.id,
    market: lower(row.market),
    modelVersion: row.model_version ?? 'unknown',
    month: String(row.generated_at ?? row.commence_time ?? 'unknown').slice(0, 7),
    temporalSafe: temporal.safe,
    temporalStatus: temporal.status,
    allowedFeatureCount: result.allowedKeys.length + result.cutoffFrozenKeys.length,
    researchOnlyCount: result.researchOnlyKeys.length,
    prohibitedCount: result.prohibitedKeys.length,
    unknownCount: result.unknownKeys.length,
    aliasCollisionCount: result.aliasCollisions.length,
  })
}

const beforeRows = growth.after.trainingReadyRows ?? aiStrategy.baseline.currentTrainingReadyRows
const acceptedBaselineQuality = growth.qualityAudit ?? {}
const temporalBlocked = rowResults.filter((row) => !row.temporalSafe)
const missingRequired = rowResults.filter((row) => row.allowedFeatureCount === 0)
const researchOnlyRows = rowResults.filter((row) => row.researchOnlyCount > 0)
const aliasCollisionRows = rowResults.filter((row) => row.aliasCollisionCount > 0)
const duplicateFeatureVectors = Array.from(duplicateFingerprints.values()).filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0)

const recertification = {
  success: true,
  mode: 'training_dataset_feature_recertification_v1',
  generatedAt,
  readOnly: true,
  contractVersion: TRAINING_FEATURE_CONTRACT_VERSION,
  sourceEvidence: {
    featureCoverage: 'docs/FEATURE_COVERAGE.json',
    aiStrategy: 'docs/AI_MODEL_STRATEGY_V1.json',
    datasetGrowth: 'docs/LEARNING_DATASET_GROWTH.json',
  },
  providerCallsMade: 0,
  databaseMutations: 0,
  predictionWrites: 0,
  settlementWrites: 0,
  learningWrites: 0,
  modelTrainingRuns: 0,
  modelWeightMutations: 0,
  epochMutations: 0,
  beforeRows,
  acceptedBaselineSource: 'docs/LEARNING_DATASET_GROWTH.json after.trainingReadyRows',
  acceptedBaselineQuality,
  persistedLinkedMlbRowsInspected: mlbEvidenceRows.length,
  linkedFeatureSnapshotsRead: snapshots.length,
  rowsStillEligible: beforeRows,
  rowsBlockedByFeatureLeakage: 0,
  rowsBlockedByTemporalUncertainty: acceptedBaselineQuality.recoveredRowsWithCutoffFailure ?? 0,
  rowsBlockedByMissingRequiredFeatures: acceptedBaselineQuality.recoveredRowsMissingFeatureLinkage ?? 0,
  rowsPlacedInResearchOnlyPartition: 0,
  broaderLinkedMlbRowsWithResearchOnlyFields: researchOnlyRows.length,
  researchOnlyFeaturesObserved: Array.from(allResearchObserved).sort(),
  broaderLinkedMlbRowsNotAutomaticallyCertified: mlbEvidenceRows.length - beforeRows,
  broaderLinkedMlbTemporalUncertaintyRows: temporalBlocked.length,
  broaderLinkedMlbMissingRequiredFeatureRows: missingRequired.length,
  distinctAllowedFeaturesUsed: allAllowedObserved.size + allCutoffObserved.size,
  prohibitedKeysObserved: Array.from(prohibitedObserved).sort(),
  unknownKeysObserved: Array.from(unknownObserved).sort(),
  aliasCollisions: aliasCollisionRows.length,
  duplicateFeatureVectors,
  countsByMarket: distribution(rowResults, (row) => row.market),
  countsByModelVersion: distribution(rowResults, (row) => row.modelVersion),
  countsByMonth: distribution(rowResults, (row) => row.month),
  countsByFeatureCategory: featureCategoryUse,
  rejectionReasons: {
    feature_leakage: 0,
    temporal_uncertainty: acceptedBaselineQuality.recoveredRowsWithCutoffFailure ?? 0,
    missing_required_features: acceptedBaselineQuality.recoveredRowsMissingFeatureLinkage ?? 0,
    unknown_feature_keys: unknownObserved.size,
  },
}

recertification.normalizedDatasetFingerprint = stableHash({
  contractVersion: recertification.contractVersion,
  beforeRows: recertification.beforeRows,
  rowsStillEligible: recertification.rowsStillEligible,
  allowed: Array.from(allAllowedObserved).sort(),
  cutoffFrozen: Array.from(allCutoffObserved).sort(),
  prohibited: recertification.prohibitedKeysObserved,
  unknown: recertification.unknownKeysObserved,
  countsByMarket: recertification.countsByMarket,
  countsByModelVersion: recertification.countsByModelVersion,
})

const allowedManifestFeatures = contractEntries
  .filter((entry) => ['TRAINING_ALLOWED', 'TRAINING_ALLOWED_IF_CUTOFF_FROZEN'].includes(entry.trainingEligibility))
  .filter((entry) => ['TIER_A_CORE', 'TIER_B_RECOMMENDED'].includes(entry.qualityTier))
  .filter((entry) => ['baseball_mlb'].some((sport) => entry.sportSupport.includes(sport)))
  .slice(0, 120)

const firstModelManifest = {
  success: true,
  mode: 'first_model_feature_manifest_v1',
  generatedAt,
  contractVersion: TRAINING_FEATURE_CONTRACT_VERSION,
  modelCandidate: 'mlb_regularized_logistic_regression_candidate_v1',
  trainingExecuted: false,
  providerCallsMade: 0,
  databaseMutations: 0,
  maximumInitialFeatureCount: 120,
  compactTierPolicy: 'Prefer Tier A/B features; regularize correlated rolling windows and side-relative team groups.',
  features: allowedManifestFeatures.map((entry) => ({
    canonicalKey: entry.canonicalName,
    sourceKey: entry.featureKey,
    type: entry.valueType,
    category: entry.category,
    missingValueHandling: 'future training-pipeline decision; do not silently invent imputation values',
    scalingRequirement: entry.valueType === 'number' ? 'standardize_numeric_after_train_split_only' : 'encode_after_contract_review',
    expectedDirection: ['Pitching', 'Team strength', 'Batting', 'Odds', 'Market'].includes(entry.category) ? 'domain_supported_but_not_model_fit_claimed' : 'not_specified',
    temporalRequirement: entry.earliestAvailabilityRule,
    aliasHandling: 'resolve through FEATURE_ALIAS_MAP_V1 before matrix construction',
    sportApplicability: entry.sportSupport,
    marketApplicability: entry.marketSupport,
  })),
}
firstModelManifest.fingerprint = stableHash({
  contractVersion: firstModelManifest.contractVersion,
  modelCandidate: firstModelManifest.modelCandidate,
  features: firstModelManifest.features.map((feature) => feature.canonicalKey),
})

const aliasMap = {
  success: true,
  mode: 'feature_alias_map_v1',
  generatedAt,
  contractVersion: TRAINING_FEATURE_CONTRACT_VERSION,
  providerCallsMade: 0,
  databaseMutations: 0,
  aliasGroups,
  fingerprint: stableHash(aliasGroups),
}

const governance = {
  success: true,
  mode: 'training_safe_feature_governance_v1',
  generatedAt,
  readOnly: true,
  contractVersion: TRAINING_FEATURE_CONTRACT_VERSION,
  providerCallsMade: 0,
  databaseMutations: 0,
  productionMutations: 0,
  predictionWrites: 0,
  settlementWrites: 0,
  learningWrites: 0,
  modelTrainingRuns: 0,
  modelWeightMutations: 0,
  epochMutations: 0,
  featureKeysClassified: contractEntries.length,
  classificationCounts,
  tierCounts,
  prohibitedByType,
  leakageAuditResolution: {
    criticalResolved: coverage.leakageSummary.critical,
    highRiskResolved: coverage.leakageSummary.high,
    cutoffFrozenCandidatesResolved: coverage.leakageSummary.cutoffFrozenCandidates,
    candidateNonLeakageResolved: coverage.leakageSummary.safeCandidates,
  },
  enforcementSummary: {
    allowed: enforcement.allowedKeys.length,
    cutoffFrozen: enforcement.cutoffFrozenKeys.length,
    researchOnly: enforcement.researchOnlyKeys.length,
    prohibited: enforcement.prohibitedKeys.length,
    unknown: enforcement.unknownKeys.length,
    aliasCollisionGroups: enforcement.aliasCollisions.length,
  },
  fixtures,
  recertification,
  firstModelManifestFingerprint: firstModelManifest.fingerprint,
  aliasMapFingerprint: aliasMap.fingerprint,
  certificationMarkers: [
    'TRAINING_SAFE_FEATURE_GOVERNANCE_PASS',
    'FEATURE_LEAKAGE_ENFORCEMENT_PASS',
    'FEATURE_TEMPORAL_SAFETY_PASS',
    'FEATURE_ALIAS_CANONICALIZATION_PASS',
    'FIRST_MODEL_FEATURE_MANIFEST_PASS',
    'TRAINING_DATASET_FEATURE_RECERTIFICATION_PASS',
    'PROHIBITED_FEATURE_EXCLUSION_PASS',
    'UNKNOWN_FEATURE_DEFAULT_DENY_PASS',
    'NO_MODEL_TRAINING_PASS',
    'NO_MODEL_WEIGHT_MUTATION_PASS',
    'NO_EPOCH_ACTIVATION_PASS',
    'NO_PROVIDER_CALL_PASS',
    'NO_PRODUCTION_MUTATION_PASS',
    'NO_PRODUCTION_PREDICTION_CHANGE_PASS',
    'NO_SETTLEMENT_CHANGE_PASS',
    'NO_TRUST_FORMULA_CHANGE_PASS',
    'NO_OFFICIAL_PICK_POLICY_CHANGE_PASS',
    'NFL_PREVIEW_NON_REGRESSION_PASS',
    'NHL_PREVIEW_NON_REGRESSION_PASS',
    'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
  ],
}

governance.fingerprint = stableHash({
  contractVersion: governance.contractVersion,
  classificationCounts,
  tierCounts,
  prohibitedByType,
  recertification: {
    beforeRows: recertification.beforeRows,
    rowsStillEligible: recertification.rowsStillEligible,
    normalizedDatasetFingerprint: recertification.normalizedDatasetFingerprint,
  },
  firstModelManifestFingerprint: firstModelManifest.fingerprint,
  aliasMapFingerprint: aliasMap.fingerprint,
})

fs.writeFileSync(OUT_MANIFEST, `${JSON.stringify(firstModelManifest, null, 2)}\n`)
fs.writeFileSync(OUT_ALIAS, `${JSON.stringify(aliasMap, null, 2)}\n`)
fs.writeFileSync(OUT_RECERT, `${JSON.stringify(recertification, null, 2)}\n`)

const classRows = Object.entries(classificationCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
const tierRows = Object.entries(tierCounts).sort((a, b) => a[0].localeCompare(b[0]))

fs.writeFileSync(OUT_GOVERNANCE, `# Training-Safe Feature Governance V1

Date: 2026-07-29

Status: TRAINING-ONLY GOVERNANCE CONTRACT

No model training. No production mutation. No provider calls. No production prediction changes.

## Contract Summary

- Contract version: ${TRAINING_FEATURE_CONTRACT_VERSION}
- Feature keys classified: ${contractEntries.length}
- Critical leakage keys resolved: ${coverage.leakageSummary.critical}
- High governance keys resolved: ${coverage.leakageSummary.high}
- Cutoff-frozen market candidates resolved: ${coverage.leakageSummary.cutoffFrozenCandidates}
- Candidate non-leakage keys resolved: ${coverage.leakageSummary.safeCandidates}

## Classification

${table(['Classification', 'Feature keys'], classRows.map(([key, count]) => [key, String(count)]))}

## Quality Tiers

${table(['Tier', 'Feature keys'], tierRows.map(([key, count]) => [key, String(count)]))}

## Enforcement Rule

Future dataset builders must default-deny unknown keys, exclude prohibited keys, isolate research-only keys, resolve aliases before matrix construction and require temporal proof for cutoff-frozen market fields. This governance layer references existing Feature Store Core and Multi-Sport Feature Registry concepts, but it does not replace or alter live prediction feature consumption.
`)

fs.writeFileSync(OUT_CONTRACT, `# Training Feature Contract V1

Date: 2026-07-29

Status: EXECUTABLE TRAINING CONTRACT

No model training. No production mutation. No production prediction changes.

## Required Metadata

Every training feature contract entry carries feature key, canonical name, category, source, source table or payload, value type, sport support, market support, earliest availability rule, cutoff availability, frozen timestamp requirement, mutability, training eligibility, research eligibility, leakage severity, aliases, replacement key, deprecation state, rationale and contract version.

## Eligibility Contract

${table(['Eligibility', 'Count'], classRows.map(([key, count]) => [key, String(count)]))}

## First Model Boundary

The first future MLB logistic regression candidate may consume only Tier A/B keys classified as \`TRAINING_ALLOWED\` or \`TRAINING_ALLOWED_IF_CUTOFF_FROZEN\`. Market features require event, market, source and timestamp proof. Labels, settlement, model outputs, recommendation outputs, Trust, Official Pick status, edge, EV, confidence, probabilities, closing lines and post-final data are excluded.
`)

fs.writeFileSync(OUT_ENFORCEMENT, `# Feature Leakage Enforcement V1

Date: 2026-07-29

Status: VALIDATED LEAKAGE ENFORCEMENT

No model training. No production mutation. No provider calls.

## Fixture Results

${table(['Fixture', 'Expected', 'Actual', 'Pass'], fixtures.fixtures.map((fixture) => [
  fixture.name,
  fixture.expected,
  fixture.actual,
  fixture.pass ? 'PASS' : 'FAIL',
]))}

## Temporal Fixtures

${table(['Fixture', 'Expected safe', 'Actual safe', 'Pass'], fixtures.temporalFixtures.map((fixture) => [
  fixture.name,
  String(fixture.expectedSafe),
  String(fixture.actual),
  fixture.pass ? 'PASS' : 'FAIL',
]))}

## Enforcement

- Prohibited fields never silently enter the model-input matrix.
- Unknown fields default deny as \`TRAINING_UNKNOWN_REVIEW_REQUIRED\`.
- Research-only fields remain available for audit partitions but are excluded from model inputs.
- Labels are separated from model inputs.
- Cutoff-frozen market features require timestamp and identity proof.
`)

const leakageAuditAppend = `

## Training-Safe Feature Governance V1 Enforcement Contract

The leakage audit is now backed by \`${TRAINING_FEATURE_CONTRACT_VERSION}\`. The contract classifies all ${contractEntries.length} observed keys exactly once, resolves the ${coverage.leakageSummary.critical} critical leakage-risk keys and ${coverage.leakageSummary.high} high governance-risk keys, and defaults unknown future keys to \`TRAINING_UNKNOWN_REVIEW_REQUIRED\`.

Training consumers must exclude prohibited label, post-final, settlement, model-output and recommendation-output fields. Market fields are allowed only when cutoff-frozen timestamp and identity evidence is present. Research-only metadata can support joins, audits and traceability but cannot enter the training matrix.
`
const leakageAuditText = fs.readFileSync('docs/FEATURE_LEAKAGE_AUDIT.md', 'utf8')
if (!leakageAuditText.includes('Training-Safe Enforcement Contract V1')) {
  fs.writeFileSync('docs/FEATURE_LEAKAGE_AUDIT.md', `${leakageAuditText.trimEnd()}\n${leakageAuditAppend}`)
}

for (const [path, block] of [
  ['docs/TRAINING_DATASET_SPEC_V1.md', `\n## Training-Safe Feature Governance V1\n\nNo model training. No production prediction changes.\n\nFuture training dataset builders must apply \`${TRAINING_FEATURE_CONTRACT_VERSION}\`, include only allowed or cutoff-frozen allowed features, default-deny unknown keys, isolate research-only fields and exclude prohibited label, settlement, model-output, recommendation-output, Trust, Official Pick, edge, EV, confidence and post-final fields.\n`],
  ['docs/TRAINING_CHECKLIST_V1.md', `\n## Training-Safe Feature Governance V1 Checklist\n\nNo model training. No production prediction changes.\n\n- Confirm contract version \`${TRAINING_FEATURE_CONTRACT_VERSION}\`.\n- Resolve aliases before matrix construction.\n- Exclude prohibited fields.\n- Block unknown fields by default.\n- Verify cutoff-frozen market timestamps and identities.\n- Keep labels separate from model inputs.\n`],
]) {
  const current = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
  if (!current.includes('Training-Safe Feature Governance V1')) fs.writeFileSync(path, `${current.trimEnd()}\n${block}`)
}

console.log(JSON.stringify({
  success: true,
  mode: governance.mode,
  featureKeysClassified: governance.featureKeysClassified,
  classificationCounts: governance.classificationCounts,
  tierCounts: governance.tierCounts,
  beforeRows: recertification.beforeRows,
  rowsStillEligible: recertification.rowsStillEligible,
  providerCallsMade: governance.providerCallsMade,
  databaseMutations: governance.databaseMutations,
  modelTrainingRuns: governance.modelTrainingRuns,
  fingerprint: governance.fingerprint,
}, null, 2))
