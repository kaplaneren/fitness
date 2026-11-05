// Ekipman kısıtı: kullanıcının salonunda / evinde olan ekipmanlar.
// Profilde equipment boşsa (undefined/null) tam donanımlı salon varsayılır.

export type Gear =
  | 'dumbbell' | 'barbell' | 'bench' | 'incline' | 'smith' | 'preacher' | 'cable' | 'rowpull'
  | 'chestpress' | 'fly' | 'legcurl' | 'legext' | 'legpress' | 'pullbar' | 'othermachine'

export const GEAR: { v: Gear; l: string; hint?: string }[] = [
  { v: 'dumbbell', l: 'Dambıl' },
  { v: 'barbell', l: 'Halter (bar + plaka)', hint: 'squat sehpası dahil' },
  { v: 'bench', l: 'Düz bench' },
  { v: 'incline', l: 'Açılı bench' },
  { v: 'smith', l: 'Smith makinesi' },
  { v: 'preacher', l: 'Kol dayamalı (preacher) sehpa' },
  { v: 'cable', l: 'Makaralı istasyon (kablo)' },
  { v: 'rowpull', l: 'Row / pulldown istasyonu' },
  { v: 'chestpress', l: 'Chest press makinesi' },
  { v: 'fly', l: 'Fly (pec deck) makinesi' },
  { v: 'legcurl', l: 'Lying leg curl' },
  { v: 'legext', l: 'Leg extension' },
  { v: 'legpress', l: 'Leg press' },
  { v: 'pullbar', l: 'Barfiks / paralel bar' },
  { v: 'othermachine', l: 'Diğer makineler', hint: 'omuz press, hack squat, calf, abduction vb.' }
]

// Her hareket için gereken ekipman. Her eleman bir koşul; "a|b" ikisinden biri yeter demek.
// Lunge, step up ve bulgarian split dambılsız da yapılabildiği için ekipman istemez (bulgarian için bench yeter).
// Listede olmayan vücut ağırlığı, lastik ve kardiyo hareketleri her zaman uygundur.
const NEEDS: Record<string, string[]> = {
  bench_press: ['barbell', 'bench|incline'], incline_bench: ['barbell', 'incline'], close_grip_bench: ['barbell', 'bench|incline'],
  db_bench_press: ['dumbbell', 'bench|incline'], incline_db_press: ['dumbbell', 'incline'], db_fly: ['dumbbell', 'bench|incline'],
  machine_chest_press: ['chestpress'], smith_incline: ['smith', 'incline'], cable_fly: ['cable'], pec_deck: ['fly'],
  dips: ['pullbar'], assisted_dips: ['othermachine'], pull_up: ['pullbar'], chin_up: ['pullbar'], assisted_pull_up: ['othermachine'],
  hanging_knee_raise: ['pullbar'], dead_hang: ['pullbar'],
  lat_pulldown: ['rowpull'], lat_pulldown_close: ['rowpull'], seated_cable_row: ['rowpull'], straight_arm_pulldown: ['cable|rowpull'],
  chest_supported_row: ['othermachine'], incline_db_row: ['dumbbell', 'incline'], one_arm_db_row: ['dumbbell'],
  barbell_row: ['barbell'], t_bar_row: ['barbell'], deadlift: ['barbell'], rdl: ['barbell'], db_rdl: ['dumbbell'],
  back_extension_45: ['othermachine'], shrug_db: ['dumbbell'], face_pull: ['cable'],
  ohp: ['barbell'], seated_db_press: ['dumbbell', 'incline|bench'], machine_shoulder_press: ['othermachine'], landmine_press: ['barbell'],
  lateral_raise: ['dumbbell'], cable_lateral_raise: ['cable'], machine_lateral_raise: ['othermachine'], rear_delt_fly: ['fly'],
  db_rear_delt: ['dumbbell', 'incline'], front_raise: ['dumbbell'],
  barbell_curl: ['barbell'], ez_curl: ['barbell'], db_curl: ['dumbbell'], hammer_curl: ['dumbbell'], incline_db_curl: ['dumbbell', 'incline'],
  preacher_curl: ['preacher'], cable_curl: ['cable'], triceps_pushdown: ['cable|rowpull'], triceps_pushdown_bar: ['cable|rowpull'],
  overhead_cable_ext: ['cable'], db_overhead_ext: ['dumbbell'], skull_crusher: ['barbell', 'bench|incline'], wrist_curl: ['dumbbell'],
  squat: ['barbell'], front_squat: ['barbell'], goblet_squat: ['dumbbell'], smith_squat: ['smith'], hack_squat: ['othermachine'],
  belt_squat: ['othermachine'], leg_press: ['legpress'], leg_press_single: ['legpress'], leg_press_calf: ['legpress'],
  leg_extension: ['legext'], lying_leg_curl: ['legcurl'], seated_leg_curl: ['othermachine'],
  bulgarian_split: ['bench|incline'],
  hip_thrust: ['barbell', 'bench|incline'], hip_thrust_machine: ['othermachine'], cable_kickback: ['cable'],
  hip_abduction: ['othermachine'], hip_adduction: ['othermachine'], standing_calf: ['othermachine'], seated_calf: ['othermachine'],
  pallof_press: ['cable'], cable_crunch: ['cable'], suitcase_carry: ['dumbbell']
}

/** Hareket bu ekipmanla yapılabilir mi? equipment boşsa her şey uygundur. Özel (kullanıcı) hareketler hep uygun. */
export function hasGear(exerciseId: string, equipment?: Gear[] | null) {
  if (!equipment) return true
  const need = NEEDS[exerciseId]
  if (!need) return true
  return need.every((cond) => cond.split('|').some((g) => equipment.includes(g as Gear)))
}

export function gearLabel(equipment?: Gear[] | null) {
  if (!equipment) return 'Tam donanımlı salon'
  if (!equipment.length) return 'Sadece vücut ağırlığı'
  return equipment.map((g) => GEAR.find((x) => x.v === g)?.l).filter(Boolean).join(', ')
}
