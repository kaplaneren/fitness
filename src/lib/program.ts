import { BUILTIN_EXERCISES, type Flag } from '../data/exercises'
import type { RoutineExercise } from '../db'

export type Adherence = 'iyi' | 'orta' | 'kotu'
export type Duration = 'kisa' | 'orta' | 'uzun'
export type Goal = 'yag' | 'kas' | 'guc'

export interface WizardInput { days: number; adherence: Adherence; duration: Duration; goal: Goal; restrictions: Flag[] }
export interface PlannedDay { name: string; exercises: RoutineExercise[]; minutes: number }
export interface Plan { title: string; days: PlannedDay[]; schedule: string; notes: string[] }

const SLOTS: Record<string, string[]> = {
  hpush: ['bench_press', 'db_bench_press', 'machine_chest_press'],
  hpush2: ['incline_bench', 'incline_db_press', 'machine_chest_press'],
  vpull: ['lat_pulldown', 'assisted_pull_up'],
  vpull2: ['lat_pulldown_close', 'straight_arm_pulldown'],
  hpull: ['barbell_row', 'chest_supported_row', 'seated_cable_row'],
  hpull2: ['one_arm_db_row', 'seated_cable_row', 'incline_db_row'],
  vpush: ['ohp', 'seated_db_press', 'machine_shoulder_press'],
  quad: ['squat', 'belt_squat', 'leg_press'],
  quad2: ['bulgarian_split', 'leg_press_single', 'step_up'],
  quadIso: ['leg_extension'],
  hinge: ['rdl', 'db_rdl', 'back_extension_45'],
  glute: ['hip_thrust', 'hip_thrust_machine'],
  hamIso: ['lying_leg_curl', 'seated_leg_curl'],
  hamIso2: ['seated_leg_curl', 'lying_leg_curl'],
  lateral: ['cable_lateral_raise', 'lateral_raise'],
  lateral2: ['machine_lateral_raise', 'lateral_raise'],
  rear: ['face_pull', 'rear_delt_fly'],
  fly: ['cable_fly', 'pec_deck'],
  biceps: ['incline_db_curl', 'db_curl'],
  biceps2: ['hammer_curl', 'cable_curl'],
  triceps: ['overhead_cable_ext', 'triceps_pushdown'],
  triceps2: ['triceps_pushdown', 'db_overhead_ext'],
  calf: ['standing_calf', 'seated_calf', 'leg_press_calf'],
  core: ['pallof_press', 'dead_bug'],
  core2: ['side_plank', 'hanging_knee_raise', 'dead_bug'],
  abduct: ['hip_abduction'],
  cardio: ['treadmill_incline', 'bike']
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

function pick(slot: string, restrictions: Flag[]) {
  const ok = SLOTS[slot].filter((id) => {
    const ex = BUILTIN_EXERCISES.find((e) => e.id === id)
    return ex && !ex.flags.some((f) => restrictions.includes(f))
  })
  return ok[0] ?? null
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

  const count = { kisa: 5, orta: 7, uzun: 9 }[inp.duration]
  const reps = {
    guc: { main: '4-6', second: '6-8', iso: '8-12', rest: [180, 120, 75] },
    kas: { main: '6-10', second: '8-12', iso: '10-15', rest: [150, 105, 60] },
    yag: { main: '8-12', second: '10-12', iso: '12-15', rest: [120, 90, 45] }
  }[inp.goal]

  const ssTags = 'abcdefgh'
  const used = new Map<string, number>()
  const out: PlannedDay[] = keys.map((k) => {
    const tpl = DAYS[k]
    const name = tpl.name + (used.has(k) ? ' (2)' : '')
    used.set(k, (used.get(k) ?? 0) + 1)
    const chosen: { slot: string; id: string }[] = []
    for (const slot of tpl.slots) {
      if (chosen.length >= count) break
      const id = pick(slot, inp.restrictions)
      if (id && !chosen.some((c) => c.id === id)) chosen.push({ slot, id })
    }
    let ssi = 0
    const ex: RoutineExercise[] = chosen.map((c, i) => {
      const iso = ISOLATION.has(c.slot)
      const sets = i < 2 ? (inp.duration === 'uzun' ? 4 : 3) : inp.duration === 'kisa' ? 2 : 3
      return {
        exerciseId: c.id, sets,
        reps: c.slot.startsWith('core') ? (c.id === 'side_plank' || c.id === 'plank' ? '30-45 sn' : '10/taraf') : i === 0 ? reps.main : iso ? reps.iso : reps.second,
        restSec: i === 0 ? reps.rest[0] : iso ? reps.rest[2] : reps.rest[1]
      }
    })
    // Kısa ve orta sürede izolasyon hareketlerini ikişerli süperset yap
    if (inp.duration !== 'uzun') {
      for (let i = 2; i < ex.length - 1; i++) {
        if (ISOLATION.has(chosen[i].slot) && ISOLATION.has(chosen[i + 1].slot) && !ex[i].superset) {
          const t = ssTags[ssi++]; ex[i].superset = t; ex[i + 1].superset = t; i++
        }
      }
    }
    if (inp.goal === 'yag' && inp.duration !== 'kisa') {
      const c = pick('cardio', inp.restrictions)
      if (c) ex.push({ exerciseId: c, sets: 1, reps: '15-20 dk', restSec: 0 })
    }
    const minutes = Math.round(ex.reduce((t, e) => t + e.sets * (45 + (e.superset ? e.restSec / 2 : e.restSec)) / 60 + (e.reps.includes('dk') ? 17 : 0), 8))
    return { name, exercises: ex, minutes }
  })

  if (inp.restrictions.length) notes.push('Sağlık kısıtlarına takılan hareketler (ör. barbell squat, deadlift, ayakta overhead press) yerine omurgayı ve dizi koruyan alternatifler seçildi.')
  if (inp.goal === 'yag') notes.push('Yağ yakımında kas kaybını önlemek için ağırlıkları düşürme; tekrar aralığını koru, kalori açığını beslenmeden yarat.')
  notes.push('İlerleme kuralı: bir hareketin tüm setlerinde tekrar aralığının üstüne çıktığında ağırlığı 2,5 kg (dambılda 1-2 kg) artır.')

  const title = `${days} günlük ${keys.every((k) => k.startsWith('F')) ? 'tam vücut' : keys.includes('PU') ? 'itiş/çekiş/bacak' : 'üst/alt'} programı`
  return { title, days: out, schedule: SCHEDULES[days], notes }
}
