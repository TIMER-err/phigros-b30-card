import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchSave, type Region } from '../src/save'
import { computeBest } from '../src/rks'
import { renderCard, renderError, type ThemeName } from '../src/render'

const CACHE_TTL = Number(process.env.CACHE_TTL ?? 1800)

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

function clamp(v: number, lo: number, hi: number, dflt: number) {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const theme: ThemeName = one(req.query.theme) === 'light' ? 'light' : 'dark'
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')

  const sessionToken = process.env.PHIGROS_SESSION_TOKEN
  if (!sessionToken) {
    res.status(500).send(renderError('missing PHIGROS_SESSION_TOKEN env var', theme))
    return
  }

  try {
    const region: Region = one(req.query.region) === 'intl' ? 'intl' : 'cn'
    const count = clamp(Number(one(req.query.count) ?? 10), 1, 40, 10)
    const width = clamp(Number(one(req.query.width) ?? 520), 380, 900, 520)
    const title = one(req.query.title)

    const save = await fetchSave(sessionToken, region)
    const best = computeBest(save)

    res.setHeader(
      'Cache-Control',
      `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}, stale-while-revalidate=86400`
    )
    res.status(200).send(renderCard(save, best, { theme, width, count, title }))
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(renderError((e as Error).message, theme))
  }
}
