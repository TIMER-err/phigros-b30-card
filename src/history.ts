import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { LevelName, RawSave } from './save'

/**
 * `[acc, score, isoDate, fullCombo]`, phi-plugin's on-disk shape.
 * A 5th `true` marks a baseline entry: the score was already there when history
 * started, so its real play date is unknown and it must not be shown as a change.
 */
export type ScoreEntry = [string, number, string, boolean, true?]

export type ScoreHistory = Record<string, Partial<Record<LevelName, ScoreEntry[]>>>

export interface TimedValue<T> {
  date: string
  value: T
}

export interface SaveHistory {
  scoreHistory: ScoreHistory
  rks: TimedValue<number>[]
  data: TimedValue<number[]>[]
  challengeModeRank: TimedValue<number>[]
  /** Set once the first save has been folded in; later merges are real changes. */
  seeded?: boolean
}

const empty = (): SaveHistory => ({
  scoreHistory: {},
  rks: [],
  data: [],
  challengeModeRank: [],
})

/** Reads the accumulated history, falling back to the one-time API seed. */
export function loadHistory(file: string, seedFile?: string): SaveHistory {
  for (const f of [file, seedFile]) {
    if (!f || !existsSync(f)) continue
    try {
      return { ...empty(), ...JSON.parse(readFileSync(f, 'utf8')) }
    } catch (e) {
      console.warn(`历史文件损坏，忽略 ${f}: ${(e as Error).message}`)
    }
  }
  return empty()
}

export function writeHistory(file: string, history: SaveHistory) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(history) + '\n')
}

function appendSample<T>(
  series: TimedValue<T>[],
  date: string,
  value: T,
  same: (a: T, b: T) => boolean
) {
  const last = series[series.length - 1]
  if (last && same(last.value, value)) return false
  if (last && new Date(last.date).getTime() >= new Date(date).getTime()) return false
  series.push({ date, value })
  return true
}

/**
 * Folds a freshly fetched save into the history, dating every change with the
 * save's own `modifiedAt`. Idempotent: re-running on the same save is a no-op.
 */
export function mergeSave(history: SaveHistory, save: RawSave) {
  const date = save.updatedAt
  const at = new Date(date).getTime()
  const baseline = !history.seeded
  history.seeded = true
  let added = 0

  for (const rec of save.records) {
    const key = `${rec.songId}.0`
    const levels = (history.scoreHistory[key] ??= {})
    const entries = (levels[rec.rank] ??= [])
    const last = entries[entries.length - 1]
    const acc = rec.acc.toFixed(4)

    // Stored acc strings are not consistently zero-padded, so compare numerically.
    if (last && Number(last[0]) === Number(acc) && last[1] === rec.score) continue
    // An older save (e.g. a restored backup) must not rewrite newer history.
    if (last && new Date(last[2]).getTime() >= at) continue

    entries.push(baseline ? [acc, rec.score, date, rec.fc, true] : [acc, rec.score, date, rec.fc])
    added++
  }

  appendSample(history.rks, date, save.summary.rankingScore, (a, b) => a === b)
  appendSample(history.challengeModeRank, date, save.summary.challengeModeRank, (a, b) => a === b)
  appendSample(history.data, date, save.money, (a, b) => a.join() === b.join())

  return added
}
