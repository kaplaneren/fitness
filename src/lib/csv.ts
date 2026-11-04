import { BUILTIN_EXERCISES, type Exercise, type Muscle } from '../data/exercises'
import { db, type DiaryEntry, type SetEntry, type Workout } from '../db'
import { normalizeTr } from './nutrition'

const q = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function workoutsCsv(exMap: Map<string, Exercise>) {
  const ws = await db.workouts.orderBy('startedAt').toArray()
  const rows = [['Tarih', 'Antrenman', 'Süre (dk)', 'Hareket', 'Set', 'Tip', 'Taraf', 'Ağırlık (kg)', 'Tekrar', 'Süre (sn)', 'RIR', 'Not']]
  for (const w of ws) for (const e of w.exercises) e.sets.forEach((s, i) => rows.push([
    new Date(w.startedAt).toISOString().slice(0, 16).replace('T', ' '), w.name, String(Math.round(((w.endedAt ?? w.startedAt) - w.startedAt) / 60000)),
    exMap.get(e.exerciseId)?.name ?? e.exerciseId, String(i + 1), s.type, s.side ?? '', s.weight?.toString() ?? '', s.reps?.toString() ?? '', s.seconds?.toString() ?? '', s.rir?.toString() ?? '', w.note ?? ''
  ]))
  return rows.map((r) => r.map(q).join(',')).join('\n')
}

export async function diaryCsv() {
  const es: DiaryEntry[] = await db.diary.orderBy('createdAt').toArray()
  const rows = [['Tarih', 'Öğün', 'Yiyecek', 'Gram', 'Kalori', 'Protein', 'Karbonhidrat', 'Yağ']]
  for (const e of es) rows.push([e.date, e.meal, e.name, String(e.grams), String(e.kcal), String(e.p), String(e.c), String(e.f)])
  return rows.map((r) => r.map(q).join(',')).join('\n')
}

export async function shareFile(name: string, content: string, type = 'text/csv') {
  const blob = new Blob(['﻿' + content], { type })
  const file = new File([blob], name, { type })
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/* ---------- Strong içe aktarma ---------- */
function parseCsv(text: string) {
  const first = text.split('\n')[0]
  const d = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], cur = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQ = false
      else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === d) { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += ch
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

// Strong hareket adlarından bu uygulamanın hareketlerine eşleme
const STRONG_MAP: Record<string, string> = {
  'bench press (barbell)': 'bench_press', 'bench press (dumbbell)': 'db_bench_press', 'incline bench press (barbell)': 'incline_bench',
  'incline bench press (dumbbell)': 'incline_db_press', 'chest press (machine)': 'machine_chest_press', 'chest fly (dumbbell)': 'db_fly',
  'cable crossover': 'cable_fly', 'chest fly': 'pec_deck', 'push up': 'push_up', 'chest dip': 'dips', 'triceps dip': 'dips',
  'pull up': 'pull_up', 'chin up': 'chin_up', 'pull up (assisted)': 'assisted_pull_up', 'lat pulldown (cable)': 'lat_pulldown', 'lat pulldown (machine)': 'lat_pulldown',
  'lat pulldown - close grip (cable)': 'lat_pulldown_close', 'seated row (cable)': 'seated_cable_row', 'seated row (machine)': 'chest_supported_row',
  'bent over row (barbell)': 'barbell_row', 'bent over one arm row (dumbbell)': 'one_arm_db_row', 't bar row': 't_bar_row', 'face pull (cable)': 'face_pull',
  'deadlift (barbell)': 'deadlift', 'romanian deadlift (barbell)': 'rdl', 'romanian deadlift (dumbbell)': 'db_rdl', 'back extension': 'back_extension_45',
  'shrug (dumbbell)': 'shrug_db', 'overhead press (barbell)': 'ohp', 'shoulder press (dumbbell)': 'seated_db_press', 'seated overhead press (dumbbell)': 'seated_db_press',
  'shoulder press (machine)': 'machine_shoulder_press', 'lateral raise (dumbbell)': 'lateral_raise', 'lateral raise (cable)': 'cable_lateral_raise',
  'lateral raise (machine)': 'machine_lateral_raise', 'reverse fly (machine)': 'rear_delt_fly', 'reverse fly (dumbbell)': 'db_rear_delt', 'front raise (dumbbell)': 'front_raise',
  'bicep curl (barbell)': 'barbell_curl', 'bicep curl (dumbbell)': 'db_curl', 'ez bar curl': 'ez_curl', 'hammer curl (dumbbell)': 'hammer_curl',
  'preacher curl (machine)': 'preacher_curl', 'bicep curl (cable)': 'cable_curl', 'incline curl (dumbbell)': 'incline_db_curl',
  'triceps pushdown (cable - straight bar)': 'triceps_pushdown_bar', 'triceps rope pushdown': 'triceps_pushdown', 'triceps pushdown': 'triceps_pushdown',
  'triceps extension (cable)': 'overhead_cable_ext', 'triceps extension (dumbbell)': 'db_overhead_ext', 'skullcrusher (barbell)': 'skull_crusher',
  'bench press - close grip (barbell)': 'close_grip_bench', 'squat (barbell)': 'squat', 'front squat (barbell)': 'front_squat', 'goblet squat (kettlebell)': 'goblet_squat',
  'goblet squat': 'goblet_squat', 'squat (smith machine)': 'smith_squat', 'hack squat': 'hack_squat', 'leg press': 'leg_press', 'leg extension (machine)': 'leg_extension',
  'lying leg curl (machine)': 'lying_leg_curl', 'seated leg curl (machine)': 'seated_leg_curl', 'bulgarian split squat': 'bulgarian_split', 'lunge (dumbbell)': 'lunge',
  'step-up': 'step_up', 'hip thrust (barbell)': 'hip_thrust', 'hip thrust (machine)': 'hip_thrust_machine', 'glute bridge': 'glute_bridge', 'glute kickback (cable)': 'cable_kickback',
  'hip abductor (machine)': 'hip_abduction', 'hip adductor (machine)': 'hip_adduction', 'standing calf raise (machine)': 'standing_calf', 'seated calf raise (machine)': 'seated_calf',
  'calf press on leg press': 'leg_press_calf', 'plank': 'plank', 'side plank': 'side_plank', 'cable crunch': 'cable_crunch', 'hanging knee raise': 'hanging_knee_raise',
  'ab wheel': 'ab_wheel', 'crunch': 'situp', 'farmers walk': 'farmers_walk', 'treadmill': 'treadmill_incline', 'cycling (indoor)': 'bike', 'elliptical trainer': 'elliptical',
  'rowing (machine)': 'rower', 'stair stepper': 'stair'
}

function guessMuscle(name: string): Muscle {
  const n = name.toLowerCase()
  const rules: [RegExp, Muscle][] = [
    [/bench|chest|fly|push up|dip/, 'gogus'], [/pulldown|pull up|chin|row|pullover/, 'kanat'], [/lateral|shoulder|overhead|arnold|upright/, 'yan_omuz'],
    [/reverse fly|face pull|rear/, 'arka_omuz'], [/curl/, n.includes('leg') ? 'arka_bacak' : 'biceps'], [/tricep|skull|extension/, n.includes('leg') ? 'on_bacak' : 'triceps'],
    [/squat|leg press|lunge|step/, 'on_bacak'], [/deadlift|hip|glute|thrust/, 'kalca'], [/calf/, 'baldir'], [/crunch|plank|ab|sit up|leg raise/, 'karin'], [/shrug/, 'trapez']
  ]
  return rules.find(([r]) => r.test(n))?.[1] ?? 'karin'
}

function parseDuration(s: string) {
  let m = 0
  const h = s.match(/(\d+)\s*h/); const mm = s.match(/(\d+)\s*m/)
  if (h) m += +h[1] * 60
  if (mm) m += +mm[1]
  if (!h && !mm && /^\d+$/.test(s.trim())) m = +s / 60
  return m
}

export async function importStrong(text: string, custom: Exercise[]) {
  const rows = parseCsv(text)
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => head.indexOf(name)
  const iDate = col('date'), iName = col('workout name'), iDur = col('duration'), iEx = col('exercise name'), iOrder = col('set order'),
    iW = col('weight'), iR = col('reps'), iSec = col('seconds'), iNotes = col('workout notes'), iRpe = col('rpe')
  if (iDate < 0 || iEx < 0) throw new Error('Bu dosya Strong dışa aktarımına benzemiyor. Strong → Ayarlar → Verileri dışa aktar ile aldığın CSV dosyasını seç.')

  const known = new Map<string, string>()
  for (const e of [...BUILTIN_EXERCISES, ...custom]) known.set(normalizeTr(e.name), e.id)
  const newCustom = new Map<string, Exercise>()
  const resolve = (name: string) => {
    const k = name.trim().toLowerCase()
    if (STRONG_MAP[k]) return STRONG_MAP[k]
    const kn = known.get(normalizeTr(name))
    if (kn) return kn
    const id = 'c_strong_' + normalizeTr(name).replace(/[^a-z0-9]+/g, '_')
    if (!newCustom.has(id)) newCustom.set(id, { id, name: name.trim(), equipment: 'other', kind: 'weight', primary: [guessMuscle(name)], secondary: [], flags: [], custom: true })
    return id
  }

  const workouts = new Map<string, Workout>()
  for (const r of rows.slice(1)) {
    const dateStr = r[iDate]; if (!dateStr) continue
    const key = dateStr + '|' + (r[iName] ?? '')
    const startedAt = new Date(dateStr.replace(' ', 'T')).getTime()
    if (Number.isNaN(startedAt)) continue
    let w = workouts.get(key)
    if (!w) {
      const mins = iDur >= 0 ? parseDuration(r[iDur] ?? '') : 60
      w = { name: r[iName] || 'Strong antrenmanı', startedAt, endedAt: startedAt + (mins || 60) * 60000, exercises: [], note: iNotes >= 0 ? r[iNotes] || undefined : undefined }
      workouts.set(key, w)
    }
    const exId = resolve(r[iEx])
    let ex = w.exercises[w.exercises.length - 1]
    if (!ex || ex.exerciseId !== exId) { ex = { exerciseId: exId, sets: [], restSec: 120 }; w.exercises.push(ex) }
    const order = (r[iOrder] ?? '').trim().toUpperCase()
    const rpe = iRpe >= 0 ? parseFloat(r[iRpe]) : NaN
    const set: SetEntry = {
      type: order === 'W' ? 'warmup' : order === 'D' ? 'drop' : order === 'F' ? 'failure' : 'normal', done: true,
      weight: parseFloat(r[iW]) || undefined, reps: parseInt(r[iR]) || undefined, seconds: iSec >= 0 ? parseFloat(r[iSec]) || undefined : undefined,
      rir: !Number.isNaN(rpe) && rpe > 0 ? Math.max(0, Math.round(10 - rpe)) : undefined
    }
    ex.sets.push(set)
  }
  const list = [...workouts.values()].filter((w) => w.exercises.length)
  const existing = new Set((await db.workouts.toArray()).map((w) => w.startedAt))
  const fresh = list.filter((w) => !existing.has(w.startedAt))
  await db.transaction('rw', db.workouts, db.customExercises, async () => {
    await db.customExercises.bulkPut([...newCustom.values()])
    await db.workouts.bulkAdd(fresh)
  })
  return { workouts: fresh.length, skipped: list.length - fresh.length, newExercises: newCustom.size }
}
