import { db, getKV, getProfile, setKV, type Routine, type SetEntry, type Workout, type WorkoutExercise } from '../db'
import { BUILTIN_EXERCISES } from '../data/exercises'
import { parseRange, recommend } from './progression'
import { readiness } from './health'
import { todayKey } from './nutrition'

const r25 = (x: number, step = 2.5) => Math.round(x / step) * step

/** Bugünün antrenman modu: deload haftası veya düşük hazır olma skoru. */
export async function trainingMode() {
  const until = await getKV<number | null>('deloadUntil', null)
  if (until && until > Date.now()) return { mode: 'deload' as const }
  const r = readiness(await db.checkins.get(todayKey()))
  if (r && r.score < 50) return { mode: 'low' as const, score: r.score }
  return { mode: 'normal' as const }
}

/** Hareketin en son yapıldığı antrenmandaki setler. */
export async function lastSetsFor(exerciseId: string, beforeTs = Infinity): Promise<SetEntry[] | null> {
  const ws = await db.workouts.orderBy('startedAt').reverse().toArray()
  for (const w of ws) {
    if (w.startedAt >= beforeTs) continue
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId)
    if (ex) return ex.sets.filter((s) => s.done)
  }
  return null
}

export async function makeExercise(exerciseId: string, setCount = 3, restSec?: number, superset?: string, repRange?: string): Promise<WorkoutExercise> {
  const profile = await getProfile()
  const last = await lastSetsFor(exerciseId)
  const work = last?.filter((s) => s.type !== 'warmup') ?? []
  const ex = BUILTIN_EXERCISES.find((e) => e.id === exerciseId) ?? (await db.customExercises.get(exerciseId))
  const adv = recommend(ex, exerciseId, await db.workouts.toArray(), parseRange(repRange), setCount)
  const tm = await trainingMode()
  if (adv && adv.tone !== 'new') {
    const step = ex?.equipment === 'dumbbell' ? 1 : 2.5
    if (tm.mode === 'deload') {
      adv.sets = Math.max(1, Math.round(adv.sets * 0.6))
      adv.weight = adv.weight != null ? r25(adv.weight * 0.9, step) : adv.weight
      adv.text = `Deload haftası: ağırlık %10, set sayısı %40 azaltıldı. ${adv.text}`
      adv.tone = 'down'
    } else if (tm.mode === 'low' && adv.tone === 'up') {
      const prev = work.reduce((m, s) => Math.max(m, s.weight ?? 0), 0)
      if (prev) adv.weight = prev
      adv.text = `Hazır olma skorun düşük (${tm.score}), bugün artış yok; geçen haftanın ağırlığıyla kal.`
      adv.tone = 'same'
    }
  }
  const n = adv?.sets ?? setCount
  const sets: SetEntry[] = Array.from({ length: n }, (_, i) => {
    const prev = work[i] ?? work[work.length - 1]
    if (adv && adv.tone !== 'new') return { type: 'normal', done: false, weight: adv.weight, reps: adv.reps[i] ?? adv.reps[adv.reps.length - 1] }
    return { type: 'normal', done: false, weight: prev?.weight, reps: prev?.reps, seconds: prev?.seconds }
  })
  return { exerciseId, sets, restSec: restSec ?? profile.defaultRest, superset, target: repRange, advice: adv?.text, adviceTone: adv?.tone }
}

export async function startWorkout(routine?: Routine) {
  const exercises: WorkoutExercise[] = []
  if (routine) {
    for (const r of routine.exercises) exercises.push(await makeExercise(r.exerciseId, r.sets, r.restSec, r.superset, r.reps))
  }
  const w: Workout = {
    name: routine?.name ?? 'Serbest antrenman',
    startedAt: Date.now(),
    routineId: routine?.id,
    exercises
  }
  await setKV('active', w)
  await setKV('rest', null)
}

export async function finishWorkout(w: Workout) {
  const cleaned: Workout = {
    ...w,
    endedAt: Date.now(),
    exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length > 0)
  }
  delete cleaned.id
  const profile = await getProfile()
  cleaned.bodyweight ??= profile.bodyweight
  const id = cleaned.exercises.length ? await db.workouts.add(cleaned) : undefined
  await db.kv.delete('active')
  await db.kv.delete('rest')
  return id
}

export async function discardWorkout() {
  await db.kv.delete('active')
  await db.kv.delete('rest')
}

/** Sağlık kısıtlarına uygun örnek 4 günlük üst/alt program. */
export const SAMPLE_ROUTINES: Omit<Routine, 'updatedAt'>[] = [
  { name: 'Üst Vücut A', folder: 'Örnek program', exercises: [
    { exerciseId: 'db_bench_press', sets: 3, reps: '6-10', restSec: 150 },
    { exerciseId: 'chest_supported_row', sets: 3, reps: '8-12', restSec: 120 },
    { exerciseId: 'machine_shoulder_press', sets: 3, reps: '8-12', restSec: 120 },
    { exerciseId: 'lat_pulldown', sets: 3, reps: '8-12', restSec: 120 },
    { exerciseId: 'cable_lateral_raise', sets: 3, reps: '12-15', restSec: 60, superset: 'a' },
    { exerciseId: 'face_pull', sets: 3, reps: '12-15', restSec: 60, superset: 'a' },
    { exerciseId: 'hammer_curl', sets: 2, reps: '10-12', restSec: 60, superset: 'b' },
    { exerciseId: 'triceps_pushdown', sets: 2, reps: '10-12', restSec: 60, superset: 'b' }
  ] },
  { name: 'Alt Vücut A', folder: 'Örnek program', exercises: [
    { exerciseId: 'leg_press', sets: 3, reps: '8-12', restSec: 150 },
    { exerciseId: 'hip_thrust', sets: 3, reps: '8-12', restSec: 120 },
    { exerciseId: 'lying_leg_curl', sets: 3, reps: '10-12', restSec: 90 },
    { exerciseId: 'hip_abduction', sets: 2, reps: '12-15', restSec: 60 },
    { exerciseId: 'seated_calf', sets: 3, reps: '10-15', restSec: 60 },
    { exerciseId: 'pallof_press', sets: 3, reps: '10/taraf', restSec: 60 },
    { exerciseId: 'dead_bug', sets: 2, reps: '8/taraf', restSec: 45 }
  ] },
  { name: 'Üst Vücut B', folder: 'Örnek program', exercises: [
    { exerciseId: 'incline_db_press', sets: 3, reps: '8-12', restSec: 120 },
    { exerciseId: 'seated_cable_row', sets: 3, reps: '8-12', restSec: 120 },
    { exerciseId: 'assisted_pull_up', sets: 3, reps: '6-10', restSec: 120 },
    { exerciseId: 'cable_fly', sets: 2, reps: '12-15', restSec: 60 },
    { exerciseId: 'machine_lateral_raise', sets: 3, reps: '12-15', restSec: 60 },
    { exerciseId: 'rear_delt_fly', sets: 2, reps: '12-15', restSec: 60 },
    { exerciseId: 'incline_db_curl', sets: 2, reps: '10-12', restSec: 60, superset: 'a' },
    { exerciseId: 'overhead_cable_ext', sets: 2, reps: '10-12', restSec: 60, superset: 'a' }
  ] },
  { name: 'Alt Vücut B', folder: 'Örnek program', exercises: [
    { exerciseId: 'belt_squat', sets: 3, reps: '8-12', restSec: 150 },
    { exerciseId: 'back_extension_45', sets: 3, reps: '10-15', restSec: 90 },
    { exerciseId: 'leg_press_single', sets: 2, reps: '10-12', restSec: 90 },
    { exerciseId: 'seated_leg_curl', sets: 3, reps: '10-12', restSec: 90 },
    { exerciseId: 'leg_press_calf', sets: 3, reps: '12-15', restSec: 60 },
    { exerciseId: 'side_plank', sets: 2, reps: '30-45 sn', restSec: 45 },
    { exerciseId: 'treadmill_incline', sets: 1, reps: '20 dk', restSec: 0 }
  ] }
]

/** Isınma, mobilite ve skolyoz/bel bakımı rutinleri. Fizyoterapistinin verdiği egzersizler önceliklidir. */
export const MOBILITY_ROUTINES: Omit<Routine, 'updatedAt'>[] = [
  { name: 'Isınma: Üst vücut', folder: 'Isınma ve mobilite', exercises: [
    { exerciseId: 'cat_cow', sets: 1, reps: '10', restSec: 0 },
    { exerciseId: 'band_pull_apart', sets: 2, reps: '15', restSec: 20 },
    { exerciseId: 'wall_angel', sets: 2, reps: '10', restSec: 20 },
    { exerciseId: 'thoracic_rotation', sets: 1, reps: '8/taraf', restSec: 0 },
    { exerciseId: 'dead_hang', sets: 2, reps: '30 sn', restSec: 30 }
  ] },
  { name: 'Isınma: Alt vücut', folder: 'Isınma ve mobilite', exercises: [
    { exerciseId: 'cat_cow', sets: 1, reps: '10', restSec: 0 },
    { exerciseId: 'glute_bridge', sets: 2, reps: '12', restSec: 20 },
    { exerciseId: 'clamshell', sets: 2, reps: '15/taraf', restSec: 20 },
    { exerciseId: 'hip_9090', sets: 1, reps: '6/taraf', restSec: 0 },
    { exerciseId: 'tke', sets: 2, reps: '15', restSec: 20 },
    { exerciseId: 'bird_dog', sets: 1, reps: '8/taraf', restSec: 0 }
  ] },
  { name: 'Skolyoz ve bel bakımı', folder: 'Isınma ve mobilite', exercises: [
    { exerciseId: 'cat_cow', sets: 1, reps: '10', restSec: 0 },
    { exerciseId: 'mcgill_curl_up', sets: 3, reps: '8', restSec: 30 },
    { exerciseId: 'side_plank', sets: 2, reps: '30 sn/taraf', restSec: 30 },
    { exerciseId: 'bird_dog', sets: 2, reps: '8/taraf', restSec: 30 },
    { exerciseId: 'dead_bug', sets: 2, reps: '8/taraf', restSec: 30 },
    { exerciseId: 'dead_hang', sets: 2, reps: '30 sn', restSec: 30 },
    { exerciseId: 'childs_pose', sets: 1, reps: '60 sn', restSec: 0 }
  ] }
]
