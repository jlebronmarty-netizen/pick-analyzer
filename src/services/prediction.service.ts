import { supabase } from "@/lib/supabase";
import { calculateTeamRating } from "@/utils/team-rating";
import {
  calculatePredictionV2,
  PredictionResult,
  TeamStatsInput,
} from "@/utils/prediction-engine-v2";

type OddsOutcome = {
  name: string;
  price: number;
};

type OddsMarket = {
  key: string;
  outcomes: OddsOutcome[];
};

type OddsBookmaker = {
  key: string;
  title: string;
  markets: OddsMarket[];
};

type GameWithOdds = {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsBookmaker[];
};

function normalizeTeamName(name: string): string {
  return name.trim().toLowerCase();
}

async function getTeamStats(sportKey: string): Promise<TeamStatsInput[]> {
  const { data, error } = await supabase
    .from("team_stats")
    .select("*")
    .eq("sport_key", sportKey);

  if (error) {
    console.error("Error loading team stats:", error.message);
    return [];
  }

  return data ?? [];
}

function buildStatsMap(stats: TeamStatsInput[]) {
  const map = new Map<string, TeamStatsInput>();

  for (const team of stats) {
    map.set(normalizeTeamName(team.team_name), team);
  }

  return map;
}

function getMoneylineOutcomes(game: GameWithOdds): OddsOutcome[] {
  const bookmaker = game.bookmakers?.[0];

  if (!bookmaker) return [];

  const moneyline = bookmaker.markets.find(
    (market) => market.key === "h2h"
  );

  return moneyline?.outcomes ?? [];
}

function getFallbackRating(stats?: TeamStatsInput | null): number {
  if (!stats) return 50;

  return calculateTeamRating({
    wins: stats.wins ?? 0,
    losses: stats.losses ?? 0,
    ties: stats.ties ?? 0,
    home_wins: stats.home_wins ?? 0,
    home_losses: stats.home_losses ?? 0,
    away_wins: stats.away_wins ?? 0,
    away_losses: stats.away_losses ?? 0,
    last_5_wins: stats.last_5_wins ?? 0,
    last_5_losses: stats.last_5_losses ?? 0,
    last_10_wins: stats.last_10_wins ?? 0,
    last_10_losses: stats.last_10_losses ?? 0,
    streak: stats.streak ?? 0,
    win_percentage: stats.win_percentage ?? 0,
  });
}

export async function generatePredictionsForGames(
  games: GameWithOdds[],
  sportKey: string
): Promise<
  Array<
    GameWithOdds & {
      predictions: PredictionResult[];
      recommendedPick: PredictionResult | null;
    }
  >
> {
  const stats = await getTeamStats(sportKey);
  const statsMap = buildStatsMap(stats);

  return games.map((game) => {
    const outcomes = getMoneylineOutcomes(game);

    if (outcomes.length < 2) {
      return {
        ...game,
        predictions: [],
        recommendedPick: null,
      };
    }

    const homeStats = statsMap.get(normalizeTeamName(game.home_team)) ?? null;
    const awayStats = statsMap.get(normalizeTeamName(game.away_team)) ?? null;

    const homeOutcome = outcomes.find(
      (outcome) =>
        normalizeTeamName(outcome.name) === normalizeTeamName(game.home_team)
    );

    const awayOutcome = outcomes.find(
      (outcome) =>
        normalizeTeamName(outcome.name) === normalizeTeamName(game.away_team)
    );

    if (!homeOutcome || !awayOutcome) {
      return {
        ...game,
        predictions: [],
        recommendedPick: null,
      };
    }

    const homeRating = getFallbackRating(homeStats);
    const awayRating = getFallbackRating(awayStats);

    const homePrediction = calculatePredictionV2({
      teamName: game.home_team,
      opponentName: game.away_team,
      americanOdds: homeOutcome.price,
      opponentAmericanOdds: awayOutcome.price,
      teamRating: homeRating,
      opponentRating: awayRating,
      teamStats: homeStats,
      opponentStats: awayStats,
      isHomeTeam: true,
    });

    const awayPrediction = calculatePredictionV2({
      teamName: game.away_team,
      opponentName: game.home_team,
      americanOdds: awayOutcome.price,
      opponentAmericanOdds: homeOutcome.price,
      teamRating: awayRating,
      opponentRating: homeRating,
      teamStats: awayStats,
      opponentStats: homeStats,
      isHomeTeam: false,
    });

    const predictions = [homePrediction, awayPrediction];

    const recommendedPick =
      predictions
        .filter((prediction) => prediction.recommendedPick)
        .sort((a, b) => b.ev - a.ev || b.confidence - a.confidence)[0] ?? null;

    return {
      ...game,
      predictions,
      recommendedPick,
    };
  });
}