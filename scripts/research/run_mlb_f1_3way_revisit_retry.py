#!/usr/bin/env python3
import importlib.util
from pathlib import Path

trainer=Path("scripts/research/train_mlb_f1_3way_revisit_v1.py")
spec=importlib.util.spec_from_file_location("f1_3way_trainer",trainer)
mod=importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(mod)
mod.EDGE_URL="https://ynuocvexviorgdjrfthw.supabase.co/functions/v1/mlb-f1-3way-run-read-v1"
mod.main()
