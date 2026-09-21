import songs from '../data/songs.json'
import type { RawSave } from './save'

export const LEVELS = ['EZ', 'HD', 'IN', 'AT'] as const

export interface ScoredChart {
  songId: string
  name: string
  level: number
  constant: number
  score: number
  acc: number
  fc: boolean
  rks: number
  /** true for the chart that fills the phi slot (counted 3x) */
  phi?: boolean
}

export interface Best {
  rks: number
  phi: ScoredChart | null
  best: ScoredChart[]
}

/** Single chart rks: 0 below 70% acc, otherwise ((acc-55)/45)^2 * constant. */
export function chartRks(acc: number, constant: number) {
  if (acc < 70) return 0
  return ((acc - 55) / 45) ** 2 * constant
}

export function computeBest(save: RawSave): Best {
  const table = songs as Record<string, { name: string; chart: (number | null)[] }>
  const scored: ScoredChart[] = []

  for (const rec of save.records) {
    const song = table[rec.songId]
    const constant = song?.chart[rec.level]
    if (constant == null) continue
    scored.push({
      songId: rec.songId,
      name: song.name,
      level: rec.level,
      constant,
      score: rec.score,
      acc: rec.acc,
      fc: rec.fc,
      rks: chartRks(rec.acc, constant),
    })
  }

  scored.sort((a, b) => b.rks - a.rks)

  // The phi slot is the highest-constant chart played at exactly 100% acc.
  let phi: ScoredChart | null = null
  for (const c of scored) {
    if (c.acc >= 100 && (!phi || c.constant > phi.constant)) phi = c
  }
  if (phi) phi = { ...phi, phi: true }

  const top27 = scored.slice(0, 27)
  const rks =
    (top27.reduce((s, c) => s + c.rks, 0) + 3 * (phi?.rks ?? 0)) / 30

  return { rks, phi, best: scored }
}
