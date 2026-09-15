from pathlib import Path

path = Path('src/services/pa14-v2-real-evidence.service.ts')
text = path.read_text()

old = """  const unfinished = unfinishedAtBatsFromRows(opponentStatcastRaw)
  const witnessEvidence = await verifyUnfinishedWitnesses(unfinished)
  const allSourceGamePks = [...new Set([...startGamePks, ...opponentGamePks])]
"""
new = """  const unfinished = unfinishedAtBatsFromRows(opponentStatcastRaw)
  const witnessEvidence = await verifyUnfinishedWitnesses(unfinished)
  const pitcherUnfinished = unfinishedAtBatsFromRows(pitcherStatcastRaw)
  const pitcherWitnessEvidence = await verifyUnfinishedWitnesses(pitcherUnfinished)
  const allSourceGamePks = [...new Set([...startGamePks, ...opponentGamePks])]
"""
assert text.count(old) == 1, text.count(old)
text = text.replace(old, new)

old = """    const pitchDigest = canonicalDigest(pitches)
    const boxDigest = canonicalDigest(official.raw)
"""
new = """    const unfinishedPaAtBatNumbers = pitcherUnfinished.get(official.gamePk) ?? []
    const witnesses = pitcherWitnessEvidence.get(official.gamePk) ?? []
    const pitchDigest = canonicalDigest(pitches)
    const boxDigest = canonicalDigest(official.raw)
"""
assert text.count(old) == 1, text.count(old)
text = text.replace(old, new)

old = """      pitches,
      terminalOnlyPas: [],
      unfinishedPaAtBatNumbers: [],
      dependencies: [
"""
new = """      pitches,
      terminalOnlyPas: [],
      unfinishedPaAtBatNumbers,
      dependencies: [
"""
assert text.count(old) == 1, text.count(old)
text = text.replace(old, new)

old = """        dependency('TERMINAL', official.gamePk, TARGET_PITCHER_ID, SOURCE_STATCAST, complete.completedBy, terminalDigest(pitches, [], [])),
"""
new = """        dependency('TERMINAL', official.gamePk, TARGET_PITCHER_ID, SOURCE_STATCAST, complete.completedBy, terminalDigest(pitches, [], unfinishedPaAtBatNumbers, witnesses)),
"""
assert text.count(old) == 1, text.count(old)
text = text.replace(old, new)

path.write_text(text)
