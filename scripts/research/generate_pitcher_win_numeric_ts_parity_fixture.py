#!/usr/bin/env python3
import importlib.util
import json
import math
import random
from pathlib import Path

FEATURE_COUNT=29
ROWS=120
SEED=20260919

def load_module(path:Path,name:str):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod

m0=load_module(Path("python_models/pitcher_win_forward_numeric_model_0.py"),"pw0")
m1=load_module(Path("python_models/pitcher_win_forward_numeric_model_1.py"),"pw1")

rng=random.Random(SEED)
rows=[]
for i in range(ROWS):
    x=[]
    for j in range(FEATURE_COUNT):
        if j in (0,2):
            v=float(rng.randint(0,1))
        elif j==1:
            v=float(rng.choice([1,1,1,2]))
        elif j in (3,4):
            v=float(rng.randint(0,160))
        elif j in (5,6,9,10,13,14,19,20,25,28):
            v=rng.random()
        elif j in (7,8,15,16,21,22):
            v=rng.uniform(-6,6)
        elif j in (11,12):
            v=float(rng.randint(0,5))
        elif j in (17,18):
            v=float(rng.randint(0,10))
        elif j in (23,24):
            v=float(rng.randint(0,5))
        elif j in (26,27):
            v=float(rng.randint(0,35))
        else:
            v=rng.uniform(-2,2)
        if j in (5,6,7,8,9,10,13,14,15,16,19,20,21,22,23,24,25,28) and rng.random()<0.08:
            v=float("nan")
        x.append(v)
    raw0=float(m0.apply_catboost_model(x))
    raw1=float(m1.apply_catboost_model(x))
    p0=1/(1+math.exp(-raw0))
    p1=1/(1+math.exp(-raw1))
    rows.append({
      "features":[None if math.isnan(v) else v for v in x],
      "raw0":raw0,"raw1":raw1,"p0":p0,"p1":p1,"ensemble":(p0+p1)/2
    })

Path("artifacts/research").mkdir(parents=True,exist_ok=True)
Path("artifacts/research/mlb_pitcher_win_forward_numeric_ts_parity_fixture.json").write_text(
  json.dumps({"contract":"MLB_PITCHER_WIN_NUMERIC_TS_PARITY_FIXTURE/1.0.0","rows":rows},indent=2)+"\n"
)
print(json.dumps({"rows":len(rows)}))
