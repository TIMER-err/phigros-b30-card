import { createDecipheriv } from 'node:crypto'
import { unzipSync } from 'fflate'
import { ByteReader, bit } from './reader'

const HOSTS = {
  cn: 'https://rak3ffdi.cloud.tds1.tapapis.cn',
  intl: 'https://phigrosservice.cloud.tds1.tapapis.com',
} as const

const LC_HEADERS = {
  cn: {
    'X-LC-Id': 'rAK3FfdieFob2Nn8Am',
    'X-LC-Key': 'Qr9AEqtuoSVS3zeD6iVbM4ZC0AtkJcQ89tywVyi0',
  },
  intl: {
    'X-LC-Id': 'nTdRVJwqgdmWZawrRRrlMCsX-c7SMHvD',
    'X-LC-Key': 'HAoyFB18NsEZpnUrTdvhLcbC',
  },
} as const

export type Region = keyof typeof HOSTS

const b64 = (s: string) => Uint8Array.from(Buffer.from(s, 'base64'))
const AES_KEY = b64('6Jaa0qVAJZuXkZCLiOa/Ax5tIZVu+taKUN1V1nqwkks=')
const AES_IV = b64('Kk/wisgNYwcAV8WVGMgyUw==')

/** Difficulty slots as stored in the save; index 4 is LEGACY. */
export const ALL_LEVELS = ['EZ', 'HD', 'IN', 'AT', 'LEGACY'] as const
export type LevelName = (typeof ALL_LEVELS)[number]

export interface ChartRecord {
  songId: string
  level: number
  rank: LevelName
  score: number
  acc: number
  fc: boolean
}

export interface Summary {
  saveVersion: number
  challengeModeRank: number
  rankingScore: number
  gameVersion: number
  avatar: string
  cleared: number[]
  fullCombo: number[]
  phi: number[]
}

export interface GameUser {
  showPlayerId: boolean
  selfIntro: string
  avatar: string
  background: string
}

export interface RawSave {
  /** LeanCloud account nickname, shown as the player id in game. */
  playerId: string
  updatedAt: string
  summary: Summary
  gameuser: GameUser
  money: number[]
  records: ChartRecord[]
}

async function lc(region: Region, path: string, sessionToken: string) {
  const res = await fetch(HOSTS[region] + path, {
    headers: {
      ...LC_HEADERS[region],
      'X-LC-Session': sessionToken,
      Accept: 'application/json',
      'User-Agent': 'LeanCloud-CSharp-SDK/1.0.3',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`LeanCloud ${path} -> ${res.status} ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<any>
}

function decryptFile(data: Uint8Array): Uint8Array {
  // byte 0 is the format version, the rest is AES-256-CBC / PKCS7
  const d = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV)
  return Uint8Array.from(
    Buffer.concat([
      Uint8Array.from(d.update(data.subarray(1))),
      Uint8Array.from(d.final()),
    ])
  )
}

function parseSummary(base64: string): Summary {
  const r = new ByteReader(b64(base64))
  const s: Summary = {
    saveVersion: r.byte(),
    challengeModeRank: r.short(),
    rankingScore: r.float32(),
    gameVersion: r.varInt(),
    avatar: r.string(),
    cleared: [],
    fullCombo: [],
    phi: [],
  }
  for (let level = 0; level < 4; level++) {
    s.cleared[level] = r.short()
    s.fullCombo[level] = r.short()
    s.phi[level] = r.short()
  }
  return s
}

function parseGameUser(data: Uint8Array): GameUser {
  const r = new ByteReader(data)
  return {
    showPlayerId: bit(r.byte(), 0),
    selfIntro: r.string(),
    avatar: r.string(),
    background: r.string(),
  }
}

/** Only `money` is needed for the card, but the fields before it must be read in order. */
function parseMoney(data: Uint8Array): number[] {
  const r = new ByteReader(data)
  r.byte() // flag bits
  r.string() // completed
  r.varInt() // songUpdateInfo
  r.short() // challengeModeRank
  return [r.varInt(), r.varInt(), r.varInt(), r.varInt(), r.varInt()]
}

function parseGameRecord(data: Uint8Array): ChartRecord[] {
  const r = new ByteReader(data)
  const count = r.varInt()
  const records: ChartRecord[] = []
  for (let i = 0; i < count && r.remaining > 0; i++) {
    const name = r.string()
    const songId = name.endsWith('.0') ? name.slice(0, -2) : name
    const len = r.varInt()
    const end = r.position + len
    const exists = r.byte()
    const fcMask = r.byte()
    for (let level = 0; level < 5; level++) {
      if (!bit(exists, level)) continue
      const score = r.int32()
      const acc = r.float32()
      records.push({
        songId,
        level,
        rank: ALL_LEVELS[level],
        score,
        acc,
        fc: (score === 1e6 && acc === 100) || bit(fcMask, level),
      })
    }
    r.position = end
  }
  return records
}

export async function fetchSave(
  sessionToken: string,
  region: Region = 'cn'
): Promise<RawSave> {
  const [me, saves] = await Promise.all([
    lc(region, '/1.1/users/me', sessionToken),
    lc(region, '/1.1/classes/_GameSave?limit=1', sessionToken),
  ])

  const save = saves.results?.[0]
  if (!save?.gameFile?.url) throw new Error('该账号没有云存档')

  const zipRes = await fetch(save.gameFile.url)
  if (!zipRes.ok) throw new Error(`下载存档失败: ${zipRes.status}`)
  const files = unzipSync(new Uint8Array(await zipRes.arrayBuffer()))
  if (!files.gameRecord) throw new Error('存档中缺少 gameRecord')

  return {
    playerId: me.nickname ?? 'Player',
    updatedAt: save.updatedAt,
    summary: parseSummary(save.summary),
    gameuser: files.user
      ? parseGameUser(decryptFile(files.user))
      : { showPlayerId: false, selfIntro: '', avatar: '', background: '' },
    money: files.gameProgress
      ? parseMoney(decryptFile(files.gameProgress))
      : [0, 0, 0, 0, 0],
    records: parseGameRecord(decryptFile(files.gameRecord)),
  }
}
