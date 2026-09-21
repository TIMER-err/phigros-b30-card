import crypto from 'node:crypto'
import { LC, type Region } from './save'

/** Phigros' TapTap OAuth client, same values phi-plugin uses. */
const CLIENT_ID = 'rAK3FfdieFob2Nn8Am'
const ACCOUNTS = { cn: 'https://accounts.tapapis.cn', intl: 'https://accounts.tapapis.com' }
const OPEN_API = { cn: 'https://open.tapapis.cn', intl: 'https://open.tapapis.com' }

export interface QrCode {
  deviceId: string
  deviceCode: string
  /** URL to encode into the QR image */
  url: string
  /** short code that can be typed on accounts.taptap.cn/device instead */
  userCode: string
  expiresIn: number
  interval: number
}

interface TapToken {
  kid: string
  access_token: string
  mac_key: string
  scope: string
}

function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.append(k, v)
  return f
}

export async function requestQrCode(region: Region = 'cn'): Promise<QrCode> {
  const deviceId = crypto.randomUUID().replace(/-/g, '')
  const res = await fetch(`${ACCOUNTS[region]}/oauth2/v1/device/code`, {
    method: 'POST',
    body: form({
      client_id: CLIENT_ID,
      response_type: 'device_code',
      scope: 'public_profile',
      version: '2.1',
      platform: 'unity',
      info: JSON.stringify({ device_id: deviceId }),
    }),
  })
  const json = (await res.json()) as any
  if (!json.success) throw new Error(`申请二维码失败: ${JSON.stringify(json.data)}`)
  return {
    deviceId,
    deviceCode: json.data.device_code,
    url: json.data.qrcode_url,
    userCode: json.data.user_code,
    expiresIn: json.data.expires_in,
    interval: json.data.interval,
  }
}

/** Returns the token once scanned, or null while the user hasn't confirmed yet. */
export async function pollQrCode(
  qr: QrCode,
  region: Region = 'cn'
): Promise<TapToken | null> {
  const res = await fetch(`${ACCOUNTS[region]}/oauth2/v1/token`, {
    method: 'POST',
    body: form({
      grant_type: 'device_token',
      client_id: CLIENT_ID,
      secret_type: 'hmac-sha-1',
      code: qr.deviceCode,
      version: '1.0',
      platform: 'unity',
      info: JSON.stringify({ device_id: qr.deviceId }),
    }),
  })
  const json = (await res.json()) as any
  if (json.success) return json.data as TapToken
  // pending: not scanned yet; waiting: scanned, user hasn't confirmed in the app
  const err = json.data?.error
  if (
    err === 'authorization_pending' ||
    err === 'authorization_waiting' ||
    err === 'slow_down'
  ) {
    return null
  }
  throw new Error(`扫码登录失败: ${json.data?.error_description ?? err}`)
}

/** TapTap signs open-api calls with an HMAC-SHA1 MAC header. */
function macAuthorization(url: string, method: string, kid: string, macKey: string) {
  const u = new URL(url)
  const ts = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('base64')
  const port = u.port || (u.protocol === 'https:' ? '443' : '80')
  const base = `${ts}\n${nonce}\n${method}\n${u.pathname + u.search}\n${u.hostname}\n${port}\n\n`
  const mac = crypto.createHmac('sha1', macKey).update(base).digest('base64')
  return `MAC id="${kid}", ts="${ts}", nonce="${nonce}", mac="${mac}"`
}

async function getProfile(token: TapToken, region: Region) {
  const url = `${OPEN_API[region]}/account/profile/v1?client_id=${CLIENT_ID}`
  const res = await fetch(url, {
    headers: { Authorization: macAuthorization(url, 'GET', token.kid, token.mac_key) },
  })
  const json = (await res.json()) as any
  if (!json.success) throw new Error(`获取 TapTap 资料失败: ${JSON.stringify(json.data)}`)
  return json.data
}

/** Exchanges the TapTap token for a Phigros (LeanCloud) sessionToken. */
export async function exchangeSessionToken(token: TapToken, region: Region = 'cn') {
  const profile = await getProfile(token, region)
  const { base, ...keys } = LC[region]
  const ts = Math.floor(Date.now() / 1000)
  const sign = `${crypto.createHash('md5').update(ts + keys['X-LC-Key']).digest('hex')},${ts}`

  const res = await fetch(`${base}/users`, {
    method: 'POST',
    headers: {
      'X-LC-Id': keys['X-LC-Id'],
      'X-LC-Sign': sign,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authData: { taptap: { ...profile, ...token } } }),
  })
  const json = (await res.json()) as any
  if (!json.sessionToken) throw new Error(`登录 Phigros 失败: ${JSON.stringify(json)}`)
  return { sessionToken: json.sessionToken as string, nickname: json.nickname as string }
}
