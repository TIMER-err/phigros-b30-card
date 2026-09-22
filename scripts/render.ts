/**
 * Renders the Phigros cards and writes them next to a meta.json describing the
 * save they were built from. Skips rendering when nothing changed.
 *
 * Env:
 *   PHIGROS_SESSION_TOKEN  required
 *   PHIGROS_REGION         cn | intl          (default cn)
 *   PHI_PLUGIN_ROOT        phi-plugin checkout (default vendor/phi-plugin)
 *   OUT_DIR                output directory    (default output)
 *   ILL_CACHE              illustration cache  (default .cache/ill)
 *   B30_NUM                charts to list      (default 33)
 *   IMG_TYPE               jpeg | png          (default jpeg)
 *   THEME                  star | snow | none  (default star)
 *   UPDATE_CARD            0 to skip the score-history card
 *   WIDE_CARD              0 to skip the landscape card
 *   WIDE_NUM               charts on the landscape card (default 12)
 *   FORCE                  set to 1 to re-render even when unchanged
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fetchSave, type Region } from '../src/save'
import { Info } from '../src/info'
import { buildB19, buildStats } from '../src/b19'
import { IllCache } from '../src/ill'
import { renderTemplate } from '../src/render'
import { loadHistory, mergeSave, writeHistory } from '../src/history'
import { buildBoxLine, buildRksLine } from '../src/update'

if (existsSync('.env')) process.loadEnvFile('.env')

const env = (k: string, d?: string) => process.env[k] || d

const token = env('PHIGROS_SESSION_TOKEN')
if (!token) throw new Error('缺少环境变量 PHIGROS_SESSION_TOKEN')

const pluginRoot = path.resolve(env('PHI_PLUGIN_ROOT', 'vendor/phi-plugin')!)
const outDir = path.resolve(env('OUT_DIR', 'output')!)
const illDir = path.resolve(env('ILL_CACHE', '.cache/ill')!)
const num = Number(env('B30_NUM', '33'))
const imgType = env('IMG_TYPE', 'jpeg') as 'jpeg' | 'png'
const theme = env('THEME', 'star')!

if (!existsSync(path.join(pluginRoot, 'resources', 'info', 'info.csv'))) {
  throw new Error(`未找到 phi-plugin 资源: ${pluginRoot}`)
}

const ext = imgType === 'png' ? 'png' : 'jpg'
const outFile = path.join(outDir, `b30.${ext}`)
const updateFile = path.join(outDir, `update.${ext}`)
const wideFile = path.join(outDir, `wide.${ext}`)
const wantUpdate = env('UPDATE_CARD') !== '0'
const wantWide = env('WIDE_CARD') !== '0'
// The landscape grid is 3 columns wide, so keep it a multiple of 3.
const wideNum = Number(env('WIDE_NUM', '12'))
const metaFile = path.join(outDir, 'meta.json')

const save = await fetchSave(token, env('PHIGROS_REGION', 'cn') as Region)
console.log(`存档: ${save.playerId}  rks ${save.summary.rankingScore.toFixed(4)}  更新于 ${save.updatedAt}`)

const prev = existsSync(metaFile)
  ? JSON.parse(readFileSync(metaFile, 'utf8'))
  : null
if (
  !env('FORCE') &&
  prev?.updatedAt === save.updatedAt &&
  prev?.num === num &&
  existsSync(outFile) &&
  (!wantUpdate || existsSync(updateFile)) &&
  (!wantWide || existsSync(wideFile))
) {
  console.log('存档未变化，跳过渲染')
  process.exit(0)
}

const info = new Info(pluginRoot)
const { phi, b19_list, com_rks } = buildB19(save, info, num)

const ills = new IllCache(illDir)
for (const s of [...phi, ...b19_list]) {
  if (s) s.illustration = ills.local(s.illustration)
}
const bg = save.gameuser.background
  ? info.background(save.gameuser.background)
  : null
const background = bg ? ills.local(bg) : ''

// History is accumulated locally: the save has no per-chart timestamps, so each
// run dates the charts that changed with the save's own modifiedAt.
const historyFile = path.join(outDir, 'history.json')
const history = loadHistory(historyFile, path.resolve('data/history-seed.json'))
const addedScores = mergeSave(history, save)
writeHistory(historyFile, history)

const boxLine = wantUpdate ? buildBoxLine(history, info) : []
const rksLine = buildRksLine(history.rks)
for (const row of boxLine)
  for (const b of row) for (const s of b.song) s.illustration = ills.local(s.illustration)
console.log(
  `历史: 新增 ${addedScores} 条成绩，共 ${history.rks.length} 个 rks 采样点，${boxLine.length} 行变动`
)

const { total, failed } = await ills.download()
console.log(`曲绘: 新下载 ${total} 张，失败 ${failed} 张`)

const money = save.money
const gameuser = {
  avatar: info.avatar(save.gameuser.avatar),
  ChallengeMode: Math.floor(save.summary.challengeModeRank / 100),
  ChallengeModeRank: save.summary.challengeModeRank % 100,
  rks: save.summary.rankingScore,
  data: [
    money[4] && `${money[4]}PiB`,
    money[3] && `${money[3]}TiB`,
    money[2] && `${money[2]}GiB`,
    money[1] && `${money[1]}MiB`,
    money[0] && `${money[0]}KiB`,
  ]
    .filter(Boolean)
    .join(' '),
  selfIntro: save.gameuser.selfIntro,
  PlayerId: richText(save.playerId),
}

const formatted = new Date(save.updatedAt)
  .toLocaleString('sv-SE', { timeZone: env('TZ', 'Asia/Shanghai') })
  .replace(/-/g, '/')

mkdirSync(outDir, { recursive: true })
const box = await renderTemplate(
  'b19/b19',
  {
    phi,
    b19_list,
    PlayerId: gameuser.PlayerId,
    Rks: save.summary.rankingScore.toFixed(4),
    Date: formatted,
    ChallengeMode: gameuser.ChallengeMode,
    ChallengeModeRank: gameuser.ChallengeModeRank,
    background,
    theme,
    gameuser,
    nnum: num,
    stats: buildStats(save),
    // phi-plugin only surfaces this when its constants disagree with the save.
    spInfo:
      Math.abs(com_rks - save.summary.rankingScore) > 1e-4
        ? [`Real RKS: ${com_rks.toFixed(4)}`]
        : [],
    b30Analysis: null,
    Version: { ver: readVersion() },
  },
  { pluginRoot, outFile, type: imgType }
)

const rksDelta =
  history.rks.length > 1
    ? history.rks[history.rks.length - 1].value - history.rks[history.rks.length - 2].value
    : 0
const rksDeltaText =
  Math.abs(rksDelta) >= 1e-4 ? `${rksDelta > 0 ? '+' : ''}${rksDelta.toFixed(4)}` : ''

let updateBox = null
if (wantUpdate) {
  const tips = readFileSync(
    path.join(pluginRoot, 'resources', 'info', 'tips.txt'),
    'utf8'
  ).split(/\r?\n/).filter(Boolean)

  updateBox = await renderTemplate(
    'update/update',
    {
      PlayerId: gameuser.PlayerId,
      Rks: save.summary.rankingScore.toFixed(4),
      Date: formatted,
      ChallengeMode: gameuser.ChallengeMode,
      ChallengeModeRank: gameuser.ChallengeModeRank,
      background,
      theme,
      box_line: boxLine,
      Notes: 0,
      tips: tips[Math.floor(Math.random() * tips.length)],
      task_data: null,
      dan: null,
      added_rks_notes: [rksDeltaText, ''],
      ...rksLine,
      Version: { ver: readVersion() },
    },
    { pluginRoot, outFile: updateFile, type: imgType }
  )
  console.log(`已生成 ${updateFile} (${updateBox.width}x${updateBox.height})`)
}

let wideBox = null
if (wantWide) {
  const cards: Record<string, unknown>[] = []
  for (const [i, p] of phi.entries()) {
    if (p) cards.push({ ...p, label: `${i + 1}`, isPhi: true })
  }
  for (const c of b19_list) {
    if (cards.length >= wideNum) break
    // The phi slots already show these charts; skip the duplicates.
    if (cards.some((x) => x.isPhi && x.id === c.id && x.rank === c.rank)) continue
    cards.push({ ...c, label: `#${c.num}`, isPhi: false })
  }

  wideBox = await renderTemplate(
    'wide/wide',
    {
      cards,
      gameuser,
      Rks: save.summary.rankingScore.toFixed(4),
      rksDelta: rksDeltaText,
      Date: formatted,
      ChallengeMode: gameuser.ChallengeMode,
      ChallengeModeRank: gameuser.ChallengeModeRank,
      stats: buildStats(save),
      background,
      theme,
      ...rksLine,
      Version: { ver: readVersion() },
    },
    {
      pluginRoot,
      tplRoot: path.resolve('templates'),
      outFile: wideFile,
      type: imgType,
    }
  )
  console.log(`已生成 ${wideFile} (${wideBox.width}x${wideBox.height})`)
}

writeFileSync(
  metaFile,
  JSON.stringify(
    {
      playerId: save.playerId,
      rks: save.summary.rankingScore,
      updatedAt: save.updatedAt,
      num,
      renderedAt: new Date().toISOString(),
      size: box,
      updateSize: updateBox,
      wideSize: wideBox,
    },
    null,
    2
  ) + '\n'
)
console.log(`已生成 ${outFile} (${box.width}x${box.height})`)

/** Phigros player ids may embed Unity rich text tags; phi-plugin converts them to HTML. */
function richText(s: string) {
  const escaped = s.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped
    .replace(
      /&lt;color\s*=\s*(.*?)&gt;(.*?)&lt;\/color&gt;/g,
      (_, c: string, t: string) =>
        `<span style="color:${c.replace(/[\s"]/g, '')}">${t}</span>`
    )
    .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<i>$1</i>')
    .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>')
}

function readVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(pluginRoot, 'package.json'), 'utf8')
    )
    return `v${pkg.version}`
  } catch {
    return ''
  }
}
