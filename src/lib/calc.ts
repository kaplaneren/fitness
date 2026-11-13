import type { SetEntry, Workout } from '../db'

/** Tahmini 1RM: 1-10 tekrar arası Brzycki ve Epley ortalaması; 10+ tekrar güvenilir değil.
 *  RIR girilmişse tükenişe kalan tekrar da hesaba katılır (8 tekrar + 2 RIR ≈ 10 tekrarlık efor). */
export function e1rm(weight?: number, reps?: number, rir?: number): number {
  if (!weight || !reps || reps < 1) return 0
  if (rir != null && rir > 0) reps = reps + Math.min(rir, 4)
  if (reps === 1) return weight
  const epley = weight * (1 + reps / 30)
  const brzycki = reps < 37 ? (weight * 36) / (37 - reps) : epley
  return Math.round(((epley + brzycki) / 2) * 10) / 10
}

export function setVolume(s: SetEntry) {
  return (s.weight ?? 0) * (s.reps ?? 0)
}

export function workoutVolume(w: Workout) {
  return w.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done && s.type !== 'warmup').reduce((a, s) => a + setVolume(s), 0), 0)
}

export function workoutSetCount(w: Workout) {
  return w.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done && s.type !== 'warmup').length, 0)
}

/** Bir tarafa takılacak plakalar. */
export function platesFor(total: number, bar: number, plates: number[]) {
  let side = (total - bar) / 2
  const out: number[] = []
  if (side <= 0) return { out, rest: 0 }
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (side >= p - 1e-9) { out.push(p); side -= p }
  }
  return { out, rest: Math.round(side * 2 * 100) / 100 }
}

/** Çalışma ağırlığına göre ısınma setleri. */
export function warmupSets(work: number, bar: number, step = 2.5): { weight: number; reps: number }[] {
  if (work <= bar) return []
  const r = (x: number) => Math.max(bar, Math.round(x / step) * step)
  const list = [
    { weight: bar, reps: 10 },
    { weight: r(work * 0.5), reps: 8 },
    { weight: r(work * 0.7), reps: 5 },
    { weight: r(work * 0.85), reps: 2 }
  ]
  return list.filter((s, i, a) => s.weight < work && (i === 0 || s.weight > a[i - 1].weight))
}

export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

export function fmtKg(n: number) {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
}

export function fmtDate(t: number, withTime = false) {
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
}

/** Dinlenme süresi: 90 → "1:30", 45 → "45 sn" */
export function fmtRest(sec: number) {
  return sec < 60 ? `${sec} sn` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Türkçe ondalık (virgül) ile sabit basamak. */
export function fmtNum(x: number, d = 1) { return x.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }) }

/** Plan gösterimi: "kilo × tekrar × set". Süreli harekette "5 dk", tek set ise set yazılmaz. */
export function fmtPlan(reps: string | number | undefined, sets: number, weight?: number) {
  const r = String(reps ?? '')
  if (/dk|sn/.test(r) && sets <= 1) return r
  return `${weight ? `${fmtKg(weight)} kg × ` : ''}${r} × ${sets} set`
}

/** Yapılmış setlerin özeti, "kilo × tekrar × set" düzeninde. Aynı setler gruplanır:
 *  70 kg × 10 × 3 set · 70 kg × 10, 10, 8 (3 set) · 60 kg × 12 + 70 kg × 8 × 2 set */
export function fmtSets(sets: { weight?: number; reps?: number; seconds?: number }[]) {
  if (!sets.length) return ''
  if (sets.every((s) => s.seconds != null && s.reps == null)) {
    const total = Math.round(sets.reduce((a, s) => a + (s.seconds ?? 0), 0) / 60)
    return sets.length > 1 ? `${total} dk (${sets.length} set)` : `${total} dk`
  }
  const w = (x?: number) => (x ? `${fmtKg(x)} kg × ` : '')
  const groups: { weight?: number; reps: number[] }[] = []
  for (const s of sets) {
    const g = groups[groups.length - 1]
    if (g && g.weight === s.weight) g.reps.push(s.reps ?? 0); else groups.push({ weight: s.weight, reps: [s.reps ?? 0] })
  }
  return groups.map((g) => g.reps.every((r) => r === g.reps[0])
    ? `${w(g.weight)}${g.reps[0]} × ${g.reps.length} set`
    : `${w(g.weight)}${g.reps.join(', ')} (${g.reps.length} set)`).join(' + ')
}
