export function teamWindow(team, window, opponent) {
  if (window === "direct5" || window === "direct10") {
    const sample = team?.direct?.slice(0, window === "direct5" ? 5 : 10) ?? [];
    return sample.every(Boolean) ? sample : [];
  }
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
export function rankThresholds(
  games,
  prices,
  market,
  band,
  window,
  order = "frequency",
) {
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
      conditions: conditions(game, quote),
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
        (order === "conditions"
          ? b.conditions.filter((x) => x.pass === true).length -
            a.conditions.filter((x) => x.pass === true).length
          : 0) ||
        b.hits / b.n - a.hits / a.n ||
        b.n - a.n ||
        a.game.id.localeCompare(b.game.id) ||
        a.quote.side.localeCompare(b.quote.side),
    )
    .slice(0, 10);
}

export function conditions(game, quote) {
  const teams = game.fixture.teams;
  const selected = quote.side === "away" ? "away" : "home",
    other = selected === "home" ? "away" : "home";
  const a = teams[selected],
    b = teams[other],
    total = quote.market === "total",
    dir = quote.side === "under" ? -1 : 1;
  const tests = [];
  const add = (name, value, threshold) =>
    tests.push({
      name,
      pass: Number.isFinite(value) ? value >= threshold : null,
    });
  for (const [name, n] of [
    ["Forma L5", 5],
    ["Forma L10", 10],
    ["Sede", 10],
    ["H2H", 10],
  ]) {
    const sample = new Map();
    let valid = true;
    for (const t of total ? [a, b] : [a]) {
      let rows = name === "H2H" ? (t.direct ?? []) : teamWindow(t, String(n));
      if (!rows.every(Boolean)) {
        valid = false;
        break;
      }
      if (name === "Sede")
        rows = rows.filter(
          (g) => g.venue === (t === teams.home ? "home" : "away"),
        );
      if (rows.length < 5) valid = false;
      for (const g of rows) {
        const margin = total
          ? dir * (g.score + g.against - quote.line)
          : g.score - g.against + (quote.market === "spread" ? quote.line : 0);
        sample.set(g.id, margin);
      }
    }
    add(
      name,
      valid
        ? [...sample.values()].filter((m) => m > 0).length / sample.size
        : null,
      0.6,
    );
  }
  const both = [a, b].map((t) => teamWindow(t, "10"));
  function avg(g, field) {
    return g.length === 10 && g.every((r) => Number.isFinite(r[field]))
      ? g.reduce((z, r) => z + r[field], 0) / 10
      : NaN;
  }
  const [x, y] = both;
  const gf = (avg(x, "goals") + avg(y, "allowed")) / 2,
    ga = (avg(y, "goals") + avg(x, "allowed")) / 2;
  add(
    "Goles",
    total
      ? dir * (gf + ga - quote.line)
      : gf - ga + (quote.market === "spread" ? quote.line : 0),
    0.25,
  );
  add(
    "Tiros",
    total
      ? dir *
          ((avg(x, "shots") +
            avg(x, "shotsAgainst") +
            avg(y, "shots") +
            avg(y, "shotsAgainst")) /
            2 -
            60)
      : (avg(x, "shots") -
          avg(x, "shotsAgainst") -
          (avg(y, "shots") - avg(y, "shotsAgainst"))) /
          2,
    2,
  );
  const sv = [a, b].map((t, i) => {
    const p = both[i]
      .flatMap((g) => g.goalies ?? [])
      .filter((p) => p.id === t.goalieId);
    const sa = p.reduce((z, r) => z + r.sa, 0);
    return t.goalie?.status === "CONFIRMADO" && p.length >= 3 && sa >= 60
      ? p.reduce((z, r) => z + r.saves, 0) / sa
      : NaN;
  });
  add(
    "Porteros confirmados",
    total ? dir * (0.9 - (sv[0] + sv[1]) / 2) : sv[0] - sv[1],
    0.01,
  );
  const special = (t) =>
    t.specialTeams?.currentGamesMatch
      ? [t.specialTeams.powerPlayPct, t.specialTeams.penaltyKillPct]
      : [];
  const [ap, ak] = special(a),
    [bp, bk] = special(b);
  add(
    "PP y PK",
    [ap, ak, bp, bk].every(Number.isFinite)
      ? total
        ? dir * ((ap + bp + 2 - ak - bk) / 4 - 0.2)
        : ap + ak - bp - bk
      : NaN,
    0.03,
  );
  add(
    "Descanso",
    a.rest?.verified &&
      b.rest?.verified &&
      [a.rest.daysOff, b.rest.daysOff].every(Number.isInteger)
      ? total
        ? dir * (Number(a.rest.backToBack) + Number(b.rest.backToBack) - 0.5)
        : a.rest.daysOff - b.rest.daysOff
      : NaN,
    total ? 0.5 : 1,
  );
  return tests;
}
