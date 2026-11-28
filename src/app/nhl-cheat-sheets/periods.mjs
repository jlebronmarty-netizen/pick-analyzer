// The official final scoreboard includes a shootout decision. A shootout attempt
// is never a goal in P1–P3. Require every non-shootout scoring increment.
export function regulationPeriods(game) {
  const finish = game.gameOutcome?.lastPeriodType;
  if (
    !["FINAL", "OFF"].includes(game.gameState) ||
    !["REG", "OT", "SO"].includes(finish) ||
    !Array.isArray(game.goals)
  )
    return null;
  const home = game.homeTeam,
    away = game.awayTeam;
  if (
    !home?.abbrev ||
    !away?.abbrev ||
    home.abbrev === away.abbrev ||
    ![home.score, away.score].every(Number.isInteger) ||
    home.score === away.score
  )
    return null;
  const periods = Array.from({ length: 3 }, () => ({ home: 0, away: 0 }));
  const totals = { home: 0, away: 0 };
  let ot = 0,
    prior = 0;
  for (const goal of game.goals) {
    const desc = goal.periodDescriptor;
    if (desc?.periodType === "SO" && finish === "SO") continue;
    const p = desc?.number;
    if (
      !Number.isInteger(p) ||
      goal.period !== p ||
      p < prior ||
      !(
        (p >= 1 && p <= 3 && desc.periodType === "REG") ||
        (p === 4 && desc.periodType === "OT" && finish === "OT")
      )
    )
      return null;
    const side =
      goal.teamAbbrev === home.abbrev
        ? "home"
        : goal.teamAbbrev === away.abbrev
          ? "away"
          : null;
    if (!side) return null;
    totals[side]++;
    if (goal.homeScore !== totals.home || goal.awayScore !== totals.away)
      return null;
    if (p === 4) ot++;
    else periods[p - 1][side]++;
    prior = p;
  }
  if (ot !== Number(finish === "OT")) return null;
  const bonus = finish === "SO" ? 1 : 0;
  if (
    totals.home !== home.score - (home.score > away.score ? bonus : 0) ||
    totals.away !== away.score - (away.score > home.score ? bonus : 0)
  )
    return null;
  return { homeScore: home.score, awayScore: away.score, finish, periods };
}
