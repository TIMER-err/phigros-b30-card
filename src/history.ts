import type { LevelName } from './save'

const API = 'https://phib19.top:8080'

/** `[acc, score, isoDate, fullCombo]` as stored by phi-plugin. */
export type ScoreEntry = [string, number, string, boolean]

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
}

/**
 * Phigros' save carries no per-chart timestamps, so the played-on dates come
 * from phi-plugin's API (the same history the phib19.top web app shows).
 * Authenticates with the Phigros sessionToken; no bot credentials needed.
 */
export async function fetchHistory(sessionToken: string): Promise<SaveHistory> {
  const res = await fetch(`${API}/get/history/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: sessionToken }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`phi-api /get/history/history -> ${res.status}`)
  const json = (await res.json()) as any
  if (!json.data) throw new Error(`phi-api 返回异常: ${JSON.stringify(json).slice(0, 200)}`)
  return {
    scoreHistory: json.data.scoreHistory ?? {},
    rks: json.data.rks ?? [],
    data: json.data.data ?? [],
    challengeModeRank: json.data.challengeModeRank ?? [],
  }
}
