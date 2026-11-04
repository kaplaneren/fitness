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

/* ---------- Güç seviyesi (strengthlevel.com standartları) ---------- */
// strengthlevel.com erkek standartları, 80 kg vücut ağırlığı için 1RM (kg):
// Başlangıç / Acemi / Orta / İleri / Elit. Dambıllarda tek dambıl ağırlığı.
// Farklı kilolar için allometrik ölçekleme (kilo/80)^0,67 uygulanır.
// Seviyeler yüzdelik dilime karşılık gelir: %5, %20, %50, %80, %95.
export const LEVELS = ['Başlangıç', 'Acemi', 'Orta', 'İleri', 'Elit'] as const
const PCT = [5, 20, 50, 80, 95]
export const STANDARDS_80: Record<string, number[]> = {
  bench_press: [56, 75, 98, 124, 151],
  incline_bench: [50, 66, 87, 109, 134],
  db_bench_press: [19, 28, 40, 53, 68],
  incline_db_press: [22, 29, 39, 50, 62],
  machine_chest_press: [39, 61, 89, 123, 160],
  squat: [75, 101, 132, 168, 206],
  deadlift: [89, 119, 155, 196, 239],
  ohp: [33, 46, 62, 81, 101],
  seated_db_press: [15, 22, 31, 42, 54],
  machine_shoulder_press: [29, 50, 76, 109, 145],
  barbell_row: [48, 66, 88, 114, 141],
  t_bar_row: [48, 66, 88, 114, 141],
  lat_pulldown: [47, 64, 85, 108, 133],
  lat_pulldown_close: [47, 64, 85, 108, 133],
  seated_cable_row: [47, 65, 87, 112, 140],
  chest_supported_row: [47, 65, 87, 112, 140],
  leg_press: [109, 162, 230, 309, 395],
  hip_thrust: [56, 96, 149, 213, 285],
  rdl: [65, 92, 125, 163, 203],
  leg_extension: [48, 72, 103, 140, 180],
  lying_leg_curl: [30, 46, 66, 90, 116],
  seated_leg_curl: [39, 58, 83, 112, 144],
  barbell_curl: [22, 33, 46, 63, 80],
  ez_curl: [22, 33, 46, 63, 80],
  db_curl: [8, 14, 22, 32, 42],
  triceps_pushdown: [22, 36, 56, 80, 107],
  triceps_pushdown_bar: [22, 36, 56, 80, 107]
}

export const REGIONS: { name: string; ids: string[]; muscles: Muscle[] }[] = [
  { name: 'Göğüs', ids: ['bench_press', 'incline_bench', 'db_bench_press', 'incline_db_press', 'machine_chest_press'], muscles: ['gogus'] },
  { name: 'Sırt', ids: ['lat_pulldown', 'lat_pulldown_close', 'seated_cable_row', 'chest_supported_row', 'barbell_row', 't_bar_row'], muscles: ['kanat', 'sirt_ust', 'trapez'] },
  { name: 'Omuz', ids: ['ohp', 'seated_db_press', 'machine_shoulder_press'], muscles: ['on_omuz', 'yan_omuz', 'arka_omuz'] },
  { name: 'Kol', ids: ['barbell_curl', 'ez_curl', 'db_curl', 'triceps_pushdown', 'triceps_pushdown_bar'], muscles: ['biceps', 'triceps', 'onkol'] },
  { name: 'Ön bacak', ids: ['leg_press', 'squat', 'leg_extension'], muscles: ['on_bacak', 'ic_bacak'] },
  { name: 'Kalça ve arka bacak', ids: ['hip_thrust', 'rdl', 'deadlift', 'lying_leg_curl', 'seated_leg_curl'], muscles: ['kalca', 'arka_bacak', 'bel'] }
]
/** Geriye dönük uyumluluk */
export const PATTERNS = REGIONS

export function hasStandard(id: string) { return id in STANDARDS_80 }

export function standardsFor(id: string, bodyweight: number) {
  const st = STANDARDS_80[id]
  if (!st) return null
  const k = Math.pow((bodyweight || 80) / 80, 0.67)
  return st.map((x) => Math.round(x * k * 2) / 2)
}

/** Yüzdelik dilim (0-100): kaç erkekten güçlü olduğun. */
export function liftScore(id: string, oneRm: number, bodyweight: number) {
  const st = standardsFor(id, bodyweight)
  if (!st || !oneRm) return 0
  if (oneRm <= st[0]) return Math.max(0, (oneRm / st[0]) * PCT[0])
  for (let i = 1; i < st.length; i++) if (oneRm <= st[i]) return PCT[i - 1] + ((oneRm - st[i - 1]) / (st[i] - st[i - 1])) * (PCT[i] - PCT[i - 1])
  return Math.min(100, 95 + ((oneRm - st[4]) / (st[4] - st[3])) * 5)
}
export function levelIndex(p: number) {
  let i = -1
  for (let k = 0; k < PCT.length; k++) if (p >= PCT[k]) i = k
  return i
}
export function levelOf(p: number) {
  const i = levelIndex(p)
  return i < 0 ? 'Yeni' : LEVELS[i]
}
export function nextLevelWeight(id: string, p: number, bodyweight: number) {
  const st = standardsFor(id, bodyweight)
  if (!st) return null
  const i = levelIndex(p) + 1
  if (i > 4) return null
  return { level: LEVELS[i], kg: st[i] }
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
  const regions = REGIONS.map((r) => {
    const lifts = r.ids.filter((id) => best[id]).map((id) => ({ id, e1: best[id].v, score: liftScore(id, best[id].v, bodyweight) })).sort((x, y) => y.score - x.score)
    // Bölge puanı: en iyi iki hareketin ortalaması (tek harekete aşırı bağımlılığı azaltır)
    const top = lifts.slice(0, 2)
    const score = top.length ? top.reduce((a, l) => a + l.score, 0) / top.length : 0
    return { ...r, lifts, score, id: lifts[0]?.id ?? '', e1: lifts[0]?.e1 ?? 0 }
  })
  const done = regions.filter((p) => p.score > 0)
  const total = done.length ? done.reduce((a, p) => a + p.score, 0) / done.length : 0
  const notes: string[] = []
  if (done.length >= 3) {
    const sorted = [...done].sort((x, y) => y.score - x.score)
    if (sorted[0].score - total > 12) notes.push(`En güçlü bölgen ${sorted[0].name}: ortalamanın ${Math.round(sorted[0].score - total)} puan üstünde.`)
    const weak = sorted[sorted.length - 1]
    if (total - weak.score > 12) notes.push(`Zayıf halka ${weak.name}: ortalamanın ${Math.round(total - weak.score)} puan altında. Programda bu bölgeye öncelik ver.`)
    const g = (n: string) => regions.find((r) => r.name === n)?.score ?? 0
    const push = (g('Göğüs') + g('Omuz')) / ((g('Göğüs') ? 1 : 0) + (g('Omuz') ? 1 : 0) || 1)
    if (g('Sırt') && push && push - g('Sırt') > 15) notes.push('İtiş gücün çekiş gücünden belirgin yüksek. Postür ve skolyoz için sırt hareketlerine ağırlık ver.')
    const upper = (g('Göğüs') + g('Sırt') + g('Omuz')) / 3, lower = (g('Ön bacak') + g('Kalça ve arka bacak')) / 2
    if (g('Ön bacak') && g('Kalça ve arka bacak') && Math.abs(upper - lower) > 15) notes.push(`${upper > lower ? 'Üst vücut alt vücuttan' : 'Alt vücut üst vücuttan'} belirgin güçlü.`)
    if (!notes.length) notes.push('Bölgeler arasında güç dengesi iyi; belirgin bir zayıf halka yok.')
  }
  return { patterns: regions, regions, total, covered: done.length, notes }
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
