# MLB Market Taxonomy V1

Canonical taxonomy is implemented in `src/services/mlb-market-expansion-roadmap.service.ts`.

Families:
- Full Game
- First Five Innings
- First Inning
- Pitcher Props
- Batter Props
- Team/Game Props
- Combined/Alternate

Each market includes:
- Canonical market ID
- Display name
- Sport
- Market family
- Selection type
- Unit
- Settlement requirements
- Feature requirements
- Model type
- Price requirements
- Historical requirements

Required markets covered:
- Moneyline
- Run Line
- Game Total
- Team Total
- Alternate Run Line
- Alternate Total
- First Five Moneyline
- First Five Run Line
- First Five Total
- First Five Team Total
- NRFI
- YRFI
- First Inning Run Line
- First Inning Total
- Pitcher strikeouts, outs, hits allowed, earned runs, walks, pitch count, win decision and quality start
- Batter hits, runs, RBI, total bases, home runs, walks, strikeouts, stolen bases, H+R+RBI, singles, doubles and extra-base hits
- Team hits, team runs, team home runs, race to X runs, winning margin, highest scoring inning, extra innings and both-teams-to-score thresholds
- Same Game combinations and alternate player, pitcher and team-total lines

Production today:
- `moneyline`
- `run_line`
- `game_total`

All other markets are contract-only or blocked until provider, data, model, settlement, shadow, backtest and calibration gates pass.
