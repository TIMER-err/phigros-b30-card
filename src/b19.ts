import type { Info } from './info'
import type { ChartRecord, LevelName, RawSave } from './save'

export type Rating = 'phi' | 'FC' | 'NEW' | 'F' | 'C' | 'B' | 'A' | 'S' | 'V'

export interface SongEntry {
  id: string
  song: string
  rank: LevelName
  difficulty: number
  score: number
  acc: number
  fc: boolean
  rks: number
  Rating: Rating
  illustration: string
  num?: number
  suggest?: string
  suggestType?: number
}

/** Equivalent single-chart rks. */
const rksOf = (acc: number, difficulty: number) =>
  acc < 70 ? 0 : ((acc - 55) / 45) ** 2 * difficulty

function ratingOf(score: number, fc: boolean): Rating {
  if (score >= 1000000) return 'phi'
  if (fc) return 'FC'
  if (!score) return 'NEW'
  if (score < 700000) return 'F'
  if (score < 820000) return 'C'
  if (score < 880000) return 'B'
  if (score < 920000) return 'A'
  if (score < 960000) return 'S'
  return 'V'
}

/** Acc needed on `difficulty` to reach `rks`; -1 when unreachable. */
function suggestAcc(rks: number, difficulty: number) {
  const ans = 45 * Math.sqrt(rks / difficulty) + 55
  return ans >= 100 ? -1 : ans
}

function suggestTypeOf(suggest: number) {
  if (suggest < 98.5) return 0
  if (suggest < 99) return 1
  if (suggest < 99.5) return 2
  if (suggest < 99.7) return 3
  if (suggest < 99.85) return 4
  return 5
}

function toEntry(rec: ChartRecord, info: Info): SongEntry | null {
  const song = info.songs.get(rec.songId)
  const difficulty = song?.chart[rec.rank]
  if (!song || !difficulty) return null
  return {
    id: rec.songId,
    song: song.song,
    rank: rec.rank,
    difficulty,
    score: rec.score,
    acc: rec.acc,
    fc: rec.fc,
    rks: rksOf(rec.acc, difficulty),
    Rating: ratingOf(rec.score, rec.fc),
    illustration: info.ill(rec.songId),
  }
}

export interface B19 {
  phi: (SongEntry | undefined)[]
  b19_list: SongEntry[]
  com_rks: number
}

/** Mirrors phi-plugin's `Save.getB19` without the API-backed acc averages. */
export function buildB19(save: RawSave, info: Info, num = 33): B19 {
  const all = save.records
    .filter((r) => r.rank !== 'LEGACY' && r.score)
    .map((r) => toEntry(r, info))
    .filter((e): e is SongEntry => e !== null)
    .sort((a, b) => b.rks - a.rks)

  const phi: (SongEntry | undefined)[] = []
  const philist = all.filter((e) => e.acc >= 100)
  let sumRks = 0
  for (let i = 0; i < 3; i++) {
    const x = philist[i]
    if (!x?.rks) continue
    phi[i] = { ...x, suggest: '无法推分' }
    sumRks += x.rks
  }

  const userRks = save.summary.rankingScore
  let minUpRks = Math.floor(userRks * 100) / 100 + 0.005 - userRks
  if (minUpRks < 0) minUpRks += 0.01

  const b19_list: SongEntry[] = []
  for (let i = 0; i < num && i < all.length; i++) {
    const x = { ...all[i], num: i + 1 }
    if (i < 27) sumRks += x.rks
    if (x.acc < 100) {
      const base = (i < 26 ? all[i].rks : all[26].rks) + minUpRks * 30
      let s = suggestAcc(base, x.difficulty)
      if (s === -1 && (!phi[0] || x.rks > (phi[phi.length - 1]?.rks ?? 0))) s = 100
      if (s === -1) {
        x.suggest = '无法推分'
      } else {
        x.suggest = s.toFixed(2) + '%'
        x.suggestType = suggestTypeOf(s)
      }
    } else {
      x.suggest = '无法推分'
    }
    b19_list.push(x)
  }

  return { phi, b19_list, com_rks: sumRks / 30 }
}

export function buildStats(save: RawSave) {
  const titles: LevelName[] = ['EZ', 'HD', 'IN', 'AT']
  return titles.map((title, i) => ({
    title,
    cleared: save.summary.cleared[i],
    fc: save.summary.fullCombo[i],
    phi: save.summary.phi[i],
  }))
}
