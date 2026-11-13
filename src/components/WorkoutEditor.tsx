import { useState } from 'react'
import { db, type SetEntry, type Workout } from '../db'
import { useExercises } from '../hooks'
import { ask, notify } from './Dialog'

// Biten antrenmanı yerinde düzenleme: ad, tarih, başlangıç / bitiş saati, nabız, not ve setler.
// Antrenmanı yeniden açmaz; "Devam et" ayrı bir seçenek.

const pad = (n: number) => String(n).padStart(2, '0')
const dateStr = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const timeStr = (t: number) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const num = (v: string) => (v.trim() === '' ? undefined : parseFloat(v.replace(',', '.')))

export default function WorkoutEditor({ w, onClose, onSaved }: { w: Workout; onClose: () => void; onSaved: (w: Workout) => void }) {
  const { map } = useExercises()
  const [name, setName] = useState(w.name)
  const [date, setDate] = useState(dateStr(w.startedAt))
  const [start, setStart] = useState(timeStr(w.startedAt))
  const [end, setEnd] = useState(timeStr(w.endedAt ?? w.startedAt))
  const [hrAvg, setHrAvg] = useState(w.heartRateAvg ? String(w.heartRateAvg) : '')
  const [hrMax, setHrMax] = useState(w.heartRateMax ? String(w.heartRateMax) : '')
  const [note, setNote] = useState(w.note ?? '')
  const [exs, setExs] = useState(() => w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) })))

  const s0 = new Date(`${date}T${start}`).getTime()
  let e0 = new Date(`${date}T${end}`).getTime()
  if (e0 < s0) e0 += 86400000 // gece yarısını geçen antrenman
  const mins = Math.round((e0 - s0) / 60000)

  const setField = (ei: number, si: number, patch: Partial<SetEntry>) => setExs(exs.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) }))
  const delSet = (ei: number, si: number) => setExs(exs.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) })).filter((e) => e.sets.length))
  const addSet = (ei: number) => setExs(exs.map((e, i) => (i !== ei ? e : { ...e, sets: [...e.sets, { ...(e.sets[e.sets.length - 1] ?? { type: 'normal' }), done: true, type: 'normal' }] })))
  const delEx = async (ei: number) => { if (await ask(`${map.get(exs[ei].exerciseId)?.name ?? 'Hareket'} bu antrenmandan çıkarılsın mı?`, { danger: true, ok: 'Çıkar' })) setExs(exs.filter((_, i) => i !== ei)) }

  const save = async () => {
    if (!Number.isFinite(s0) || !Number.isFinite(e0)) { notify('Tarih veya saat geçersiz.'); return }
    if (mins > 6 * 60 && !(await ask(`Süre ${Math.floor(mins / 60)} saat ${mins % 60} dk görünüyor. Doğru mu?`, { ok: 'Evet, kaydet' }))) return
    const next: Workout = {
      ...w, name: name.trim() || w.name, startedAt: s0, endedAt: e0, note: note.trim() || undefined,
      heartRateAvg: num(hrAvg) || undefined, heartRateMax: num(hrMax) || undefined,
      exercises: exs.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) })).filter((e) => e.sets.length)
    }
    if (!next.exercises.length) { notify('En az bir set kalmalı. Antrenmanı tamamen silmek için detay ekranındaki Sil\'i kullan.'); return }
    await db.workouts.put(next)
    onSaved(next)
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Vazgeç</button>
        <strong>Antrenmanı düzenle</strong>
        <button className="btn ghost" onClick={save}>Kaydet</button>
      </div>
      <div className="sheet-body">
        <div className="card">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Antrenman adı" />
          <label className="field">Tarih<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <div className="fields two">
            <label className="field">Başlangıç<input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="field">Bitiş<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <p className="muted tiny">Süre: {Number.isFinite(mins) ? `${Math.floor(mins / 60) ? `${Math.floor(mins / 60)} sa ` : ''}${mins % 60} dk` : '–'}. Yakılan kalori süreye göre yeniden hesaplanır.</p>
          <div className="fields">
            <label className="field">Ort. nabız<input inputMode="numeric" value={hrAvg} onChange={(e) => setHrAvg(e.target.value)} /></label>
            <label className="field">Maks. nabız<input inputMode="numeric" value={hrMax} onChange={(e) => setHrMax(e.target.value)} /></label>
          </div>
          <textarea className="input" rows={2} placeholder="Not" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {exs.map((e, ei) => {
          const info = map.get(e.exerciseId)
          const timed = info?.kind === 'time'
          return (
            <div key={ei} className="card">
              <div className="row-between"><h3>{info?.name ?? e.exerciseId}</h3><button className="link small danger" onClick={() => delEx(ei)}>Çıkar</button></div>
              <table className="sets edit-sets">
                <thead><tr><th>#</th>{timed ? <th>dk</th> : <><th>kg</th><th>tekrar</th><th>RIR</th></>}<th /></tr></thead>
                <tbody>
                  {e.sets.map((s, si) => (
                    <tr key={`${exs.length}-${ei}-${si}-${e.sets.length}`} className={`t-${s.type}`}>
                      <td><button className="link small" title="Set türü" onClick={() => setField(ei, si, { type: s.type === 'normal' ? 'warmup' : s.type === 'warmup' ? 'drop' : s.type === 'drop' ? 'failure' : 'normal' })}>{s.type === 'normal' ? si + 1 : s.type === 'warmup' ? 'I' : s.type === 'drop' ? 'D' : 'F'}</button></td>
                      {timed
                        ? <td><input className="input sm" inputMode="decimal" defaultValue={s.seconds != null ? Math.round(s.seconds / 60) : ''} onChange={(x) => setField(ei, si, { seconds: (num(x.target.value) ?? 0) * 60 })} /></td>
                        : <>
                          <td><input className="input sm" inputMode="decimal" defaultValue={s.weight ?? ''} onChange={(x) => setField(ei, si, { weight: num(x.target.value) })} /></td>
                          <td><input className="input sm" inputMode="numeric" defaultValue={s.reps ?? ''} onChange={(x) => setField(ei, si, { reps: num(x.target.value) })} /></td>
                          <td><input className="input sm" inputMode="numeric" defaultValue={s.rir ?? ''} onChange={(x) => setField(ei, si, { rir: num(x.target.value) })} /></td>
                        </>}
                      <td><button className="icon-btn" aria-label="Seti sil" onClick={() => delSet(ei, si)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn sm" onClick={() => addSet(ei)}>+ Set</button>
            </div>
          )
        })}
        <p className="muted tiny">Yeni hareket eklemek için detaydaki "Devam et" ile antrenmanı yeniden aç.</p>
        <button className="btn primary block" onClick={save}>Kaydet</button>
      </div>
    </div>
  )
}
