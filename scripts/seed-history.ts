/**
 * 一次性引导：从 phi-plugin 的 API 拉取既有历史记录，写入 data/history-seed.json。
 *
 * Phigros 存档本身不记录每个谱面的游玩时间，历史只能靠逐日 diff 累积。
 * 如果你以前用过 phi-plugin / phib19.top，这个脚本能把已有的历史一次性导入，
 * 之后的日常渲染完全本地累加，不再访问该 API。
 *
 *   npm run seed-history
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { SaveHistory } from '../src/history'

if (existsSync('.env')) process.loadEnvFile('.env')

const API = 'https://phib19.top:8080'
const token = process.env.PHIGROS_SESSION_TOKEN
if (!token) throw new Error('缺少环境变量 PHIGROS_SESSION_TOKEN')

const res = await fetch(`${API}/get/history/history`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
  signal: AbortSignal.timeout(60000),
})
if (!res.ok) throw new Error(`phi-api -> ${res.status}`)
const json = (await res.json()) as any
if (!json.data) throw new Error(`返回异常: ${JSON.stringify(json).slice(0, 200)}`)

const history: SaveHistory = {
  scoreHistory: json.data.scoreHistory ?? {},
  rks: json.data.rks ?? [],
  data: json.data.data ?? [],
  challengeModeRank: json.data.challengeModeRank ?? [],
}

const entries = Object.values(history.scoreHistory).reduce(
  (n, levels) => n + Object.values(levels).reduce((m, a) => m + (a?.length ?? 0), 0),
  0
)

mkdirSync('data', { recursive: true })
const out = path.resolve('data/history-seed.json')
writeFileSync(out, JSON.stringify(history) + '\n')
console.log(
  `已写入 ${out}\n  曲目 ${Object.keys(history.scoreHistory).length} 个，成绩 ${entries} 条，rks 采样 ${history.rks.length} 个`
)
