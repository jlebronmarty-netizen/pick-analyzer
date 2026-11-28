export const windows = {
  L5: "Últimos 5",
  L10: "Últimos 10",
  H5: "H2H 5",
  H10: "H2H 10",
};
export const markets = {
  ALL: "General",
  MONEYLINE: "Moneyline",
  SPREAD: "Spread",
  TOTAL: "Total",
  TEAM: "Total de equipo",
};
export function sample(team, pair, window, away = false) {
  const n = window.endsWith("10") ? 10 : 5;
  if (!window.startsWith("H")) return team.recentGames.slice(0, n);
  return pair.slice(0, n).map((g) =>
    away
      ? {
          ...g,
          pointsFor: g.pointsAgainst,
          pointsAgainst: g.pointsFor,
          periods: g.periods.map((p) => ({
            ...p,
            pointsFor: p.pointsAgainst,
            pointsAgainst: p.pointsFor,
          })),
        }
      : g,
  );
}
export function measure(g, period) {
  if (period === "FT") return g;
  const parts = g.periods.filter((p) =>
    period === "OT" ? p.period > 2 : p.period === Number(period),
  );
  if (!parts.length) return null;
  return {
    pointsFor: parts.reduce((n, p) => n + p.pointsFor, 0),
    pointsAgainst: parts.reduce((n, p) => n + p.pointsAgainst, 0),
  };
}
function margin(g, market, side) {
  if (market === "TOTAL")
    return (
      (g.pointsFor + g.pointsAgainst - side.line) *
      (side.side === "OVER" ? 1 : -1)
    );
  return g.pointsFor - g.pointsAgainst + (market === "SPREAD" ? side.line : 0);
}
function rate(rows, market, side) {
  const wins = rows.filter((g) => margin(g, market, side) > 0).length;
  return {
    wins,
    n: rows.length,
    rate: rows.length ? wins / rows.length : null,
  };
}
export function efficiency(games, samples) {
  const rows = games.map((g) => samples?.[g.eventId]).filter(Boolean);
  const sum = (key) => rows.reduce((n, r) => n + r[key], 0);
  const pos = sum("possessions");
  return {
    n: rows.length,
    pace: pos ? (40 * pos) / sum("minutes") : null,
    offense: pos ? (100 * sum("pointsFor")) / pos : null,
    defense: pos ? (100 * sum("pointsAgainst")) / pos : null,
  };
}
export const sorts = { frequency: "Frecuencia histórica", conditions: "Condiciones favorables", gap: "Brecha en puntos", percent: "Brecha porcentual" };
export function candidates(
  report,
  pairs,
  { window, market, band, period, game, conference, sort = "frequency" },
  possessions = {},
) {
  if (period !== "FT" || market === "TEAM" || !report.coverage.readComplete)
    return [];
  const teams = new Map(report.teams.map((t) => [t.id, t])),
    result = [];
  for (const f of report.fixtures) {
    const home = teams.get(f.homeId),
      away = teams.get(f.awayId),
      pair = pairs[f.eventId] ?? [];
    if (
      !home ||
      !away ||
      (game && game !== f.eventId) ||
      (conference && ![home.conference, away.conference].includes(conference))
    )
      continue;
    if (
      f.state !== "PREGAME" ||
      Date.parse(f.scheduledAt) <= Date.parse(report.readAt) ||
      f.markets.status !== "REFERENCE_ONLY" ||
      !(Date.parse(f.markets.capturedAt) <= Date.parse(report.readAt))
    )
      continue;
    for (const q of f.markets.quotes) {
      if (q.period !== "FULL_GAME" || (market !== "ALL" && market !== q.market))
        continue;
      for (const side of [q.first, q.second]) {
        if (
          side.americanOdds < -650 ||
          (band === "heavy" && side.americanOdds >= -250) ||
          (band === "standard" && side.americanOdds < -250)
        )
          continue;
        const isAway = side.side === "AWAY",
          team = isAway ? away : home,
          other = isAway ? home : away,
          total = q.market === "TOTAL";
        const hist = sample(team, pair, window, isAway),
          required = window.endsWith("10") ? 10 : 5,
          h2h = window.startsWith("H");
        if (
          (!h2h &&
            (!team.last10.sequenceVerified || hist.length !== required)) ||
          hist.length < 5
        )
          continue;
        if (
          total &&
          !h2h &&
          (!other.last10.sequenceVerified ||
            other.recentGames.length < required)
        )
          continue;
        const unique = (rows) => [
          ...new Map(rows.map((g) => [g.eventId, g])).values(),
        ];
        const rows =
          total && !h2h
            ? unique([...hist, ...sample(other, pair, window)])
            : hist;
        const frequency = rate(rows, q.market, side);
        const conditions = [];
        function add(label, ok, n) {
          conditions.push({ label, ok, n });
        }
        function threshold(label, games) {
          const r = rate(games, q.market, side);
          add(label, r.n >= 5 ? r.rate >= 0.6 : null, r.n);
        }
        const recent = team.last10.sequenceVerified ? team.recentGames : [];
        const opponentRecent = other.last10.sequenceVerified ? other.recentGames : [];
        function compareSamples(label, first, second, minimum = 5) {
          if (!total) return threshold(label, first.length >= minimum ? first : []);
          const merged = unique([...first, ...second]);
          const enough = first.length >= minimum && second.length >= minimum;
          add(label, enough ? rate(merged, q.market, side).rate >= 0.6 : null, merged.length);
        }
        compareSamples("Forma L5 a la línea de referencia", recent.slice(0, 5), opponentRecent.slice(0, 5));
        compareSamples("Forma L10 a la línea de referencia", recent, opponentRecent, 10);
        const venue = f.neutralSite === true ? "NEUTRAL" : f.neutralSite === false ? (isAway ? "AWAY" : "HOME") : null;
        const opposite = venue === "HOME" ? "AWAY" : venue === "AWAY" ? "HOME" : venue;
        const venueSample = (games, expected) => games.filter(g =>
          expected !== null && (total && expected !== "NEUTRAL"
            ? ["HOME", "AWAY"].includes(g.venue) : g.venue === expected));
        compareSamples(total ? "Totales en sede neutral o con localía" : "Rendimiento en la sede",
          venueSample(recent, venue), venueSample(opponentRecent, opposite));
        threshold("Ante el rival", sample(team, pair, "H10", isAway));
        const gap =
          rows.reduce((s, g) => s + margin(g, q.market, side), 0) / rows.length;
        add(
          total ? "Margen medio sobre el total" : "Margen medio favorable",
          gap >= 2,
          rows.length,
        );
        if (q.market === "SPREAD")
          add("ATS a la línea histórica de cada partido", null, 0);
        const halves = recent.filter((g) => g.periods.length >= 2);
        if (total) {
          const otherHalves = other.last10.sequenceVerified
            ? other.recentGames.filter((g) => g.periods.length >= 2)
            : [];
          const combined = unique([...halves, ...otherHalves]);
          const halfFloor = Math.min(halves.length, otherHalves.length);
          const avg = (idx) =>
            combined.reduce(
              (n, g) =>
                n + g.periods[idx].pointsFor + g.periods[idx].pointsAgainst,
              0,
            ) / combined.length;
          add(
            "Volumen de ambas mitades",
            halfFloor >= 5
              ? [avg(0), avg(1)].every(
                  (v) =>
                    (v - side.line / 2) * (side.side === "OVER" ? 1 : -1) > 0,
                )
              : null,
            combined.length,
          );
        } else {
          const positive = (idx) =>
            halves.reduce(
              (n, g) =>
                n + g.periods[idx].pointsFor - g.periods[idx].pointsAgainst,
              0,
            ) > 0;
          add(
            "Diferencial positivo en ambas mitades",
            halves.length >= 5 ? positive(0) && positive(1) : null,
            halves.length,
          );
        }
        if (!total)
          add(
            "Ventaja de descanso",
            team.rest.verified && other.rest.verified
              ? team.rest.daysOff > other.rest.daysOff
              : null,
            Number(team.rest.verified) + Number(other.rest.verified),
          );
        const e = efficiency(recent, possessions[team.id]),
          o = efficiency(
            other.last10.sequenceVerified ? other.recentGames : [],
            possessions[other.id],
          );
        const n = Math.min(e.n, o.n);
        if (total) {
          // Pool unique game totals and minutes. Each team's floor is checked
          // separately; a prior meeting contributes one game to the estimate.
          const pooled = new Map();
          let conflict = false;
          for (const [id, games] of [[team.id,recent],[other.id,opponentRecent]]) {
            for (const g of games) {
              const stats = possessions[id]?.[g.eventId];
              if (!stats) continue;
              const entry = { points:stats.pointsFor+stats.pointsAgainst, minutes:stats.minutes, possessions:stats.possessions };
              const old = pooled.get(g.eventId);
              if (old && (old.points !== entry.points || old.minutes !== entry.minutes || old.possessions !== entry.possessions)) conflict=true;
              pooled.set(g.eventId,entry);
            }
          }
          const stats = [...pooled.values()];
          const sum = k => stats.reduce((s,r)=>s+r[k],0);
          const pos = sum("possessions"), mins=sum("minutes");
          const expected = pos>0 && mins>0 ? (40*pos/mins)*(sum("points")/pos) : null;
          add("Ritmo y eficiencia frente al total", n>=5 && !conflict && expected!==null
            ? (expected-side.line)*(side.side==="OVER"?1:-1)>=2 : null, stats.length);
        } else
          add(
            "Ventaja de eficiencia neta",
            n >= 5
              ? e.offense - e.defense - (o.offense - o.defense) >= 3
              : null,
            n,
          );
        // A reference total has a positive points denominator. ML has no points
        // line and percent change at a signed handicap is not comparable.
        const percent = total && side.line > 0 ? 100 * gap / side.line : null;
        if (sort === "percent" && percent === null) continue;
        const fulfilled = conditions.filter(c => c.ok === true).length;
        result.push({ f, q, side, team, frequency, conditions, rows, gap, percent, fulfilled });
      }
    }
  }
  return result
    .sort(
      (a, b) =>
        (sort === "conditions" ? b.fulfilled - a.fulfilled :
         sort === "gap" ? b.gap - a.gap : sort === "percent" ? b.percent - a.percent : 0) ||
        b.frequency.rate - a.frequency.rate ||
        b.frequency.n - a.frequency.n ||
        a.f.eventId.localeCompare(b.f.eventId) ||
        a.q.sportsbook.localeCompare(b.q.sportsbook) ||
        a.side.side.localeCompare(b.side.side),
    )
    .slice(0, 10);
}
