import type { Exercise, Muscle } from '../data/exercises'
import type { Profile, SetEntry, Workout } from '../db'
import { e1rm } from './calc'

export const DAY = 86400000

/** Haftalık kas başına zor set sayısı (ana kas 1, yardımcı kas 0,5). Isınma setleri sayılmaz. */
export function muscleSets(workouts: Workout[], exMap: Map<string, Exercise>, since: number) {
  const out: Partial<Record<Muscle, number>> = {}
  for (const w of workouts) {
    if (w.startedAt < since) continue
    for (const e of w.exercises) {
      const info = exMap.get(e.exerciseId)
      if (!info || info.kind === 'time') continue
      const n = e.sets.filter((s) => s.done && s.type !== 'warmup').length
      for (const m of info.primary) out[m] = (out[m] ?? 0) + n
      for (const m of info.secondary) out[m] = (out[m] ?? 0) + n * 0.5
    }
  }
  return out
}

/** Haftalık set hedefi (hipertrofi literatüründeki yaygın aralık). */
export const WEEKLY_RANGE: Record<Muscle, [number, number]> = {
  gogus: [10, 20], on_omuz: [4, 12], yan_omuz: [8, 20], arka_omuz: [6, 16], triceps: [6, 14], biceps: [8, 16],
  onkol: [0, 10], kanat: [10, 20], sirt_ust: [8, 18], trapez: [0, 12], bel: [0, 8], karin: [6, 16], oblik: [4, 12],
  kalca: [8, 18], on_bacak: [8, 18], arka_bacak: [8, 16], ic_bacak: [0, 10], baldir: [6, 14]
}

export function volumeStatus(m: Muscle, sets: number): 'low' | 'ok' | 'high' {
  const [lo, hi] = WEEKLY_RANGE[m]
  if (sets < lo) return 'low'
  if (sets > hi + 4) return 'high'
  return 'ok'
}

/* ---------- Güç skoru ---------- */
// Vücut ağırlığına oranla 1RM eşikleri: Başlangıç, Acemi, Orta, İleri, Elit (erkek).
// Bu uygulamaya ait yaklaşık tablodur; dambıl hareketlerinde tek dambıl ağırlığı esas alınır.
export const LEVELS = ['Başlangıç', 'Acemi', 'Orta', 'İleri', 'Elit'] as const
const STANDARDS: Record<string, number[]> = {
  bench_press: [0.5, 0.75, 1.0, 1.5, 2.0],
  incline_bench: [0.45, 0.65, 0.9, 1.3, 1.7],
  db_bench_press: [0.15, 0.25, 0.4, 0.6, 0.8],
  incline_db_press: [0.13, 0.22, 0.35, 0.52, 0.7],
  machine_chest_press: [0.4, 0.65, 0.95, 1.35, 1.8],
  lat_pulldown: [0.45, 0.65, 0.9, 1.2, 1.5],
  lat_pulldown_close: [0.45, 0.65, 0.9, 1.2, 1.5],
  seated_cable_row: [0.45, 0.65, 0.9, 1.25, 1.6],
  chest_supported_row: [0.4, 0.6, 0.85, 1.15, 1.5],
  barbell_row: [0.4, 0.65, 0.9, 1.25, 1.6],
  machine_shoulder_press: [0.3, 0.5, 0.75, 1.0, 1.35],
  seated_db_press: [0.1, 0.18, 0.28, 0.4, 0.55],
  ohp: [0.35, 0.55, 0.75, 1.0, 1.3],
  leg_press: [1.0, 1.75, 2.5, 3.5, 4.5],
  belt_squat: [0.75, 1.1, 1.5, 2.0, 2.6],
  squat: [0.75, 1.0, 1.5, 2.0, 2.5],
  hip_thrust: [0.75, 1.25, 1.75, 2.5, 3.25],
  deadlift: [1.0, 1.25, 1.75, 2.5, 3.0],
  rdl: [0.75, 1.0, 1.4, 1.9, 2.4],
  barbell_curl: [0.2, 0.4, 0.6, 0.85, 1.15],
  ez_curl: [0.2, 0.4, 0.6, 0.85, 1.15],
  db_curl: [0.1, 0.15, 0.25, 0.37, 0.5]
}

export const PATTERNS: { name: string; ids: string[] }[] = [
  { name: 'Yatay itiş', ids: ['bench_press', 'incline_bench', 'db_bench_press', 'incline_db_press', 'machine_chest_press'] },
  { name: 'Dikey çekiş', ids: ['lat_pulldown', 'lat_pulldown_close'] },
  { name: 'Yatay çekiş', ids: ['seated_cable_row', 'chest_supported_row', 'barbell_row'] },
  { name: 'Dikey itiş', ids: ['machine_shoulder_press', 'seated_db_press', 'ohp'] },
  { name: 'Bacak', ids: ['leg_press', 'belt_squat', 'squat'] },
  { name: 'Kalça', ids: ['hip_thrust', 'deadlift', 'rdl'] },
  { name: 'Kol', ids: ['barbell_curl', 'ez_curl', 'db_curl'] }
]

export function hasStandard(id: string) { return id in STANDARDS }

/** 0-100 puan: eşikler 20/40/60/80/100'e denk gelir. */
export function liftScore(id: string, oneRm: number, bodyweight: number) {
  const st = STANDARDS[id]
  if (!st || !oneRm || !bodyweight) return 0
  const r = oneRm / bodyweight
  if (r <= st[0]) return Math.max(0, (r / st[0]) * 20)
  for (let i = 1; i < st.length; i++) if (r <= st[i]) return 20 * i + ((r - st[i - 1]) / (st[i] - st[i - 1])) * 20
  return 100
}
export function levelOf(score: number) {
  if (score < 20) return 'Yeni'
  return LEVELS[Math.min(4, Math.floor(score / 20) - 1)]
}
export function nextLevelWeight(id: string, score: number, bodyweight: number) {
  const st = STANDARDS[id]
  if (!st) return null
  const i = Math.min(4, Math.floor(score / 20))
  if (score >= 100) return null
  return { level: LEVELS[i], kg: Math.round(st[i] * bodyweight * 2) / 2 }
}

export function bestE1rmByExercise(workouts: Workout[], since = 0) {
  const best: Record<string, { v: number; date: number }> = {}
  for (const w of workouts) {
    if (w.startedAt < since) continue
    for (const e of w.exercises) for (const s of e.sets) {
      if (s.type === 'warmup' || !s.reps || s.reps > 12) continue
      const v = e1rm(s.weight, s.reps)
      if (v > (best[e.exerciseId]?.v ?? 0)) best[e.exerciseId] = { v, date: w.startedAt }
    }
  }
  return best
}

export function strengthProfile(workouts: Workout[], bodyweight: number) {
  const best = bestE1rmByExercise(workouts)
  const patterns = PATTERNS.map((p) => {
    let top = { id: '', score: 0, e1: 0 }
    for (const id of p.ids) {
      const b = best[id]
      if (!b) continue
      const sc = liftScore(id, b.v, bodyweight)
      if (sc > top.score) top = { id, score: sc, e1: b.v }
    }
    return { ...p, ...top }
  })
  const done = patterns.filter((p) => p.score > 0)
  const total = done.length ? done.reduce((a, p) => a + p.score, 0) / done.length : 0
  return { patterns, total, covered: done.length }
}

/* ---------- Antrenman analizi ---------- */
export interface Insight { tone: 'good' | 'warn' | 'bad'; text: string }

export function analyzeWorkout(w: Workout, exMap: Map<string, Exercise>): { insights: Insight[]; avgRir: number | null; repBands: [number, number, number] } {
  const insights: Insight[] = []
  const work = w.exercises.flatMap((e) => e.sets.filter((s) => s.done !== false && s.type !== 'warmup').map((s) => ({ s, e })))
  const rirs = work.map(({ s }) => s.rir).filter((x): x is number => x != null)
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null
  const bands: [number, number, number] = [0, 0, 0]
  for (const { s } of work) if (s.reps) bands[s.reps < 6 ? 0 : s.reps <= 15 ? 1 : 2]++

  if (avgRir == null) insights.push({ tone: 'warn', text: 'Setlere RIR (tükenişe kalan tekrar) girersen yoğunluk analizi de yapılır.' })
  else if (avgRir > 3.5) insights.push({ tone: 'warn', text: `Ortalama RIR ${avgRir.toFixed(1)}: setler tükenişe uzak. Kas gelişimi için çoğu seti 1-3 RIR aralığında bitir.` })
  else if (avgRir < 0.8) insights.push({ tone: 'warn', text: `Ortalama RIR ${avgRir.toFixed(1)}: neredeyse her set tükenişe gitmiş. Eklemlerin için büyük hareketlerde 1-2 tekrar bırak.` })
  else insights.push({ tone: 'good', text: `Ortalama RIR ${avgRir.toFixed(1)}: yoğunluk verimli aralıkta.` })

  const total = bands[0] + bands[1] + bands[2]
  if (total) {
    if (bands[1] / total >= 0.6) insights.push({ tone: 'good', text: `Setlerin %${Math.round((bands[1] / total) * 100)}'i 6-15 tekrar aralığında; kas gelişimi için ideal.` })
    if (bands[2] / total > 0.4) insights.push({ tone: 'warn', text: 'Setlerin çoğu 15 tekrarın üzerinde. Ağırlığı artırıp 8-12 tekrara çekmeyi dene.' })
  }

  // Hareket sırası: izolasyondan sonra aynı kası çalıştıran bileşik hareket
  const seen: Muscle[] = []
  for (const e of w.exercises) {
    const info = exMap.get(e.exerciseId)
    if (!info) continue
    const compound = info.secondary.length >= 2
    const isolation = info.secondary.length <= 1 && info.kind === 'weight'
    if (compound && info.primary.some((m) => seen.includes(m))) {
      insights.push({ tone: 'warn', text: `${info.name} aynı kası önceden yoran izolasyon hareketinden sonra gelmiş. Bileşik hareketleri başa al.` })
      break
    }
    if (isolation) seen.push(...info.primary)
  }

  const perMuscle = muscleSets([w], exMap, 0)
  const heavy = (Object.entries(perMuscle) as [Muscle, number][]).filter(([, n]) => n > 10)
  for (const [m] of heavy.slice(0, 1)) insights.push({ tone: 'warn', text: `Tek antrenmanda bir kasa 10'dan fazla set (${m.replace('_', ' ')}). Fazlası genelde verim getirmez; haftaya yay.` })

  const mins = ((w.endedAt ?? Date.now()) - w.startedAt) / 60000
  if (mins > 95) insights.push({ tone: 'warn', text: `Antrenman ${Math.round(mins)} dakika sürdü. Dinlenmeleri kısaltmak veya süperset kullanmak süreyi düşürür.` })
  return { insights, avgRir, repBands: bands }
}

/* ---------- Dinamik dinlenme ---------- */
export function dynamicRest(base: number, ex: Exercise | undefined, set: SetEntry, profile: Profile) {
  if (!profile.dynamicRest) return base
  let r = base
  const compound = (ex?.secondary.length ?? 0) >= 2
  if (set.reps != null && set.reps <= 6) r += compound ? 45 : 20
  if (set.rir != null) { if (set.rir <= 0) r += 30; else if (set.rir >= 3) r -= 20 }
  if (set.type === 'warmup') r = Math.min(r, 60)
  if (set.type === 'drop') r = 15
  return Math.max(15, Math.round(r / 5) * 5)
}

/* ---------- Çalışma ağırlığı ve projeksiyon ---------- */
export function workingWeight(oneRm: number, reps: number, rir: number, step = 2.5) {
  const w = oneRm / (1 + (reps + rir) / 30)
  return Math.floor(w / step) * step
}

/** Son 10 haftanın e1RM serisinden doğrusal eğilim; kg/hafta. */
export function trend(points: { t: number; v: number }[]) {
  if (points.length < 3) return null
  const xs = points.map((p) => p.t / (7 * DAY)), ys = points.map((p) => p.v)
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length
  let num = 0, den = 0
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2 }
  if (!den) return null
  const slope = num / den
  return { slope, at: (t: number) => my + slope * (t / (7 * DAY) - mx) }
}

export function ffmi(weight: number, heightCm: number, bodyFat: number) {
  const h = heightCm / 100
  const lean = weight * (1 - bodyFat / 100)
  return { ffmi: lean / (h * h) + 6.1 * (1.8 - h), lean }
}
