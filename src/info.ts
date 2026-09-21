import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import type { LevelName } from './save'

const ILL_BASE = 'https://raw.githubusercontent.com/Catrong/phi-plugin-ill/main'

export interface SongInfo {
  id: string
  song: string
  /** difficulty (定数) per level name; missing charts are absent */
  chart: Partial<Record<LevelName, number>>
}

/**
 * Song table + resource resolution, backed by a phi-plugin checkout.
 * Mirrors the parts of phi-plugin's `getInfo` that the b19 template relies on.
 */
export class Info {
  readonly resources: string
  readonly songs = new Map<string, SongInfo>()
  /** song name (lowercased) -> id, used to resolve the background song */
  private readonly byName = new Map<string, string>()

  constructor(pluginRoot: string) {
    this.resources = path.join(pluginRoot, 'resources')
    const csv = readFileSync(path.join(this.resources, 'info', 'info.csv'), 'utf8')
    for (const line of csv.split(/\r?\n/).slice(1)) {
      if (!line.trim()) continue
      const c = line.split('\t')
      const chart: SongInfo['chart'] = {}
      for (const [i, lv] of (['EZ', 'HD', 'IN', 'AT'] as const).entries()) {
        const n = Number.parseFloat(c[8 + i])
        if (Number.isFinite(n) && n > 0) chart[lv] = n
      }
      const info: SongInfo = { id: c[0], song: c[1], chart }
      this.songs.set(c[0], info)
      this.byName.set(c[1].toLowerCase(), c[0])
    }
  }

  /** Illustration URL/path for a song id (without the trailing `.0`). */
  ill(songId: string) {
    return `${ILL_BASE}/ill/${encodeURIComponent(songId + '.png')}`
  }

  illBlur(songId: string) {
    return `${ILL_BASE}/illBlur/${encodeURIComponent(songId + '.png')}`
  }

  /** phi-plugin renames a few background entries before looking them up. */
  background(saveBackground: string): string | null {
    const alias: Record<string, string> = {
      'Another Me ': 'Another Me (KALPA)',
      'Another Me': 'Another Me (Rising Sun Traxx)',
      'Re_Nascence (Psystyle Ver.) ': 'Re_Nascence (Psystyle Ver.)',
      'Energy Synergy Matrix': 'ENERGY SYNERGY MATRIX',
      'Le temps perdu-': 'Le temps perdu',
    }
    const name = alias[saveBackground] ?? saveBackground
    const id = this.songs.has(name) ? name : this.byName.get(name.toLowerCase())
    return id ? this.ill(id) : null
  }

  /** Falls back to the default avatar when the save references an unknown one. */
  avatar(id: string) {
    const renamed: Record<string, string> = {
      'Cipher : /2&//<|0': 'Cipher1',
      'Oblivion: PHIN': 'OblivionPHIN',
    }
    const name = renamed[id] ?? id
    return existsSync(path.join(this.resources, 'html', 'avatar', `${name}.png`))
      ? name
      : 'Introduction'
  }
}
