import { BUILTIN_EXERCISES, FLAG_INFO, type Flag } from '../data/exercises'
import type { RoutineExercise } from '../db'
import { GEAR, hasGear, type Gear } from './equipment'

export type Adherence = 'iyi' | 'orta' | 'kotu'
export type Duration = 'kisa' | 'orta' | 'uzun'
export type Goal = 'yag' | 'kas' | 'guc'

export type Machine = 'bike' | 'elliptical' | 'treadmill_incline' | 'rower' | 'stair'
export type WarmupType = Machine | 'mobility'
export const MACHINES: { v: Machine; l: string }[] = [
  { v: 'bike', l: 'Bisiklet' }, { v: 'elliptical', l: 'Eliptik' }, { v: 'treadmill_incline', l: 'Eğimli yürüyüş' }, { v: 'rower', l: 'Kürek' }, { v: 'stair', l: 'Merdiven' }
]
export const DURATION_MIN: Record<Duration, number> = { kisa: 45, orta: 60, uzun: 90 }

export interface WizardInput {
  days: number; adherence: Adherence; duration: Duration; goal: Goal; restrictions: Flag[]
  /** Eldeki ekipman; boşsa tam donanımlı salon */
  equipment?: Gear[] | null
  /** Antrenman başı ısınma ve kardiyo süreleri (dk), toplam süreden düşülür */
  warmupMin: number; warmupType: WarmupType
  cardioMin: number; cardioType: Machine
}
export interface PlannedDay { name: string; exercises: RoutineExercise[]; minutes: number; split: { warmup: number; weights: number; cardio: number } }
export interface Plan { title: string; days: PlannedDay[]; schedule: string; notes: string[] }

const SLOTS: Record<string, string[]> = {
  hpush: ['bench_press', 'db_bench_press', 'machine_chest_press', 'smith_incline', 'push_up'],
  hpush2: ['incline_bench', 'incline_db_press', 'machine_chest_press', 'smith_incline', 'db_bench_press', 'push_up'],
  vpull: ['lat_pulldown', 'assisted_pull_up', 'pull_up', 'one_arm_db_row'],
  vpull2: ['lat_pulldown_close', 'straight_arm_pulldown', 'chin_up', 'pull_up'],
  hpull: ['barbell_row', 'chest_supported_row', 'seated_cable_row', 'one_arm_db_row', 't_bar_row'],
  hpull2: ['one_arm_db_row', 'seated_cable_row', 'incline_db_row', 'chest_supported_row', 'barbell_row'],
  vpush: ['ohp', 'seated_db_press', 'machine_shoulder_press', 'landmine_press'],
  quad: ['squat', 'belt_squat', 'leg_press', 'smith_squat', 'hack_squat', 'goblet_squat', 'leg_extension', 'bulgarian_split', 'lunge'],
  quad2: ['bulgarian_split', 'leg_press_single', 'step_up', 'lunge', 'tke'],
  quadIso: ['leg_extension'],
  hinge: ['rdl', 'db_rdl', 'back_extension_45'],
  glute: ['hip_thrust', 'hip_thrust_machine', 'cable_kickback', 'glute_bridge'],
  hamIso: ['lying_leg_curl', 'seated_leg_curl', 'db_rdl'],
  hamIso2: ['seated_leg_curl', 'lying_leg_curl', 'db_rdl'],
  lateral: ['cable_lateral_raise', 'lateral_raise', 'machine_lateral_raise'],
  lateral2: ['machine_lateral_raise', 'lateral_raise', 'cable_lateral_raise'],
  rear: ['face_pull', 'rear_delt_fly', 'db_rear_delt', 'band_pull_apart'],
  fly: ['cable_fly', 'pec_deck', 'db_fly'],
  biceps: ['incline_db_curl', 'db_curl', 'cable_curl', 'barbell_curl'],
  biceps2: ['hammer_curl', 'preacher_curl', 'cable_curl', 'ez_curl'],
  triceps: ['overhead_cable_ext', 'triceps_pushdown', 'db_overhead_ext', 'skull_crusher', 'dips'],
  triceps2: ['triceps_pushdown', 'db_overhead_ext', 'skull_crusher', 'close_grip_bench'],
  calf: ['standing_calf', 'seated_calf', 'leg_press_calf'],
  core: ['pallof_press', 'dead_bug'],
  core2: ['side_plank', 'hanging_knee_raise', 'dead_bug'],
  abduct: ['hip_abduction', 'clamshell'],
  cardio: ['treadmill_incline', 'bike', 'elliptical']
}
const ISOLATION = new Set(['quadIso', 'hamIso', 'hamIso2', 'lateral', 'lateral2', 'rear', 'fly', 'biceps', 'biceps2', 'triceps', 'triceps2', 'calf', 'core', 'core2', 'abduct'])

const DAYS: Record<string, { name: string; slots: string[] }> = {
  FA: { name: 'Tam Vücut A', slots: ['quad', 'hpush', 'vpull', 'hinge', 'lateral', 'hamIso', 'triceps', 'biceps', 'core'] },
  FB: { name: 'Tam Vücut B', slots: ['glute', 'hpush2', 'hpull', 'quad2', 'rear', 'calf', 'biceps2', 'triceps2', 'core2'] },
  FC: { name: 'Tam Vücut C', slots: ['quad', 'vpush', 'hpull2', 'hamIso2', 'fly', 'lateral2', 'calf', 'core'] },
  UA: { name: 'Üst Vücut A', slots: ['hpush', 'hpull', 'vpush', 'vpull', 'lateral', 'rear', 'biceps', 'triceps', 'fly'] },
  UB: { name: 'Üst Vücut B', slots: ['hpush2', 'vpull', 'hpull2', 'fly', 'lateral2', 'triceps2', 'biceps2', 'rear', 'vpush'] },
  LA: { name: 'Alt Vücut A', slots: ['quad', 'glute', 'hamIso', 'quad2', 'calf', 'core', 'abduct', 'quadIso'] },
  LB: { name: 'Alt Vücut B', slots: ['hinge', 'quad', 'hamIso2', 'glute', 'calf', 'core2', 'abduct'] },
  PU: { name: 'İtiş', slots: ['hpush', 'vpush', 'hpush2', 'lateral', 'fly', 'triceps', 'triceps2', 'lateral2'] },
  PL: { name: 'Çekiş', slots: ['vpull', 'hpull', 'hpull2', 'rear', 'biceps', 'vpull2', 'biceps2', 'core'] },
  LG: { name: 'Bacak', slots: ['quad', 'hinge', 'glute', 'hamIso', 'quad2', 'calf', 'core2', 'abduct'] }
}

const SCHEDULES: Record<number, string> = {
  2: 'Pazartesi · Perşembe', 3: 'Pazartesi · Çarşamba · Cuma', 4: 'Pazartesi · Salı · Perşembe · Cuma',
  5: 'Pazartesi · Salı · Çarşamba · Cuma · Cumartesi', 6: 'Pazartesi\'den Cumartesi\'ye, Pazar dinlenme'
}

function pick(slot: string, restrictions: Flag[], equipment?: Gear[] | null) {
  const cands = SLOTS[slot].filter((id) => hasGear(id, equipment))
  const ok = cands.filter((id) => {
    const ex = BUILTIN_EXERCISES.find((e) => e.id === id)
    return ex && !ex.flags.some((f) => restrictions.includes(f))
  })
  if (ok[0]) return ok[0]
  // Hepsi bir kısıta takılıyorsa en az takılanı seç; antrenmanda ağırlık önerisi temkinli olur.
  const ranked = cands.map((id) => ({ id, n: BUILTIN_EXERCISES.find((e) => e.id === id)?.flags.filter((f) => restrictions.includes(f)).length ?? 9 })).sort((a, b) => a.n - b.n)
  return ranked[0]?.id ?? null
}

export function buildPlan(inp: WizardInput): Plan {
  const notes: string[] = []
  let keys: string[]
  let days = inp.days
  if (inp.adherence === 'kotu') {
    if (days > 3) { notes.push(`Devamlılığın düşük olduğu için ${days} gün yerine 3 gün öneriyorum. Az ama düzenli gitmek, çok planlayıp kaçırmaktan iyidir.`); days = 3 }
    keys = days === 3 ? ['FA', 'FB', 'FC'] : ['FA', 'FB']
    notes.push('Tam vücut sistemi seçtim: bir gün kaçırsan bile her kas haftada en az bir kez çalışır. Kaçırdığın günü telafi etmeye çalışma, sıradaki antrenmanla devam et.')
  } else if (days <= 3) {
    keys = days === 3 ? ['FA', 'FB', 'FC'] : ['FA', 'FB']
    notes.push('Haftada 2-3 günde her kası 2-3 kez çalıştırmanın en verimli yolu tam vücut antrenmanı.')
  } else if (days === 4) {
    keys = ['UA', 'LA', 'UB', 'LB']
    notes.push('4 gün için üst/alt ayrımı: her kas haftada 2 kez, antrenmanlar odaklı kalır.')
  } else if (inp.adherence === 'orta') {
    if (days === 6) notes.push('Devamlılığın orta olduğu için 6 yerine 5 gün öneriyorum.')
    days = 5
    keys = ['UA', 'LA', 'FA', 'UB', 'LB']
    notes.push('Üst/alt + bir tam vücut günü: bir günü kaçırırsan program bozulmaz.')
  } else if (days === 5) {
    keys = ['PU', 'PL', 'LG', 'UA', 'LA']
    notes.push('İtiş/çekiş/bacak + üst/alt: her kas haftada yaklaşık 2 kez.')
  } else {
    keys = ['PU', 'PL', 'LG', 'PU', 'PL', 'LG']
    notes.push('6 gün için itiş/çekiş/bacak iki tur. Uyku ve beslenme yerindeyse uygundur; yorgunluk birikirse 5 güne in.')
  }

  const total = DURATION_MIN[inp.duration]
  const warm = Math.max(0, inp.warmupMin), cardio = Math.max(0, inp.cardioMin)
  // Ağırlık bölümüne kalan süre; en az 20 dk ayrılır
  let budget = total - warm - cardio
  if (budget < 20) { notes.push(`${total} dakikadan ${warm} dk ısınma ve ${cardio} dk kardiyo düşünce ağırlığa ${Math.max(0, budget)} dk kalıyor; en az 20 dk ağırlık olacak şekilde plan biraz uzadı.`); budget = 20 }
  const maxCount = { kisa: 6, orta: 8, uzun: 10 }[inp.duration]
  const reps = {
    guc: { main: '4-6', second: '6-8', iso: '8-12', rest: [180, 120, 75] },
    kas: { main: '6-10', second: '8-12', iso: '10-15', rest: [150, 105, 60] },
    yag: { main: '8-12', second: '10-12', iso: '12-15', rest: [120, 90, 45] }
  }[inp.goal]
  // Bir hareketin tahmini süresi: set başına ~45 sn iş + dinlenme (süpersette yarısı) + 1 dk hazırlık
  const exMinutes = (e: RoutineExercise) => e.sets * (45 + (e.superset ? e.restSec / 2 : e.restSec)) / 60 + 1
  const pairable = inp.duration !== 'uzun'

  const warmupBlock = (k: string): RoutineExercise[] => {
    if (!warm) return []
    if (inp.warmupType !== 'mobility') return [{ exerciseId: inp.warmupType, sets: 1, reps: `${warm} dk`, restSec: 0 }]
    const lower = ['LA', 'LB', 'LG'].includes(k)
    const pool = lower ? ['cat_cow', 'glute_bridge', 'clamshell', 'hip_9090', 'tke', 'bird_dog'] : k.startsWith('F') ? ['cat_cow', 'band_pull_apart', 'glute_bridge', 'wall_angel', 'bird_dog', 'hip_9090'] : ['cat_cow', 'band_pull_apart', 'wall_angel', 'thoracic_rotation', 'dead_hang', 'bird_dog']
    const n = Math.max(2, Math.min(pool.length, Math.round(warm / 1.5)))
    return pool.slice(0, n).map((id) => ({ exerciseId: id, sets: 1, reps: id === 'dead_hang' ? '30 sn' : '10-12', restSec: 0 }))
  }

  const ssTags = 'abcdefgh'
  const used = new Map<string, number>()
  const out: PlannedDay[] = keys.map((k) => {
    const tpl = DAYS[k]
    const name = tpl.name + (used.has(k) ? ' (2)' : '')
    used.set(k, (used.get(k) ?? 0) + 1)
    const ex: RoutineExercise[] = []
    const slots: string[] = []
    let ssi = 0
    let mins = 0
    for (const slot of tpl.slots) {
      if (ex.length >= maxCount) break
      const id = pick(slot, inp.restrictions, inp.equipment)
      if (!id || ex.some((e) => e.exerciseId === id)) continue
      const i = ex.length
      const iso = ISOLATION.has(slot)
      const e: RoutineExercise = {
        exerciseId: id,
        sets: i < 2 ? (inp.duration === 'uzun' ? 4 : 3) : inp.duration === 'kisa' ? 2 : 3,
        reps: slot.startsWith('core') ? (id === 'side_plank' || id === 'plank' ? '30-45 sn' : '10/taraf') : i === 0 ? reps.main : iso ? reps.iso : reps.second,
        restSec: i === 0 ? reps.rest[0] : iso ? reps.rest[2] : reps.rest[1]
      }
      // Kısa ve orta sürede ardışık izolasyon hareketlerini süperset yap
      const prev = ex[i - 1]
      if (pairable && iso && i >= 3 && prev && ISOLATION.has(slots[i - 1]) && !prev.superset) {
        const t = ssTags[ssi++]
        const before = exMinutes(prev)
        prev.superset = t; e.superset = t
        const delta = exMinutes(prev) - before + exMinutes(e)
        if (mins + delta > budget) { prev.superset = undefined; ssi--; break }
        mins += delta
      } else {
        if (mins + exMinutes(e) > budget) {
          // Süre dolduysa set sayısını azaltarak bir hareket daha sığdırmayı dene
          if (e.sets > 2) { e.sets = 2; if (mins + exMinutes(e) <= budget) { ex.push(e); slots.push(slot); mins += exMinutes(e) } }
          break
        }
        mins += exMinutes(e)
      }
      ex.push(e); slots.push(slot)
    }
    // Tek kalan süperset etiketini temizle
    for (const e of ex) if (e.superset && ex.filter((x) => x.superset === e.superset).length < 2) e.superset = undefined
    const cardioBlock: RoutineExercise[] = cardio ? [{ exerciseId: inp.cardioType, sets: 1, reps: `${cardio} dk`, restSec: 0 }] : []
    const weights = Math.round(mins)
    return { name, exercises: [...warmupBlock(k), ...ex, ...cardioBlock], minutes: warm + weights + cardio, split: { warmup: warm, weights, cardio } }
  })

  notes.push(`Süre planı: ${total} dk antrenmanın ${warm ? `${warm} dk ısınmaya, ` : ''}${cardio ? `${cardio} dk kardiyoya, ` : ''}kalan ~${Math.max(20, total - warm - cardio)} dk ağırlığa ayrıldı. Ağırlık hareketleri bu süreye sığacak kadar seçildi.`)
  const flagged = [inp.warmupType, inp.cardioType].filter((id, i) => (i === 0 ? warm : cardio) && id !== 'mobility').filter((id) => BUILTIN_EXERCISES.find((e) => e.id === id)?.flags.some((f) => inp.restrictions.includes(f)))
  if (flagged.length) notes.push(`Seçtiğin ${[...new Set(flagged)].map((id) => MACHINES.find((m) => m.v === id)?.l.toLowerCase()).join(' ve ')} sağlık kısıtlarından birine takılıyor; ağrı olursa bisiklet veya eliptiğe geç.`)
  if (inp.goal === 'yag' && !cardio) notes.push('Yağ yakımı hedefinde antrenman sonuna 15-20 dk kardiyo eklemek yağ kaybını hızlandırır.')

  if (inp.restrictions.length) notes.push(`Sağlık kısıtlarına (${inp.restrictions.map((f) => FLAG_INFO[f].short).join(', ')}) takılan hareketler yerine güvenli alternatifler seçildi.`)
  if (inp.equipment) notes.push(inp.equipment.length ? `Ekipman kısıtına göre sadece şunlarla yapılabilen hareketler seçildi: ${inp.equipment.map((g) => GEAR.find((x) => x.v === g)?.l).join(', ')}. Uygun hareketi olmayan bölümler atlandı.` : 'Ekipman seçmediğin için sadece vücut ağırlığı ve lastik hareketleri seçildi.')
  if (inp.goal === 'yag') notes.push('Yağ yakımında kas kaybını önlemek için ağırlıkları düşürme; tekrar aralığını koru, kalori açığını beslenmeden yarat.')
  notes.push('İlerleme kuralı: bir hareketin tüm setlerinde tekrar aralığının üstüne çıktığında ağırlığı 2,5 kg (dambılda 1-2 kg) artır.')

  const title = `${days} günlük ${keys.every((k) => k.startsWith('F')) ? 'tam vücut' : keys.includes('PU') ? 'itiş/çekiş/bacak' : 'üst/alt'} programı`
  return { title, days: out, schedule: SCHEDULES[days], notes }
}
