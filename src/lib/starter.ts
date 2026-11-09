import { BUILTIN_EXERCISES, type Exercise } from '../data/exercises'
import type { Profile, Workout } from '../db'
import { LEVELS, REGIONS, levelIndex, standardsFor, strengthProfile } from './analysis'

// Hiç yapılmamış hareket için ilk ağırlık önerisi.
// 1) Kullanıcının güç yüzdeliği bulunur: hareketin bölgesindeki (göğüs, sırt...) puanı, yoksa genel puanı,
//    hiç kayıt yoksa yeni başlayan varsayılır (%8).
// 2) O yüzdelikte strengthlevel.com standartlarından tahmini 1RM okunur (kilo ve cinsiyete göre ölçekli).
//    Standardı olmayan hareketler, benzer bir standart hareketin 1RM'inin yaklaşık oranıyla hesaplanır.
// 3) İlk seans temkinli: yüzdelik 10 puan aşağı alınır ve hedef tekrarın 3 fazlasını yapabileceğin ağırlık
//    (RIR 3) Epley formülüyle bulunur, aşağı yuvarlanır. Sağlık kısıtı varsa %15 daha hafif.

const PCT = [5, 20, 50, 80, 95]

/** Standardı olmayan hareketler: [benzer standart hareket, 1RM oranı]. Dambıllarda tek dambıl. Yaklaşık değerler. */
const RELATIVE: Record<string, [string, number]> = {
  smith_incline: ['incline_bench', 0.95], close_grip_bench: ['bench_press', 0.88], skull_crusher: ['bench_press', 0.45],
  cable_fly: ['machine_chest_press', 0.35], pec_deck: ['machine_chest_press', 0.75], db_fly: ['db_bench_press', 0.45],
  one_arm_db_row: ['seated_cable_row', 0.48], incline_db_row: ['seated_cable_row', 0.36], straight_arm_pulldown: ['lat_pulldown', 0.45],
  face_pull: ['seated_cable_row', 0.4], cable_crunch: ['lat_pulldown', 0.6],
  db_rdl: ['rdl', 0.36], shrug_db: ['deadlift', 0.25], suitcase_carry: ['deadlift', 0.25],
  landmine_press: ['ohp', 0.5], lateral_raise: ['seated_db_press', 0.42], cable_lateral_raise: ['seated_db_press', 0.3],
  machine_lateral_raise: ['machine_shoulder_press', 0.5], rear_delt_fly: ['machine_shoulder_press', 0.65],
  db_rear_delt: ['seated_db_press', 0.35], front_raise: ['seated_db_press', 0.42],
  hammer_curl: ['db_curl', 1.05], incline_db_curl: ['db_curl', 0.85], preacher_curl: ['barbell_curl', 0.85],
  cable_curl: ['barbell_curl', 0.95], wrist_curl: ['db_curl', 0.6],
  overhead_cable_ext: ['triceps_pushdown', 0.75], db_overhead_ext: ['triceps_pushdown', 0.5],
  front_squat: ['squat', 0.82], goblet_squat: ['squat', 0.28], smith_squat: ['squat', 0.95], hack_squat: ['squat', 1.0],
  belt_squat: ['squat', 0.9], leg_press_single: ['leg_press', 0.45], bulgarian_split: ['squat', 0.2], lunge: ['squat', 0.22],
  step_up: ['squat', 0.18], hip_thrust_machine: ['hip_thrust', 0.8], cable_kickback: ['hip_thrust', 0.12],
  hip_abduction: ['leg_extension', 1.0], hip_adduction: ['leg_extension', 1.0],
  standing_calf: ['leg_press', 0.52], seated_calf: ['leg_press', 0.35], leg_press_calf: ['leg_press', 0.75]
}

function oneRmAt(st: number[], p: number) {
  if (p <= PCT[0]) return st[0] * Math.max(0.4, p / PCT[0])
  for (let i = 1; i < PCT.length; i++) if (p <= PCT[i]) return st[i - 1] + ((p - PCT[i - 1]) / (PCT[i] - PCT[i - 1])) * (st[i] - st[i - 1])
  return st[4]
}

export interface Starter { weight: number; oneRm: number; pct: number; basis: string; text: string }

export function starterWeight(id: string, ex: Exercise | undefined, range: [number, number] | null, workouts: Workout[], profile: Pick<Profile, 'bodyweight' | 'sex' | 'restrictions' | 'barWeight'>): Starter | null {
  if (!ex || ex.kind !== 'weight') return null
  const [ref, ratio] = RELATIVE[id] ?? [id, 1]
  const st = standardsFor(ref, profile.bodyweight, profile.sex)
  if (!st) return null

  const sp = strengthProfile(workouts, profile.bodyweight, profile.sex)
  const region = sp.regions.find((r) => r.ids.includes(ref)) ?? sp.regions.find((r) => REGIONS.find((x) => x.name === r.name)?.muscles.some((m) => ex.primary.includes(m)))
  let pct: number, basis: string
  if (region && region.score > 0) { pct = region.score; basis = `${region.name.toLowerCase()} gücüne` }
  else if (sp.total > 0) { pct = sp.total; basis = 'genel güç seviyene' }
  else { pct = 8; basis = 'yeni başlayan seviyesine' }
  // Bölge puanı farklı ekipmandan geliyorsa (ör. makineden serbest ağırlığa) teknik ve denge farkı için daha temkinli
  const free = (e?: string) => e === 'barbell' || e === 'dumbbell' ? 'free' : 'machine'
  const sameKind = region?.lifts.some((l) => free(BUILTIN_EXERCISES.find((x) => x.id === l.id)?.equipment) === free(ex.equipment))
  const cross = region && region.score > 0 && !sameKind
  const used = Math.max(3, pct - 10 - (cross ? 15 : 0))
  const oneRm = oneRmAt(st, used) * ratio

  const hi = (range ?? [8, 12])[1]
  const step = ex.equipment === 'dumbbell' ? 1 : 2.5
  let w = oneRm / (1 + (hi + 3) / 30)
  const hit = ex.flags.some((f) => profile.restrictions.includes(f))
  if (hit) w *= 0.85
  w = Math.floor(w / step) * step
  const min = ex.equipment === 'barbell' && !['landmine_press', 'skull_crusher'].includes(id) ? profile.barWeight : step
  w = Math.max(min, w)

  const li = levelIndex(pct)
  const level = li < 0 ? 'Başlangıç altı' : LEVELS[li]
  const fmt = (x: number) => x.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
  const text = `İlk kez: ${basis} (${level}, %${Math.round(pct)}) göre tahmini 1RM ≈ ${fmt(Math.round(oneRm * 2) / 2)} kg${ref !== id ? ' (benzer hareketten)' : ''}. ` +
    `${cross ? 'Bu bölgede bu tip ekipmanla kaydın olmadığı için temkinli. ' : ''}${fmt(w)} kg × ${hi} ile başla; 3 tekrar daha yapabilecek gibiysen sonraki sette artır, zorlanırsan düşür.${hit ? ' Kısıtın olduğu için %15 hafif.' : ''}${ex.equipment === 'dumbbell' ? ' Ağırlık tek dambıl.' : ''}`
  return { weight: w, oneRm, pct, basis, text }
}
