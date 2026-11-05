import type { Exercise } from '../data/exercises'
import type { Checkin, Profile, Workout } from '../db'
import { DAY } from './analysis'
import { todayKey } from './nutrition'

/* ---------- Hazır olma skoru ---------- */
// Uyku süresi ve kalitesi, enerji, kas ağrısı, stres ve eklem ağrısından 0-100 arası skor.
export function readiness(c?: Checkin | null) {
  if (!c) return null
  const parts: { w: number; v: number }[] = []
  if (c.sleepHours != null) parts.push({ w: 2, v: Math.max(0, Math.min(1, (c.sleepHours - 4.5) / 3.5)) })
  if (c.sleepQuality != null) parts.push({ w: 1.5, v: (c.sleepQuality - 1) / 4 })
  if (c.energy != null) parts.push({ w: 2, v: (c.energy - 1) / 4 })
  if (c.soreness != null) parts.push({ w: 1.5, v: (5 - c.soreness) / 4 })
  if (c.stress != null) parts.push({ w: 1, v: (5 - c.stress) / 4 })
  const pain = Math.max(c.painKnee ?? 0, c.painBack ?? 0, c.painWrist ?? 0, c.painShoulder ?? 0)
  if (!parts.length && !pain) return null
  let score = parts.length ? (parts.reduce((a, p) => a + p.w * p.v, 0) / parts.reduce((a, p) => a + p.w, 0)) * 100 : 80
  if (pain >= 3) score -= (pain - 2) * 6
  score = Math.max(0, Math.min(100, Math.round(score)))
  const advice = pain >= 6 ? 'Eklem ağrın yüksek. Ağrıyan bölgeyi yükleyen hareketleri bugün atla, mobilite rutini yap.'
    : score >= 75 ? 'Hazırsın. Plana uy, öneri artış diyorsa ağırlığı artır.'
    : score >= 50 ? 'Normal antrenman yap ama rekor deneme; setlerde 2 tekrar pay bırak.'
    : 'Toparlanman düşük. Set sayısını üçte bir azalt veya hafif bir gün yap.'
  return { score, advice, pain }
}

/* ---------- Ağrı analizi ---------- */
// Her hareket için: o hareketin yapıldığı günün ertesi günkü ağrı ortalaması ile genel ortalama farkı.
export type Joint = 'painKnee' | 'painBack' | 'painWrist' | 'painShoulder'
export const JOINT_NAMES: Record<Joint, string> = { painKnee: 'Diz', painBack: 'Bel', painShoulder: 'Omuz', painWrist: 'Bilek' }

export function painLinks(checkins: Checkin[], workouts: Workout[], exMap: Map<string, Exercise>, joint: Joint) {
  const byDate = new Map(checkins.filter((c) => c[joint] != null).map((c) => [c.date, c[joint] as number]))
  if (byDate.size < 5) return { avg: null as number | null, links: [] as { id: string; name: string; after: number; n: number; diff: number }[] }
  const avg = [...byDate.values()].reduce((a, b) => a + b, 0) / byDate.size
  const acc = new Map<string, number[]>()
  for (const w of workouts) {
    const next = todayKey(new Date(w.startedAt + DAY))
    const same = todayKey(new Date(w.startedAt))
    const v = byDate.get(next) ?? byDate.get(same)
    if (v == null) continue
    for (const e of w.exercises) acc.set(e.exerciseId, [...(acc.get(e.exerciseId) ?? []), v])
  }
  const links = [...acc.entries()].filter(([, xs]) => xs.length >= 2).map(([id, xs]) => {
    const after = xs.reduce((a, b) => a + b, 0) / xs.length
    return { id, name: exMap.get(id)?.name ?? id, after, n: xs.length, diff: after - avg }
  }).sort((a, b) => b.diff - a.diff)
  return { avg, links }
}

/* ---------- Nabız bölgeleri ---------- */
export function hrZones(age: number) {
  const max = Math.round(208 - 0.7 * age)
  const z = [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((p) => Math.round(max * p))
  return {
    max,
    zones: [
      { n: 1, name: 'Toparlanma', lo: z[0], hi: z[1] },
      { n: 2, name: 'Aerobik', lo: z[1], hi: z[2] },
      { n: 3, name: 'Tempo', lo: z[2], hi: z[3] },
      { n: 4, name: 'Eşik', lo: z[3], hi: z[4] },
      { n: 5, name: 'Maks.', lo: z[4], hi: z[5] }
    ]
  }
}
export function zoneOf(hr: number, age: number) {
  const { zones } = hrZones(age)
  return zones.find((z) => hr >= z.lo && hr < z.hi)?.n ?? (hr >= zones[4].hi ? 5 : 0)
}

export function cardioMinutes(workouts: Workout[], exMap: Map<string, Exercise>, profile: Profile, days = 28) {
  const since = Date.now() - days * DAY
  const byZone: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const w of workouts) {
    if (w.startedAt < since) continue
    const mins = w.exercises.filter((e) => exMap.get(e.exerciseId)?.kind === 'time' && exMap.get(e.exerciseId)?.equipment !== 'bodyweight')
      .reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.seconds ?? 0), 0) / 60, 0)
    if (!mins) continue
    byZone[w.heartRateAvg ? zoneOf(w.heartRateAvg, profile.age) : 0] += mins
  }
  return byZone
}

/* ---------- Deload ---------- */
export function deloadAdvice(workouts: Workout[], checkins: Checkin[], plateauCount: number) {
  const reasons: string[] = []
  // Kesintisiz antrenman haftası sayısı
  let weeks = 0
  for (let i = 1; i <= 12; i++) {
    const s = Date.now() - i * 7 * DAY
    if (workouts.some((w) => w.startedAt >= s && w.startedAt < s + 7 * DAY)) weeks++; else break
  }
  if (weeks >= 7) reasons.push(`${weeks} haftadır ara vermeden antrenman yapıyorsun.`)
  if (plateauCount >= 3) reasons.push(`${plateauCount} harekette 3+ haftadır rekor yok.`)
  const recent = checkins.filter((c) => new Date(c.date).getTime() > Date.now() - 7 * DAY).map((c) => readiness(c)?.score).filter((x): x is number => x != null)
  if (recent.length >= 3 && recent.reduce((a, b) => a + b, 0) / recent.length < 55) reasons.push('Son bir haftada hazır olma skorun düşük.')
  return { suggest: reasons.length >= 2 || (reasons.length === 1 && weeks >= 9), reasons }
}

/* ---------- Antrenmanla yakılan kalori ---------- */
// Ağırlık antrenmanı ve kardiyo için saatlik aktif kalori (profilden, varsayılan 380 / 500 kcal).
export function workoutBurn(w: Workout, exMap: Map<string, Exercise>, profile: Profile, now = Date.now()) {
  const totalMin = Math.max(0, ((w.endedAt ?? now) - w.startedAt) / 60000)
  const cardioMin = Math.min(totalMin, w.exercises
    .filter((e) => exMap.get(e.exerciseId)?.kind === 'time' && exMap.get(e.exerciseId)?.equipment !== 'bodyweight')
    .reduce((a, e) => a + e.sets.filter((s) => s.done !== false).reduce((b, s) => b + (s.seconds ?? 0), 0) / 60, 0))
  const weightMin = totalMin - cardioMin
  const hr = w.heartRateAvg
  if (hr && hr >= 80 && totalMin > 0) {
    // Ortalama nabız girildiyse Keytel (2005) formülü: toplam harcama − dinlenme (bazal) = aktif kalori
    const kg = w.bodyweight ?? profile.bodyweight, age = profile.age
    const perMin = profile.sex === 'f'
      ? (-20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * age) / 4.184
      : (-55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * age) / 4.184
    const bmr = 10 * kg + 6.25 * profile.height - 5 * age + (profile.sex === 'm' ? 5 : -161)
    const active = Math.max(0, perMin - bmr / 1440)
    const weights = active * weightMin, cardio = active * cardioMin
    return { weightMin, cardioMin, weights, cardio, kcal: Math.round(weights + cardio), method: 'hr' as const }
  }
  const weights = (weightMin / 60) * profile.kcalWeights
  const cardio = (cardioMin / 60) * profile.kcalCardio
  return { weightMin, cardioMin, weights, cardio, kcal: Math.round(weights + cardio), method: 'rate' as const }
}

/** Bir günde (YYYY-AA-GG) yapılan antrenmanların toplam aktif kalorisi; devam eden antrenman dahil. */
export function dayBurn(day: string, workouts: Workout[], exMap: Map<string, Exercise>, profile: Profile, active?: Workout | null) {
  const list = [...workouts.filter((w) => todayKey(new Date(w.startedAt)) === day), ...(active && todayKey(new Date(active.startedAt)) === day ? [active] : [])]
  const parts = list.map((w) => ({ w, ...workoutBurn(w, exMap, profile) }))
  return {
    kcal: parts.reduce((a, p) => a + p.kcal, 0),
    weightMin: parts.reduce((a, p) => a + p.weightMin, 0),
    cardioMin: parts.reduce((a, p) => a + p.cardioMin, 0),
    parts
  }
}
