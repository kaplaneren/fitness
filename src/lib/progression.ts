import type { Exercise } from '../data/exercises'
import type { SetEntry, Workout } from '../db'
import { e1rm } from './calc'

// Uygulamanın ilerleme algoritması: RIR destekli çift ilerleme (double progression).
// 1) Tüm setlerde tekrar aralığının üstüne ulaşıldı ve tükenişe pay kaldıysa ağırlık artar.
// 2) Aralık içindeyse aynı ağırlıkta her sete +1 tekrar hedeflenir.
// 3) Alt sınırın altında kalındıysa aynı ağırlık korunur; iki seans üst üste olursa ağırlık %10 düşer.
// 4) Üç seans aynı ağırlık ve aynı toplam tekrarla geçtiyse bir set eklenir (yeni uyaran).
// 5) Setler tükenişe gittiyse (RIR 0) aralığın üstüne ulaşılsa bile önce aynı ağırlık pekiştirilir.

export function parseRange(reps?: string): [number, number] | null {
  if (!reps || /sn|dk/.test(reps)) return null
  const m = reps.match(/(\d+)\s*-\s*(\d+)/)
  if (m) return [+m[1], +m[2]]
  const n = reps.match(/(\d+)/)
  return n ? [+n[1], +n[1]] : null
}

export function increment(ex: Exercise | undefined, w: number) {
  if (!ex) return 2.5
  if (ex.equipment === 'dumbbell') return w < 10 ? 1 : 2
  if (ex.equipment === 'machine' || ex.equipment === 'cable') return w >= 40 ? 5 : 2.5
  return 2.5
}

const round = (x: number, step: number) => Math.round(x / step) * step

export interface Advice { weight?: number; reps: number[]; sets: number; text: string; tone: 'up' | 'same' | 'down' | 'new' }

export function recommend(ex: Exercise | undefined, exerciseId: string, history: Workout[], range: [number, number] | null, plannedSets: number, now = Date.now()): Advice | null {
  if (ex && ex.kind !== 'weight') return null
  const [lo, hi] = range ?? [8, 12]
  const sessions = history
    .filter((w) => w.startedAt < now)
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((w) => ({ t: w.startedAt, sets: w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter((s) => s.type !== 'warmup' && s.weight && s.reps)) }))
    .filter((s) => s.sets.length)
  if (!sessions.length) return { reps: Array(plannedSets).fill(hi), sets: plannedSets, text: `İlk kez: ${lo}-${hi} tekrarda 2-3 tekrar daha yapabileceğin bir ağırlık seç.`, tone: 'new' }

  const last = sessions[0]
  const W = Math.max(...last.sets.map((s) => s.weight!))
  const top = last.sets.filter((s) => s.weight === W)
  const reps = top.map((s) => s.reps!)
  const rirs = top.map((s) => s.rir).filter((x): x is number => x != null)
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : 1.5
  const inc = increment(ex, W)
  const step = ex?.equipment === 'dumbbell' ? 1 : 2.5

  const fmt = (x: number) => x.toLocaleString('tr-TR')
  const lastStr = `${fmt(W)} kg × ${reps.join(', ')}`
  const sets = Math.max(plannedSets, top.length)

  // 3 seans aynı
  const same3 = sessions.length >= 3 && sessions.slice(0, 3).every((s) => {
    const w = Math.max(...s.sets.map((x) => x.weight!))
    return w === W && s.sets.filter((x) => x.weight === w).reduce((a, x) => a + x.reps!, 0) === reps.reduce((a, b) => a + b, 0)
  })

  if (reps.every((r) => r >= hi) && avgRir >= 0.5) {
    const nw = round(W + inc, step)
    return { weight: nw, reps: Array(sets).fill(lo + Math.min(2, hi - lo)), sets, text: `Geçen sefer ${lastStr}: tüm setlerde ${hi} tekrara ulaştın. Ağırlığı ${fmt(nw)} kg'a çıkar, ${lo}-${hi} aralığından devam et.`, tone: 'up' }
  }
  if (reps.every((r) => r >= hi) && avgRir < 0.5) {
    return { weight: W, reps: Array(sets).fill(hi), sets, text: `Geçen sefer ${lastStr}, ama setler tükenişe gitti. Bu seans aynı ağırlıkla ${hi} tekrarı 1 tekrar payla yap; sonra artır.`, tone: 'same' }
  }
  if (Math.min(...reps) < lo) {
    const prevLow = sessions[1] && sessions[1].sets.some((s) => s.weight === W && s.reps! < lo)
    if (prevLow) {
      const nw = round(W * 0.9, step)
      return { weight: nw, reps: Array(sets).fill(hi - 1), sets, text: `İki seanstır ${fmt(W)} kg'da ${lo} tekrarın altında kaldın. Ağırlığı ${fmt(nw)} kg'a düşür, ${hi - 1} tekrardan tekrar yüksel.`, tone: 'down' }
    }
    return { weight: W, reps: Array(sets).fill(lo), sets, text: `Geçen sefer ${lastStr}. Aynı ağırlıkla tüm setlerde en az ${lo} tekrarı hedefle.`, tone: 'same' }
  }
  if (same3) {
    return { weight: W, reps: Array(sets + 1).fill(Math.min(hi, Math.max(...reps))), sets: Math.min(5, sets + 1), text: `Üç seanstır ${lastStr} ile aynı yerdesin. Bir set ekle; bu yeni uyaran genelde platoyu kırar.`, tone: 'same' }
  }
  const target = Array.from({ length: sets }, (_, i) => Math.min(hi, (reps[i] ?? reps[reps.length - 1]) + 1))
  return { weight: W, reps: target, sets, text: `Geçen sefer ${lastStr}. Aynı ağırlıkla her sete 1 tekrar ekle: ${target.join(', ')}.`, tone: 'same' }
}

export function e1rmOf(sets: SetEntry[]) {
  return Math.max(0, ...sets.map((s) => e1rm(s.weight, s.reps)))
}
