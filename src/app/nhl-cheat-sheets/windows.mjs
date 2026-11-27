export function teamWindow(team, window, opponent) {
  const n = window === "5" ? 5 : 10;
  const series = team?.history?.slice(0, n);
  if (series?.length !== n || !series.every(Boolean)) return [];
  return series.filter((game) => window !== "h2h" || game.opp === opponent);
}

export function inBand(price, band) {
  if (!Number.isInteger(price) || Math.abs(price) < 100 || price < -650)
    return false;
  return band === "all" || (band === "heavy" ? price <= -251 : price >= -250);
}

// Compare the recorded final scoreboard, including the shootout decision.
// This is a historical threshold frequency, independent of book settlement.
export function rankThresholds(games, prices, market, band, window) {
  const entries = [];
  for (const quote of prices.filter(
    (p) => p.market === market && inBand(p.price, band),
  )) {
    const game = games.find((g) => g.id === quote.id);
    if (!game?.fixture) continue;
    const teams = game.fixture.teams;
    const sample = new Map();
    const sides = market === "total" ? ["home", "away"] : [quote.side];
    let comparable = true;
    for (const side of sides) {
      const history = teamWindow(
        teams[side],
        window,
        teams[side === "away" ? "home" : "away"].abbrev,
      );
      if (!history.length) comparable = false;
      for (const g of history) {
        const margin =
          market === "total"
            ? (g.score + g.against - quote.line) *
              (quote.side === "over" ? 1 : -1)
            : g.score - g.against + (market === "spread" ? quote.line : 0);
        if (
          !Number.isFinite(margin) ||
          (sample.has(g.id) && sample.get(g.id) !== margin)
        )
          comparable = false;
        sample.set(g.id, margin);
      }
    }
    if (!comparable || sample.size < 5) continue;
    const margins = [...sample.values()];
    entries.push({
      game,
      quote,
      hits: margins.filter((x) => x > 0).length,
      ties: margins.filter((x) => x === 0).length,
      n: sample.size,
    });
  }
  return entries
    .sort(
      (a, b) =>
        b.hits / b.n - a.hits / a.n ||
        b.n - a.n ||
        a.game.id.localeCompare(b.game.id) ||
        a.quote.side.localeCompare(b.quote.side),
    )
    .slice(0, 10);
}
