import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import { EQUIPMENT_NAMES, FLAG_INFO, MUSCLE_GROUPS, MUSCLE_NAMES, type Equipment, type Exercise, type Kind, type Muscle } from '../data/exercises'
import { useExercises, useProfile } from '../hooks'
import { GroupChips, useFilteredExercises } from '../components/ExercisePicker'
import FlagBadges from '../components/FlagBadges'
import { e1rm, fmtDate, fmtKg } from '../lib/calc'

export default function ExercisesScreen() {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [open, setOpen] = useState<Exercise | null>(null)
  const [creating, setCreating] = useState(false)
  const list = useFilteredExercises(query, group)
  const profile = useProfile()
  return (
    <div className="screen">
      <div className="row-between"><h1>Hareketler</h1><button className="btn ghost" onClick={() => setCreating(true)}>+ Yeni</button></div>
      <input className="input" placeholder={`${list.length} hareket içinde ara…`} value={query} onChange={(e) => setQuery(e.target.value)} />
      <GroupChips value={group} onChange={setGroup} />
      <ul className="list">
        {list.map((e) => (
          <li key={e.id} onClick={() => setOpen(e)}>
            <div>
              <div>{e.name}</div>
              <div className="muted tiny">{e.primary.map((m) => MUSCLE_NAMES[m]).join(', ')} · {EQUIPMENT_NAMES[e.equipment]}</div>
              <FlagBadges flags={e.flags} active={profile.restrictions} />
            </div>
            <span className="muted">›</span>
          </li>
        ))}
      </ul>
      {open && <ExerciseDetail ex={open} onClose={() => setOpen(null)} />}
      {creating && <CustomExercise onClose={() => setCreating(false)} />}
    </div>
  )
}

function ExerciseDetail({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const { map } = useExercises()
  const profile = useProfile()
  const history = useLiveQuery(async () => {
    const ws = await db.workouts.orderBy('startedAt').reverse().toArray()
    return ws.flatMap((w) => w.exercises.filter((e) => e.exerciseId === ex.id).map((e) => ({ date: w.startedAt, sets: e.sets.filter((s) => s.type !== 'warmup') })))
  }, [ex.id]) ?? []
  const all = history.flatMap((h) => h.sets)
  const best1rm = Math.max(0, ...all.map((s) => e1rm(s.weight, s.reps)))
  const maxW = Math.max(0, ...all.map((s) => s.weight ?? 0))
  const maxReps = Math.max(0, ...all.map((s) => s.reps ?? 0))
  const hit = ex.flags.filter((f) => profile.restrictions.includes(f))

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Kapat</button>
        <strong className="clamp1">{ex.name}</strong>
        {ex.custom ? <button className="btn ghost danger" onClick={async () => { if (confirm('Özel hareket silinsin mi?')) { await db.customExercises.delete(ex.id); onClose() } }}>Sil</button> : <span />}
      </div>
      <div className="sheet-body">
        <BodyMap primary={ex.primary} secondary={ex.secondary} />
        <p><b>Ana kaslar:</b> {ex.primary.map((m) => MUSCLE_NAMES[m]).join(', ')}</p>
        {ex.secondary.length > 0 && <p><b>Yardımcı:</b> {ex.secondary.map((m) => MUSCLE_NAMES[m]).join(', ')}</p>}
        <p><b>Ekipman:</b> {EQUIPMENT_NAMES[ex.equipment]}</p>
        {ex.note && <p className="card">{ex.note}</p>}
        {hit.length > 0 && (
          <div className="card warn-card">
            {hit.map((f) => <div key={f}>⚠ {FLAG_INFO[f].label}</div>)}
            {ex.alt?.length ? <div className="small">Alternatifler: {ex.alt.map((a) => map.get(a)?.name ?? a).join(', ')}</div> : null}
          </div>
        )}
        {all.length > 0 && (
          <div className="stat-row">
            {best1rm > 0 && <div><b>{fmtKg(best1rm)}</b><span>en iyi tahmini 1RM</span></div>}
            {maxW > 0 && <div><b>{fmtKg(maxW)}</b><span>maks. kg</span></div>}
            <div><b>{maxReps}</b><span>maks. tekrar</span></div>
          </div>
        )}
        <h3>Geçmiş</h3>
        {history.length === 0 && <p className="muted">Henüz kayıt yok.</p>}
        {history.slice(0, 30).map((h, i) => (
          <div key={i} className="hist-row">
            <span className="muted small">{fmtDate(h.date)}</span>
            <span>{h.sets.map((s) => (s.seconds != null ? `${Math.round(s.seconds / 60)} dk` : `${s.weight ? fmtKg(s.weight) + '×' : ''}${s.reps ?? ''}`)).join('  ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Basit ön/arka vücut şeması. Bölgeler kas gruplarına göre renklenir.
const REGIONS: { m: Muscle; side: 'f' | 'b'; d: string }[] = [
  { m: 'trapez', side: 'b', d: 'M38 22 L50 18 L62 22 L58 30 L42 30Z' },
  { m: 'on_omuz', side: 'f', d: 'M30 26 a6 6 0 0 1 8 -2 l2 8 h-10Z M70 26 a6 6 0 0 0 -8 -2 l-2 8 h10Z' },
  { m: 'yan_omuz', side: 'b', d: 'M28 28 a6 6 0 0 1 8 -4 l2 6 h-10Z M72 28 a6 6 0 0 0 -8 -4 l-2 6 h10Z' },
  { m: 'arka_omuz', side: 'b', d: 'M30 30 h8 v5 h-8Z M62 30 h8 v5 h-8Z' },
  { m: 'gogus', side: 'f', d: 'M38 26 h24 v10 a12 4 0 0 1 -24 0Z' },
  { m: 'biceps', side: 'f', d: 'M28 34 h8 v12 h-8Z M64 34 h8 v12 h-8Z' },
  { m: 'triceps', side: 'b', d: 'M28 36 h8 v12 h-8Z M64 36 h8 v12 h-8Z' },
  { m: 'onkol', side: 'f', d: 'M26 48 h8 v14 h-8Z M66 48 h8 v14 h-8Z' },
  { m: 'karin', side: 'f', d: 'M43 40 h14 v20 h-14Z' },
  { m: 'oblik', side: 'f', d: 'M38 40 h5 v18 h-5Z M57 40 h5 v18 h-5Z' },
  { m: 'kanat', side: 'b', d: 'M38 32 h10 v16 l-8 -4Z M52 32 h10 l-2 12 l-8 4Z' },
  { m: 'sirt_ust', side: 'b', d: 'M42 30 h16 v6 h-16Z' },
  { m: 'bel', side: 'b', d: 'M44 48 h12 v10 h-12Z' },
  { m: 'kalca', side: 'b', d: 'M38 60 h24 v12 h-24Z' },
  { m: 'on_bacak', side: 'f', d: 'M38 64 h10 v24 h-10Z M52 64 h10 v24 h-10Z' },
  { m: 'ic_bacak', side: 'f', d: 'M47 64 h6 v14 h-6Z' },
  { m: 'arka_bacak', side: 'b', d: 'M38 73 h10 v18 h-10Z M52 73 h10 v18 h-10Z' },
  { m: 'baldir', side: 'b', d: 'M39 94 h8 v14 h-8Z M53 94 h8 v14 h-8Z' }
]
const SILHOUETTE = 'M50 4 a7 7 0 1 1 0 14 a7 7 0 1 1 0 -14Z M36 20 h28 l10 6 l4 38 h-6 l-4 -28 v28 l2 0 l2 56 h-10 l-6 -40 l-6 40 h-10 l2 -56 v-28 l-4 28 h-6 l4 -38Z'

export function BodyMap({ primary, secondary }: { primary: Muscle[]; secondary: Muscle[] }) {
  const fill = (m: Muscle) => (primary.includes(m) ? 'var(--accent)' : secondary.includes(m) ? 'var(--accent-soft)' : 'transparent')
  return (
    <div className="bodymap">
      {(['f', 'b'] as const).map((side) => (
        <figure key={side}>
          <svg viewBox="0 0 100 120">
            <path d={SILHOUETTE} fill="var(--surface-2)" />
            {REGIONS.filter((r) => r.side === side).map((r) => <path key={r.m} d={r.d} fill={fill(r.m)} />)}
          </svg>
          <figcaption>{side === 'f' ? 'Ön' : 'Arka'}</figcaption>
        </figure>
      ))}
    </div>
  )
}

function CustomExercise({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [equipment, setEquipment] = useState<Equipment>('machine')
  const [kind, setKind] = useState<Kind>('weight')
  const [primary, setPrimary] = useState<Muscle[]>([])
  const save = async () => {
    if (!name.trim() || !primary.length) { alert('Ad ve en az bir ana kas seç.'); return }
    await db.customExercises.add({ id: 'c_' + Date.now(), name: name.trim(), equipment, kind, primary, secondary: [], flags: [], custom: true })
    onClose()
  }
  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Vazgeç</button>
        <strong>Yeni hareket</strong>
        <button className="btn ghost" onClick={save}>Kaydet</button>
      </div>
      <div className="sheet-body">
        <input className="input" placeholder="Hareket adı" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="field">Ekipman
          <select className="input" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            {Object.entries(EQUIPMENT_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field">Kayıt tipi
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="weight">Ağırlık × tekrar</option>
            <option value="reps">Sadece tekrar</option>
            <option value="assisted">Destekli (−kg)</option>
            <option value="time">Süre</option>
          </select>
        </label>
        <p>Ana kaslar</p>
        {MUSCLE_GROUPS.map((g) => (
          <div key={g.name} className="chips">
            {g.muscles.map((m) => (
              <button key={m} className={`chip ${primary.includes(m) ? 'on' : ''}`} onClick={() => setPrimary((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))}>{MUSCLE_NAMES[m]}</button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
