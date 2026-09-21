import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Downloads the illustrations referenced by a card into `dir` and rewrites the
 * URLs to local paths. Already-present files are reused, which is what makes the
 * Actions cache worthwhile.
 */
export class IllCache {
  private readonly pending = new Map<string, string>()

  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true })
  }

  /** Registers a remote URL and returns the `file://` URL it will be stored at. */
  local(url: string) {
    const name = decodeURIComponent(path.basename(new URL(url).pathname))
    const file = path.join(this.dir, name)
    if (!existsSync(file) || statSync(file).size === 0) this.pending.set(url, file)
    return pathToFileURL(file).href
  }

  async download(concurrency = 8) {
    const jobs = [...this.pending]
    const total = jobs.length
    this.pending.clear()
    let failed = 0
    const worker = async () => {
      for (;;) {
        const job = jobs.shift()
        if (!job) return
        const [url, file] = job
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(String(res.status))
          writeFileSync(file, Buffer.from(await res.arrayBuffer()))
        } catch (e) {
          failed++
          console.warn(`曲绘下载失败 ${url}: ${(e as Error).message}`)
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker))
    return { total, failed }
  }
}
