import type { SetEntry, Workout } from '../db'

/** Tahmini 1RM: 1-10 tekrar arası Brzycki ve Epley ortalaması; 10+ tekrar güvenilir değil. */
export function e1rm(weight?: number, reps?: number): number {
  if (!weight || !reps || reps < 1) return 0
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
