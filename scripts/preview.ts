// Local preview: writes preview.svg using PHIGROS_SESSION_TOKEN.
// Usage: PHIGROS_SESSION_TOKEN=xxx npx tsx scripts/preview.ts [count] [theme]
import { writeFileSync } from 'node:fs'
import { fetchSave, type Region } from '../src/save'
import { computeBest } from '../src/rks'
import { renderCard, type ThemeName } from '../src/render'

const token = process.env.PHIGROS_SESSION_TOKEN
if (!token) throw new Error('set PHIGROS_SESSION_TOKEN')

const count = Number(process.argv[2] ?? 10)
const theme = (process.argv[3] ?? 'dark') as ThemeName
const region = (process.env.PHIGROS_REGION ?? 'cn') as Region

const save = await fetchSave(token, region)
const best = computeBest(save)
console.log(`${save.nickname}  RKS ${best.rks.toFixed(4)}  charts ${best.best.length}`)
writeFileSync('preview.svg', renderCard(save, best, { theme, width: 520, count }))
console.log('wrote preview.svg')
