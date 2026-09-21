/**
 * TapTap 扫码登录，拿到 Phigros sessionToken 并写入 .env。
 *   npm run login            国服
 *   npm run login -- intl    国际服
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import QRCode from 'qrcode'
import { requestQrCode, pollQrCode, exchangeSessionToken } from '../src/taptap'
import type { Region } from '../src/save'

const region: Region = process.argv[2] === 'intl' ? 'intl' : 'cn'

const qr = await requestQrCode(region)
console.log(await QRCode.toString(qr.url, { type: 'terminal', small: true }))
console.log(`用 TapTap App 扫描上方二维码，或访问 https://accounts.taptap.cn/device 输入: ${qr.userCode}`)
console.log(`链接: ${qr.url}`)
console.log(`等待授权（${qr.expiresIn}s 内有效）...`)

const deadline = Date.now() + qr.expiresIn * 1000
let token = null
while (!token) {
  if (Date.now() > deadline) throw new Error('二维码已过期，请重新运行')
  await new Promise((r) => setTimeout(r, Math.max(qr.interval, 1) * 1000))
  token = await pollQrCode(qr, region)
}

const { sessionToken, nickname } = await exchangeSessionToken(token, region)
console.log(`\n登录成功: ${nickname}`)

writeEnv({ PHIGROS_SESSION_TOKEN: sessionToken, PHIGROS_REGION: region })
console.log('已写入 .env（该文件已被 .gitignore 忽略）')
console.log('\n上传为仓库 Secret:')
console.log('  gh secret set PHIGROS_SESSION_TOKEN < <(sed -n "s/^PHIGROS_SESSION_TOKEN=//p" .env)')

/** Upserts keys in .env, leaving any unrelated lines untouched. */
function writeEnv(vars: Record<string, string>) {
  const lines = existsSync('.env')
    ? readFileSync('.env', 'utf8').split(/\r?\n/)
    : []
  for (const [key, value] of Object.entries(vars)) {
    const i = lines.findIndex((l) => l.startsWith(`${key}=`))
    if (i >= 0) lines[i] = `${key}=${value}`
    else lines.push(`${key}=${value}`)
  }
  writeFileSync('.env', lines.filter(Boolean).join('\n') + '\n', { mode: 0o600 })
}
