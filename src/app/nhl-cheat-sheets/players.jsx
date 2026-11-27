"use client";
import { useState } from "react";
import { teamWindow } from "./windows.mjs";

export function GoalieComparison({ teams, window }) {
  return (
    <table>
      <caption>
        Porteros reportados · apariciones en la ventana del equipo
      </caption>
      <thead>
        <tr>
          <th>Portero</th>
          <th>Juegos</th>
          <th>Atajadas/J</th>
          <th>SV%</th>
          <th>GAA</th>
        </tr>
      </thead>
      <tbody>
        {["away", "home"].map((side) => {
          const t = teams[side],
            opp = teams[side === "away" ? "home" : "away"];
          const games = teamWindow(t, window, opp.abbrev);
          const appearances = games.flatMap((g) =>
            g.goalies.filter((p) => p.id === t.goalieId),
          );
          const sum = (k) => appearances.reduce((a, p) => a + p[k], 0);
          const shots = sum("sa"),
            seconds = sum("seconds");
          return (
            <tr key={side}>
              <th>
                {t.goalie.name ?? "Sin identificar"}
                <small>
                  {t.abbrev} · {t.goalie.status}
                </small>
              </th>
              <td>{t.goalieId && games.length ? appearances.length : "—"}</td>
              <td>
                {appearances.length
                  ? (sum("saves") / appearances.length).toFixed(1)
                  : "—"}
              </td>
              <td>
                {shots ? ((100 * sum("saves")) / shots).toFixed(1) + "%" : "—"}
              </td>
              <td>
                {seconds ? ((3600 * sum("ga")) / seconds).toFixed(2) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PlayerCard({ games, opponentGoalie }) {
  const [selected, setSelected] = useState("");
  const roster = new Map(
    games.flatMap((g) => g.skaters.map((p) => [String(p.id), p])),
  );
  const id = roster.has(selected) ? selected : roster.keys().next().value;
  if (!id) return <p>Sin jugadores con participación identificada.</p>;
  const rows = games.flatMap((g) =>
    g.skaters.filter((p) => String(p.id) === id),
  );
  const ties = games.flatMap((g) =>
    g.meetings.filter(
      (m) => String(m.shooterId) === id && m.goalieId === opponentGoalie?.id,
    ),
  );
  return (
    <section>
      <label>
        Jugador observado{" "}
        <select value={id} onChange={(e) => setSelected(e.target.value)}>
          {Array.from(roster, ([key, p]) => (
            <option key={key} value={key}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <table>
        <caption>Promedio por aparición con estadística válida</caption>
        <thead>
          <tr>
            <th>Estadística</th>
            <th>Promedio</th>
            <th>Muestra</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["s", "Tiros a puerta"],
            ["g", "Goles"],
            ["a", "Asistencias"],
          ].map(([k, label]) => {
            const values = rows.map((p) => p[k]).filter(Number.isInteger);
            return (
              <tr key={k}>
                <th>{label}</th>
                <td>
                  {values.length
                    ? (
                        values.reduce((a, n) => a + n, 0) / values.length
                      ).toFixed(1)
                    : "—"}
                </td>
                <td>
                  {values.length}/{games.length} juegos
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        {ties.length
          ? "Frente a " +
            opponentGoalie.name +
            " en " +
            ties.length +
            " partidos observados: " +
            ties.reduce((a, m) => a + m.s, 0) +
            " tiros y " +
            ties.reduce((a, m) => a + m.g, 0) +
            " goles."
          : "Sin cruce directo identificado en esta ventana con el portero reportado del rival."}
      </p>
    </section>
  );
}
