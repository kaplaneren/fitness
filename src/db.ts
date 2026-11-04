import Dexie, { type Table } from 'dexie'
import { BUILTIN_EXERCISES, type Exercise, type Flag } from './data/exercises'

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure'

export interface SetEntry {
  weight?: number
  reps?: number
  seconds?: number
  type: SetType
  done: boolean
  rpe?: number
}

export interface WorkoutExercise {
  exerciseId: string
  sets: SetEntry[]
  restSec: number
  note?: string
  superset?: string
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
}

export interface Profile {
  bodyweight: number
  restrictions: Flag[]
  defaultRest: number
  barWeight: number
  plates: number[]
  lastBackup?: number
}

export const DEFAULT_PROFILE: Profile = {
  bodyweight: 80.4,
  restrictions: ['axial', 'lumbar', 'knee', 'wrist'],
  defaultRest: 120,
  barWeight: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25]
}

interface KV { key: string; value: unknown }

class AppDB extends Dexie {
  customExercises!: Table<Exercise, string>
  routines!: Table<Routine, number>
  workouts!: Table<Workout, number>
  measurements!: Table<Measurement, number>
  kv!: Table<KV, string>

  constructor() {
    super('form-app')
    this.version(1).stores({
      customExercises: 'id, name',
      routines: '++id, name, folder, updatedAt',
      workouts: '++id, startedAt',
      measurements: '++id, date',
      kv: 'key'
    })
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

const BACKUP_TABLES = ['customExercises', 'routines', 'workouts', 'measurements', 'kv'] as const

export async function exportBackup() {
  const data: Record<string, unknown[]> = {}
  for (const t of BACKUP_TABLES) data[t] = await db.table(t).toArray()
  return { app: 'form', version: 1, exportedAt: new Date().toISOString(), data }
}

export async function importBackup(json: unknown) {
  const b = json as { app?: string; data?: Record<string, unknown[]> }
  if (b?.app !== 'form' || !b.data) throw new Error('Bu dosya geçerli bir yedek değil.')
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      await db.table(t).clear()
      if (b.data![t]) await db.table(t).bulkAdd(b.data![t])
    }
  })
}
