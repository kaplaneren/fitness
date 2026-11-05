import { db, type Routine } from '../db'
import type { Exercise } from '../data/exercises'
import { ask, notify } from '../components/Dialog'

// Program paylaşımı: rutinler kısa bir JSON olarak base64url ile linke (#p=...) gömülür.
// Linki açan kişi programı tek dokunuşla kendi rutinlerine ekler. Sunucu yok, veri linkin içinde.

interface Packed { v: 1; f?: string; r: [string, [string, number, string, number, string?][]][]; c?: Exercise[] }

const bytesToB64 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
const b64ToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const b64 = (s: string) => bytesToB64(new TextEncoder().encode(s))
const unb64 = (s: string) => new TextDecoder().decode(b64ToBytes(s))

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}
// Kod biçimi: "z" + sıkıştırılmış (deflate-raw) base64url; eski linkler sıkıştırmasız JSON base64url ("ey..." ile başlar)
async function pack(json: string) {
  try { if (typeof CompressionStream !== 'undefined') return 'z' + bytesToB64(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'))) } catch { /* düz */ }
  return b64(json)
}
async function unpack(code: string) {
  if (code.startsWith('z')) return new TextDecoder().decode(await pipe(b64ToBytes(code.slice(1)), new DecompressionStream('deflate-raw')))
  return unb64(code)
}

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
  return pack(JSON.stringify(p))
}

export function shareLink(code: string) {
  const base = /^https?:/.test(location.protocol) && !location.hostname.endsWith('claude.ai') && !location.hostname.endsWith('claudeusercontent.com') ? location.origin + location.pathname : ''
  return base ? `${base}#p=${code}` : `#p=${code}`
}

async function decode(input: string): Promise<Packed | null> {
  const m = input.trim().match(/(?:#p=)?([A-Za-z0-9_-]{8,})\s*$/)
  if (!m) return null
  try {
    const p = JSON.parse(await unpack(m[1])) as Packed
    return p?.v === 1 && Array.isArray(p.r) ? p : null
  } catch { return null }
}

/** Link ya da kodu çözüp onay sorar ve rutinleri ekler. Eklenen rutin sayısını döner. */
export async function importProgram(input: string): Promise<number> {
  const p = await decode(input)
  if (!p) { await notify('Bu link veya kod okunamadı. Paylaşılan linkin tamamını kopyaladığından emin ol.'); return 0 }
  const names = p.r.map(([n]) => n).join(', ')
  const exCount = p.r.reduce((a, [, ex]) => a + ex.length, 0)
  const newCustom = (p.c ?? []).length ? (await Promise.all((p.c ?? []).map((c) => db.customExercises.get(c.id)))).filter((x) => !x).length : 0
  if (!await ask(`${p.f ? `"${p.f}" programı\n` : ''}${p.r.length} rutin: ${names}\n${exCount} hareket satırı${newCustom ? `, ${newCustom} yeni özel hareket` : ''}.\n\nRutinlerine yeni bir klasör olarak eklensin mi? Mevcut rutinlerin değişmez.`, { title: 'Program içe aktar', ok: 'Ekle' })) return 0
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
