"use client";
import { teamWindow, inBand, rankThresholds } from "./windows.mjs";
import { GoalieComparison, PlayerCard } from "./players";
import { useState } from "react";
import {
  FilterGroup,
  SheetCard,
  TrendBars,
} from "@/components/cheat-sheets/presentation";
import s from "@/components/cheat-sheets/sheet.module.css";
const markets = {
  ml: "Moneyline",
  spread: "Puck line",
  total: "Total",
  periodML: "Moneyline por período",
  periodSpread: "Puck line por período",
  periodTotal: "Total por período",
  team: "Total de equipo",
  skater: "Props de jugador",
  goalie: "Props de portero",
};
const bands = {
  all: "Ambos rangos",
  standard: "−250 o mejor",
  heavy: "−251 a −650",
};
const na = "Sin evidencia";
function prTime(value, withDate = false) {
  const local = new Date(new Date(value).getTime() - 4 * 3600000);
  const h = local.getUTCHours(),
    m = String(local.getUTCMinutes()).padStart(2, "0");
  return (
    (withDate ? local.toISOString().slice(0, 10) + " · " : "") +
    (h % 12 || 12) +
    ":" +
    m +
    " " +
    (h >= 12 ? "p. m." : "a. m.")
  );
}
function percentage(n) {
  return Number.isFinite(n) && n >= 0 && n <= 1
    ? (100 * n).toFixed(1) + "%"
    : na;
}
function Analysis({ label, children, className }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={className}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{label}</summary>
      {open ? children : null}
    </details>
  );
}
function Team({ team: t, window, opponent, opponentGoalie }) {
  const games = teamWindow(t, window, opponent).reverse();
  const mean = (key) =>
    games.length && games.every((g) => Number.isFinite(g[key]))
      ? (games.reduce((sum, g) => sum + g[key], 0) / games.length).toFixed(1)
      : na;
  const periodGames = games.filter((g) => g.periods?.length === 3);
  const wins = games.filter((g) => g.score > g.against).length;
  const overtimeLosses = games.filter(
    (g) => g.score < g.against && g.finish !== "REG",
  ).length;
  const starts = games.flatMap((g) =>
    g.goalies.filter((p) => p.id === t.goalieId),
  );
  const total = (k) => starts.reduce((a, p) => a + p[k], 0);
  return (
    <section>
      <h3>{t.abbrev}</h3>
      <p>
        Temporada {t.season.record ?? na} · Posición {t.rank ?? na} · Local{" "}
        {t.homeRecord ?? na} · Visitante {t.awayRecord ?? na}
      </p>
      {games.length ? (
        <>
          <p>
            Récord {wins}–{games.length - wins - overtimeLosses}–
            {overtimeLosses} · Marcador final a favor · {games.length} juegos ·
            incluye desempate SO
          </p>
          <TrendBars
            bars={games.map((g) => ({
              id: g.id,
              value: g.score,
              title: g.opp + " · " + g.score + "–" + g.against + " " + g.finish,
              label: g.opp + " " + g.score,
            }))}
            scale={Math.max(1, ...games.map((g) => g.score))}
          />
          <p>
            Diferencial {games.reduce((a, g) => a + g.score - g.against, 0)} ·
            Goles a favor/en contra {mean("goals")} / {mean("allowed")} · Tiros
            a favor/en contra {mean("shots")} / {mean("shotsAgainst")} por juego
          </p>
        </>
      ) : (
        <p>Sin serie comparable para esta ventana.</p>
      )}
      <p>
        Portero {t.goalie.name ?? na} · {t.goalie.status}
      </p>
      <p>
        Portero observado en la ventana · {starts.length} apariciones · Atajadas
        por aparición{" "}
        {starts.length ? (total("saves") / starts.length).toFixed(1) : na} · SV%{" "}
        {percentage(total("sa") ? total("saves") / total("sa") : null)} · GAA{" "}
        {total("seconds")
          ? ((3600 * total("ga")) / total("seconds")).toFixed(2)
          : na}
      </p>
      {games.length > 0 && (
        <Analysis label="Jugadores y cruces observados">
          <PlayerCard games={games} opponentGoalie={opponentGoalie} />
          {games.map((g) => (
            <details key={g.id}>
              <summary>
                {g.id} · vs {g.opp} · {g.finish}
              </summary>
              <p>
                Goles {g.goals ?? "—"}–{g.allowed ?? "—"} · Tiros{" "}
                {g.shots ?? "—"}–{g.shotsAgainst ?? "—"}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Tiros</th>
                    <th>G</th>
                    <th>A</th>
                  </tr>
                </thead>
                <tbody>
                  {g.skaters.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.s ?? "—"}</td>
                      <td>{p.g ?? "—"}</td>
                      <td>{p.a ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {g.meetings.map((m) => (
                <p key={m.shooterId + "-" + m.goalieId}>
                  {m.shooter} vs portero {m.goalie} · {m.s} tiros · {m.g} goles
                </p>
              ))}
            </details>
          ))}
        </Analysis>
      )}
      <p>
        PP{" "}
        {percentage(
          t.specialTeams.currentGamesMatch ? t.specialTeams.powerPlayPct : null,
        )}{" "}
        · PK{" "}
        {percentage(
          t.specialTeams.currentGamesMatch
            ? t.specialTeams.penaltyKillPct
            : null,
        )}
      </p>
      <p>
        Descanso {t.rest.verified ? (t.rest.daysOff ?? na) : na} días · B2B{" "}
        {t.rest.verified && typeof t.rest.backToBack === "boolean"
          ? t.rest.backToBack
            ? "Sí"
            : "No"
          : na}
      </p>
      {periodGames.length ? (
        <p>
          Goles por período a favor/en contra · {periodGames.length}/
          {games.length} juegos con acta conciliada ·{" "}
          {[0, 1, 2]
            .map(
              (i) =>
                "P" +
                (i + 1) +
                " " +
                [0, 1]
                  .map((side) =>
                    (
                      periodGames.reduce(
                        (acc, g) => acc + g.periods[i][side],
                        0,
                      ) / periodGames.length
                    ).toFixed(1),
                  )
                  .join("/"),
            )
            .join(" · ")}
        </p>
      ) : t.last10.periods.length > 0 &&
        t.last10.complete &&
        t.last10.sequenceVerified ? (
        <p>
          Goles a favor/en contra por período (L10) ·{" "}
          {t.last10.periods
            .map(
              (p) =>
                "P" +
                p.period +
                " " +
                (p.goalsForPerGame ?? "—") +
                "/" +
                (p.goalsAgainstPerGame ?? "—") +
                " (n=" +
                p.goalsCoverage +
                ")",
            )
            .join(" · ")}
        </p>
      ) : (
        <p>Períodos P1–P3 · sin serie conciliada.</p>
      )}
    </section>
  );
}
export default function Sheet({ date, data }) {
  const [market, M] = useState("ml"),
    [band, B] = useState("all"),
    [window, W] = useState("10"),
    [game, G] = useState("all");
  const visible =
    data?.games.filter((g) => game === "all" || game === g.id) ?? [];
  const ranks = (band === "all" ? ["standard", "heavy"] : [band]).map((b) => ({
    band: b,
    entries: rankThresholds(visible, data?.prices ?? [], market, b, window),
  }));
  return (
    <main className={s.sheet}>
      <a href="/nhl">← Panel NHL</a>
      <header className={s.hero}>
        <b>NHL · {date}</b>
        <h1>Cheat Sheets</h1>
        <p>Comparativas y cuotas archivadas.</p>
      </header>
      <form>
        <label>
          Jornada <input type="date" name="date" defaultValue={date} />
        </label>{" "}
        <button>Consultar</button>
      </form>
      <div className={s.controls}>
        <FilterGroup
          label="Mercado"
          options={markets}
          value={market}
          onChange={M}
        />
        <FilterGroup
          label="Historial"
          options={{
            5: "Últimos 5",
            10: "Últimos 10",
            h2h: "Contra el rival en L10",
          }}
          value={window}
          onChange={W}
        />
        <FilterGroup label="Cuotas" options={bands} value={band} onChange={B} />
      </div>
      <label>
        Partido{" "}
        <select value={game} onChange={(e) => G(e.target.value)}>
          <option value="all">Todos</option>
          {data?.games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.away} @ {g.home}
            </option>
          ))}
        </select>
      </label>
      {data &&
        ranks.map((r) => (
          <section key={r.band}>
            <h2 className={s.heading}>
              Top 10 histórico · {markets[market]} · {bands[r.band]}
            </h2>
            {r.entries.length ? (
              <div className={s.grid}>
                {r.entries.map(({ game: g, quote: q, hits, n, ties }, i) => (
                  <SheetCard key={g.id + q.side}>
                    <header>
                      <span>
                        {g.away} @ {g.home}
                      </span>
                      <span>{prTime(g.time)} PR</span>
                    </header>
                    <h2>
                      {
                        {
                          home: g.home,
                          away: g.away,
                          over: "Más de",
                          under: "Menos de",
                        }[q.side]
                      }{" "}
                      {q.line ?? ""}
                    </h2>
                    <div className={s.score}>
                      <b>
                        {hits}/{n}
                      </b>
                      <span>veces sobre el umbral</span>
                      <i>#{i + 1}</i>
                    </div>
                    <div className={s.footer}>
                      <span>
                        Circa {q.price > 0 ? "+" : ""}
                        {q.price}
                      </span>
                      <span>
                        {ties} empates · {prTime(q.captured)} PR
                      </span>
                    </div>
                    <Analysis
                      className={s.analysis}
                      label="Historial del mercado"
                    >
                      {(market === "total" ? ["away", "home"] : [q.side]).map(
                        (side) => (
                          <Team
                            key={side}
                            team={g.fixture.teams[side]}
                            opponentGoalie={{
                              id: g.fixture.teams[
                                side === "home" ? "away" : "home"
                              ].goalieId,
                              name: g.fixture.teams[
                                side === "home" ? "away" : "home"
                              ].goalie.name,
                            }}
                            window={window}
                            opponent={
                              g.fixture.teams[side === "home" ? "away" : "home"]
                                .abbrev
                            }
                          />
                        ),
                      )}
                    </Analysis>
                  </SheetCard>
                ))}
              </div>
            ) : (
              <p>
                Sin cuotas y muestras comparables de al menos cinco partidos.
              </p>
            )}
          </section>
        ))}
      <p className={s.note}>
        Frecuencia histórica sobre marcadores finales con desempate. En totales
        se combinan los partidos únicos de ambos equipos. Cuotas descriptivas de
        Circa. Reglas de reglamentario, prórroga y shootout pendientes de
        verificación.
      </p>
      {!data ? (
        <p>Lectura incompleta. Revisa la fecha o vuelve a intentar.</p>
      ) : !data.games.length ? (
        <p>Sin partidos archivados para esta jornada.</p>
      ) : (
        <div className={s.grid}>
          {data.games
            .filter((g) => game === "all" || game === g.id)
            .map((g) => {
              const prices = data.prices.filter(
                (p) =>
                  p.id === g.id && p.market === market && inBand(p.price, band),
              );
              return (
                <SheetCard key={g.id}>
                  <header>
                    <small>{prTime(g.time)} PR</small>
                    <h2>
                      {g.away} @ {g.home}
                    </h2>
                  </header>
                  <div className={s.score}>{markets[market]}</div>
                  <div className={s.analysis}>
                    {prices.length ? (
                      prices.map((p) => (
                        <p key={p.side}>
                          {
                            {
                              away: g.away,
                              home: g.home,
                              over: "Más de",
                              under: "Menos de",
                            }[p.side]
                          }{" "}
                          {p.line ?? ""} · Circa {p.price > 0 ? "+" : ""}
                          {p.price} · {prTime(p.captured)} PR
                        </p>
                      ))
                    ) : (
                      <p>Sin cuota comparable en este rango.</p>
                    )}
                    <Analysis label="Análisis del partido">
                      {g.fixture && (
                        <GoalieComparison
                          teams={g.fixture.teams}
                          window={window}
                        />
                      )}
                      {g.fixture && (
                        <p>
                          {g.fixture.native
                            ? "Archivo de Pick disponible hasta"
                            : "Corte prepartido en Pick"}{" "}
                          · {prTime(g.fixture.availableAsOf, true)} PR
                        </p>
                      )}
                      {g.fixture ? (
                        Object.entries(g.fixture.teams).map(([side, t]) => (
                          <Team
                            key={side}
                            team={t}
                            opponentGoalie={{
                              id: g.fixture.teams[
                                side === "home" ? "away" : "home"
                              ].goalieId,
                              name: g.fixture.teams[
                                side === "home" ? "away" : "home"
                              ].goalie.name,
                            }}
                            window={window}
                            opponent={
                              g.fixture.teams[side === "home" ? "away" : "home"]
                                .abbrev
                            }
                          />
                        ))
                      ) : (
                        <p>
                          Sin corte prepartido de equipos y porteros para este
                          partido.
                        </p>
                      )}
                      <p>
                        Lesiones y alineación completa · Sin confirmar en este
                        corte.
                      </p>
                    </Analysis>
                  </div>
                </SheetCard>
              );
            })}
        </div>
      )}
    </main>
  );
}
