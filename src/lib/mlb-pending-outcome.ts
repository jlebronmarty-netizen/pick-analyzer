// Research settlement only. A missing value or roster entry is never a zero.
export function outcomeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export type PendingOfficialEvidence = {
  version: 'MLB_PENDING_OUTCOME_EVIDENCE_V1'; gamePk: number; season: number;
  officialDate: string; statusCode: string; detailedState: string; final: boolean;
  homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null;
  capturedAt: string; scheduleSha256: string; boxscoreSha256: string;
  players: Record<string, { plateAppearances: number | null; doubles: number | null; walks: number | null }>;
};
export function parsePendingOfficialEvidence(gamePk: number, schedule: any, box: any,
  provenance: Pick<PendingOfficialEvidence, 'capturedAt' | 'scheduleSha256' | 'boxscoreSha256'>): PendingOfficialEvidence {
  const games = (schedule?.dates ?? []).flatMap((d: any) => d.games ?? []);
  const matches = games.filter((g: any) => g.gamePk === gamePk);
  if (!matches.length || matches.some((g:any)=>Number(g.season)!==2026)) throw Error('OFFICIAL_GAME_IDENTITY_MISMATCH');
  // Schedule may contain both the postponed entry and its rescheduled final.
  // Only a unique completed entry can supply a result; ambiguous finals fail closed.
  const finals=matches.filter((g:any)=>g.status?.statusCode==='F' && g.status?.codedGameState==='F');
  if(finals.length>1) throw Error('AMBIGUOUS_OFFICIAL_FINAL');
  const g=finals[0] ?? matches.find((g:any)=>/postponed|cancelled/i.test(g.status?.detailedState??'')) ?? matches[0];
  for (const side of ['home','away']) {
    if (g.teams?.[side]?.team?.id !== box?.teams?.[side]?.team?.id) throw Error('OFFICIAL_TEAM_IDENTITY_MISMATCH');
  }
  const players: PendingOfficialEvidence['players'] = {};
  for (const side of ['home','away']) for (const p of Object.values(box.teams[side].players ?? {}) as any[]) {
    const id = outcomeNumber(p.person?.id);
    if (!Number.isSafeInteger(id) || Number(id) <= 0) continue;
    const b = p.stats?.batting;
    players[String(id)] = {plateAppearances: outcomeNumber(b?.plateAppearances), doubles: outcomeNumber(b?.doubles), walks: outcomeNumber(b?.baseOnBalls)};
  }
  return {version:'MLB_PENDING_OUTCOME_EVIDENCE_V1', gamePk, season:2026,
    officialDate:g.officialDate, statusCode:g.status?.statusCode ?? '', detailedState:g.status?.detailedState ?? '',
    // Postponed can also have abstractGameState=Final. Require the completed status code.
    final:g.status?.statusCode === 'F' && g.status?.codedGameState === 'F',
    homeTeam:box.teams.home.team.abbreviation ?? '', awayTeam:box.teams.away.team.abbreviation ?? '',
    homeScore:outcomeNumber(g.teams.home.score), awayScore:outcomeNumber(g.teams.away.score), players, ...provenance};
}
export function pendingPropBlocker(e: PendingOfficialEvidence, playerId: number, targetDate: string) {
  if (e.statusCode.startsWith('D') || /postponed|cancelled/i.test(e.detailedState)) return 'POSTPONED_CONTRACT_REVIEW';
  if (e.officialDate !== targetDate) return 'OFFICIAL_DATE_MISMATCH_REVIEW';
  if (!e.final) return 'WAITING_FOR_OFFICIAL_FINAL';
  const player = e.players[String(playerId)];
  if (!player) return 'PLAYER_NOT_IN_FINAL_BOXSCORE_CONTRACT_REVIEW';
  if (player.plateAppearances === 0) return 'ZERO_PA_CONTRACT_REVIEW';
  if (player.plateAppearances === null) return 'NO_BATTING_PARTICIPATION_CONTRACT_REVIEW';
  return 'EXACT_OUTCOME_NOT_AVAILABLE';
}
export function standardRunlineOutcome(e: PendingOfficialEvidence | undefined,
  frozen: {gamePk:number; targetDate:string; homeTeam:string; awayTeam:string; dogSide:string}) {
  if (!e || e.gamePk !== frozen.gamePk || e.season !== 2026 || !e.final || e.officialDate !== frozen.targetDate ||
    e.homeTeam !== frozen.homeTeam || e.awayTeam !== frozen.awayTeam ||
    !['HOME','AWAY'].includes(frozen.dogSide) || e.homeScore === null || e.awayScore === null ||
    !Number.isInteger(e.homeScore) || !Number.isInteger(e.awayScore) || e.homeScore < 0 || e.awayScore < 0 || e.homeScore === e.awayScore) return null;
  const margin = frozen.dogSide === 'HOME' ? e.homeScore-e.awayScore : e.awayScore-e.homeScore;
  return {result: margin + 1.5 > 0 ? 'WIN' as const : 'LOSS' as const, actualValue:margin,
    actualLabel:`${frozen.dogSide} ${margin >= 0 ? '+' : ''}${margin}; final ${e.awayTeam} ${e.awayScore}–${e.homeScore} ${e.homeTeam}`,
    settledAt:e.capturedAt};
}
export function pendingReasonLabel(blocker: unknown): string {
  switch (blocker) {
    case 'POSTPONED_CONTRACT_REVIEW': return 'Partido aplazado; revisar regla del contrato.';
    case 'PLAYER_NOT_IN_FINAL_BOXSCORE_CONTRACT_REVIEW': return 'Jugador ausente del boxscore final; revisar participación y contrato.';
    case 'ZERO_PA_CONTRACT_REVIEW': return 'Sin aparición al plato; revisar regla de participación.';
    case 'NO_BATTING_PARTICIPATION_CONTRACT_REVIEW': return 'Sin registro de bateo en el boxscore final; revisar participación y contrato.';
    case 'OFFICIAL_DATE_MISMATCH_REVIEW': return 'Fecha oficial distinta; requiere revisión.';
    case 'WAITING_FOR_OFFICIAL_FINAL': return 'Esperando resultado final oficial.';
    default: return 'Falta resultado exacto verificado para liquidar.';
  }
}
