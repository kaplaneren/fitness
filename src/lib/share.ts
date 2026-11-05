import { db, type Routine } from '../db'
import type { Exercise } from '../data/exercises'
import { ask, notify } from '../components/Dialog'

// Program paylaşımı: rutinler kısa bir JSON olarak base64url ile linke (#p=...) gömülür.
// Linki açan kişi programı tek dokunuşla kendi rutinlerine ekler. Sunucu yok, veri linkin içinde.

interface Packed { v: 1; f?: string; r: [string, [string, number, string, number, string?][]][]; c?: Exercise[] }

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))

export async function programCode(routines: Routine[], folder?: string) {
  const ids = new Set(routines.flatMap((r) => r.exercises.map((e) => e.exerciseId)))
  const custom = (await db.customExercises.toArray()).filter((e) => ids.has(e.id))
  const p: Packed = {
    v: 1, f: folder,
    r: routines.map((r) => [r.name, r.exercises.map((e) => {
      const row: [string, number, string, number, string?] = [e.exerciseId, e.sets, e.reps, e.restSec]
      if (e.superset) row.push(e.superset)
      return row
    })]),
    ...(custom.length ? { c: custom } : {})
  }
  return b64(JSON.stringify(p))
}

export function shareLink(code: string) {
  const base = /^https?:/.test(location.protocol) && !location.hostname.endsWith('claude.ai') && !location.hostname.endsWith('claudeusercontent.com') ? location.origin + location.pathname : ''
  return base ? `${base}#p=${code}` : `#p=${code}`
}

function decode(input: string): Packed | null {
  const m = input.trim().match(/(?:#p=)?([A-Za-z0-9_-]{8,})\s*$/)
  if (!m) return null
  try {
    const p = JSON.parse(unb64(m[1])) as Packed
    return p?.v === 1 && Array.isArray(p.r) ? p : null
  } catch { return null }
}

/** Link ya da kodu çözüp onay sorar ve rutinleri ekler. Eklenen rutin sayısını döner. */
export async function importProgram(input: string): Promise<number> {
  const p = decode(input)
  if (!p) { await notify('Bu link veya kod okunamadı. Paylaşılan linkin tamamını kopyaladığından emin ol.'); return 0 }
  const names = p.r.map(([n]) => n).join(', ')
  if (!await ask(`${p.f ? `"${p.f}" programı: ` : ''}${p.r.length} rutin (${names}) rutinlerine eklensin mi?`, { title: 'Program içe aktar', ok: 'Ekle' })) return 0
  const existing = new Set((await db.routines.toArray()).map((r) => r.folder).filter(Boolean))
  let folder = p.f || 'Paylaşılan program'
  if (existing.has(folder)) { let i = 2; while (existing.has(`${folder} (${i})`)) i++; folder = `${folder} (${i})` }
  for (const c of p.c ?? []) if (!(await db.customExercises.get(c.id))) await db.customExercises.put({ ...c, custom: true })
  await db.routines.bulkAdd(p.r.map(([name, ex]) => ({
    name, folder, updatedAt: Date.now(),
    exercises: ex.map(([exerciseId, sets, reps, restSec, superset]) => ({ exerciseId, sets, reps, restSec, ...(superset ? { superset } : {}) }))
  })))
  return p.r.length
}

/** Uygulama #p=... linkiyle açıldıysa programı içe aktarır. */
export async function importFromHash() {
  if (!location.hash.startsWith('#p=')) return
  const h = location.hash
  history.replaceState(null, '', location.pathname + location.search)
  const n = await importProgram(h)
  if (n) await notify(`${n} rutin eklendi. Antrenman sekmesinde görebilirsin.`)
}
