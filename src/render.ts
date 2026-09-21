import { LEVELS, type Best, type ScoredChart } from './rks'
import type { RawSave } from './save'

const THEMES = {
  dark: {
    bg: '#0d1117',
    bg2: '#161b22',
    border: '#30363d',
    title: '#e6edf3',
    text: '#c9d1d9',
    dim: '#7d8590',
    accent: '#58a6ff',
    row: '#161b22',
  },
  light: {
    bg: '#ffffff',
    bg2: '#f6f8fa',
    border: '#d0d7de',
    title: '#1f2328',
    text: '#1f2328',
    dim: '#636c76',
    accent: '#0969da',
    row: '#f6f8fa',
  },
} as const

export type ThemeName = keyof typeof THEMES

const LEVEL_COLORS = ['#22a35b', '#3a86d4', '#cf3f3f', '#8b5cf6']
const CHALLENGE_COLORS = ['#6b7280', '#22a35b', '#3a86d4', '#cf3f3f', '#e0a52b', '#9b5de5']

const PAD = 18
const HEADER = 84
const ROW_H = 30
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans CJK SC','PingFang SC','Microsoft YaHei',Helvetica,Arial,sans-serif"

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[
        c
      ]!
  )
}

/** Rough advance width in px for a given font size. */
function textWidth(s: string, size: number) {
  let w = 0
  for (const ch of s) w += ch.charCodeAt(0) > 0x2e80 ? 1 : 0.55
  return w * size
}

function ellipsize(s: string, size: number, max: number) {
  if (textWidth(s, size) <= max) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size) > max) break
    out += ch
  }
  return out + '…'
}

function fmtScore(n: number) {
  return String(n).padStart(7, '0')
}

function row(c: ScoredChart, i: number, y: number, t: (typeof THEMES)[ThemeName], width: number) {
  const inner = width - PAD * 2
  const badgeX = PAD + 30
  const badgeW = 62
  const nameX = badgeX + badgeW + 10
  const rksX = width - PAD - 6
  const accX = rksX - 46
  const scoreX = accX - 60
  const markX = scoreX - 58
  const nameMax = markX - 22 - nameX

  const label = c.phi ? 'φ' : String(i)
  const tag = `${LEVELS[c.level]} ${c.constant.toFixed(1)}`
  const mark = c.acc >= 100 ? 'AP' : c.fc ? 'FC' : ''

  return `<g>
  <rect x="${PAD}" y="${y}" width="${inner}" height="${ROW_H - 4}" rx="5" fill="${t.row}"/>
  <text x="${PAD + 20}" y="${y + 19}" text-anchor="end" font-size="12" fill="${c.phi ? t.accent : t.dim}" font-weight="${c.phi ? 700 : 400}">${label}</text>
  <rect x="${badgeX}" y="${y + 5}" width="${badgeW}" height="${ROW_H - 14}" rx="4" fill="${LEVEL_COLORS[c.level]}"/>
  <text x="${badgeX + badgeW / 2}" y="${y + 18}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">${esc(tag)}</text>
  <text x="${nameX}" y="${y + 19}" font-size="12.5" fill="${t.text}">${esc(ellipsize(c.name, 12.5, nameMax))}</text>
  ${mark ? `<text x="${markX}" y="${y + 18}" text-anchor="end" font-size="10" font-weight="700" fill="${mark === 'AP' ? '#e0a52b' : t.accent}">${mark}</text>` : ''}
  <text x="${scoreX}" y="${y + 19}" text-anchor="end" font-size="12" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="${t.dim}">${fmtScore(c.score)}</text>
  <text x="${accX}" y="${y + 19}" text-anchor="end" font-size="12" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="${t.text}">${c.acc.toFixed(2)}%</text>
  <text x="${rksX}" y="${y + 19}" text-anchor="end" font-size="12.5" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-weight="600" fill="${t.accent}">${c.rks.toFixed(2)}</text>
</g>`
}

export interface RenderOptions {
  theme: ThemeName
  width: number
  count: number
  title?: string
}

export function renderCard(
  save: RawSave,
  best: Best,
  opts: RenderOptions
): string {
  const t = THEMES[opts.theme]
  const { width } = opts

  const list: ScoredChart[] = []
  if (best.phi) list.push(best.phi)
  for (const c of best.best) {
    if (list.length >= opts.count) break
    if (best.phi && c.songId === best.phi.songId && c.level === best.phi.level)
      continue
    list.push(c)
  }

  const height = HEADER + list.length * ROW_H + PAD
  const cm = save.summary.challengeModeRank
  const cmColor = CHALLENGE_COLORS[Math.min(Math.floor(cm / 100), 5)]
  const cleared = save.summary.progress.reduce((s, p) => s + p[0], 0)
  const aps = save.summary.progress.reduce((s, p) => s + p[2], 0)
  const updated = new Date(save.updatedAt).toISOString().slice(0, 10)

  const rows = list
    .map((c, i) => row(c, best.phi ? i : i + 1, HEADER + i * ROW_H, t, width))
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}" role="img" aria-label="Phigros ${esc(save.nickname)} RKS ${best.rks.toFixed(4)}">
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="${t.bg}" stroke="${t.border}"/>
<text x="${PAD}" y="${PAD + 15}" font-size="16" font-weight="700" fill="${t.title}">${esc(opts.title ?? save.nickname)}</text>
<text x="${width - PAD}" y="${PAD + 17}" text-anchor="end" font-size="20" font-weight="800" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="${t.accent}">${best.rks.toFixed(4)}</text>
<text x="${width - PAD - textWidth(best.rks.toFixed(4), 20) - 6}" y="${PAD + 17}" text-anchor="end" font-size="10" font-weight="700" fill="${t.dim}">RKS</text>
<g transform="translate(${PAD},${PAD + 30})">
  <rect x="0" y="0" width="52" height="17" rx="3" fill="${cmColor}"/>
  <text x="26" y="12.5" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">CHAL ${cm % 100}</text>
  <text x="62" y="12.5" font-size="11" fill="${t.dim}">Cleared ${cleared} · AP ${aps} · Updated ${updated}</text>
</g>
<line x1="${PAD}" y1="${HEADER - 10}" x2="${width - PAD}" y2="${HEADER - 10}" stroke="${t.border}"/>
${rows}
</svg>`
}

export function renderError(message: string, theme: ThemeName = 'dark') {
  const t = THEMES[theme]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="60" viewBox="0 0 480 60" font-family="${FONT}">
<rect x="0.5" y="0.5" width="479" height="59" rx="8" fill="${t.bg}" stroke="#cf3f3f"/>
<text x="16" y="25" font-size="13" font-weight="700" fill="#cf3f3f">Phigros card error</text>
<text x="16" y="44" font-size="11.5" fill="${t.dim}">${esc(ellipsize(message, 11.5, 448))}</text>
</svg>`
}
