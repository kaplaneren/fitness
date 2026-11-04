import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, setKV, type Workout } from '../db'
import { useExercises } from '../hooks'
import { e1rm, fmtDate, fmtDuration, fmtKg, workoutSetCount, workoutVolume } from '../lib/calc'

export default function HistoryScreen() {
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().toArray(), []) ?? []
  const [open, setOpen] = useState<Workout | null>(null)

  const byMonth = new Map<string, Workout[]>()
  for (const w of workouts) {
    const k = new Date(w.startedAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    byMonth.set(k, [...(byMonth.get(k) ?? []), w])
  }

  return (
    <div className="screen">
      <h1>Geçmiş</h1>
      {workouts.length === 0 && <p className="muted">Bitirdiğin antrenmanlar burada görünecek.</p>}
      {[...byMonth].map(([month, list]) => (
        <section key={month}>
          <h3 className="folder">{month} · {list.length} antrenman</h3>
          {list.map((w) => <WorkoutCard key={w.id} w={w} onClick={() => setOpen(w)} />)}
        </section>
      ))}
      {open && <WorkoutDetail w={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function WorkoutCard({ w, onClick }: { w: Workout; onClick: () => void }) {
  const { map } = useExercises()
  return (
    <button className="card wcard" onClick={onClick}>
      <div className="row-between"><strong>{w.name}</strong><span className="muted small">{fmtDate(w.startedAt)}</span></div>
      <div className="stats small muted">
        <span>{fmtDuration((w.endedAt ?? w.startedAt) - w.startedAt)}</span>
        <span>{fmtKg(workoutVolume(w))} kg hacim</span>
        <span>{workoutSetCount(w)} set</span>
      </div>
      <ul className="mini">
        {w.exercises.map((e, i) => {
          const work = e.sets.filter((s) => s.type !== 'warmup')
          const top = work.reduce((b, s) => (e1rm(s.weight, s.reps) > e1rm(b?.weight, b?.reps) ? s : b), work[0])
          return <li key={i}><span>{work.length} × {map.get(e.exerciseId)?.name ?? e.exerciseId}</span><span className="muted">{top?.weight ? `${fmtKg(top.weight)} kg × ${top.reps}` : top?.reps ? `${top.reps} tekrar` : ''}</span></li>
        })}
      </ul>
    </button>
  )
}

function WorkoutDetail({ w, onClose }: { w: Workout; onClose: () => void }) {
  const { map } = useExercises()
  const remove = async () => { if (confirm('Bu antrenman silinsin mi?')) { await db.workouts.delete(w.id!); onClose() } }
  const edit = async () => {
    if (await db.kv.get('active')) { alert('Önce devam eden antrenmanı bitir.'); return }
    if (!confirm('Antrenman düzenleme moduna alınsın mı? Bitir dediğinde tekrar kaydedilir.')) return
    await db.workouts.delete(w.id!)
    await setKV('active', { ...w, id: undefined, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) })) })
    onClose()
  }
  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Kapat</button>
        <strong>{w.name}</strong>
        <button className="btn ghost" onClick={edit}>Düzenle</button>
      </div>
      <div className="sheet-body">
        <p className="muted">{fmtDate(w.startedAt, true)} · {fmtDuration((w.endedAt ?? w.startedAt) - w.startedAt)}</p>
        <div className="stat-row">
          <div><b>{fmtKg(workoutVolume(w))}</b><span>kg hacim</span></div>
          <div><b>{workoutSetCount(w)}</b><span>set</span></div>
          {w.heartRateAvg && <div><b>{w.heartRateAvg}</b><span>ort. nabız</span></div>}
          {w.heartRateMax && <div><b>{w.heartRateMax}</b><span>maks. nabız</span></div>}
        </div>
        {w.note && <p className="card">{w.note}</p>}
        {w.exercises.map((e, i) => {
          const info = map.get(e.exerciseId)
          let n = 0
          return (
            <div key={i} className="card">
              <strong>{info?.name ?? e.exerciseId}</strong>
              <table className="sets read">
                <tbody>
                  {e.sets.map((s, si) => (
                    <tr key={si} className={`t-${s.type}`}>
                      <td>{s.type === 'normal' ? ++n : s.type === 'warmup' ? 'I' : s.type === 'drop' ? 'D' : 'F'}</td>
                      <td>{s.seconds != null ? `${Math.round(s.seconds / 60)} dk` : `${s.weight != null ? fmtKg(s.weight) + ' kg × ' : ''}${s.reps ?? ''}`}</td>
                      <td className="muted">{s.weight && s.reps && s.type !== 'warmup' ? `1RM ≈ ${fmtKg(e1rm(s.weight, s.reps))}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
        <button className="btn danger block" onClick={remove}>Antrenmanı sil</button>
      </div>
    </div>
  )
}
