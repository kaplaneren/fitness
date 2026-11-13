import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { ask, notify } from '../components/Dialog'
import { db } from '../db'
import { EQUIPMENT_NAMES, FLAG_INFO, MUSCLE_GROUPS, MUSCLE_NAMES, type Equipment, type Exercise, type Kind, type Muscle } from '../data/exercises'
import { useExercises, useProfile } from '../hooks'
import { GroupChips, useFilteredExercises } from '../components/ExercisePicker'
import FlagBadges from '../components/FlagBadges'
import BodyMap from '../components/BodyMap'
import LineChart from '../components/LineChart'
import { e1rm, fmtDate, fmtKg, fmtSets } from '../lib/calc'
import { repMaxes } from '../lib/insights'
import { DAY, LEVELS, hasStandard, levelOf, liftScore, nextLevelWeight, standardsFor, trend, workingWeight } from '../lib/analysis'
import { LevelScale } from './Progress'

export default function ExerciseLibrary({ onClose, initialMuscle }: { onClose: () => void; initialMuscle?: Muscle | null }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [muscle, setMuscle] = useState<Muscle | null>(initialMuscle ?? null)
  const [open, setOpen] = useState<Exercise | null>(null)
  const [creating, setCreating] = useState(false)
  const base = useFilteredExercises(query, group)
  const list = muscle ? base.filter((e) => e.primary.includes(muscle)) : base
  const profile = useProfile()
  const { map: exMap } = useExercises()
  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Kapat</button>
        <strong>Hareketler</strong>
        <button className="btn ghost" onClick={() => setCreating(true)}>+ Yeni</button>
      </div>
      <div className="sheet-body">
        <div className="card">
          <p className="muted small">Bir kasa dokun, o kası çalıştıran hareketleri göster.</p>
          <BodyMap selected={muscle} onPick={(m) => setMuscle(muscle === m ? null : m)} />
          {muscle && <div className="row-between"><strong>{MUSCLE_NAMES[muscle]}</strong><button className="link" onClick={() => setMuscle(null)}>Filtreyi kaldır</button></div>}
        </div>
        <input className="input" placeholder={`${list.length} hareket içinde ara`} value={query} onChange={(e) => setQuery(e.target.value)} />
        <GroupChips value={group} onChange={(g) => { setGroup(g); setMuscle(null) }} />
        <ul className="list">
          {list.map((e) => (
            <li key={e.id} onClick={() => setOpen(e)}>
              <div className="stack grow" style={{ gap: 3 }}>
                <span className="title">{e.name}</span>
                <span className="muted tiny">{e.primary.map((m) => MUSCLE_NAMES[m]).join(', ')} · {EQUIPMENT_NAMES[e.equipment]}</span>
                <FlagBadges flags={e.flags} active={profile.restrictions} alt={e.alt?.map((a) => exMap.get(a)?.name ?? a)} />
              </div>
              <span className="muted">›</span>
            </li>
          ))}
        </ul>
      </div>
      {open && <ExerciseDetail ex={open} onClose={() => setOpen(null)} />}
      {creating && <CustomExercise onClose={() => setCreating(false)} />}
    </div>
  )
}

export function ExerciseDetail({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const { map } = useExercises()
  const profile = useProfile()
  const [metric, setMetric] = useState<'e1rm' | 'vol' | 'max'>('e1rm')
  const history = useLiveQuery(async () => {
    const ws = await db.workouts.orderBy('startedAt').toArray()
    return ws.flatMap((w) => w.exercises.filter((e) => e.exerciseId === ex.id).map((e) => ({ date: w.startedAt, sets: e.sets.filter((s) => s.type !== 'warmup') })))
  }, [ex.id]) ?? []
  const all = history.flatMap((h) => h.sets)
  const rm = useLiveQuery(async () => repMaxes(await db.workouts.toArray(), ex.id), [ex.id]) ?? {}
  const best1rm = Math.max(0, ...all.map((s) => (s.reps && s.reps <= 12 ? e1rm(s.weight, s.reps, s.rir) : 0)))
  const maxW = Math.max(0, ...all.map((s) => s.weight ?? 0))
  const maxReps = Math.max(0, ...all.map((s) => s.reps ?? 0))
  const hit = ex.flags.filter((f) => profile.restrictions.includes(f))

  const series = useMemo(() => history.map((h) => ({
    t: h.date,
    v: metric === 'e1rm' ? Math.max(0, ...h.sets.map((s) => e1rm(s.weight, s.reps, s.rir)))
      : metric === 'vol' ? h.sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0)
      : Math.max(0, ...h.sets.map((s) => s.weight ?? 0))
  })).filter((p) => p.v > 0), [history, metric])

  const proj = useMemo(() => {
    if (metric !== 'e1rm') return undefined
    const recent = series.filter((p) => p.t > Date.now() - 70 * DAY)
    const tr = trend(recent)
    if (!tr || tr.slope <= 0) return undefined
    const last = series[series.length - 1]
    return { pts: [last, { t: last.t + 28 * DAY, v: tr.at(last.t + 28 * DAY) }], slope: tr.slope, in12: tr.at(last.t + 84 * DAY) }
  }, [series, metric])

  const score = hasStandard(ex.id) && best1rm ? liftScore(ex.id, best1rm, profile.bodyweight, profile.sex) : 0
  const next = score ? nextLevelWeight(ex.id, score, profile.bodyweight, profile.sex) : null

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Kapat</button>
        <strong className="ellipsis">{ex.name}</strong>
        {ex.custom ? <button className="btn ghost danger" onClick={async () => { if (await ask('Özel hareket silinsin mi?', { danger: true, ok: 'Sil' })) { await db.customExercises.delete(ex.id); onClose() } }}>Sil</button> : <span />}
      </div>
      <div className="sheet-body">
        <div className="card">
          <BodyMap primary={ex.primary} secondary={ex.secondary} />
          <div className="legend"><span><i style={{ background: 'var(--accent)' }} />Ana kas</span><span><i style={{ background: 'color-mix(in srgb, var(--accent) 40%, var(--muscle))' }} />Yardımcı kas</span></div>
          <p><b>Ana:</b> {ex.primary.map((m) => MUSCLE_NAMES[m]).join(', ')}{ex.secondary.length > 0 && <> · <b>Yardımcı:</b> {ex.secondary.map((m) => MUSCLE_NAMES[m]).join(', ')}</>}</p>
          <p className="muted small">Ekipman: {EQUIPMENT_NAMES[ex.equipment]}</p>
          {ex.note && <p className="small">{ex.note}</p>}
          <a className="link" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' doğru form')}`} target="_blank" rel="noreferrer">Form videosu ara (YouTube) ↗</a>
        </div>

        {hit.length > 0 && (
          <div className="card warn-card">
            {hit.map((f) => <div key={f} className="small"><b className="warn">⚠</b> <b>{FLAG_INFO[f].label}.</b> {FLAG_INFO[f].tip}</div>)}
            {ex.alt?.length ? <div className="small">Daha güvenli: {ex.alt.map((a) => map.get(a)?.name ?? a).join(', ')}</div> : null}
          </div>
        )}

        {all.length > 0 && (
          <div className="stat-row">
            {best1rm > 0 && <div className="stat"><b>{fmtKg(best1rm)}</b><span>en iyi tahmini 1RM</span></div>}
            {maxW > 0 && <div className="stat"><b>{fmtKg(maxW)}</b><span>maks. kg</span></div>}
            <div className="stat"><b>{maxReps}</b><span>maks. tekrar</span></div>
          </div>
        )}

        {(() => {
          const side = (k: 'L' | 'R') => Math.max(0, ...all.filter((x) => x.side === k).map((x) => e1rm(x.weight, x.reps, x.rir)))
          const vol = (k: 'L' | 'R') => all.filter((x) => x.side === k).reduce((a, x) => a + (x.weight ?? 0) * (x.reps ?? 0), 0)
          const l = side('L'), r = side('R')
          if (!l || !r) return null
          const diff = ((l - r) / Math.max(l, r)) * 100
          return (
            <div className="card">
              <h3>Sağ / sol farkı</h3>
              <div className="stat-row">
                <div className="stat"><b>{fmtKg(l)}</b><span>sol tahmini 1RM</span></div>
                <div className="stat"><b>{fmtKg(r)}</b><span>sağ tahmini 1RM</span></div>
                <div className="stat"><b className={Math.abs(diff) > 10 ? 'warn' : 'good'}>%{Math.abs(diff).toFixed(0)}</b><span>{diff > 0 ? 'sol güçlü' : diff < 0 ? 'sağ güçlü' : 'eşit'}</span></div>
              </div>
              <p className="small">Toplam hacim: sol {fmtKg(vol('L'))} kg, sağ {fmtKg(vol('R'))} kg. {Math.abs(diff) > 10 ? 'Fark %10 üstünde; zayıf tarafla başla ve güçlü tarafta onun tekrarını geçme.' : 'Fark normal aralıkta (%10 altı).'}</p>
            </div>
          )
        })()}

        {score > 0 && (
          <div className="card">
            <div className="card-title"><h3>Güç seviyesi</h3><span className="pill">{levelOf(score)}</span></div>
            <LevelScale p={score} />
            <p className="small">{profile.sex === 'f' ? 'Kadınların' : 'Erkeklerin'} yaklaşık <b>%{Math.round(score)}</b>'inden güçlü · 1RM kilonun <b>{(best1rm / profile.bodyweight).toFixed(2).replace('.', ',')}</b> katı{next && <> · {next.level} için <b>{fmtKg(next.kg)} kg</b></>}</p>
            {standardsFor(ex.id, profile.bodyweight, profile.sex) && <p className="muted tiny">strengthlevel.com ({profile.sex === 'f' ? 'kadın' : 'erkek'}, {fmtKg(profile.bodyweight)} kg): {standardsFor(ex.id, profile.bodyweight, profile.sex)!.map((k, i) => `${LEVELS[i]} ${fmtKg(k)}`).join(' · ')}{ex.equipment === 'dumbbell' ? ' (tek dambıl)' : ''}</p>}
          </div>
        )}

        {series.length > 0 && (
          <div className="card">
            <div className="seg">
              <button className={metric === 'e1rm' ? 'on' : ''} onClick={() => setMetric('e1rm')}>Tahmini 1RM</button>
              <button className={metric === 'max' ? 'on' : ''} onClick={() => setMetric('max')}>Maks. kg</button>
              <button className={metric === 'vol' ? 'on' : ''} onClick={() => setMetric('vol')}>Hacim</button>
            </div>
            <LineChart points={series} projection={proj?.pts} unit=" kg" />
            {proj && <p className="small">Son 10 haftalık eğilim: haftada <b>+{fmtKg(proj.slope)} kg</b>. Bu hızla 12 hafta sonra tahmini 1RM ≈ <b>{fmtKg(proj.in12)} kg</b>.</p>}
          </div>
        )}

        {Object.keys(rm).length > 0 && (
          <div className="card">
            <h3>Tekrar rekorları</h3>
            <table className="sets read">
              <tbody>
                {Object.entries(rm).sort((a, b) => +a[0] - +b[0]).map(([reps, r]) => (
                  <tr key={reps}><td><b>{reps} tekrar</b></td><td className="mono">{fmtKg(r.w)} kg</td><td className="muted tiny">{fmtDate(r.t)}</td><td className="muted tiny">1RM ≈ {fmtKg(e1rm(r.w, +reps))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {best1rm > 0 && (
          <div className="card">
            <h3>Çalışma ağırlıkları (2 RIR)</h3>
            <div className="stat-row">
              {[5, 8, 10, 12].map((r) => <div key={r} className="stat"><b>{fmtKg(workingWeight(best1rm, r, 2))}</b><span>{r} tekrar</span></div>)}
            </div>
          </div>
        )}

        <h3>Geçmiş</h3>
        {history.length === 0 && <p className="muted">Henüz kayıt yok.</p>}
        <div>
          {[...history].reverse().slice(0, 30).map((h, i) => (
            <div key={i} className="hist-row">
              <span className="muted small">{fmtDate(h.date)}</span>
              <span className="mono">{fmtSets(h.sets)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CustomExercise({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [equipment, setEquipment] = useState<Equipment>('machine')
  const [kind, setKind] = useState<Kind>('weight')
  const [primary, setPrimary] = useState<Muscle[]>([])
  const save = async () => {
    if (!name.trim() || !primary.length) { notify('Hareketin adını yaz ve en az bir ana kas seç.'); return }
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
        <input id="cx-name" className="input" placeholder="Hareket adı" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="fields">
          <label className="field">Ekipman
            <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
              {Object.entries(EQUIPMENT_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field">Kayıt tipi
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="weight">Ağırlık × tekrar</option>
              <option value="reps">Sadece tekrar</option>
              <option value="assisted">Destekli (−kg)</option>
              <option value="time">Süre</option>
            </select>
          </label>
        </div>
        <p className="section-label">Ana kaslar</p>
        <BodyMap selected={null} primary={primary} onPick={(m) => setPrimary((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))} />
        {MUSCLE_GROUPS.map((g) => (
          <div key={g.name} className="chips wrap">
            {g.muscles.map((m) => (
              <button key={m} className={`chip ${primary.includes(m) ? 'on' : ''}`} onClick={() => setPrimary((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))}>{MUSCLE_NAMES[m]}</button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
