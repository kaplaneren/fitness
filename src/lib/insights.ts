import type { Exercise, Muscle } from '../data/exercises'
import { MUSCLE_GROUPS, MUSCLE_NAMES } from '../data/exercises'
import type { DiaryEntry, Measurement, Profile, Workout } from '../db'
import { DAY, WEEKLY_RANGE, bestE1rmByExercise, muscleSets, volumeStatus } from './analysis'
import { e1rm, workoutSetCount, workoutVolume } from './calc'
import { targets, todayKey } from './nutrition'

export function mondayOf(t: number) {
  const d = new Date(t); const day = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime()
}
const dayKeyOf = (t: number) => todayKey(new Date(t))

/* ---------- Kilo trendi ---------- */
/** Günlük dalgalanmayı süzen üstel hareketli ortalama (her gün için). */
export function weightTrend(ms: Measurement[], bodyweight: number) {
  return seriesTrend(ms.filter((m) => m.weight).map((m) => ({ t: m.date, v: m.weight! })), bodyweight)
}

/** Bel çevresi ve kilodan yağ oranı tahmini (YMCA formülü). */
export function estimateBodyFat(waistCm: number, weightKg: number, sex: 'm' | 'f') {
  const wIn = waistCm / 2.54, lb = weightKg * 2.2046
  const bf = ((sex === 'm' ? -98.42 : -76.76) + 4.15 * wIn - 0.082 * lb) / lb * 100
  return Math.round(bf * 10) / 10
}

/** Her ölçüm için bel+kilo ile yağ tahmini (eksik kilo için en yakın önceki kilo kullanılır). */
export function bodyFatSeries(ms: Measurement[], sex: 'm' | 'f', fallbackWeight: number) {
  const sorted = [...ms].sort((a, b) => a.date - b.date)
  let lastW = fallbackWeight
  const est: { t: number; v: number }[] = [], measured: { t: number; v: number }[] = []
  for (const m of sorted) {
    if (m.weight) lastW = m.weight
    if (m.waist) est.push({ t: m.date, v: estimateBodyFat(m.waist, lastW, sex) })
    if (m.bodyFat) measured.push({ t: m.date, v: m.bodyFat })
  }
  return { est, measured }
}

export function seriesTrend(input: { t: number; v: number }[], _unused = 0) {
  const pts = [...input].sort((a, b) => a.t - b.t)
  if (!pts.length) return { raw: [], smooth: [], rate: null as number | null }
  const alpha = 0.15
  const smooth: { t: number; v: number }[] = []
  let ema = pts[0].v, lastT = pts[0].t
  for (const p of pts) {
    const days = Math.max(1, (p.t - lastT) / DAY)
    const a = 1 - Math.pow(1 - alpha, days)
    ema = ema + a * (p.v - ema); lastT = p.t
    smooth.push({ t: p.t, v: Math.round(ema * 100) / 100 })
  }
  // Son 21 gündeki eğim (kg/hafta)
  const recent = smooth.filter((p) => p.t >= smooth[smooth.length - 1].t - 21 * DAY)
  let rate: number | null = null
  if (recent.length >= 2 && recent[recent.length - 1].t - recent[0].t >= 7 * DAY) {
    rate = ((recent[recent.length - 1].v - recent[0].v) / ((recent[recent.length - 1].t - recent[0].t) / DAY)) * 7
  }
  return { raw: pts, smooth, rate }
}

export function goalEta(current: number, target: number | undefined, rate: number | null) {
  if (!target || rate == null || Math.abs(current - target) < 0.2) return null
  const need = target - current
  if (Math.sign(need) !== Math.sign(rate) || Math.abs(rate) < 0.05) return { weeks: null as number | null, date: null as number | null }
  const weeks = need / rate
  return { weeks, date: Date.now() + weeks * 7 * DAY }
}

/* ---------- Adaptif TDEE ---------- */
/** Son N günde: ortalama alınan kalori − (trend kilo değişimi × 7700 / gün). */
export function adaptiveTdee(diary: DiaryEntry[], ms: Measurement[], days = 21) {
  const since = Date.now() - days * DAY
  const byDay = new Map<string, number>()
  for (const e of diary) if (new Date(e.date).getTime() >= since - DAY) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.kcal)
  const logged = [...byDay.values()].filter((k) => k > 600)
  const tr = weightTrend(ms.filter((m) => m.date >= since - 7 * DAY), 0).smooth.filter((p) => p.t >= since)
  if (logged.length < 10 || tr.length < 2) return { tdee: null as number | null, loggedDays: logged.length, weightPoints: tr.length, avgIntake: logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0 }
  const avgIntake = logged.reduce((a, b) => a + b, 0) / logged.length
  const span = (tr[tr.length - 1].t - tr[0].t) / DAY
  const dW = tr[tr.length - 1].v - tr[0].v
  const tdee = avgIntake - (dW * 7700) / Math.max(7, span)
  return { tdee: Math.round(tdee / 10) * 10, loggedDays: logged.length, weightPoints: tr.length, avgIntake: Math.round(avgIntake) }
}

/* ---------- Plato dedektörü ---------- */
export interface Plateau { id: string; name: string; weeks: number; best: number; tip: string }
export function strengthPlateaus(workouts: Workout[], exMap: Map<string, Exercise>): Plateau[] {
  const now = Date.now()
  const out: Plateau[] = []
  const ids = new Set(workouts.filter((w) => w.startedAt > now - 42 * DAY).flatMap((w) => w.exercises.map((e) => e.exerciseId)))
  for (const id of ids) {
    const ex = exMap.get(id)
    if (!ex || ex.kind !== 'weight') continue
    const sessions = workouts.filter((w) => w.exercises.some((e) => e.exerciseId === id)).map((w) => ({
      t: w.startedAt,
      v: Math.max(0, ...w.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter((s) => s.type !== 'warmup' && (s.reps ?? 99) <= 12).map((s) => e1rm(s.weight, s.reps, s.rir))))
    })).filter((s) => s.v > 0)
    if (sessions.length < 4) continue
    const best = Math.max(...sessions.map((s) => s.v))
    const bestAt = sessions.find((s) => s.v === best)!.t
    const weeks = (now - bestAt) / (7 * DAY)
    if (weeks >= 3 && sessions.filter((s) => s.t > bestAt).length >= 2) {
      const tip = weeks >= 5
        ? 'Bir hafta hacmi yarıya indir (deload), sonra tekrar aralığını değiştir (ör. 6-8 yerine 10-12).'
        : 'Tekrar aralığını değiştir ya da set sayısını bir artır. Uyku ve protein alımını kontrol et.'
      out.push({ id, name: ex.name, weeks: Math.floor(weeks), best, tip })
    }
  }
  return out.sort((a, b) => b.weeks - a.weeks)
}

export function weightPlateau(ms: Measurement[], profile: Profile) {
  const tr = weightTrend(ms, profile.bodyweight).smooth
  if (tr.length < 4) return null
  const last = tr[tr.length - 1]
  const old = [...tr].reverse().find((p) => p.t <= last.t - 14 * DAY)
  if (!old) return null
  const change = last.v - old.v
  if (profile.goal === 'cut' && change > -0.2) {
    return { days: Math.round((last.t - old.t) / DAY), change, tip: 'Kilo 2 haftadır düşmüyor. Önce kayıtların eksiksiz mi kontrol et; doğruysa günlük kaloriyi 150 kcal azalt veya haftaya 2 × 20 dk eğimli yürüyüş ekle.' }
  }
  if (profile.goal === 'bulk' && change < 0.1) {
    return { days: Math.round((last.t - old.t) / DAY), change, tip: 'Kilo 2 haftadır artmıyor. Günlük kaloriyi 150 kcal artır.' }
  }
  return null
}

/* ---------- Devamlılık ---------- */
export function consistency(workouts: Workout[], weeklyTarget: number, weeks = 16) {
  const start = mondayOf(Date.now()) - (weeks - 1) * 7 * DAY
  const days = new Map<string, number>()
  for (const w of workouts) if (w.startedAt >= start) days.set(dayKeyOf(w.startedAt), (days.get(dayKeyOf(w.startedAt)) ?? 0) + (workoutSetCount(w) || (w.activity ? 1 : 0)))
  const grid: { key: string; t: number; sets: number }[][] = []
  for (let wk = 0; wk < weeks; wk++) {
    const col = []
    for (let d = 0; d < 7; d++) { const t = start + (wk * 7 + d) * DAY; const key = dayKeyOf(t); col.push({ key, t, sets: days.get(key) ?? 0 }) }
    grid.push(col)
  }
  const perWeek = grid.map((col) => col.filter((c) => c.sets > 0).length)
  // Bu hafta henüz bitmediği için seride geçen haftadan geriye say
  let streak = 0
  for (let i = perWeek.length - 2; i >= 0; i--) { if (perWeek[i] >= weeklyTarget) streak++; else break }
  if (perWeek[perWeek.length - 1] >= weeklyTarget) streak++
  const hit = perWeek.slice(0, -1).filter((n) => n >= weeklyTarget).length
  return { grid, perWeek, streak, hitRate: hit / Math.max(1, perWeek.length - 1), start }
}

/* ---------- Denge ---------- */
const PUSH: Muscle[] = ['gogus', 'on_omuz', 'triceps']
const PULL: Muscle[] = ['kanat', 'sirt_ust', 'arka_omuz', 'biceps']
const UPPER: Muscle[] = ['gogus', 'on_omuz', 'yan_omuz', 'arka_omuz', 'triceps', 'biceps', 'kanat', 'sirt_ust', 'trapez']
const LOWER: Muscle[] = ['kalca', 'on_bacak', 'arka_bacak', 'ic_bacak', 'baldir']
export function balance(workouts: Workout[], exMap: Map<string, Exercise>, days = 28) {
  const s = muscleSets(workouts, exMap, Date.now() - days * DAY)
  const sum = (ms: Muscle[]) => ms.reduce((a, m) => a + (s[m] ?? 0), 0)
  return { push: sum(PUSH), pull: sum(PULL), upper: sum(UPPER), lower: sum(LOWER) }
}

/* ---------- Kas grubu hacim trendi ---------- */
export function groupVolumeWeeks(workouts: Workout[], exMap: Map<string, Exercise>, weeks = 8) {
  // Sadece bitmiş haftalar: süren hafta grafikte yapay bir düşüş gibi görünüyordu
  const m0 = mondayOf(Date.now()) - 7 * DAY
  return Array.from({ length: weeks }, (_, i) => {
    const s = m0 - (weeks - 1 - i) * 7 * DAY
    const ws = workouts.filter((w) => w.startedAt >= s && w.startedAt < s + 7 * DAY)
    const sets = muscleSets(ws, exMap, 0)
    return { t: s, groups: Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.name, Math.round(g.muscles.reduce((a, m) => a + (sets[m] ?? 0), 0))])) as Record<string, number> }
  })
}

/* ---------- Tekrar rekorları ---------- */
export function repMaxes(workouts: Workout[], id: string) {
  const best: Record<number, { w: number; t: number }> = {}
  for (const w of workouts) for (const e of w.exercises) if (e.exerciseId === id) for (const s of e.sets) {
    if (s.type === 'warmup' || !s.reps || !s.weight || s.reps > 15) continue
    if (s.weight > (best[s.reps]?.w ?? 0)) best[s.reps] = { w: s.weight, t: w.startedAt }
  }
  return best
}

/* ---------- Beslenme analizi ---------- */
export function nutritionStats(diary: DiaryEntry[], profile: Profile, days = 28) {
  const t = targets(profile)
  const since = Date.now() - days * DAY
  const byDay = new Map<string, { kcal: number; p: number; c: number; f: number }>()
  for (const e of diary) {
    if (new Date(e.date).getTime() < since) continue
    const d = byDay.get(e.date) ?? { kcal: 0, p: 0, c: 0, f: 0 }
    d.kcal += e.kcal; d.p += e.p; d.c += e.c; d.f += e.f
    byDay.set(e.date, d)
  }
  const logged = [...byDay.entries()].filter(([, d]) => d.kcal > 600)
  if (!logged.length) return null
  const avg = (k: 'kcal' | 'p' | 'c' | 'f', list = logged) => list.reduce((a, [, d]) => a + d[k], 0) / Math.max(1, list.length)
  const weekend = logged.filter(([k]) => [0, 6].includes(new Date(k).getDay()))
  const weekday = logged.filter(([k]) => ![0, 6].includes(new Date(k).getDay()))
  const onKcal = logged.filter(([, d]) => Math.abs(d.kcal - t.kcal) <= t.kcal * 0.1).length
  const onProtein = logged.filter(([, d]) => d.p >= t.protein * 0.9).length
  const kcal = avg('kcal'), p = avg('p'), c = avg('c'), f = avg('f')
  const energy = p * 4 + c * 4 + f * 9 || 1
  return {
    t, days: logged.length, kcal, p, c, f,
    proteinPerKg: p / profile.bodyweight,
    split: { p: (p * 4) / energy, c: (c * 4) / energy, f: (f * 9) / energy },
    onKcal: onKcal / logged.length, onProtein: onProtein / logged.length,
    weekend: weekend.length ? avg('kcal', weekend) : null, weekday: weekday.length ? avg('kcal', weekday) : null,
    series: logged.map(([k, d]) => ({ t: new Date(k).getTime(), v: Math.round(d.kcal) })).sort((a, b) => a.t - b.t),
    proteinSeries: logged.map(([k, d]) => ({ t: new Date(k).getTime(), v: Math.round(d.p) })).sort((a, b) => a.t - b.t)
  }
}

/* ---------- Haftalık rapor ---------- */
export interface Note { tone: 'good' | 'warn' | 'bad'; text: string }
export function weeklyReport(weekStart: number, workouts: Workout[], diary: DiaryEntry[], ms: Measurement[], exMap: Map<string, Exercise>, profile: Profile) {
  const end = weekStart + 7 * DAY, prevStart = weekStart - 7 * DAY
  const inW = (t: number, s: number) => t >= s && t < s + 7 * DAY
  // Süren hafta, geçen haftanın aynı dönemiyle (pazartesiden aynı gün ve saate kadar) kıyaslanır; yoksa pazartesi her şey "düşüş" görünür
  const partial = end > Date.now()
  const elapsed = partial ? Math.max(0, Date.now() - weekStart) : 7 * DAY
  const cur = workouts.filter((w) => inW(w.startedAt, weekStart)), prev = workouts.filter((w) => w.startedAt >= prevStart && w.startedAt < prevStart + elapsed)
  const stat = (ws: Workout[]) => ({
    n: ws.length, sets: ws.reduce((a, w) => a + workoutSetCount(w), 0), vol: ws.reduce((a, w) => a + workoutVolume(w), 0),
    mins: ws.length ? ws.reduce((a, w) => a + ((w.endedAt ?? w.startedAt) - w.startedAt), 0) / ws.length / 60000 : 0
  })
  const a = stat(cur), b = stat(prev), bFull = stat(workouts.filter((w) => inW(w.startedAt, prevStart)))

  const before = bestE1rmByExercise(workouts.filter((w) => w.startedAt < weekStart))
  const prs: { id: string; name: string; v: number; gain: number }[] = []
  const after = bestE1rmByExercise(cur)
  for (const [id, x] of Object.entries(after)) if (before[id] && x.v > before[id].v) prs.push({ id, name: exMap.get(id)?.name ?? id, v: x.v, gain: x.v - before[id].v })

  const sets = muscleSets(cur, exMap, 0)
  const under = (Object.keys(WEEKLY_RANGE) as Muscle[]).filter((m) => WEEKLY_RANGE[m][0] >= 6 && volumeStatus(m, sets[m] ?? 0) === 'low')

  const t = targets(profile)
  const days = Array.from({ length: 7 }, (_, i) => dayKeyOf(weekStart + i * DAY))
  const dk = days.map((d) => diary.filter((e) => e.date === d)).filter((es) => es.reduce((x, e) => x + e.kcal, 0) > 600)
  const avgKcal = dk.length ? dk.reduce((x, es) => x + es.reduce((y, e) => y + e.kcal, 0), 0) / dk.length : null
  const avgP = dk.length ? dk.reduce((x, es) => x + es.reduce((y, e) => y + e.p, 0), 0) / dk.length : null

  const wAvg = (s: number) => { const xs = ms.filter((m) => m.weight && inW(m.date, s)).map((m) => m.weight!); return xs.length ? xs.reduce((x, y) => x + y) / xs.length : null }
  const wCur = wAvg(weekStart), wPrev = wAvg(prevStart)

  const notes: Note[] = []
  if (a.n >= profile.weeklyTarget) notes.push({ tone: 'good', text: `Haftalık hedefin olan ${profile.weeklyTarget} antrenmanı tamamladın.` })
  else if (end < Date.now()) notes.push({ tone: 'warn', text: `${profile.weeklyTarget} antrenman hedefinin ${a.n} tanesi yapıldı. Kaçırdığın günü telafi etmeye çalışma, programa sıradan devam et.` })
  if (b.vol > 0 && a.vol > 0) {
    const d = (a.vol - b.vol) / b.vol
    if (d > 0.25) notes.push({ tone: 'warn', text: `Hacim geçen haftaya göre %${Math.round(d * 100)} arttı. Ani artış eklem yükünü artırır; artışı haftada %10-15 ile sınırla.` })
    else if (d < -0.25) notes.push({ tone: 'warn', text: `Hacim geçen haftaya göre %${Math.round(-d * 100)} düştü.` })
  }
  if (prs.length) notes.push({ tone: 'good', text: `${prs.length} harekette yeni tahmini 1RM rekoru.` })
  if (under.length && a.n && !partial) notes.push({ tone: 'warn', text: `Hedef set sayısının altında kalan kaslar: ${under.slice(0, 5).map((m) => MUSCLE_NAMES[m]).join(', ')}.` })
  if (avgKcal != null) {
    const diff = avgKcal - t.kcal
    if (Math.abs(diff) <= t.kcal * 0.08) notes.push({ tone: 'good', text: `Kalori ortalaman (${Math.round(avgKcal)}) hedefe yakın.` })
    else notes.push({ tone: 'warn', text: `Kalori ortalaman hedefin ${Math.abs(Math.round(diff))} kcal ${diff > 0 ? 'üstünde' : 'altında'}.` })
    if (avgP != null && avgP < t.protein * 0.9) notes.push({ tone: 'warn', text: `Protein ortalaman ${Math.round(avgP)} g; hedef ${t.protein} g. Her öğüne bir protein kaynağı ekle.` })
    if (dk.length < 5 && !partial) notes.push({ tone: 'warn', text: `Bu hafta ${dk.length} gün beslenme kaydı var. Doğru analiz için en az 5 gün kaydet.` })
  }
  const curWeighins = ms.filter((m) => m.weight && inW(m.date, weekStart)).length
  if (wCur != null && wPrev != null && (!partial || curWeighins >= 3)) {
    const d = wCur - wPrev
    const pct = (d / wPrev) * 100
    if (profile.goal === 'cut') {
      if (pct < -1) notes.push({ tone: 'warn', text: `Kilo haftada ${Math.abs(d).toFixed(1)} kg düştü; kas kaybı riski için hızlı. Günlük 100-150 kcal ekle.` })
      else if (pct <= -0.3) notes.push({ tone: 'good', text: `Kilo haftada ${Math.abs(d).toFixed(1)} kg düştü; yağ yakımı için ideal hız.` })
      else notes.push({ tone: 'warn', text: `Ortalama kilo bu hafta ${d > 0 ? '+' : ''}${d.toFixed(1)} kg. Bir hafta daha böyle giderse kaloriyi 150 kcal azalt.` })
    }
  }
  return { a, b, bFull, prs, under, avgKcal, avgP, wCur, wPrev, notes, logged: dk.length, partial, elapsed }
}
