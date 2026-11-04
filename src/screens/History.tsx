import { ask, notify } from '../components/Dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, setKV, type Workout } from '../db'
import { useExercises } from '../hooks'
import { e1rm, fmtDate, fmtDuration, fmtKg, workoutSetCount, workoutVolume } from '../lib/calc'
import { analyzeWorkout, bestE1rmByExercise } from '../lib/analysis'

export function HistoryList() {
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().toArray(), []) ?? []
  const [open, setOpen] = useState<Workout | null>(null)
  const byMonth = new Map<string, Workout[]>()
  for (const w of workouts) {
    const k = new Date(w.startedAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    byMonth.set(k, [...(byMonth.get(k) ?? []), w])
  }
  return (
    <div className="stack">
      {workouts.length === 0 && <p className="muted">Bitirdiğin antrenmanlar burada görünecek.</p>}
      {[...byMonth].map(([month, list]) => (
        <section key={month} className="stack">
          <span className="section-label">{month} · {list.length} antrenman</span>
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
    <button className="card" onClick={onClick}>
      <div className="row-between"><h3>{w.name}</h3><span className="muted small">{fmtDate(w.startedAt)}</span></div>
      <div className="row small muted">
        <span>{fmtDuration((w.endedAt ?? w.startedAt) - w.startedAt)}</span>·
        <span>{fmtKg(workoutVolume(w))} kg</span>·
        <span>{workoutSetCount(w)} set</span>
      </div>
      <ul className="mini">
        {w.exercises.map((e, i) => {
          const work = e.sets.filter((s) => s.type !== 'warmup')
          const top = work.reduce((b, s) => (e1rm(s.weight, s.reps) > e1rm(b?.weight, b?.reps) ? s : b), work[0])
          return <li key={i}><span className="ellipsis">{work.length} × {map.get(e.exerciseId)?.name ?? e.exerciseId}</span><span className="muted mono">{top?.weight ? `${fmtKg(top.weight)} × ${top.reps}` : top?.reps ? `${top.reps} tekrar` : ''}</span></li>
        })}
      </ul>
    </button>
  )
}

export function WorkoutDetail({ w, onClose, justFinished }: { w: Workout; onClose: () => void; justFinished?: boolean }) {
  const { map } = useExercises()
  const prs = useLiveQuery(async () => {
    const before = (await db.workouts.toArray()).filter((x) => x.startedAt < w.startedAt)
    const best = bestE1rmByExercise(before)
    const list: { name: string; v: number }[] = []
    for (const e of w.exercises) {
      const top = Math.max(0, ...e.sets.filter((s) => s.type !== 'warmup' && (s.reps ?? 99) <= 12).map((s) => e1rm(s.weight, s.reps)))
      if (top > 0 && best[e.exerciseId] && top > best[e.exerciseId].v) list.push({ name: map.get(e.exerciseId)?.name ?? '', v: top })
    }
    return list
  }, [w.id, map]) ?? []
  const analysis = analyzeWorkout(w, map)

  const remove = async () => { if (await ask('Bu antrenman silinsin mi?', { danger: true, ok: 'Sil' })) { await db.workouts.delete(w.id!); onClose() } }
  const edit = async () => {
    if (await db.kv.get('active')) { notify('Önce devam eden antrenmanı bitir.'); return }
    if (!await ask('Antrenman düzenlemeye açılsın mı? Bitir dediğinde yeniden kaydedilir.')) return
    await db.workouts.delete(w.id!)
    await setKV('active', { ...w, id: undefined, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) })) })
    onClose()
  }
  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Kapat</button>
        <strong className="ellipsis">{justFinished ? 'Tebrikler' : w.name}</strong>
        <button className="btn ghost" onClick={edit}>Düzenle</button>
      </div>
      <div className="sheet-body">
        {justFinished && <div className="stack"><span className="eyebrow">Antrenman kaydedildi</span><h1>{w.name}</h1></div>}
        <p className="muted">{fmtDate(w.startedAt, true)}</p>
        <div className="stat-row">
          <div className="stat"><b>{fmtDuration((w.endedAt ?? w.startedAt) - w.startedAt)}</b><span>süre</span></div>
          <div className="stat"><b>{fmtKg(workoutVolume(w))}</b><span>kg hacim</span></div>
          <div className="stat"><b>{workoutSetCount(w)}</b><span>set</span></div>
          {w.heartRateAvg && <div className="stat"><b>{w.heartRateAvg}</b><span>ort. nabız</span></div>}
        </div>
        {prs.length > 0 && (
          <div className="card">
            <h3>Yeni rekorlar</h3>
            {prs.map((p) => <div key={p.name} className="row-between small"><span>★ {p.name}</span><b>1RM ≈ {fmtKg(p.v)} kg</b></div>)}
          </div>
        )}
        <div className="card">
          <h3>Antrenman analizi</h3>
          {analysis.insights.map((x, i) => <p key={i} className="small"><b className={x.tone === 'good' ? 'good' : x.tone === 'bad' ? 'bad' : 'warn'}>{x.tone === 'good' ? '✓' : '!'}</b> {x.text}</p>)}
          {analysis.repBands.some(Boolean) && (
            <div className="row tiny muted">
              <span className="pill">&lt;6 tekrar: {analysis.repBands[0]}</span>
              <span className="pill">6-15: {analysis.repBands[1]}</span>
              <span className="pill">15+: {analysis.repBands[2]}</span>
            </div>
          )}
        </div>
        {w.note && <div className="card"><p>{w.note}</p></div>}
        {w.exercises.map((e, i) => {
          const info = map.get(e.exerciseId)
          let n = 0
          return (
            <div key={i} className="card">
              <h3>{info?.name ?? e.exerciseId}</h3>
              <table className="sets read">
                <tbody>
                  {e.sets.map((s, si) => (
                    <tr key={si} className={`t-${s.type}`}>
                      <td style={{ width: 28 }}><b>{s.type === 'normal' ? ++n : s.type === 'warmup' ? 'I' : s.type === 'drop' ? 'D' : 'F'}</b></td>
                      <td className="mono">{s.seconds != null ? `${Math.round(s.seconds / 60)} dk` : `${s.weight != null ? fmtKg(s.weight) + ' kg × ' : ''}${s.reps ?? ''}`}{s.rir != null ? ` · RIR ${s.rir}` : ''}</td>
                      <td className="muted tiny">{s.weight && s.reps && s.type !== 'warmup' ? `1RM ≈ ${fmtKg(e1rm(s.weight, s.reps))}` : ''}</td>
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
