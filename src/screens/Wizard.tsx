import { useState } from 'react'
import { db } from '../db'
import { useExercises, useProfile } from '../hooks'
import { buildPlan, type Adherence, type Duration, type Goal, type Plan } from '../lib/program'
import { notify } from '../components/Dialog'

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return <div className="seg">{options.map((o) => <button key={String(o.v)} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.l}</button>)}</div>
}

export default function Wizard({ onClose }: { onClose: () => void }) {
  const profile = useProfile()
  const { map } = useExercises()
  const [days, setDays] = useState(4)
  const [adherence, setAdherence] = useState<Adherence>('orta')
  const [duration, setDuration] = useState<Duration>('orta')
  const [goal, setGoal] = useState<Goal>('yag')
  const [plan, setPlan] = useState<Plan | null>(null)

  const make = () => setPlan(buildPlan({ days, adherence, duration, goal, restrictions: profile.restrictions }))
  const save = async () => {
    if (!plan) return
    const folder = `Program · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`
    await db.routines.bulkAdd(plan.days.map((d, i) => ({ name: `${i + 1}. ${d.name}`, folder, exercises: d.exercises, updatedAt: Date.now() })))
    await notify(`${plan.days.length} rutin "${folder}" klasörüne kaydedildi.`)
    onClose()
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={plan ? () => setPlan(null) : onClose}>{plan ? 'Geri' : 'Vazgeç'}</button>
        <strong>Program oluştur</strong>
        {plan ? <button className="btn ghost" onClick={save}>Kaydet</button> : <span />}
      </div>
      <div className="sheet-body">
        {!plan ? (
          <>
            <div className="card">
              <h3>Haftada kaç gün gidebilirsin?</h3>
              <Seg value={days} onChange={setDays} options={[2, 3, 4, 5, 6].map((v) => ({ v, l: String(v) }))} />
            </div>
            <div className="card">
              <h3>Devamlılığın nasıl?</h3>
              <Seg value={adherence} onChange={setAdherence} options={[{ v: 'iyi', l: 'İyi' }, { v: 'orta', l: 'Orta' }, { v: 'kotu', l: 'Kötü' }]} />
              <p className="muted small">{adherence === 'iyi' ? 'Planladığın günlerin neredeyse hepsine gidiyorsun.' : adherence === 'orta' ? 'Haftada bir gün kaçırdığın oluyor.' : 'İş, yorgunluk veya motivasyon yüzünden sık sık aksıyor.'}</p>
            </div>
            <div className="card">
              <h3>Bir antrenmana ne kadar vaktin var?</h3>
              <Seg value={duration} onChange={setDuration} options={[{ v: 'kisa', l: 'Kısa · 45 dk' }, { v: 'orta', l: 'Orta · 60 dk' }, { v: 'uzun', l: 'Uzun · 90 dk' }]} />
            </div>
            <div className="card">
              <h3>Hedefin</h3>
              <Seg value={goal} onChange={setGoal} options={[{ v: 'yag', l: 'Yağ yakımı' }, { v: 'kas', l: 'Kas' }, { v: 'guc', l: 'Güç' }]} />
            </div>
            <p className="muted small">Profilindeki sağlık kısıtları ({profile.restrictions.length} adet) programa uygulanır.</p>
            <button className="btn primary block" onClick={make}>Programı hazırla</button>
          </>
        ) : (
          <>
            <div className="card">
              <span className="eyebrow">Önerilen program</span>
              <h2>{plan.title}</h2>
              <p className="small"><b>Günler:</b> {plan.schedule}</p>
              <ul className="note-list">{plan.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
            {plan.days.map((d, i) => (
              <div key={i} className="card">
                <div className="card-title"><h3>{i + 1}. {d.name}</h3><span className="pill">≈ {d.minutes} dk</span></div>
                <table className="sets read">
                  <tbody>
                    {d.exercises.map((e, j) => (
                      <tr key={j}>
                        <td>{map.get(e.exerciseId)?.name}{e.superset && <span className="ss-tag" style={{ marginLeft: 6 }}>S{e.superset.toUpperCase()}</span>}</td>
                        <td className="mono" style={{ whiteSpace: 'nowrap' }}>{e.sets} × {e.reps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <button className="btn primary block" onClick={save}>Rutinlere kaydet</button>
          </>
        )}
      </div>
    </div>
  )
}
