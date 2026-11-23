"""Focused contract and SQL-injection tests for the offline NHL export renderer."""
import base64
import copy
import importlib.util
import json
import pathlib
import re
import subprocess
import sys
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "nhl-manual-feature-sql.py"
SPEC = importlib.util.spec_from_file_location("nhl_feature_renderer", SCRIPT)
RENDERER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RENDERER)


def export_fixture():
    def team(abbrev):
        return {
            "abbrev": abbrev,
            "season": {"through_date": "2026-11-22"},
            "last10": {"gp": 1, "complete": False, "sequence_verified": False, "newest_date": "2026-11-22"},
            "recent_event_ids": ["nhl:2026020370"],
            "special_teams": {"captured_at": "2026-11-23T18:07:30Z"},
            "rest": {},
            "reported_goalie": {"status": "NO_CONFIRMADO", "checked_at": None},
        }
    feature = {
        "schema_version": RENDERER.SCHEMA,
        "event_id": "nhl:2026020378",
        "scheduled_at": "2026-11-24T00:00:00.000Z",
        "available_as_of": "2026-11-23T21:07:51.184Z",
        "local_date": "2026-11-23",
        "scope": "PROSPECTIVE_RESEARCH_INPUTS",
        "forecast_probability": None,
        "official_pick": False,
        "model_promoted": False,
        "teams": {"away": team("CBJ"), "home": team("NJD")},
        "coverage": {"both_last10_complete": False, "both_goalies_confirmed": False},
        "provenance": {"slate_verified": True, "publication_at": "2026-11-23T21:07:51.184Z"},
    }
    return {
        "schema_version": RENDERER.SCHEMA,
        "available_as_of": feature["available_as_of"],
        "source_snapshot_sha256": "a" * 64,
        "source_run_id": "NHL-test-run_20261123.1",
        "features": [feature],
    }


class RendererTests(unittest.TestCase):
    def test_roundtrip_sql_arguments_are_base64_and_preserve_unicode(self):
        document = export_fixture()
        document["features"][0]["note"] = "Montréal; '; DROP TABLE anything; -- \\ $() `echo nope`"
        sql = RENDERER.render_sql(document)
        args = re.findall(r"decode\('([A-Za-z0-9+/=]*)','base64'\)", sql)
        self.assertEqual(len(args), 3)
        decoded = [base64.b64decode(a).decode("utf-8") for a in args]
        self.assertEqual(decoded[:2], [document["source_run_id"], document["source_snapshot_sha256"]])
        self.assertEqual(json.loads(decoded[2]), document["features"])
        self.assertNotIn("DROP TABLE", sql)
        self.assertEqual(sql.count(";"), 1)
        self.assertTrue(sql.startswith("SELECT * FROM public.append_nhl_manual_feature_snapshots_v1("))

    def test_readback_has_only_safe_identity_arguments(self):
        sql = RENDERER.render_sql(export_fixture(), readback=True)
        self.assertIn("FROM public.nhl_manual_feature_snapshots_v1", sql)
        self.assertNotIn("append_nhl", sql)
        self.assertEqual(len(re.findall(r"decode\('", sql)), 2)
        self.assertEqual(sql.count(";"), 1)

    def test_empty_batch_is_valid_and_does_not_invent_events(self):
        d = export_fixture(); d["features"] = []
        sql = RENDERER.render_sql(d)
        encoded = re.findall(r"decode\('([A-Za-z0-9+/=]*)','base64'\)", sql)[2]
        self.assertEqual(json.loads(base64.b64decode(encoded)), [])

    def test_invalid_run_hash_and_duplicate_events_rejected(self):
        for key, value in (("source_run_id", "x'); SELECT pg_sleep(1); --"), ("source_snapshot_sha256", "z" * 64)):
            with self.subTest(key=key):
                d = export_fixture(); d[key] = value
                with self.assertRaises(RENDERER.ContractError): RENDERER.render_sql(d)
        d = export_fixture(); d["features"].append(copy.deepcopy(d["features"][0]))
        with self.assertRaisesRegex(RENDERER.ContractError, "DUPLICATE_EVENT"): RENDERER.render_sql(d)

    def test_flags_require_exact_false_and_null(self):
        for key, value in (("official_pick", True), ("official_pick", 0), ("model_promoted", 0), ("forecast_probability", 0.6)):
            with self.subTest(key=key, value=value):
                d = export_fixture(); d["features"][0][key] = value
                with self.assertRaisesRegex(RENDERER.ContractError, "FORECAST_OR_PROMOTION"): RENDERER.render_sql(d)
        d = export_fixture(); del d["features"][0]["forecast_probability"]
        with self.assertRaises(RENDERER.ContractError): RENDERER.render_sql(d)

    def test_identity_and_chronology_rejected(self):
        changes = [
            lambda f: f.update(scheduled_at=f["available_as_of"]),
            lambda f: f.update(local_date="2026-11-24"),
            lambda f: f.update(available_as_of="2026-11-23T21:07:52Z"),
            lambda f: f["teams"]["home"].update(abbrev="CBJ"),
            lambda f: f["teams"]["home"]["recent_event_ids"].append(f["event_id"]),
            lambda f: f["provenance"].update(markets_captured_at="2026-11-23T23:00:00Z"),
            lambda f: f["teams"]["away"]["reported_goalie"].update(checked_at="2026-11-23T23:00:00Z"),
        ]
        for change in changes:
            with self.subTest(change=changes.index(change)):
                d = export_fixture(); change(d["features"][0])
                with self.assertRaises(RENDERER.ContractError): RENDERER.render_sql(d)

    def test_coverage_cannot_promote_missing_history_or_goalies(self):
        for flag in ("both_last10_complete", "both_goalies_confirmed"):
            d = export_fixture(); d["features"][0]["coverage"][flag] = True
            with self.assertRaises(RENDERER.ContractError): RENDERER.render_sql(d)
        d = export_fixture(); d["features"][0]["teams"]["away"]["last10"].update(complete=True)
        with self.assertRaisesRegex(RENDERER.ContractError, "UNVERIFIED_COMPLETE_L10"): RENDERER.render_sql(d)

    def test_nonfinite_duplicate_keys_and_nul_are_rejected(self):
        for raw in (b'{"same":1,"same":2}', b'{"number":NaN}', b'{"number":1e999}', b'{"text":"\\u0000"}', b'{"text":"\\ud800"}'):
            with self.subTest(raw=raw):
                with self.assertRaises(RENDERER.ContractError): RENDERER.load_export(raw)

    def test_size_limits(self):
        d = export_fixture(); d["features"][0]["note"] = "x" * RENDERER.MAX_FEATURE_BYTES
        with self.assertRaisesRegex(RENDERER.ContractError, "FEATURE_SIZE_LIMIT"): RENDERER.render_sql(d)
        d = export_fixture(); prototype = d["features"][0]; prototype["note"] = "x" * 46_000
        d["features"] = []
        for index in range(32):
            item = copy.deepcopy(prototype); item["event_id"] = "nhl:" + str(2026020500 + index); d["features"].append(item)
        with self.assertRaisesRegex(RENDERER.ContractError, "SQL_SIZE_LIMIT"): RENDERER.render_sql(d)

    def test_cli_stdin_prints_one_statement_or_no_sql_on_error(self):
        completed = subprocess.run([sys.executable, str(SCRIPT), "-"], input=json.dumps(export_fixture()), capture_output=True, text=True, check=False)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(completed.stdout.count(";"), 1)
        failed = subprocess.run([sys.executable, str(SCRIPT), "-"], input='{"schema_version":"wrong"}', capture_output=True, text=True, check=False)
        self.assertEqual(failed.returncode, 2)
        self.assertEqual(failed.stdout, "")
        self.assertIn("NHL_MANUAL_FEATURE_SQL_ERROR", failed.stderr)


if __name__ == "__main__":
    unittest.main()
