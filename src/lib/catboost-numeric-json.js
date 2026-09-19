export function catboostNumericRaw(model, features) {
  if (!model || !Array.isArray(model.oblivious_trees)) {
    throw new Error('CATBOOST_NUMERIC_MODEL_INVALID')
  }
  const floatMeta = new Map(
    (model.features_info?.float_features ?? []).map((item) => [Number(item.feature_index), item]),
  )

  let raw = 0
  for (const tree of model.oblivious_trees) {
    const splits = Array.isArray(tree.splits) ? tree.splits : []
    let leafIndex = 0

    for (let depth = 0; depth < splits.length; depth += 1) {
      const split = splits[depth]
      if (split?.split_type !== 'FloatFeature') {
        throw new Error('CATBOOST_NUMERIC_NON_FLOAT_SPLIT')
      }
      const featureIndex = Number(split.float_feature_index)
      const border = Number(split.border)
      const value = features[featureIndex]
      const meta = floatMeta.get(featureIndex)

      let goesRight = false
      if (typeof value === 'number' && Number.isFinite(value)) {
        goesRight = value > border
      } else {
        const nanPolicy = meta?.nan_value_treatment ?? 'AsFalse'
        if (nanPolicy === 'AsTrue') goesRight = true
        else if (nanPolicy === 'AsFalse' || nanPolicy === 'AsIs') goesRight = false
        else throw new Error(`CATBOOST_NUMERIC_NAN_POLICY:${nanPolicy}`)
      }

      if (goesRight) leafIndex |= (1 << depth)
    }

    const leafValue = Number(tree.leaf_values?.[leafIndex])
    if (!Number.isFinite(leafValue)) {
      throw new Error('CATBOOST_NUMERIC_LEAF_INVALID')
    }
    raw += leafValue
  }

  const scale = Number(model.scale_and_bias?.[0] ?? 1)
  const bias = Number(model.scale_and_bias?.[1]?.[0] ?? 0)
  return raw * scale + bias
}

export function catboostNumericProbability(model, features) {
  const raw = catboostNumericRaw(model, features)
  if (raw >= 0) {
    const z = Math.exp(-raw)
    return 1 / (1 + z)
  }
  const z = Math.exp(raw)
  return z / (1 + z)
}

export function catboostNumericEnsembleProbability(models, features) {
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error('CATBOOST_NUMERIC_ENSEMBLE_EMPTY')
  }
  return models.reduce((sum, model) => sum + catboostNumericProbability(model, features), 0) / models.length
}
