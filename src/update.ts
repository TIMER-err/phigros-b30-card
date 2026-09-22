import type { SaveHistory, ScoreEntry } from './history'
import type { Info } from './info'
import { ALL_LEVELS, type LevelName } from './save'
import type { Rating } from './b19'

/** Matches phi-plugin's default HistoryDayNum / HistoryScoreDate / HistoryScoreNum. */
export interface UpdateLimits {
  perDay: number
  days: number
  total: number
}

export const DEFAULT_LIMITS: UpdateLimits = { perDay: 10, days: 10, total: 50 }

interface SongCell {
  song: string
  rank: LevelName
  illustration: string
  Rating: Rating
  rks_new?: number
  acc_new: number
  score_new: number
}

interface Box {
  date?: string
  color: string
  song: SongCell[]
  width?: number
  update_num?: number
}

function rate(score: number, fc: boolean): Rating {
  if (score === 1000000) return 'phi'
  if (fc) return 'FC'
  if (score >= 960000) return 'V'
  if (score >= 920000) return 'S'
  if (score >= 880000) return 'A'
  if (score >= 820000) return 'B'
  if (score >= 700000) return 'C'
  if (score > 0) return 'F'
  return 'NEW'
}

const rksOf = (acc: number, difficulty: number) =>
  acc < 70 ? 0 : ((acc - 55) / 45) ** 2 * difficulty

/** Deterministic per-date colour so the card stays stable across renders. */
function dateColor(date: string) {
  let h = 0
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const part = (shift: number) =>
    ((h >> shift) & 0xff) % 201 // phi-plugin caps each channel at 200
  return (
    '#' +
    [part(0), part(8), part(16)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  )
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** Normalises a value into 0..100 for the SVG polyline, like fCompute.range. */
function range(value: number, [lo, hi]: [number, number]) {
  if (lo === hi) return 50
  return Math.abs(((value - lo) / (hi - lo)) * 100)
}

export function buildRksLine(rks: SaveHistory['rks']) {
  if (!rks.length) return { rks_history: [], rks_range: [0, 0], rks_date: ['', ''] }

  const points: { date: number; value: number }[] = []
  const bounds: [number, number] = [Infinity, 0]
  const span: [number, number] = [new Date(rks[0].date).getTime(), 0]

  rks.forEach((item, i) => {
    const date = new Date(item.date).getTime()
    // Collapse runs of identical rks into a single segment.
    if (i <= 1 || item.value !== points[points.length - 2]?.value) {
      points.push({ date, value: item.value })
      bounds[0] = Math.min(bounds[0], item.value)
      bounds[1] = Math.max(bounds[1], item.value)
    } else {
      points[points.length - 1].date = date
    }
    span[1] = date
  })

  const rks_history: number[][] = []
  for (let i = 0; i < points.length - 1; i++) {
    rks_history.push([
      range(points[i].date, span),
      range(points[i].value, bounds),
      range(points[i + 1].date, span),
      range(points[i + 1].value, bounds),
    ])
  }
  if (!rks_history.length) rks_history.push([0, 50, 100, 50])

  return {
    rks_history,
    rks_range: bounds,
    rks_date: [fmtDate(new Date(span[0]).toISOString()), fmtDate(new Date(span[1]).toISOString())],
  }
}

/** Groups the score history by play date and packs it into the template's row layout. */
export function buildBoxLine(
  history: SaveHistory,
  info: Info,
  limits: UpdateLimits = DEFAULT_LIMITS
) {
  const byDate = new Map<string, { date: string; color: string; update_num: number; song: SongCell[] }>()

  for (const [rawId, levels] of Object.entries(history.scoreHistory)) {
    const songId = rawId.endsWith('.0') ? rawId.slice(0, -2) : rawId
    const song = info.songs.get(songId)
    for (const level of ALL_LEVELS) {
      const entries = levels[level] as ScoreEntry[] | undefined
      if (!entries) continue
      for (const [acc, score, iso, fc, isBaseline] of entries) {
        if (isBaseline) continue // play date unknown, not a change
        const key = fmtDate(iso)
        let group = byDate.get(key)
        if (!group) {
          group = { date: key, color: dateColor(key), update_num: 0, song: [] }
          byDate.set(key, group)
        }
        group.update_num++
        const difficulty = song?.chart[level]
        group.song.push({
          song: song?.song ?? songId,
          rank: level,
          illustration: info.ill(songId),
          Rating: rate(score, fc),
          rks_new: difficulty ? rksOf(Number(acc), difficulty) : undefined,
          acc_new: Number(acc),
          score_new: score,
        })
      }
    }
  }

  const groups = [...byDate.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  let shown = 0
  const kept: typeof groups = []
  for (const group of groups) {
    if (
      kept.length >= limits.days ||
      limits.total < shown + Math.min(limits.perDay, group.update_num)
    ) {
      break
    }
    group.song.sort((a, b) => (b.rks_new ?? 0) - (a.rks_new ?? 0))
    group.song = group.song.slice(0, Math.min(limits.perDay, limits.total - shown))
    shown += group.song.length
    kept.push(group)
  }

  // Pack boxes into rows of 5 cells; a day spilling over continues unlabelled.
  const box_line: Box[][] = []
  const width = (n: number) => n * 135 + 20 * n - 20
  let lineNum = 5
  let continued = false

  while (kept.length) {
    const group = kept[0]
    let row: Box[]
    if (lineNum === 5) {
      row = []
      box_line.push(row)
    } else {
      row = box_line[box_line.length - 1]
    }
    const take = lineNum === 5 ? 5 : 5 - lineNum
    const box: Box = {
      ...(continued ? {} : { date: group.date }),
      color: group.color,
      song: group.song.splice(0, take),
    }
    row.push(box)
    lineNum = lineNum === 5 ? box.song.length : lineNum + box.song.length
    box.width = width(box.song.length)
    continued = true
    if (!group.song.length) {
      box.update_num = group.update_num
      kept.shift()
      continued = false
    }
  }

  return box_line
}
