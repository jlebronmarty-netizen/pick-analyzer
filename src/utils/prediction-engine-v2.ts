export type TeamStatsInput = {
  team_name: string;
  sport_key: string;
  season: number;
  wins: number;
  losses: number;
  ties?: number | null;
  home_wins?: number | null;
  home_losses?: number | null;
  away_wins?: number | null;
  away_losses?: number | null;
  last_5_wins?: number | null;
  last_5_losses?: number | null;
  last_10_wins?: number | null;
  last_10_losses?: number | null;
  streak?: number | null;
  win_percentage?: number | null;
};

export type PredictionInput = {
  teamName: string;
  opponentName: string;
  americanOdds: number;
  opponentAmericanOdds: number;
  teamRating: number;
  opponentRating: number;
  teamStats?: TeamStatsInput | null;
  opponentStats?: TeamStatsInput | null;
  isHomeTeam?: boolean;
};

export type PredictionResult = {
  team: string;
  opponent: string;
  odds: number;
  impliedProbability: number;
  modelProbability: number;
  edge: number;
  ev: number;
  confidence: number;
  recommendedPick: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function americanOddsToImpliedProbability(odds: number): number {
  if (odds < 0) {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }

  return 100 / (odds + 100);
}

export function americanOddsToDecimal(odds: number): number {
  if (odds < 0) {
    return 1 + 100 / Math.abs(odds);
  }

  return 1 + odds / 100;
}

function getWinPercentage(stats?: TeamStatsInput | null): number {
  if (!stats) return 0.5;

  if (typeof stats.win_percentage === "number") {
    return stats.win_percentage > 1
      ? stats.win_percentage / 100
      : stats.win_percentage;
  }

  const wins = stats.wins ?? 0;
  const losses = stats.losses ?? 0;
  const ties = stats.ties ?? 0;
  const total = wins + losses + ties;

  if (total === 0) return 0.5;

  return wins / total;
}

function getRecentForm(stats?: TeamStatsInput | null): number {
  if (!stats) return 0.5;

  const wins = stats.last_10_wins ?? 0;
  const losses = stats.last_10_losses ?? 0;
  const total = wins + losses;

  if (total === 0) return 0.5;

  return wins / total;
}

function getStreakScore(stats?: TeamStatsInput | null): number {
  if (!stats || typeof stats.streak !== "number") return 0.5;

  const normalized = 0.5 + clamp(stats.streak, -5, 5) * 0.05;

  return clamp(normalized, 0.25, 0.75);
}

function percentageFromDifference(
  teamValue: number,
  opponentValue: number,
  multiplier: number
): number {
  const diff = teamValue - opponentValue;
  return clamp(0.5 + diff * multiplier, 0.05, 0.95);
}

export function calculatePredictionV2(
  input: PredictionInput
): PredictionResult {
  const implied = americanOddsToImpliedProbability(input.americanOdds);
  const opponentImplied = americanOddsToImpliedProbability(
    input.opponentAmericanOdds
  );

  const normalizedVegasProbability =
    implied / Math.max(implied + opponentImplied, 0.01);

  const ratingProbability = percentageFromDifference(
    input.teamRating,
    input.opponentRating,
    0.015
  );

  const winPercentageProbability = percentageFromDifference(
    getWinPercentage(input.teamStats),
    getWinPercentage(input.opponentStats),
    0.9
  );

  const recentFormProbability = percentageFromDifference(
    getRecentForm(input.teamStats),
    getRecentForm(input.opponentStats),
    0.8
  );

  const streakProbability = percentageFromDifference(
    getStreakScore(input.teamStats),
    getStreakScore(input.opponentStats),
    0.7
  );

  const homeBonus = input.isHomeTeam ? 0.015 : 0;

  const modelProbability =
    normalizedVegasProbability * 0.45 +
    ratingProbability * 0.25 +
    winPercentageProbability * 0.12 +
    recentFormProbability * 0.12 +
    streakProbability * 0.06 +
    homeBonus;

  const finalModelProbability = clamp(modelProbability, 0.03, 0.97);

  const decimalOdds = americanOddsToDecimal(input.americanOdds);
  const ev = finalModelProbability * decimalOdds - 1;
  const edge = finalModelProbability - implied;

  const confidence = clamp(
    50 +
      edge * 100 +
      Math.abs(input.teamRating - input.opponentRating) * 0.25 +
      (getRecentForm(input.teamStats) - 0.5) * 20,
    1,
    99
  );

  return {
    team: input.teamName,
    opponent: input.opponentName,
    odds: input.americanOdds,
    impliedProbability: Number((implied * 100).toFixed(2)),
    modelProbability: Number((finalModelProbability * 100).toFixed(2)),
    edge: Number((edge * 100).toFixed(2)),
    ev: Number((ev * 100).toFixed(2)),
    confidence: Number(confidence.toFixed(2)),
    recommendedPick:
      ev > 0 &&
      edge > 0.015 &&
      confidence >= 55 &&
      finalModelProbability > implied,
  };
}