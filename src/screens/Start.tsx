import { ask } from '../components/Dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type Routine } from '../db'
import { useActiveWorkout, useExercises } from '../hooks'
import { startWorkout } from '../lib/workout'
import RoutineEditor from './RoutineEditor'
import Wizard from './Wizard'
import ExerciseLibrary from './Exercises'
import VersionFooter from '../components/VersionFooter'
import { fmtDate } from '../lib/calc'

export default function StartScreen({ onStarted }: { onStarted: () => void }) {
  const routines = useLiveQuery(() => db.routines.orderBy('name').toArray(), []) ?? []
  const lastByRoutine = useLiveQuery(async () => {
    const m = new Map<number, number>()
    for (const w of await db.workouts.toArray()) if (w.routineId) m.set(w.routineId, Math.max(m.get(w.routineId) ?? 0, w.startedAt))
    return m
  }, []) ?? new Map<number, number>()
  const { workout } = useActiveWorkout()
  const { map } = useExercises()
  const [editing, setEditing] = useState<Routine | null>(null)
  const [wizard, setWizard] = useState(false)
  const [library, setLibrary] = useState(false)

  const start = async (r?: Routine) => {
    if (workout && !await ask('Devam eden bir antrenman var. Onu silip yenisini başlatayım mı?', { danger: true, ok: 'Yenisini başlat' })) return
    await startWorkout(r)
    onStarted()
  }

  const folders = new Map<string, Routine[]>()
  for (const r of routines) {
    const f = r.folder || 'Rutinlerim'
    folders.set(f, [...(folders.get(f) ?? []), r])
  }
  const deleteFolder = async (f: string) => {
    if (!await ask(`"${f}" klasöründeki tüm rutinler silinsin mi?`, { danger: true, ok: 'Sil' })) return
    await db.routines.bulkDelete(folders.get(f)!.map((r) => r.id!))
  }

  return (
    <div className="screen">
      <div className="screen-head"><h1>Antrenman</h1></div>
      <div className="stack">
        <button className="btn primary block" onClick={() => start()}>Boş antrenman başlat</button>
        <div className="row">
          <button className="btn grow" onClick={() => setWizard(true)}>Program oluştur</button>
          <button className="btn grow" onClick={() => setLibrary(true)}>Hareketler</button>
        </div>
      </div>

      <div className="row-between">
        <h2>Rutinler</h2>
        <button className="btn ghost" onClick={() => setEditing({ name: '', exercises: [], updatedAt: 0 })}>+ Yeni rutin</button>
      </div>

      {routines.length === 0 && (
        <div className="card empty">
          <h3>Henüz rutinin yok</h3>
          <p className="muted small">Kaç gün gidebildiğini, ne kadar düzenli olduğunu ve ne kadar vaktin olduğunu söyle, sağlık kısıtlarına uygun bir program hazırlayayım.</p>
          <button className="btn primary" onClick={() => setWizard(true)}>Program oluştur</button>
        </div>
      )}

      {[...folders].map(([folder, list]) => (
        <section key={folder} className="stack">
          <div className="row-between">
            <span className="section-label">{folder}</span>
            {folder !== 'Rutinlerim' && <button className="link muted tiny" onClick={() => deleteFolder(folder)}>Klasörü sil</button>}
          </div>
          <div className="grid2">
            {list.map((r) => (
              <div key={r.id} className="card">
                <div className="row-between">
                  <h3>{r.name}</h3>
                  <button className="icon-btn" aria-label="Düzenle" onClick={() => setEditing(r)}>⋯</button>
                </div>
                <p className="muted small clamp">{r.exercises.map((e) => map.get(e.exerciseId)?.name ?? e.exerciseId).join(', ')}</p>
                <p className="muted tiny">{r.exercises.length} hareket{lastByRoutine.get(r.id!) ? ` · son: ${fmtDate(lastByRoutine.get(r.id!)!)}` : ''}</p>
                <button className="btn primary sm" onClick={() => start(r)}>Başlat</button>
              </div>
            ))}
          </div>
        </section>
      ))}

      <VersionFooter />
      {editing && <RoutineEditor routine={editing} onClose={() => setEditing(null)} />}
      {wizard && <Wizard onClose={() => setWizard(false)} />}
      {library && <ExerciseLibrary onClose={() => setLibrary(false)} />}
    </div>
  )
}
