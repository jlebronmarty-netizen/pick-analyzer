export type OfficialSportMetrics = {
  key: string;
  label: string;
  readiness: string;
  connected: boolean;
  available: boolean;
  wins: number | null;
  losses: number | null;
  pushes: number | null;
  voids: number | null;
  pending: number | null;
};

export function summarizeOfficialSports(sports: OfficialSportMetrics[]) {
  const connected = sports.filter((sport) => sport.connected);
  const available =
    connected.length > 0 &&
    connected.every(
      (sport) =>
        sport.available &&
        [
          sport.wins,
          sport.losses,
          sport.pushes,
          sport.voids,
          sport.pending,
        ].every(
          (value) =>
            typeof value === "number" && Number.isInteger(value) && value >= 0,
        ),
    );
  const wins = available
    ? connected.reduce((sum, sport) => sum + (sport.wins ?? 0), 0)
    : null;
  const losses = available
    ? connected.reduce((sum, sport) => sum + (sport.losses ?? 0), 0)
    : null;
  const decided = wins !== null && losses !== null ? wins + losses : null;
  return {
    available,
    wins,
    losses,
    decided,
    accuracy: decided && wins !== null ? wins / decided : null,
    pushes: available
      ? connected.reduce((sum, sport) => sum + (sport.pushes ?? 0), 0)
      : null,
    voids: available
      ? connected.reduce((sum, sport) => sum + (sport.voids ?? 0), 0)
      : null,
    pending: available
      ? connected.reduce((sum, sport) => sum + (sport.pending ?? 0), 0)
      : null,
    includedSports: connected.map((sport) => sport.label),
  };
}
