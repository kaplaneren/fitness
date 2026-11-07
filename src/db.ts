import Dexie, { type Table } from 'dexie'
import { BUILTIN_EXERCISES, type Exercise, type Flag } from './data/exercises'
import type { Gear } from './lib/equipment'
import type { ActivityInfo } from './lib/activity'

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure'

export interface SetEntry {
  weight?: number
  reps?: number
  seconds?: number
  type: SetType
  done: boolean
  rpe?: number
  /** Tükenişe kalan tekrar (Reps In Reserve) */
  rir?: number
  /** Tek taraflı kayıt: sol / sağ */
  side?: 'L' | 'R'
}

export interface WorkoutExercise {
  exerciseId: string
  sets: SetEntry[]
  restSec: number
  note?: string
  superset?: string
  /** Rutindeki tekrar aralığı (ör. "8-12") */
  target?: string
  advice?: string
  adviceTone?: 'up' | 'same' | 'down' | 'new'
}

export interface Workout {
  id?: number
  name: string
  startedAt: number
  endedAt?: number
  routineId?: number
  exercises: WorkoutExercise[]
  note?: string
  heartRateAvg?: number
  heartRateMax?: number
  bodyweight?: number
  /** Salon dışı aktivite (tenis, yüzme, koşu...); varsa exercises boştur */
  activity?: ActivityInfo
}

export interface RoutineExercise {
  exerciseId: string
  sets: number
  reps: string
  restSec: number
  superset?: string
}

export interface Routine {
  id?: number
  name: string
  folder?: string
  exercises: RoutineExercise[]
  updatedAt: number
}

export interface Measurement {
  id?: number
  date: number
  weight?: number
  waist?: number
  bodyFat?: number
  chest?: number
  arm?: number
  thigh?: number
  hip?: number
}

export interface Profile {
  bodyweight: number
  height: number
  age: number
  sex: 'm' | 'f'
  restrictions: Flag[]
  /** Eldeki ekipman; null/boşsa tam donanımlı salon */
  equipment?: Gear[] | null
  defaultRest: number
  dynamicRest: boolean
  barWeight: number
  plates: number[]
  lastBackup?: number
  theme: 'system' | 'light' | 'dark'
  activity: number
  goal: 'cut' | 'maintain' | 'bulk'
  /** Elle girilen hedefler; boşsa hesaplanır */
  kcalTarget?: number
  proteinTarget?: number
  fatTarget?: number
  waterTarget: number
  targetWeight?: number
  weeklyTarget: number
  carbCycling: boolean
  supplements: string[]
  /** Saatte yakılan aktif kalori: ağırlık antrenmanı / kardiyo */
  kcalWeights: number
  kcalCardio: number
  /** Antrenmanla yakılanı günlük kalori hedefine ekle */
  eatBack: boolean
  /** Günlük ortalama adım */
  steps: number
}

export const DEFAULT_PROFILE: Profile = {
  bodyweight: 75,
  height: 175,
  age: 30,
  sex: 'm',
  restrictions: [],
  defaultRest: 120,
  dynamicRest: true,
  barWeight: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  theme: 'system',
  activity: 1.45,
  goal: 'cut',
  waterTarget: 10,
  weeklyTarget: 4,
  carbCycling: false,
  supplements: ['Kreatin 5 g'],
  kcalWeights: 380,
  kcalCardio: 500,
  eatBack: false,
  steps: 7500
}

export interface Checkin {
  date: string
  sleepHours?: number
  sleepQuality?: number
  energy?: number
  soreness?: number
  stress?: number
  painKnee?: number
  painBack?: number
  painWrist?: number
  painShoulder?: number
  steps?: number
  note?: string
}

export interface MealTemplate { id: string; name: string; items: Omit<DiaryEntry, 'id' | 'date' | 'meal' | 'createdAt'>[] }

export interface Food {
  id: string
  name: string
  brand?: string
  /** 100 g (veya 100 ml) başına */
  kcal: number
  p: number
  c: number
  f: number
  fiber?: number
  servings?: { label: string; g: number }[]
  cat?: string
  barcode?: string
  source?: 'base' | 'usda' | 'off' | 'user' | 'recipe'
  ingredients?: { foodId: string; g: number }[]
}

export type Meal = 'kahvalti' | 'ogle' | 'aksam' | 'ara'

export interface DiaryEntry {
  id?: number
  date: string
  meal: Meal
  foodId: string
  name: string
  grams: number
  kcal: number
  p: number
  c: number
  f: number
  label?: string
  createdAt: number
}

export interface Photo {
  id?: number
  date: number
  blob: Blob
  note?: string
}

interface KV { key: string; value: unknown }

class AppDB extends Dexie {
  customExercises!: Table<Exercise, string>
  routines!: Table<Routine, number>
  workouts!: Table<Workout, number>
  measurements!: Table<Measurement, number>
  kv!: Table<KV, string>
  foods!: Table<Food, string>
  diary!: Table<DiaryEntry, number>
  photos!: Table<Photo, number>
  checkins!: Table<Checkin, string>

  constructor() {
    super('form-app')
    this.version(1).stores({
      customExercises: 'id, name',
      routines: '++id, name, folder, updatedAt',
      workouts: '++id, startedAt',
      measurements: '++id, date',
      kv: 'key'
    })
    this.version(2).stores({
      foods: 'id, name, barcode, source',
      diary: '++id, date, foodId, createdAt',
      photos: '++id, date'
    })
    this.version(3).stores({ checkins: 'date' })
  }
}

export const db = new AppDB()

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key)
  return row ? (row.value as T) : fallback
}
export function setKV(key: string, value: unknown) {
  return db.kv.put({ key, value })
}
export async function getProfile(): Promise<Profile> {
  return { ...DEFAULT_PROFILE, ...(await getKV<Partial<Profile>>('profile', {})) }
}

export function allExercises(custom: Exercise[] = []): Exercise[] {
  return [...BUILTIN_EXERCISES, ...custom].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}

const BACKUP_TABLES = ['customExercises', 'routines', 'workouts', 'measurements', 'kv', 'foods', 'diary', 'checkins'] as const

export async function exportBackup() {
  const data: Record<string, unknown[]> = {}
  for (const t of BACKUP_TABLES) data[t] = await db.table(t).toArray()
  return { app: 'form', version: 1, schema: db.verno, appVersion: __APP_VERSION__, exportedAt: new Date().toISOString(), data }
}

/** Geri yüklemeden önce yedeğin içeriğini özetler; geçersizse null. */
export function backupSummary(json: unknown) {
  const b = json as { app?: string; exportedAt?: string; data?: Record<string, unknown[]> }
  if (b?.app !== 'form' || !b.data) return null
  const n = (t: string) => b.data![t]?.length ?? 0
  const parts = [[n('workouts'), 'antrenman'], [n('routines'), 'rutin'], [n('measurements'), 'ölçüm'], [n('diary'), 'beslenme kaydı'], [n('checkins'), 'günlük kontrol'], [n('foods') + n('customExercises'), 'özel yiyecek/hareket']] as const
  return { text: parts.filter(([c]) => c).map(([c, l]) => `${c} ${l}`).join(', ') || 'boş yedek', date: b.exportedAt ? Date.parse(b.exportedAt) : null }
}

export async function importBackup(json: unknown) {
  const b = json as { app?: string; data?: Record<string, unknown[]> }
  if (b?.app !== 'form' || !b.data) throw new Error('Bu dosya geçerli bir yedek değil.')
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      await db.table(t).clear()
      if (b.data![t]) await db.table(t).bulkPut(b.data![t])
    }
  })
}
