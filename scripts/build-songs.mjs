// Converts phi-plugin's info.csv (tab separated) into data/songs.json
// Usage: node scripts/build-songs.mjs [path-to-info.csv]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE =
  process.argv[2] ??
  'https://raw.githubusercontent.com/Catrong/phi-plugin/main/resources/info/info.csv'

const csv = /^https?:/.test(SOURCE)
  ? await fetch(SOURCE).then((r) => {
      if (!r.ok) throw new Error(`fetch info.csv failed: ${r.status}`)
      return r.text()
    })
  : readFileSync(SOURCE, 'utf8')

const songs = {}
for (const line of csv.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue
  const c = line.split('\t')
  const id = c[0]
  const chart = [c[8], c[9], c[10], c[11]].map((v) => {
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : null
  })
  songs[id] = { name: c[1], chart }
}

mkdirSync(resolve(root, 'data'), { recursive: true })
writeFileSync(
  resolve(root, 'data/songs.json'),
  JSON.stringify(songs, null, 0) + '\n'
)
console.log(`wrote ${Object.keys(songs).length} songs`)
