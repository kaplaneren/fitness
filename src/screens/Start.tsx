import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type Routine } from '../db'
import { useActiveWorkout, useExercises } from '../hooks'
import { SAMPLE_ROUTINES, startWorkout } from '../lib/workout'
import RoutineEditor from './RoutineEditor'
import { fmtDate } from '../lib/calc'

export default function StartScreen({ onStarted }: { onStarted: () => void }) {
  const routines = useLiveQuery(() => db.routines.orderBy('name').toArray(), []) ?? []
  const lastByRoutine = useLiveQuery(async () => {
    const m = new Map<number, number>()
    for (const w of await db.workouts.toArray()) if (w.routineId) m.set(w.routineId, Math.max(m.get(w.routineId) ?? 0, w.startedAt))
    return m
  }, []) ?? new Map()
  const { workout } = useActiveWorkout()
  const { map } = useExercises()
  const [editing, setEditing] = useState<Routine | null>(null)

  const start = async (r?: Routine) => {
    if (workout && !confirm('Devam eden bir antrenman var. Onu silip yenisini başlatayım mı?')) return
    await startWorkout(r)
    onStarted()
  }

  const folders = new Map<string, Routine[]>()
  for (const r of routines) {
    const f = r.folder || 'Rutinlerim'
    folders.set(f, [...(folders.get(f) ?? []), r])
  }

  const addSamples = async () => {
    await db.routines.bulkAdd(SAMPLE_ROUTINES.map((r) => ({ ...r, updatedAt: Date.now() })))
  }

  return (
    <div className="screen">
      <h1>Antrenman</h1>
      <button className="btn primary block" onClick={() => start()}>Boş antrenman başlat</button>

      <div className="row-between section-head">
        <h2>Rutinler</h2>
        <button className="btn ghost" onClick={() => setEditing({ name: '', exercises: [], updatedAt: 0 })}>+ Yeni rutin</button>
      </div>

      {routines.length === 0 && (
        <div className="card empty">
          <p>Henüz rutinin yok. Kendin oluşturabilir ya da omurga, diz ve bilek kısıtlarına göre hazırladığım 4 günlük üst/alt örnek programı ekleyebilirsin.</p>
          <button className="btn" onClick={addSamples}>Örnek programı ekle</button>
        </div>
      )}

      {[...folders].map(([folder, list]) => (
        <section key={folder}>
          <h3 className="folder">{folder}</h3>
          <div className="grid2">
            {list.map((r) => (
              <div key={r.id} className="card routine">
                <div className="row-between">
                  <strong>{r.name}</strong>
                  <button className="icon-btn" aria-label="Düzenle" onClick={() => setEditing(r)}>⋯</button>
                </div>
                <p className="muted small clamp">{r.exercises.map((e) => map.get(e.exerciseId)?.name ?? e.exerciseId).join(', ')}</p>
                {lastByRoutine.get(r.id!) && <p className="muted tiny">Son: {fmtDate(lastByRoutine.get(r.id!)!)}</p>}
                <button className="btn primary sm" onClick={() => start(r)}>Başlat</button>
              </div>
            ))}
          </div>
        </section>
      ))}

      {editing && <RoutineEditor routine={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
