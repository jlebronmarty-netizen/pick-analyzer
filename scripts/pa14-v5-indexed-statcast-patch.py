from pathlib import Path

path = Path('src/services/pa14-v2-real-evidence.service.ts')
text = path.read_text()

anchor = """const RUNNER_WITNESS_EVENT = /(?:caught_stealing|pickoff)/

const OFFICIAL_DESCRIPTION_MAP = new Map<string, string>(["""
replacement = """const RUNNER_WITNESS_EVENT = /(?:caught_stealing|pickoff)/

const OFFICIAL_TYPE_BY_DESCRIPTION = new Map<string, 'S' | 'B' | 'X'>([
  ['called_strike', 'S'],
  ['swinging_strike', 'S'],
  ['swinging_strike_blocked', 'S'],
  ['foul', 'S'],
  ['foul_tip', 'S'],
  ['foul_bunt', 'S'],
  ['missed_bunt', 'S'],
  ['bunt_foul_tip', 'S'],
  ['swinging_pitchout', 'S'],
  ['foul_pitchout', 'S'],
  ['automatic_strike', 'S'],
  ['ball', 'B'],
  ['blocked_ball', 'B'],
  ['pitchout', 'B'],
  ['hit_by_pitch', 'B'],
  ['intentional_ball', 'B'],
  ['automatic_ball', 'B'],
  ['hit_into_play', 'X'],
  ['hit_into_play_no_out', 'X'],
  ['hit_into_play_score', 'X'],
])

const OFFICIAL_DESCRIPTION_MAP = new Map<string, string>(["""
assert text.count(anchor) == 1, text.count(anchor)
text = text.replace(anchor, replacement)

old = """      const description = normalizeOfficialDescription(event?.details?.description)
      const type = String(event?.details?.code ?? '')
      if (!['S', 'B', 'X'].includes(type)) throw new Error(`SOURCE_VOCABULARY_INVALID: ${gamePk}/${atBatNumber} code ${type}`)
"""
new = """      const description = normalizeOfficialDescription(event?.details?.description)
      const type = OFFICIAL_TYPE_BY_DESCRIPTION.get(description)
      if (!type) throw new Error(`SOURCE_VOCABULARY_INVALID: ${gamePk}/${atBatNumber} description ${description}`)
"""
assert text.count(old) == 1, text.count(old)
text = text.replace(old, new)
path.write_text(text)
