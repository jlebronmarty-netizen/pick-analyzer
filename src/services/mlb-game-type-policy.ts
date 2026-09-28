export const MLB_MODEL_GAME_TYPES = ['R','F','D','L','W'] as const
export type MlbModelGameType = typeof MLB_MODEL_GAME_TYPES[number]

export function isMlbModelGameType(value: unknown): value is MlbModelGameType {
  return MLB_MODEL_GAME_TYPES.includes(String(value ?? '') as MlbModelGameType)
}

export function mlbModelGameTypesQuery() {
  return MLB_MODEL_GAME_TYPES.join(',')
}
