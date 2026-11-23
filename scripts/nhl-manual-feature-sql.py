#!/usr/bin/env python3
"""Validate a Site /api/features export and render one injection-safe SQL query.

This helper has no network or database access. Every variable SQL argument is
UTF-8/base64 encoded; user JSON is never interpolated into an SQL string literal.
The database assigns actual Pick availability and skips newly received events
that have already started. Historical identical retries remain renderable.
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

SCHEMA = "NHL_MANUAL_FEATURES_V1"
MAX_INPUT_BYTES = 4_194_304
MAX_FEATURE_BYTES = 131_072
MAX_SQL_BYTES = 1_900_000  # execute_sql rejects queries around 2 MB.
AST = timezone(timedelta(hours=-4))
EVENT = re.compile(r"^nhl:[0-9]{10}$")
RUN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9:_.-]{0,159}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
UTC = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?Z$")
TEAM = re.compile(r"^[A-Z]{2,3}$")


class ContractError(ValueError):
    """A safe error code; does not print source data or partial SQL."""


def require(condition: bool, code: str) -> None:
    if not condition:
        raise ContractError(code)


def object_value(value: object, code: str) -> dict:
    require(isinstance(value, dict), code)
    return value


def instant(value: object, code: str) -> datetime:
    require(isinstance(value, str) and UTC.fullmatch(value) is not None, code)
    try:
        return datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise ContractError(code) from exc


def day(value: object, code: str) -> date:
    require(isinstance(value, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value) is not None, code)
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ContractError(code) from exc


def nonnegative_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        require(key not in result, "DUPLICATE_JSON_KEY")
        result[key] = value
    return result


def _reject_constant(_: str) -> None:
    raise ContractError("NONFINITE_JSON_NUMBER")


def _safe_json(value: object, depth: int = 0) -> None:
    require(depth <= 64, "JSON_NESTING_LIMIT")
    if isinstance(value, str):
        require("\x00" not in value, "JSON_NUL_NOT_SUPPORTED")
        try:
            value.encode("utf-8", errors="strict")
        except UnicodeError as exc:
            raise ContractError("INVALID_UTF8_STRING") from exc
    elif isinstance(value, float):
        require(math.isfinite(value), "NONFINITE_JSON_NUMBER")
    elif isinstance(value, list):
        for item in value:
            _safe_json(item, depth + 1)
    elif isinstance(value, dict):
        for key, item in value.items():
            require(isinstance(key, str), "JSON_OBJECT_KEY_NOT_STRING")
            _safe_json(key, depth + 1)
            _safe_json(item, depth + 1)
    else:
        require(value is None or isinstance(value, (bool, int)), "INVALID_JSON_TYPE")


def load_export(raw: bytes) -> dict:
    require(len(raw) <= MAX_INPUT_BYTES, "INPUT_SIZE_LIMIT")
    try:
        result = json.loads(raw.decode("utf-8", errors="strict"), object_pairs_hook=_unique_object, parse_constant=_reject_constant)
    except (UnicodeError, json.JSONDecodeError, RecursionError) as exc:
        raise ContractError("INVALID_JSON_OR_UTF8") from exc
    _safe_json(result)
    return object_value(result, "EXPORT_OBJECT_REQUIRED")


def validate_export(document: object) -> dict:
    d = object_value(document, "EXPORT_OBJECT_REQUIRED")
    _safe_json(d)
    require(d.get("schema_version") == SCHEMA, "INVALID_EXPORT_SCHEMA")
    require(isinstance(d.get("source_run_id"), str) and RUN.fullmatch(d["source_run_id"]) is not None, "INVALID_SOURCE_RUN_ID")
    require(isinstance(d.get("source_snapshot_sha256"), str) and SHA256.fullmatch(d["source_snapshot_sha256"]) is not None, "INVALID_SOURCE_SNAPSHOT_SHA256")
    source_time = instant(d.get("available_as_of"), "INVALID_EXPORT_TIMESTAMP")
    features = d.get("features")
    require(isinstance(features, list) and len(features) <= 32, "INVALID_FEATURE_BATCH_SIZE")
    event_ids = set()
    for f in features:
        object_value(f, "FEATURE_OBJECT_REQUIRED")
        require(f.get("schema_version") == SCHEMA and f.get("scope") == "PROSPECTIVE_RESEARCH_INPUTS", "INVALID_FEATURE_SCHEMA_OR_SCOPE")
        event = f.get("event_id")
        require(isinstance(event, str) and EVENT.fullmatch(event) is not None and event not in event_ids, "INVALID_OR_DUPLICATE_EVENT_ID")
        event_ids.add(event)
        require("forecast_probability" in f and f["forecast_probability"] is None and f.get("official_pick") is False and f.get("model_promoted") is False, "FORECAST_OR_PROMOTION_NOT_ALLOWED")
        available = instant(f.get("available_as_of"), "INVALID_FEATURE_TIMESTAMP")
        scheduled = instant(f.get("scheduled_at"), "INVALID_SCHEDULED_TIMESTAMP")
        require(available == source_time and available < scheduled, "FEATURE_NOT_PROSPECTIVE_AT_SOURCE")
        local_day = day(f.get("local_date"), "INVALID_LOCAL_DATE")
        require(local_day == scheduled.astimezone(AST).date(), "SCHEDULE_LOCAL_DATE_MISMATCH")
        require(available.astimezone(AST).date() == local_day, "SOURCE_LOCAL_DATE_MISMATCH")
        teams = object_value(f.get("teams"), "FEATURE_TEAMS_REQUIRED")
        coverage = object_value(f.get("coverage"), "FEATURE_COVERAGE_REQUIRED")
        provenance = object_value(f.get("provenance"), "FEATURE_PROVENANCE_REQUIRED")
        for side in ("away", "home"):
            team = object_value(teams.get(side), "FEATURE_TEAM_SIDE_REQUIRED")
            require(isinstance(team.get("abbrev"), str) and TEAM.fullmatch(team["abbrev"]) is not None, "INVALID_TEAM_ABBREVIATION")
            for key in ("season", "last10", "special_teams", "rest", "reported_goalie"):
                object_value(team.get(key), "FEATURE_TEAM_OBJECT_REQUIRED")
            recent = team.get("recent_event_ids")
            require(isinstance(recent, list) and len(recent) <= 10 and all(isinstance(x, str) and EVENT.fullmatch(x) for x in recent), "INVALID_RECENT_EVENT_IDS")
            require(len(set(recent)) == len(recent) and event not in recent, "RECENT_EVENT_ID_DUPLICATE_OR_CURRENT")
            l10 = team["last10"]
            require(nonnegative_int(l10.get("gp")) and l10["gp"] == len(recent), "RECENT_GAME_COUNT_MISMATCH")
            if l10.get("complete") is True:
                require(l10.get("sequence_verified") is True and l10["gp"] == 10, "UNVERIFIED_COMPLETE_L10")
                expected = l10.get("expected_event_ids")
                if expected is not None:
                    require(expected == recent, "EXPECTED_RECENT_SEQUENCE_MISMATCH")
            for value in (team["season"].get("through_date"), l10.get("newest_date"), l10.get("calendar_verified_through")):
                if value is not None:
                    require(day(value, "INVALID_HISTORY_CUTOFF") < local_day, "HISTORY_CUTOFF_NOT_PRIOR_DAY")
            goalie = team["reported_goalie"]
            require(goalie.get("status") in ("CONFIRMADO", "PROBABLE", "NO_CONFIRMADO"), "INVALID_GOALIE_STATUS")
            for value in (team["special_teams"].get("captured_at"), goalie.get("checked_at"), goalie.get("source_time")):
                if value is not None:
                    require(instant(value, "INVALID_TEAM_SOURCE_TIMESTAMP") <= available, "TEAM_SOURCE_AFTER_FEATURE")
        require(teams["away"]["abbrev"] != teams["home"]["abbrev"], "MATCHUP_TEAMS_IDENTICAL")
        if coverage.get("both_last10_complete") is True:
            require(all(teams[s]["last10"].get("complete") is True for s in ("away", "home")), "L10_COVERAGE_MISMATCH")
        if coverage.get("both_goalies_confirmed") is True:
            require(all(teams[s]["reported_goalie"]["status"] == "CONFIRMADO" for s in ("away", "home")), "GOALIE_COVERAGE_MISMATCH")
        for key in ("standings_captured_at", "goalies_as_of", "markets_captured_at", "special_teams_captured_at", "archived_boxscores_last_capture", "slate_captured_at", "publication_at"):
            if provenance.get(key) is not None:
                require(instant(provenance[key], "INVALID_PROVENANCE_TIMESTAMP") <= available, "PROVENANCE_AFTER_FEATURE")
        require(provenance.get("slate_verified") is True, "UNVERIFIED_SLATE")
        encoded = json.dumps(f, ensure_ascii=False, allow_nan=False, separators=(", ", ": ")).encode("utf-8")
        require(len(encoded) <= MAX_FEATURE_BYTES, "FEATURE_SIZE_LIMIT")
    return d


def _text_sql(value: str) -> str:
    encoded = base64.b64encode(value.encode("utf-8", errors="strict")).decode("ascii")
    require(re.fullmatch(r"[A-Za-z0-9+/]*={0,2}", encoded) is not None, "BASE64_ENCODING_FAILED")
    return "convert_from(decode('" + encoded + "','base64'),'UTF8')"


def render_sql(document: object, *, readback: bool = False) -> str:
    d = validate_export(document)
    run = _text_sql(d["source_run_id"])
    snapshot = _text_sql(d["source_snapshot_sha256"])
    if readback:
        sql = (
            "SELECT event_id, available_as_of, inserted_at, scheduled_at, source_run_id, source_snapshot_sha256,\n"
            "       feature_payload->>'available_as_of' AS source_available_as_of,\n"
            "       feature_payload->>'official_pick' AS official_pick,\n"
            "       feature_payload->>'model_promoted' AS model_promoted\n"
            "FROM public.nhl_manual_feature_snapshots_v1\n"
            f"WHERE source_run_id = {run}\n"
            f"  AND source_snapshot_sha256 = {snapshot}\n"
            "ORDER BY event_id, available_as_of;"
        )
    else:
        payload = _text_sql(json.dumps(d["features"], ensure_ascii=False, allow_nan=False, separators=(",", ":")))
        sql = (
            "SELECT * FROM public.append_nhl_manual_feature_snapshots_v1(\n"
            f"  {run},\n  {snapshot},\n  {payload}::jsonb\n"
            ") ORDER BY event_id;"
        )
    require(len(sql.encode("utf-8")) <= MAX_SQL_BYTES, "SQL_SIZE_LIMIT_SPLIT_FEATURE_BATCH")
    return sql


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Path to JSON from /api/features, or '-' for stdin")
    parser.add_argument("--readback", action="store_true", help="Print a bounded receipt readback SELECT instead of the append SELECT")
    args = parser.parse_args(argv)
    try:
        if args.input == "-":
            raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        else:
            with Path(args.input).open("rb") as handle:
                raw = handle.read(MAX_INPUT_BYTES + 1)
        sql = render_sql(load_export(raw), readback=args.readback)
    except (ContractError, OSError, UnicodeError) as exc:
        print(f"NHL_MANUAL_FEATURE_SQL_ERROR: {exc}", file=sys.stderr)
        return 2
    sys.stdout.write(sql + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
