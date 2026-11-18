// Pure, read-only NBA prop SHADOW grader. Never mutates archived predictions.
export const GRADE_VERSION = 'NBA_PROP_SHADOW_SETTLEMENT_V1';
export const SUPPORTED_MARKETS = Object.freeze({
  points: ['pts'], rebounds: ['reb'], assists: ['ast'], threes: ['fg3m'],
  points_rebounds_assists: ['pts','reb','ast'],
  points_rebounds: ['pts','reb'], points_assists: ['pts','ast'],
  rebounds_assists: ['reb','ast'],
});
const timestamp = x => Date.parse(String(x ?? ''));
const integer = x => typeof x === 'number' && Number.isSafeInteger(x) ? x :
  typeof x === 'string' && /^\\d+$/.test(x) && Number.isSafeInteger(Number(x)) ? Number(x) : null;
const validOdds = x => Number.isInteger(x) && (x <= -100 || x >= 100);
const decimalReturn = odds => odds > 0 ? odds / 100 : 100 / -odds;
// Return null for unavailable values, never silently treat missing stats as zero.
export function actualPropValue(finalRow, market) {
  const fields = SUPPORTED_MARKETS[market];
  if (!fields) return null;
  let total = 0;
  for (const field of fields) {
    const n = integer(finalRow?.[field]);
    if (n === null || n < 0) return null;
    total += n;
  }
  return total;
}
// An independent frozen decision record must exist BEFORE a game starts.
// Book grading rules for OT, DNP and voids have not yet been verified.
export function gradeFrozenProp(decision, final, options = {}) {
  const pending = (reason, value = null) => ({
    version: GRADE_VERSION, status: 'UNSETTLED', reason, actual: value,
    outcome: null, netUnits: null, modelProbability: null,
  });
  if (!decision || !final || !Object.hasOwn(SUPPORTED_MARKETS,decision.market))
    return pending('UNSUPPORTED_OR_MISSING_INPUT');
  const player = integer(decision.playerId), game = integer(decision.providerGameId);
  if (player === null || game === null || player !== integer(final.player_id) ||
      game !== integer(final.provider_game_id)) return pending('IDENTITY_MISMATCH');
  const frozen = timestamp(decision.frozenAt), tip = timestamp(decision.gameStartAt);
  const captured = timestamp(final.source_captured_at);
  if (![frozen,tip,captured].every(Number.isFinite) ||
      frozen >= tip - 600000 || captured < tip || timestamp(decision.quoteCapturedAt) > frozen)
    return pending('TIMESTAMP_OR_PREGAME_CUTOFF_INVALID');
  if (final.final_verified !== true) return pending('FINAL_NOT_VERIFIED');
  if (final.corrected_or_disputed === true) return pending('FINAL_DISPUTED');
  if (final.dnp === true || !(Number(final.minutes_played) > 0))
    return pending('DNP_REQUIRES_CONTRACT_VERIFICATION');
  if (options.fullGameOtRuleVerified !== true ||
      decision.period !== 'FULL_GAME_LABEL_OT_UNVERIFIED')
    return pending('OVERTIME_RULE_UNVERIFIED');
  if (options.dnpVoidRuleVerified !== true) return pending('DNP_RULE_UNVERIFIED');
  if (options.bookRegionVerified !== true) return pending('BOOK_REGION_UNVERIFIED');
  const side = decision.side, line = Number(decision.line),
        odds = Number(decision.americanOdds), actual = actualPropValue(final,decision.market);
  if (!['over','under'].includes(side) || !Number.isFinite(line) || line < 0 ||
      !validOdds(odds) || actual === null ||
      decision.contract !== (side==='over'?'STRICT_GREATER_THAN':'STRICT_LESS_THAN'))
    return pending('INVALID_CONTRACT_OR_FINAL_STATS',actual);
  const win = side==='over' ? actual > line : actual < line;
  const push = actual === line;
  return {version:GRADE_VERSION,status:'GRADED',reason:push?'PUSH':'RULE_VERIFIED',
    actual,outcome:push?'PUSH':win?'WIN':'LOSS',netUnits:push?0:win?decimalReturn(odds):-1,
    modelProbability:null};
}
export function summarizeVerifiedGrades(grades) {
  const graded = grades.filter(x=>x.status==='GRADED');
  const wins = graded.filter(x=>x.outcome==='WIN').length;
  const losses = graded.filter(x=>x.outcome==='LOSS').length;
  const pushes = graded.filter(x=>x.outcome==='PUSH').length;
  const staked = wins+losses;
  const units = graded.reduce((sum,x)=>sum+x.netUnits,0);
  return {total:grades.length,graded:graded.length,unsettled:grades.length-graded.length,
    wins,losses,pushes,gradedWinRate:staked?wins/staked:null,
    flatStakeRoi:staked?units/staked:null,netUnits:Math.round(units*10000)/10000,
    note:'Observed SHADOW outcomes only; ROI assumes 1-unit stakes and verified settlement rules, not executable fills or calibrated edge.'};
}
