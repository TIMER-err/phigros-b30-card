import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import template from 'art-template'
import puppeteer from 'puppeteer'

export interface RenderOptions {
  pluginRoot: string
  outFile: string
  /** Directory holding the `.art` file, when it is not one of phi-plugin's. */
  tplRoot?: string
  /** Extra scale applied by the page itself, as phi-plugin's renderScale does. */
  scale?: number
  type?: 'jpeg' | 'png'
  quality?: number
  deviceScaleFactor?: number
}

/**
 * Renders a phi-plugin `.art` template exactly as the plugin's puppeteer
 * renderer does: same layout, same resource paths, screenshot of #container/body.
 */
export async function renderTemplate(
  tpl: string,
  params: Record<string, unknown>,
  opts: RenderOptions
) {
  const resPath = path.join(opts.pluginRoot, 'resources').replace(/\\/g, '/') + '/'
  const layoutPath = resPath + 'html/common/layout/'
  const [app, name] = tpl.split('/')
  const tplFile = opts.tplRoot
    ? path.join(opts.tplRoot, app, `${name}.art`)
    : path.join(opts.pluginRoot, 'resources', 'html', app, `${name}.art`)

  const data = {
    ...params,
    themeInfo: null,
    tplFile,
    tplResPath: path.dirname(tplFile).replace(/\\/g, '/') + '/',
    pluResPath: resPath,
    _res_path: resPath,
    _imgPath: resPath + 'html/otherimg/',
    _layout_path: layoutPath,
    defaultLayout: layoutPath + 'default.art',
    elemLayout: layoutPath + 'elem.art',
    sys: { scale: `style="transform:scale(${opts.scale ?? 1})"` },
    _plugin: 'phi-plugin',
    Math,
  }

  template.defaults.cache = false
  const html = template(tplFile, data)

  // All resource references are absolute, so the page can live anywhere.
  const htmlFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'phi-')), `${name}.html`)
  writeFileSync(htmlFile, html)
  if (process.env.DEBUG_HTML) console.log(`[html] ${htmlFile}`)
  mkdirSync(path.dirname(opts.outFile), { recursive: true })

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
      '--allow-file-access-from-files',
    ],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({
      width: 1440,
      height: 1080,
      deviceScaleFactor: opts.deviceScaleFactor ?? 1,
    })
    await page.goto(pathToFileURL(htmlFile).href, {
      waitUntil: 'networkidle0',
      timeout: 120000,
    })
    // The layout runs a font-fitting script after load; give it a frame to settle.
    await page.evaluate(() => document.fonts.ready)
    await new Promise((r) => setTimeout(r, 500))

    const body = (await page.$('#container')) ?? (await page.$('body'))
    if (!body) throw new Error('未找到可截图的页面节点')
    const box = await body.boundingBox()
    if (!box || box.width <= 0 || box.height <= 0) throw new Error('页面尺寸为空')

    const type = opts.type ?? 'jpeg'
    await body.screenshot({
      path: opts.outFile as `${string}.jpeg`,
      type,
      ...(type === 'jpeg' ? { quality: opts.quality ?? 90 } : {}),
    })
    return { width: Math.round(box.width), height: Math.round(box.height) }
  } finally {
    await browser.close()
  }
}
