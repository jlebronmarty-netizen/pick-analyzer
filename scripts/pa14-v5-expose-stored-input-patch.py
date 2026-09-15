from pathlib import Path

p = Path('src/services/pa14-v2-real-evidence.service.ts')
s = p.read_text()

old = """  const first = buildPePitcherKV2Row(input)
  const second = buildPePitcherKV2Row(input)
  const replayMatch = pa14V2CanonicalJson(first) === pa14V2CanonicalJson(second)
"""
new = """  const inputDigest = pa14V2Sha256(pa14V2CanonicalJson(input))
  const first = buildPePitcherKV2Row(input)
  const second = buildPePitcherKV2Row(input)
  const replayMatch = pa14V2CanonicalJson(first) === pa14V2CanonicalJson(second)
"""
assert s.count(old) == 1, f'input digest insertion count={s.count(old)}'
s = s.replace(old, new)

old = """    result: first,
    replayMatch,
"""
new = """    result: first,
    storedInput: input,
    inputDigest,
    replayMatch,
"""
assert s.count(old) == 1, f'return insertion count={s.count(old)}'
s = s.replace(old, new)

p.write_text(s)
