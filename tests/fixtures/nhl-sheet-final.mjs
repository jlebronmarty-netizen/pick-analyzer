export const goal = {
  scoringPlayerId: 11,
  eventOwnerTeamId: 1,
  homeScore: 1,
  awayScore: 0,
};
export function archiveFixture(start, observed) {
  const side = {
    forwards: [{ playerId: 11, toi: "17:00", goals: 1, sog: 1, assists: 0 }],
    defense: [],
    goalies: [],
  };
  const boxscore = {
    id: 2,
    startTimeUTC: start,
    homeTeam: { id: 1, abbrev: "H", score: 1, sog: 1 },
    awayTeam: { id: 2, abbrev: "A", score: 0, sog: 0 },
    gameType: 2,
    gameState: "FINAL",
    gameOutcome: { lastPeriodType: "REG" },
    periodDescriptor: { periodType: "REG", number: 3 },
    playerByGameStats: {
      homeTeam: side,
      awayTeam: { forwards: [], defense: [], goalies: [] },
    },
  };
  const plays = [
    "goal",
    "period-end",
    "period-end",
    "period-end",
    "game-end",
  ].map((typeDescKey, i) => ({
    typeDescKey,
    timeInPeriod: typeDescKey === "period-end" ? "20:00" : "00:10",
    eventId: i + 1,
    periodDescriptor: { periodType: "REG", number: [1, 1, 2, 3, 3][i] },
    details: i ? {} : goal,
  }));
  return {
    event_id: "nhl:2",
    provider_game_id: 2,
    provider: "nhl_web_api",
    source_version: "NHL_CAUSAL_CONTEXT_V2",
    updated_at: observed,
    boxscore,
    play_by_play: { ...structuredClone(boxscore), plays },
    boxscore_captured_at: observed,
    pbp_captured_at: observed,
  };
}
