"use client";
import { useState } from "react";
import {
  FilterGroup,
  SheetCard,
  TrendBars,
} from "@/components/cheat-sheets/presentation";
import layout from "../nhl-cheat-sheets/layout.module.css";
import s from "@/components/cheat-sheets/sheet.module.css";
import {
  windows,
  markets,
  sample,
  measure,
  candidates,
  efficiency,
} from "./evidence.mjs";

const periods = {
  FT: "Partido",
  1: "Primera mitad",
  2: "Segunda mitad",
  OT: "Prórroga",
};
const bands = {
  both: "Ambos rangos",
  standard: "−250 o mejor",
  heavy: "−251 a −650",
};
const fmt = (v) => (Number.isFinite(v) ? Number(v.toFixed(1)) : "—");
const clock = (v) =>
  new Date(v).toLocaleTimeString("es-PR", {
    timeZone: "America/Puerto_Rico",
    hour: "numeric",
    minute: "2-digit",
  });
const record = (a) =>
  a.games ? a.wins + "–" + a.losses + " (" + a.games + ")" : "Sin muestra";
function Comparison({
  f,
  home,
  away,
  pair,
  window,
  period,
  possessions,
  ranks,
  attempts,
}) {
  const columns = [home, away].map((t, i) => {
    const history = sample(t, pair, window, i === 1);
    const bars = history.toReversed().flatMap((g) => {
      const p = measure(g, period);
      return p
        ? [
            {
              id: g.eventId,
              value: p.pointsFor,
              hit: p.pointsFor > p.pointsAgainst,
              title: g.date + " · " + p.pointsFor + "–" + p.pointsAgainst,
              label: g.date + " · " + p.pointsFor + " puntos",
            },
          ]
        : [];
    });
    return { t, bars, history };
  });
  const scale = Math.max(
    1,
    ...columns.flatMap((c) => c.bars.map((b) => b.value)),
  );
  const rows = [
    ["Conferencia", (t) => t.conference ?? "Sin dato"],
    ["Ranking publicado en ESPN", (t) => ranks?.[t.id] ?? "Sin dato"],
    ["Récord reportado", (t) => t.reportedRecord?.overall ?? "Sin dato"],
    ["Temporada observada", (t) => record(t.archive)],
    ...[
      ["Local", "home"],
      ["Visitante", "away"],
      ["Neutral", "neutral"],
    ].map(([label, key]) => [label, (t) => record(t.archive[key])]),
    [
      "PF / PC por juego",
      (t) =>
        fmt(t.archive.pointsFor) +
        " / " +
        fmt(t.archive.pointsAgainst) +
        " (n=" +
        t.archive.games +
        ")",
    ],
    ...Object.entries({
      fieldGoalPct: "TC%",
      threePointPct: "3P%",
      freeThrowPct: "TL%",
      rebounds: "Rebotes",
      assists: "Asistencias",
      turnovers: "Pérdidas",
    }).map(([key, label]) => [
      label,
      (t) => {
        const m = t.archive.stats[key];
        return (
          fmt(
            m.value === null ? null : m.value * (key.endsWith("Pct") ? 100 : 1),
          ) +
          " (" +
          m.games +
          " juegos" +
          (key.endsWith("Pct")
            ? ", " + attempts[t.id][key] + " intentos"
            : "") +
          ")"
        );
      },
    ]),
    [
      "Descanso",
      (t) =>
        t.rest.verified
          ? t.rest.daysOff === 0
            ? "Juegos consecutivos"
            : t.rest.daysOff + " días"
          : "Sin verificar",
    ],
    ...Object.entries({
      pace: "Posesiones estimadas / 40 min",
      offense: "Puntos por 100 posesiones",
      defense: "Permitidos por 100 posesiones",
    }).map(([k, label]) => [
      label,
      (t) => {
        const e = efficiency(
          sample(t, pair, window, t === away),
          possessions[t.id],
        );
        return fmt(e[k]) + " (n=" + e.n + ")";
      },
    ]),
  ];
  return (
    <SheetCard>
      <header>
        {clock(f.scheduledAt)} PR ·{" "}
        {f.neutralSite === true
          ? "Sede neutral"
          : f.neutralSite === false
            ? "Localía registrada"
            : "Sede por verificar"}
      </header>
      <h2>
        {away.name} @ {home.name}
      </h2>
      <div className={s.score}>
        {windows[window]} · {periods[period]}
      </div>
      <div className={s.trend}>
        {columns.map(({ t, bars, history }) => (
          <figure key={t.id}>
            <figcaption>
              {t.name} · puntos · {bars.length}/{history.length} juegos con
              datos
            </figcaption>
            {bars.length ? (
              <TrendBars bars={bars} scale={scale} />
            ) : (
              <small>Sin muestra</small>
            )}
          </figure>
        ))}
      </div>
      <details className={s.analysis}>
        <summary>Comparativa de equipos</summary>
        <table>
          <thead>
            <tr>
              <th>Estadística</th>
              <th>{home.abbreviation ?? home.name}</th>
              <th>{away.abbreviation ?? away.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, read]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{read(home)}</td>
                <td>{read(away)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Recibo del partido · cuotas archivadas</h3>
        {f.markets.quotes.length === 0 ? (
          <p>Sin precio pareado al corte.</p>
        ) : (
          f.markets.quotes.map((q) => (
            <p key={q.sportsbook + q.market}>
              {q.sportsbook} · {markets[q.market]} ·{" "}
              {[q.first, q.second]
                .map((x) => {
                  const labels = {
                    HOME: home.name,
                    AWAY: away.name,
                    OVER: "Más de",
                    UNDER: "Menos de",
                  };
                  return [labels[x.side], x.line, "(" + x.americanOdds + ")"]
                    .filter((v) => v !== null)
                    .join(" ");
                })
                .join(" / ")}{" "}
              · {clock(f.markets.capturedAt)} PR · reglas pendientes
            </p>
          ))
        )}
        {[home, away].map((t) => (
          <p key={t.id}>
            {t.name} · {t.warnings.join(" ") || "Secuencia verificada."}
          </p>
        ))}
      </details>
    </SheetCard>
  );
}
export default function Board({ report, pairs, possessions, ranks, attempts }) {
  const [window, setWindow] = useState("L5"),
    [market, setMarket] = useState("ALL"),
    [period, setPeriod] = useState("FT"),
    [band, setBand] = useState("both"),
    [game, setGame] = useState(""),
    [conference, setConference] = useState("");
  const [limit, setLimit] = useState(8);
  const teams = new Map(report.teams.map((t) => [t.id, t]));
  const fixtures = report.fixtures.filter(
    (f) =>
      (!game || game === f.eventId) &&
      (!conference ||
        [
          teams.get(f.homeId)?.conference,
          teams.get(f.awayId)?.conference,
        ].includes(conference)),
  );
  return (
    <div className={layout.surface}>
      <main className={s.sheet}>
        <a href="/ncaab">← Panel NCAAB</a>
        <header className={s.hero}>
          <p>NCAAB / {report.date}</p>
          <h1>Cheat Sheets</h1>
          <p>
            Equipos, mitades y líneas archivadas · corte {clock(report.readAt)}{" "}
            PR
          </p>
        </header>
        <form method="get">
          <label>
            Jornada{" "}
            <input
              aria-label="Jornada"
              name="date"
              type="date"
              defaultValue={report.date}
            />
          </label>
          <button>Ver corte de la 1 p. m. PR</button>
        </form>
        <div className={s.controls}>
          <FilterGroup
            label="Mercado"
            options={markets}
            value={market}
            onChange={setMarket}
          />
          <FilterGroup
            label="Período"
            options={periods}
            value={period}
            onChange={setPeriod}
          />
          <FilterGroup
            label="Historial"
            options={windows}
            value={window}
            onChange={setWindow}
          />
          <FilterGroup
            label="Cuotas"
            options={bands}
            value={band}
            onChange={setBand}
          />
          <label style={{ minWidth: 0, maxWidth: "100%" }}>
            Partido{" "}
            <select
              style={{ maxWidth: "100%", colorScheme: "dark" }}
              value={game}
              onChange={(e) => setGame(e.target.value)}
            >
              <option value="">Todos</option>
              {report.fixtures.map((f) => (
                <option key={f.eventId} value={f.eventId}>
                  {f.awayName} @ {f.homeName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Conferencia{" "}
            <select
              style={{ maxWidth: "100%", colorScheme: "dark" }}
              value={conference}
              onChange={(e) => setConference(e.target.value)}
            >
              <option value="">Todas</option>
              {[
                ...new Set(
                  report.teams.map((t) => t.conference).filter(Boolean),
                ),
              ]
                .sort()
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </label>
        </div>
        {(band === "both" ? ["standard", "heavy"] : [band]).map((b) => {
          const rank = candidates(
            report,
            pairs,
            { window, market, period, band: b, game, conference },
            possessions,
          );
          return (
            <section key={b}>
              <h2 className={s.heading}>
                Top 10 · {markets[market]} · {bands[b]}
              </h2>
              <p>
                Frecuencia histórica a la línea archivada · {rank.length}{" "}
                referencias
              </p>
              <div className={s.grid}>
                {rank.map(({ f, q, side, team, frequency, conditions }, i) => {
                  const evaluated = conditions.filter((c) => c.ok !== null);
                  return (
                    <SheetCard
                      key={[f.eventId, q.market, q.sportsbook, side.side].join(
                        "|",
                      )}
                    >
                      <header>
                        #{i + 1} · {f.awayName} @ {f.homeName}
                      </header>
                      <h2>
                        {q.market === "TOTAL"
                          ? side.side === "OVER"
                            ? "Más de"
                            : "Menos de"
                          : team.name}{" "}
                        {side.line ?? ""}
                      </h2>
                      <p className={s.line}>{markets[q.market]}</p>
                      <div className={s.score}>
                        <b>
                          {frequency.wins}/{frequency.n}
                        </b>{" "}
                        juegos favorables
                      </div>
                      <div className={s.footer}>
                        {q.sportsbook} {side.americanOdds > 0 ? "+" : ""}
                        {side.americanOdds} · {clock(f.markets.capturedAt)} PR
                      </div>
                      <details className={s.analysis}>
                        <summary>
                          Condiciones · {evaluated.filter((c) => c.ok).length}/
                          {evaluated.length}
                        </summary>
                        {conditions.map((c) => (
                          <p key={c.label}>
                            {c.label} ·{" "}
                            {c.ok === null
                              ? "Sin evidencia"
                              : c.ok
                                ? "Cumple"
                                : "No cumple"}{" "}
                            (n={c.n})
                          </p>
                        ))}
                      </details>
                      <p className={s.limits}>
                        Reglas de liquidación y prórroga pendientes.
                      </p>
                    </SheetCard>
                  );
                })}
              </div>
              {!rank.length && (
                <p className={s.empty}>
                  {period !== "FT" || market === "TEAM"
                    ? "Sin líneas y cuotas pareadas para este mercado y período."
                    : "Sin referencias prepartido con cuota y muestra suficientes."}
                </p>
              )}
            </section>
          );
        })}
        <h2 className={s.heading}>Comparativas · {fixtures.length} partidos</h2>
        <div className={s.grid}>
          {fixtures.slice(0, limit).map((f) => (
            <Comparison
              key={f.eventId}
              f={f}
              home={teams.get(f.homeId)}
              away={teams.get(f.awayId)}
              pair={pairs[f.eventId] ?? []}
              window={window}
              period={period}
              possessions={possessions}
              ranks={ranks[f.eventId]}
              attempts={attempts}
            />
          ))}
        </div>
        {fixtures.length > limit && (
          <button onClick={() => setLimit(limit + 8)}>
            Ver más partidos ({fixtures.length - limit})
          </button>
        )}
        <details className={s.method}>
          <summary>Cobertura del archivo</summary>
          <p>
            {report.coverage.archivedFinals} finales ·{" "}
            {report.coverage.excludedEvents} eventos excluidos ·{" "}
            {report.source.missingDates.length} fechas sin captura. H2H usa
            enfrentamientos observados de esta temporada.
          </p>
          {report.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </details>
      </main>
    </div>
  );
}
