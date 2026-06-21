import { NextResponse } from "next/server";
import { generatePredictionsForGames } from "@/services/prediction.service";

const ODDS_API_BASE_URL = "https://api.the-odds-api.com/v4";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const sport = searchParams.get("sport") ?? "baseball_mlb";
    const regions = searchParams.get("regions") ?? "us";
    const markets = searchParams.get("markets") ?? "h2h";
    const oddsFormat = searchParams.get("oddsFormat") ?? "american";

    const apiKey = process.env.ODDS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing ODDS_API_KEY",
        },
        { status: 500 }
      );
    }

    const url = new URL(`${ODDS_API_BASE_URL}/sports/${sport}/odds`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", regions);
    url.searchParams.set("markets", markets);
    url.searchParams.set("oddsFormat", oddsFormat);

    const response = await fetch(url.toString(), {
      next: {
        revalidate: 60,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch odds",
          details: errorText,
        },
        { status: response.status }
      );
    }

    const games = await response.json();

    const gamesWithPredictions = await generatePredictionsForGames(
      games,
      sport
    );

    return NextResponse.json({
      success: true,
      sport,
      count: gamesWithPredictions.length,
      games: gamesWithPredictions,
    });
  } catch (error) {
    console.error("Odds API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unexpected server error",
      },
      { status: 500 }
    );
  }
}