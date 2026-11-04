// Hareket kütüphanesi. Açıklamalar bu uygulama için yazıldı.
// flags: sağlık etiketleri
//   axial  = omurgaya dikey (aksiyal) yük bindirir
//   lumbar = bel bölgesine eğilme/kayma yükü bindirir
//   knee   = dizde derin bükülme altında yük (menisküs / patella için riskli)
//   wrist  = yük altında bilek ekstansiyonu (geriye bükülme)

export type Muscle =
  | 'gogus' | 'on_omuz' | 'yan_omuz' | 'arka_omuz' | 'triceps' | 'biceps' | 'onkol'
  | 'kanat' | 'sirt_ust' | 'trapez' | 'bel' | 'karin' | 'oblik'
  | 'kalca' | 'on_bacak' | 'arka_bacak' | 'ic_bacak' | 'baldir'

export type Flag = 'axial' | 'lumbar' | 'knee' | 'wrist'
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'smith' | 'kettlebell' | 'band' | 'other'
export type Kind = 'weight' | 'reps' | 'time' | 'assisted'

export interface Exercise {
  id: string
  name: string
  equipment: Equipment
  primary: Muscle[]
  secondary: Muscle[]
  flags: Flag[]
  kind: Kind
  note?: string
  alt?: string[]
  custom?: boolean
}

export const MUSCLE_NAMES: Record<Muscle, string> = {
  gogus: 'Göğüs', on_omuz: 'Ön omuz', yan_omuz: 'Yan omuz', arka_omuz: 'Arka omuz',
  triceps: 'Triceps', biceps: 'Biceps', onkol: 'Ön kol', kanat: 'Kanat (lat)',
  sirt_ust: 'Üst sırt', trapez: 'Trapez', bel: 'Bel', karin: 'Karın', oblik: 'Yan karın',
  kalca: 'Kalça', on_bacak: 'Ön bacak', arka_bacak: 'Arka bacak', ic_bacak: 'İç bacak', baldir: 'Baldır'
}

export const MUSCLE_GROUPS: { name: string; muscles: Muscle[] }[] = [
  { name: 'Göğüs', muscles: ['gogus'] },
  { name: 'Sırt', muscles: ['kanat', 'sirt_ust', 'trapez', 'bel'] },
  { name: 'Omuz', muscles: ['on_omuz', 'yan_omuz', 'arka_omuz'] },
  { name: 'Kol', muscles: ['biceps', 'triceps', 'onkol'] },
  { name: 'Bacak', muscles: ['on_bacak', 'arka_bacak', 'kalca', 'ic_bacak', 'baldir'] },
  { name: 'Karın', muscles: ['karin', 'oblik'] }
]

export const EQUIPMENT_NAMES: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dambıl', machine: 'Makine', cable: 'Kablo', bodyweight: 'Vücut ağırlığı',
  smith: 'Smith', kettlebell: 'Kettlebell', band: 'Lastik', other: 'Diğer'
}

export const FLAG_INFO: Record<Flag, { label: string; short: string }> = {
  axial: { label: 'Omurgaya dikey yük (skolyoz / bel)', short: 'Omurga yükü' },
  lumbar: { label: 'Bele eğilme yükü (bel fıtığı geçmişi)', short: 'Bel yükü' },
  knee: { label: 'Derin diz bükülmesi altında yük (menisküs / kondromalazi)', short: 'Diz yükü' },
  wrist: { label: 'Yük altında bilek ekstansiyonu (sol bilek)', short: 'Bilek' }
}

type Row = [string, string, Equipment, Muscle[], Muscle[], Flag[], Kind, string?, string[]?]

const rows: Row[] = [
  // GÖĞÜS
  ['bench_press', 'Bench Press (Barbell)', 'barbell', ['gogus'], ['on_omuz', 'triceps'], ['wrist'], 'weight', 'Kürek kemiklerini geride ve aşağıda tut, bar göğsün alt kısmına insin.', ['db_bench_press', 'machine_chest_press']],
  ['incline_bench', 'Incline Bench Press (Barbell)', 'barbell', ['gogus'], ['on_omuz', 'triceps'], ['wrist'], 'weight', 'Sehpa 30° civarı yeterli, daha diki ön omza kayar.', ['incline_db_press']],
  ['db_bench_press', 'Bench Press (Dambıl)', 'dumbbell', ['gogus'], ['on_omuz', 'triceps'], [], 'weight', 'Nötr ya da hafif içe dönük tutuş bileği rahatlatır.'],
  ['incline_db_press', 'Incline Press (Dambıl)', 'dumbbell', ['gogus'], ['on_omuz', 'triceps'], [], 'weight'],
  ['machine_chest_press', 'Chest Press (Makine)', 'machine', ['gogus'], ['on_omuz', 'triceps'], [], 'weight', 'Sırtı pede yasla; dikey tutamaç varsa onu kullan.'],
  ['smith_incline', 'Incline Press (Smith)', 'smith', ['gogus'], ['on_omuz', 'triceps'], ['wrist'], 'weight'],
  ['cable_fly', 'Cable Fly', 'cable', ['gogus'], ['on_omuz'], [], 'weight', 'Dirsekler hafif bükülü sabit; kollarla sarılma hareketi.'],
  ['pec_deck', 'Pec Deck (Makine)', 'machine', ['gogus'], ['on_omuz'], [], 'weight'],
  ['db_fly', 'Fly (Dambıl)', 'dumbbell', ['gogus'], ['on_omuz'], [], 'weight'],
  ['push_up', 'Şınav', 'bodyweight', ['gogus'], ['triceps', 'on_omuz', 'karin'], ['wrist'], 'reps', 'Bilek ağrırsa şınav tutamacı veya dambıl üzerinde yap.'],
  ['dips', 'Dips (Paralel)', 'bodyweight', ['gogus', 'triceps'], ['on_omuz'], [], 'reps'],
  ['assisted_dips', 'Dips (Destekli Makine)', 'machine', ['gogus', 'triceps'], ['on_omuz'], [], 'assisted'],

  // SIRT
  ['pull_up', 'Barfiks', 'bodyweight', ['kanat'], ['biceps', 'sirt_ust'], [], 'reps'],
  ['assisted_pull_up', 'Barfiks (Destekli Makine)', 'machine', ['kanat'], ['biceps', 'sirt_ust'], [], 'assisted'],
  ['chin_up', 'Chin Up', 'bodyweight', ['kanat', 'biceps'], ['sirt_ust'], [], 'reps'],
  ['lat_pulldown', 'Lat Pulldown (Geniş)', 'cable', ['kanat'], ['biceps', 'sirt_ust'], [], 'weight', 'Göğsü yukarı tut, barı köprücük kemiğine çek.'],
  ['lat_pulldown_close', 'Lat Pulldown (Dar / V-bar)', 'cable', ['kanat'], ['biceps', 'sirt_ust'], [], 'weight'],
  ['seated_cable_row', 'Seated Cable Row', 'cable', ['sirt_ust', 'kanat'], ['biceps', 'arka_omuz'], [], 'weight', 'Gövdeyi sabit tut, belden sallanma.'],
  ['chest_supported_row', 'Chest Supported Row (Makine)', 'machine', ['sirt_ust', 'kanat'], ['biceps', 'arka_omuz'], [], 'weight', 'Göğüs desteği beli tamamen yükten kurtarır.'],
  ['incline_db_row', 'Incline Bench Row (Dambıl)', 'dumbbell', ['sirt_ust', 'kanat'], ['biceps', 'arka_omuz'], [], 'weight', 'Göğüs sehpaya yaslı; bel için güvenli kürek çekiş.'],
  ['one_arm_db_row', 'Tek Kol Row (Dambıl)', 'dumbbell', ['kanat', 'sirt_ust'], ['biceps'], [], 'weight', 'Diz ve el sehpada, sırt düz.'],
  ['barbell_row', 'Barbell Row', 'barbell', ['sirt_ust', 'kanat'], ['biceps', 'bel'], ['lumbar'], 'weight', 'Öne eğik pozisyon bele yük bindirir.', ['chest_supported_row', 'seated_cable_row']],
  ['t_bar_row', 'T-Bar Row', 'barbell', ['sirt_ust', 'kanat'], ['biceps', 'bel'], ['lumbar'], 'weight', undefined, ['chest_supported_row']],
  ['straight_arm_pulldown', 'Straight Arm Pulldown', 'cable', ['kanat'], ['triceps'], [], 'weight'],
  ['deadlift', 'Deadlift (Barbell)', 'barbell', ['arka_bacak', 'kalca', 'bel'], ['sirt_ust', 'trapez', 'onkol', 'on_bacak'], ['axial', 'lumbar'], 'weight', undefined, ['hip_thrust', 'back_extension_45', 'lying_leg_curl']],
  ['rdl', 'Romanian Deadlift (Barbell)', 'barbell', ['arka_bacak', 'kalca'], ['bel', 'onkol'], ['axial', 'lumbar'], 'weight', undefined, ['db_rdl', 'back_extension_45']],
  ['db_rdl', 'Romanian Deadlift (Dambıl)', 'dumbbell', ['arka_bacak', 'kalca'], ['bel'], ['lumbar'], 'weight', 'Hafif ağırlık, nötr bel, kalçayı geriye it.', ['back_extension_45', 'seated_leg_curl']],
  ['back_extension_45', '45° Back Extension', 'bodyweight', ['kalca', 'arka_bacak'], ['bel'], [], 'reps', 'Kalça odaklı yap: sırtı hafif yuvarla, bel üzerinden aşırı geriye gitme.'],
  ['shrug_db', 'Shrug (Dambıl)', 'dumbbell', ['trapez'], ['onkol'], [], 'weight'],
  ['face_pull', 'Face Pull', 'cable', ['arka_omuz', 'sirt_ust'], ['trapez'], [], 'weight', 'Postür ve skolyoz için faydalı; ipi alına doğru çek, dışa döndür.'],

  // OMUZ
  ['ohp', 'Overhead Press (Barbell, Ayakta)', 'barbell', ['on_omuz'], ['yan_omuz', 'triceps'], ['axial', 'wrist', 'lumbar'], 'weight', undefined, ['seated_db_press', 'machine_shoulder_press']],
  ['seated_db_press', 'Shoulder Press (Dambıl, Oturarak)', 'dumbbell', ['on_omuz'], ['yan_omuz', 'triceps'], ['axial'], 'weight', 'Sırtı dik sehpaya yasla; yük omurgaya az biner, nötr tutuş bileği korur.', ['machine_shoulder_press', 'landmine_press']],
  ['machine_shoulder_press', 'Shoulder Press (Makine)', 'machine', ['on_omuz'], ['yan_omuz', 'triceps'], [], 'weight', 'Sırt destekli makine, aksiyal yük minimum.'],
  ['landmine_press', 'Landmine Press (Tek Kol)', 'barbell', ['on_omuz', 'gogus'], ['triceps'], [], 'weight'],
  ['lateral_raise', 'Lateral Raise (Dambıl)', 'dumbbell', ['yan_omuz'], ['trapez'], [], 'weight'],
  ['cable_lateral_raise', 'Lateral Raise (Kablo)', 'cable', ['yan_omuz'], [], [], 'weight'],
  ['machine_lateral_raise', 'Lateral Raise (Makine)', 'machine', ['yan_omuz'], [], [], 'weight'],
  ['rear_delt_fly', 'Reverse Fly (Makine)', 'machine', ['arka_omuz'], ['sirt_ust'], [], 'weight'],
  ['db_rear_delt', 'Rear Delt Fly (Dambıl, Sehpada)', 'dumbbell', ['arka_omuz'], ['sirt_ust'], [], 'weight', 'Incline sehpaya göğüs yaslı yap.'],
  ['front_raise', 'Front Raise (Dambıl)', 'dumbbell', ['on_omuz'], [], [], 'weight'],

  // KOL
  ['barbell_curl', 'Biceps Curl (Barbell)', 'barbell', ['biceps'], ['onkol'], ['wrist'], 'weight', 'Düz bar bileği zorlarsa EZ bar kullan.', ['ez_curl', 'db_curl']],
  ['ez_curl', 'Biceps Curl (EZ Bar)', 'barbell', ['biceps'], ['onkol'], [], 'weight'],
  ['db_curl', 'Biceps Curl (Dambıl)', 'dumbbell', ['biceps'], ['onkol'], [], 'weight'],
  ['hammer_curl', 'Hammer Curl', 'dumbbell', ['biceps', 'onkol'], [], [], 'weight'],
  ['incline_db_curl', 'Incline Curl (Dambıl)', 'dumbbell', ['biceps'], [], [], 'weight'],
  ['preacher_curl', 'Preacher Curl (Makine)', 'machine', ['biceps'], [], [], 'weight'],
  ['cable_curl', 'Biceps Curl (Kablo)', 'cable', ['biceps'], ['onkol'], [], 'weight'],
  ['triceps_pushdown', 'Triceps Pushdown (Halat)', 'cable', ['triceps'], [], [], 'weight'],
  ['triceps_pushdown_bar', 'Triceps Pushdown (Bar)', 'cable', ['triceps'], [], ['wrist'], 'weight', undefined, ['triceps_pushdown']],
  ['overhead_cable_ext', 'Overhead Triceps Extension (Kablo)', 'cable', ['triceps'], [], [], 'weight'],
  ['db_overhead_ext', 'Overhead Triceps Extension (Dambıl)', 'dumbbell', ['triceps'], [], [], 'weight'],
  ['skull_crusher', 'Skull Crusher (EZ Bar)', 'barbell', ['triceps'], [], ['wrist'], 'weight', undefined, ['overhead_cable_ext']],
  ['close_grip_bench', 'Close Grip Bench Press', 'barbell', ['triceps', 'gogus'], ['on_omuz'], ['wrist'], 'weight', undefined, ['machine_chest_press']],
  ['wrist_curl', 'Wrist Curl', 'dumbbell', ['onkol'], [], [], 'weight'],

  // BACAK
  ['squat', 'Back Squat (Barbell)', 'barbell', ['on_bacak', 'kalca'], ['arka_bacak', 'ic_bacak', 'bel'], ['axial', 'knee', 'lumbar'], 'weight', undefined, ['leg_press', 'belt_squat']],
  ['front_squat', 'Front Squat', 'barbell', ['on_bacak', 'kalca'], ['karin', 'sirt_ust'], ['axial', 'knee', 'wrist'], 'weight', undefined, ['leg_press', 'belt_squat']],
  ['goblet_squat', 'Goblet Squat', 'dumbbell', ['on_bacak', 'kalca'], ['karin'], ['knee'], 'weight', 'Kutuya oturarak (box) sınırlı derinlikte yapılabilir.', ['leg_press']],
  ['smith_squat', 'Squat (Smith)', 'smith', ['on_bacak', 'kalca'], ['arka_bacak'], ['axial', 'knee'], 'weight', undefined, ['leg_press', 'belt_squat']],
  ['hack_squat', 'Hack Squat (Makine)', 'machine', ['on_bacak'], ['kalca'], ['knee', 'axial'], 'weight', 'Omuz pedleri omurgaya yük bindirir; derinliği ağrısız açıyla sınırla.', ['leg_press']],
  ['belt_squat', 'Belt Squat', 'machine', ['on_bacak', 'kalca'], ['ic_bacak'], ['knee'], 'weight', 'Yük kalçadan asılır, omurga yüksüz kalır. Derinliği ağrısız açıda tut.'],
  ['leg_press', 'Leg Press', 'machine', ['on_bacak', 'kalca'], ['arka_bacak', 'ic_bacak'], [], 'weight', 'Ayakları platformda yüksek koy, dizler 90°nin altına inmesin, bel pedden kalkmasın.'],
  ['leg_press_single', 'Leg Press (Tek Bacak)', 'machine', ['on_bacak', 'kalca'], ['arka_bacak'], [], 'weight', 'Skolyozda sağ-sol dengesizliğini görmek için iyi.'],
  ['leg_extension', 'Leg Extension', 'machine', ['on_bacak'], [], ['knee'], 'weight', 'Kondromalazide tam açıklık patellayı zorlayabilir; son 30-40°lik açıda ve hafif çalış.'],
  ['lying_leg_curl', 'Lying Leg Curl', 'machine', ['arka_bacak'], ['baldir'], [], 'weight'],
  ['seated_leg_curl', 'Seated Leg Curl', 'machine', ['arka_bacak'], ['baldir'], [], 'weight'],
  ['bulgarian_split', 'Bulgarian Split Squat', 'dumbbell', ['on_bacak', 'kalca'], ['ic_bacak'], ['knee'], 'weight', undefined, ['leg_press_single', 'step_up']],
  ['lunge', 'Lunge (Dambıl)', 'dumbbell', ['on_bacak', 'kalca'], ['arka_bacak'], ['knee'], 'weight', undefined, ['leg_press_single']],
  ['step_up', 'Step Up (Dambıl, Alçak Kutu)', 'dumbbell', ['on_bacak', 'kalca'], [], [], 'weight', 'Diz seviyesinin altındaki kutu dizi az zorlar.'],
  ['hip_thrust', 'Hip Thrust (Barbell)', 'barbell', ['kalca'], ['arka_bacak'], [], 'weight', 'Belden değil kalçadan kaldır, üstte çeneyi göğse yakın tut.'],
  ['hip_thrust_machine', 'Hip Thrust (Makine)', 'machine', ['kalca'], ['arka_bacak'], [], 'weight'],
  ['glute_bridge', 'Glute Bridge', 'bodyweight', ['kalca'], ['arka_bacak'], [], 'reps'],
  ['cable_kickback', 'Glute Kickback (Kablo)', 'cable', ['kalca'], [], [], 'weight'],
  ['hip_abduction', 'Hip Abduction (Makine)', 'machine', ['kalca'], [], [], 'weight'],
  ['hip_adduction', 'Hip Adduction (Makine)', 'machine', ['ic_bacak'], [], [], 'weight'],
  ['standing_calf', 'Standing Calf Raise (Makine)', 'machine', ['baldir'], [], ['axial'], 'weight', 'Omuz pedli makine omurgaya yük bindirir.', ['seated_calf', 'leg_press_calf']],
  ['seated_calf', 'Seated Calf Raise', 'machine', ['baldir'], [], [], 'weight'],
  ['leg_press_calf', 'Calf Press (Leg Press)', 'machine', ['baldir'], [], [], 'weight'],

  // KARIN
  ['plank', 'Plank', 'bodyweight', ['karin'], ['oblik'], [], 'time', 'Ön kollar üzerinde yap; bileğe yük binmez.'],
  ['side_plank', 'Side Plank', 'bodyweight', ['oblik'], ['karin'], [], 'time', 'Skolyozda zayıf taraf için ek set eklenebilir.'],
  ['dead_bug', 'Dead Bug', 'bodyweight', ['karin'], [], [], 'reps', 'Bel yere yapışık; bel sağlığı için temel hareket.'],
  ['bird_dog', 'Bird Dog', 'bodyweight', ['karin', 'bel'], ['kalca'], [], 'reps'],
  ['pallof_press', 'Pallof Press', 'cable', ['oblik', 'karin'], [], [], 'weight', 'Dönmeye direnç hareketi; skolyoz ve bel için çok uygun.'],
  ['cable_crunch', 'Cable Crunch', 'cable', ['karin'], [], ['lumbar'], 'weight', 'Tekrarlı omurga bükülmesi; ağrı varsa dead bug / pallof ile değiştir.', ['dead_bug', 'pallof_press']],
  ['hanging_knee_raise', 'Hanging Knee Raise', 'bodyweight', ['karin'], ['onkol'], [], 'reps'],
  ['ab_wheel', 'Ab Wheel', 'other', ['karin'], ['kanat'], ['lumbar', 'wrist'], 'reps', undefined, ['dead_bug']],
  ['situp', 'Mekik', 'bodyweight', ['karin'], [], ['lumbar'], 'reps', undefined, ['dead_bug']],
  ['farmers_walk', 'Farmer\'s Walk', 'dumbbell', ['onkol', 'trapez'], ['karin', 'oblik'], ['axial'], 'weight'],
  ['suitcase_carry', 'Suitcase Carry (Tek Kol)', 'dumbbell', ['oblik'], ['onkol', 'trapez'], [], 'weight'],

  // MOBİLİTE VE ISINMA
  ['cat_cow', 'Kedi-Deve (Cat-Cow)', 'bodyweight', ['bel'], ['karin'], [], 'reps', 'Yavaş ve ağrısız aralıkta; nefesle birlikte omurgayı yuvarla ve aç.'],
  ['dead_hang', 'Barda Asılma (Dead Hang)', 'bodyweight', ['onkol'], ['kanat'], [], 'time', 'Omurgayı rahatlatır. Bilek ağrırsa askı kayışı kullan.'],
  ['thoracic_rotation', 'Göğüs Omurgası Rotasyonu (Yan yatarak)', 'bodyweight', ['sirt_ust'], ['oblik'], [], 'reps', 'Dizler kalça hizasında, bel sabit; sadece üst sırt döner.'],
  ['wall_angel', 'Duvar Meleği (Wall Angel)', 'bodyweight', ['arka_omuz', 'sirt_ust'], [], [], 'reps', 'Sırt, baş ve kollar duvara değsin; kolları yavaşça yukarı kaydır.'],
  ['band_pull_apart', 'Band Pull-Apart', 'band', ['arka_omuz'], ['sirt_ust'], [], 'reps'],
  ['hip_9090', '90/90 Kalça Mobilitesi', 'bodyweight', ['kalca'], ['ic_bacak'], [], 'reps'],
  ['hip_flexor_stretch', 'Kalça Fleksör Esnetme', 'bodyweight', ['on_bacak'], ['kalca'], [], 'time', 'Diz altına yastık koy; kalçayı hafif öne it, beli çukurlaştırma.'],
  ['childs_pose', 'Çocuk Pozu', 'bodyweight', ['bel'], ['kanat'], [], 'time'],
  ['mcgill_curl_up', 'McGill Curl-up', 'bodyweight', ['karin'], [], [], 'reps', 'Bel nötr, bir diz bükülü; baş ve omuzlar yalnızca birkaç cm kalkar. Bel dostu karın hareketi.'],
  ['clamshell', 'Clamshell (Lastikle)', 'band', ['kalca'], [], [], 'reps', 'Diz sağlığı için kalça dış rotatorlarını güçlendirir.'],
  ['tke', 'Terminal Diz Ekstansiyonu (Lastikle)', 'band', ['on_bacak'], [], [], 'reps', 'Kondromalazi rehabilitasyonunda kullanılan, dize düşük yük bindiren son açı ekstansiyonu.'],

  // KARDİYO
  ['treadmill_incline', 'Eğimli Yürüyüş (Koşu Bandı)', 'machine', ['baldir'], ['kalca'], [], 'time', 'Diz dostu kardiyo; nabzı not et.'],
  ['bike', 'Bisiklet', 'machine', ['on_bacak'], ['baldir'], [], 'time', 'Sele yüksekliği: pedal altta iken diz hafif bükülü.'],
  ['elliptical', 'Eliptik', 'machine', ['on_bacak', 'kalca'], [], [], 'time'],
  ['rower', 'Kürek Makinesi', 'machine', ['sirt_ust', 'kanat'], ['on_bacak', 'kalca'], ['lumbar'], 'time'],
  ['stair', 'Merdiven Makinesi', 'machine', ['on_bacak', 'kalca'], ['baldir'], ['knee'], 'time'],
  ['swim', 'Yüzme', 'other', ['kanat'], ['gogus', 'on_omuz'], [], 'time']
]

export const BUILTIN_EXERCISES: Exercise[] = rows.map(([id, name, equipment, primary, secondary, flags, kind, note, alt]) => ({
  id, name, equipment, primary, secondary, flags, kind, note, alt
}))
