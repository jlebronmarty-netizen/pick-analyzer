create index if not exists prediction_history_current_board_live_idx
  on prediction_history (sport_key, is_current, commence_time, odds_timestamp desc)
  where model_probability is not null
    and odds is not null;

create index if not exists sports_odds_snapshots_current_board_event_market_idx
  on sports_odds_snapshots (sport_key, event_id, market, snapshot_time desc);
