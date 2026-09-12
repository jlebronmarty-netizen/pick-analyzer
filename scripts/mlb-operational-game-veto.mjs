import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

export const GAME_VETO_CLASSES = Object.freeze({
  CURRENT_STARTED_GAME_VETO: 'BLOCK_STARTED',
  CURRENT_GAME_IDENTITY_VETO: 'BLOCK_GAME_IDENTITY',
  CURRENT_STARTER_CHANGE_VETO: 'BLOCK_STARTER_CHANGE',
  STARTER_MISSING: 'BLOCK_MISSING_STARTER',
  NEW_CANONICAL_EVIDENCE_AFTER_RUN_FREEZE: 'BLOCK_POST_FREEZE_EVIDENCE',
  NEW_RAW_EVIDENCE_AFTER_RUN_FREEZE: 'BLOCK_POST_FREEZE_EVIDENCE',
  STALE_GAME_EVIDENCE: 'BLOCK_STALE_EVIDENCE',
  FEATURE_INCOMPLETE: 'BLOCK_FEATURE_INCOMPLETE',
  STARTER_OR_STATUS_CHANGED: 'BLOCK_OTHER_CERTIFIED_REASON',
})
export function gameVetoClassification(reason) {
  const code = reason?.replace(/^R2TR1_BLOCK:/, '')
  if(['STARTER_CHANGED','STARTER_CONFLICT'].includes(code))return 'BLOCK_STARTER_CHANGE'
  if(['NOT_PREGAME','STARTED_GAME','PREGAME_STATUS'].includes(code))return 'BLOCK_STARTED'
  return GAME_VETO_CLASSES[code] ?? 'BLOCK_OTHER_CERTIFIED_REASON'
}
const businessNative = row => ({
  game_pk: row.game_pk, game_date: row.game_date, scheduled_at: new Date(row.scheduled_at).toISOString(), home_team_id: row.home_team_id, away_team_id: row.away_team_id,
  game_type: row.game_type, official_status: row.official_status, doubleheader: row.doubleheader, game_number: row.game_number,
  officialDate: row.metadata?.officialDate, abstractGameState: row.metadata?.abstractGameState,
  homeStarter: row.metadata?.homeProbablePitcher?.id ?? row.metadata?.starter_evidence?.homeProbablePitcher?.id ?? null,
  awayStarter: row.metadata?.awayProbablePitcher?.id ?? row.metadata?.starter_evidence?.awayProbablePitcher?.id ?? null,
})

// Veto-only evidence: this function never substitutes current observations into
// frozen model inputs. Unknown/global transport or schema errors still abort.
export function classifyCurrentGame({ context, native, currentGame, at, requireCurrent }) {
  const { target, starters } = context
  let reason = null
  if (!native || !Number.isFinite(Date.parse(native.scheduled_at))) reason = 'CURRENT_GAME_IDENTITY_VETO'
  else if (Date.parse(target.scheduledAt) <= Date.parse(at) || Date.parse(native.scheduled_at) <= Date.parse(at)) reason = 'CURRENT_STARTED_GAME_VETO'
  else if (Date.parse(native.updated_at) > Date.parse(target.runAsOf) || Date.parse(native.created_at) > Date.parse(target.runAsOf)) reason = 'NEW_CANONICAL_EVIDENCE_AFTER_RUN_FREEZE'
  else if (sha256(businessNative(native)) !== sha256(businessNative(target.native))) reason = 'STARTER_OR_STATUS_CHANGED'
  else if (requireCurrent) {
    if (!currentGame || currentGame.pregame_classification !== 'PREGAME_SAFE' || currentGame.metadata.abstractGameState !== 'Preview' || Date.parse(currentGame.scheduled_at) <= Date.parse(at)) reason = 'CURRENT_STARTED_GAME_VETO'
    else if (currentGame.home_team_id !== target.homeTeamId || currentGame.away_team_id !== target.awayTeamId || Date.parse(currentGame.scheduled_at) !== Date.parse(target.scheduledAt)) reason = 'CURRENT_GAME_IDENTITY_VETO'
    else if (!currentGame.metadata.homeProbablePitcher?.id || !currentGame.metadata.awayProbablePitcher?.id) reason = 'STARTER_MISSING'
    else if (currentGame.metadata.homeProbablePitcher.id !== starters.home.mlbam_pitcher_id || currentGame.metadata.awayProbablePitcher.id !== starters.away.mlbam_pitcher_id) reason = 'CURRENT_STARTER_CHANGE_VETO'
  }
  return { gamePk: target.gamePk, classification: reason ? gameVetoClassification(reason) : 'ELIGIBLE', reason }
}
