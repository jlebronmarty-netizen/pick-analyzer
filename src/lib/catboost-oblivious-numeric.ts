export type NumericCatBoostSplit = {
  border: number
  float_feature_index: number
  split_index?: number
  split_type: string
}

export type NumericCatBoostTree = {
  leaf_values: number[]
  splits: NumericCatBoostSplit[]
}

export type NumericCatBoostModel = {
  features_info: {
    float_features: Array<{
      feature_id: string
      feature_index: number
      flat_feature_index: number
      has_nans: boolean
      nan_value_treatment: string
    }>
  }
  oblivious_trees: NumericCatBoostTree[]
  scale_and_bias: Array<number | number[]>
}

export function applyNumericCatBoostRaw(model: NumericCatBoostModel, features: readonly number[]) {
  let sum = 0
  for (const tree of model.oblivious_trees) {
    let leafIndex = 0
    for (let depth = 0; depth < tree.splits.length; depth += 1) {
      const split = tree.splits[depth]
      if (split.split_type !== 'FloatFeature') {
        throw new Error(`UNSUPPORTED_CATBOOST_SPLIT_TYPE:${split.split_type}`)
      }
      const value = features[split.float_feature_index]
      // CatBoost numeric models exported with nan_value_treatment=AsFalse route
      // NaN/missing values to the false branch. JavaScript's NaN > border is
      // false, so this branch is explicit for auditability.
      const pass = Number.isFinite(value) && value > split.border
      if (pass) leafIndex |= (1 << depth)
    }
    const leaf = tree.leaf_values[leafIndex]
    if (!Number.isFinite(leaf)) throw new Error('CATBOOST_LEAF_NOT_FINITE')
    sum += leaf
  }
  const scaleEntry = model.scale_and_bias?.[0]
  const biasEntry = model.scale_and_bias?.[1]
  const scale = typeof scaleEntry === 'number' ? scaleEntry : 1
  const bias = Array.isArray(biasEntry) ? Number(biasEntry[0] ?? 0) : Number(biasEntry ?? 0)
  const raw = scale * sum + bias
  if (!Number.isFinite(raw)) throw new Error('CATBOOST_RAW_NOT_FINITE')
  return raw
}

export function sigmoid(raw: number) {
  if (raw >= 0) {
    const z = Math.exp(-raw)
    return 1 / (1 + z)
  }
  const z = Math.exp(raw)
  return z / (1 + z)
}

export function applyNumericCatBoostProbability(model: NumericCatBoostModel, features: readonly number[]) {
  return sigmoid(applyNumericCatBoostRaw(model, features))
}
