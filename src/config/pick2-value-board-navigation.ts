export const PICK2_MLB_VALUE_BOARD_NAVIGATION_FLAG = 'PICK2_MLB_VALUE_BOARD_NAVIGATION_ENABLED'
export const PICK2_MLB_VALUE_BOARD_ROUTE_FLAG = 'PICK2_MLB_VALUE_BOARD_ENABLED'
export const PICK2_MLB_VALUE_BOARD_ROUTE = '/mlb-value-board'
export const PICK2_MLB_VALUE_BOARD_NAVIGATION_LABEL = 'MLB Value Board'
export const PICK2_MLB_VALUE_BOARD_NAVIGATION_ICON = 'V'

export function isPick2MlbValueBoardNavigationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[PICK2_MLB_VALUE_BOARD_ROUTE_FLAG] === 'true' && env[PICK2_MLB_VALUE_BOARD_NAVIGATION_FLAG] === 'true'
}
