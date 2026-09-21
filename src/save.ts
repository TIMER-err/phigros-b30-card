import { createDecipheriv } from 'node:crypto'
import { unzipSync } from 'fflate'
import { ByteReader } from './reader'

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

export interface ChartRecord {
  songId: string
  /** 0=EZ 1=HD 2=IN 3=AT */
  level: number
  score: number
  acc: number
  fc: boolean
}

export interface Summary {
  challengeModeRank: number
  rankingScore: number
  avatar: string
  /** [difficulty][0]=clear [1]=fc [2]=phi, difficulty order EZ,HD,IN,AT */
  progress: number[][]
}

export interface RawSave {
  nickname: string
  updatedAt: string
  summary: Summary
  records: ChartRecord[]
}

async function lc(
  region: Region,
  path: string,
  sessionToken: string
): Promise<any> {
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
    throw new Error(
      `LeanCloud ${path} -> ${res.status} ${body.slice(0, 200)}`
    )
  }
  return res.json()
}

function decryptFile(data: Uint8Array): Uint8Array {
  // byte 0 is the format version, the rest is AES-256-CBC / PKCS7
  const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV)
  const out = Buffer.concat([
    Uint8Array.from(decipher.update(data.subarray(1))),
    Uint8Array.from(decipher.final()),
  ])
  return Uint8Array.from(out)
}

function parseSummary(base64: string): Summary {
  const b = Buffer.from(base64, 'base64')
  const avatarLen = b.readUInt8(8)
  let i = 9 + avatarLen
  const progress: number[][] = []
  for (let d = 0; d < 4; d++) {
    progress.push([
      b.readUInt16LE(i),
      b.readUInt16LE(i + 2),
      b.readUInt16LE(i + 4),
    ])
    i += 6
  }
  return {
    challengeModeRank: b.readUInt16LE(1),
    rankingScore: b.readFloatLE(3),
    avatar: b.toString('utf8', 9, 9 + avatarLen),
    progress,
  }
}

function parseGameRecord(data: Uint8Array): ChartRecord[] {
  const r = new ByteReader(data)
  const count = r.varInt()
  const records: ChartRecord[] = []
  for (let i = 0; i < count; i++) {
    const name = r.string()
    const songId = name.endsWith('.0') ? name.slice(0, -2) : name
    const len = r.varInt()
    const end = r.position + len
    const exists = r.byte()
    const fcMask = r.byte()
    for (let level = 0; level < 4; level++) {
      if (((exists >> level) & 1) === 0) continue
      const score = r.int32()
      const acc = r.float32()
      records.push({
        songId,
        level,
        score,
        acc,
        fc: ((fcMask >> level) & 1) === 1,
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
    nickname: me.nickname ?? 'Player',
    updatedAt: save.updatedAt,
    summary: parseSummary(save.summary),
    records: parseGameRecord(decryptFile(files.gameRecord)),
  }
}
