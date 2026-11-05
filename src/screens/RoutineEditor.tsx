import { ask, notify } from '../components/Dialog'
import { useState } from 'react'
import { db, type Routine, type RoutineExercise } from '../db'
import { useExercises, useProfile } from '../hooks'
import ExercisePicker from '../components/ExercisePicker'
import FlagBadges from '../components/FlagBadges'

const SS = 'abcdefgh'

export default function RoutineEditor({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const [r, setR] = useState<Routine>(structuredClone(routine))
  const [picking, setPicking] = useState(false)
  const { map } = useExercises()
  const profile = useProfile()

  const upd = (i: number, patch: Partial<RoutineExercise>) =>
    setR((x) => ({ ...x, exercises: x.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) }))
  const move = (i: number, d: number) => setR((x) => {
    const ex = [...x.exercises]; const j = i + d
    if (j < 0 || j >= ex.length) return x
    ;[ex[i], ex[j]] = [ex[j], ex[i]]
    return { ...x, exercises: ex }
  })
  const linkNext = (i: number) => setR((x) => {
    const ex = [...x.exercises]
    if (i + 1 >= ex.length) return x
    if (ex[i].superset && ex[i].superset === ex[i + 1].superset) { ex[i + 1] = { ...ex[i + 1], superset: undefined } }
    else {
      const used = new Set(ex.map((e) => e.superset).filter(Boolean))
      const tag = ex[i].superset ?? [...SS].find((c) => !used.has(c)) ?? 'z'
      ex[i] = { ...ex[i], superset: tag }; ex[i + 1] = { ...ex[i + 1], superset: tag }
    }
    return { ...x, exercises: ex }
  })

  const save = async () => {
    if (!r.name.trim()) { notify('Rutine bir ad ver.'); return }
    const data = { ...r, name: r.name.trim(), folder: r.folder?.trim() || undefined, updatedAt: Date.now() }
    if (r.id) await db.routines.put(data); else { delete data.id; await db.routines.add(data) }
    onClose()
  }
  const remove = async () => {
    if (r.id && await ask(`"${r.name}" silinsin mi?`)) { await db.routines.delete(r.id); onClose() }
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Vazgeç</button>
        <strong>{r.id ? 'Rutini düzenle' : 'Yeni rutin'}</strong>
        <button className="btn ghost" onClick={save}>Kaydet</button>
      </div>
      <div className="sheet-body">
        <input className="input big" placeholder="Rutin adı (ör. Üst Vücut A)" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
        <input className="input" placeholder="Klasör (isteğe bağlı)" value={r.folder ?? ''} onChange={(e) => setR({ ...r, folder: e.target.value })} />

        {r.exercises.map((e, i) => {
          const ex = map.get(e.exerciseId)
          const linked = e.superset && r.exercises[i + 1]?.superset === e.superset
          return (
            <div key={i} className={`card rex ${e.superset ? 'ss' : ''}`}>
              <div className="row-between">
                <div>
                  <strong>{ex?.name ?? e.exerciseId}</strong>
                  {e.superset && <span className="ss-tag">Süperset {e.superset.toUpperCase()}</span>}
                  {ex && <FlagBadges flags={ex.flags} active={profile.restrictions} alt={ex.alt?.map((a) => map.get(a)?.name ?? a)} />}
                </div>
                <div className="row">
                  <button className="icon-btn" onClick={() => move(i, -1)} aria-label="Yukarı">↑</button>
                  <button className="icon-btn" onClick={() => move(i, 1)} aria-label="Aşağı">↓</button>
                  <button className="icon-btn danger" onClick={() => setR({ ...r, exercises: r.exercises.filter((_, j) => j !== i) })} aria-label="Sil">✕</button>
                </div>
              </div>
              <div className="fields">
                <label>Set<input type="number" inputMode="numeric" value={e.sets} min={1} onChange={(v) => upd(i, { sets: Math.max(1, +v.target.value || 1) })} /></label>
                <label>Tekrar<input value={e.reps} onChange={(v) => upd(i, { reps: v.target.value })} /></label>
                <label>Dinl. (sn)<input type="number" inputMode="numeric" value={e.restSec} onChange={(v) => upd(i, { restSec: +v.target.value || 0 })} /></label>
              </div>
              {i < r.exercises.length - 1 && (
                <button className="link small" onClick={() => linkNext(i)}>{linked ? 'Sonrakiyle süperseti kaldır' : 'Sonrakiyle süperset yap'}</button>
              )}
            </div>
          )
        })}

        <button className="btn block" onClick={() => setPicking(true)}>+ Hareket ekle</button>
        {r.id && <button className="btn danger block" onClick={remove}>Rutini sil</button>}
      </div>
      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            setR((x) => ({ ...x, exercises: [...x.exercises, ...ids.map((id) => ({ exerciseId: id, sets: 3, reps: '8-12', restSec: profile.defaultRest }))] }))
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}
