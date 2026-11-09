import { ask, askText, notify } from '../components/Dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMeso } from '../lib/meso'
import { useEffect, useRef, useState } from 'react'
import { db, setKV, type SetEntry, type SetType, type Workout, type WorkoutExercise } from '../db'
import { restDone, unlockAudio, useExercises, useNow, useProfile, useWakeLock } from '../hooks'
import { e1rm, fmtDate, fmtDuration, fmtKg, platesFor, setVolume, warmupSets, workoutSetCount, workoutVolume } from '../lib/calc'
import { discardWorkout, finishWorkout, lastSetsFor, makeExercise } from '../lib/workout'
import { dynamicRest, workingWeight } from '../lib/analysis'
import { parseRange } from '../lib/progression'
import ExercisePicker from '../components/ExercisePicker'
import FlagBadges from '../components/FlagBadges'
import { PLATE_COLORS } from '../lib/plates'
import { hasGear } from '../lib/equipment'
import { workoutBurn } from '../lib/health'

interface Rest { endAt: number; total: number }

const TYPE_ORDER: SetType[] = ['normal', 'warmup', 'drop', 'failure']
const TYPE_LABEL: Record<SetType, string> = { normal: '', warmup: 'I', drop: 'D', failure: 'F' }

export default function ActiveWorkout({ workout, onMinimize, onFinished }: { workout: Workout; onMinimize: () => void; onFinished: (id?: number) => void }) {
  const [w, setW] = useState<Workout>(workout)
  const { map } = useExercises()
  const profile = useProfile()
  const { state: meso } = useMeso()
  const rest = (useLiveQuery(() => db.kv.get('rest'), [])?.value as Rest | null) ?? null
  const now = useNow(250)
  const [picker, setPicker] = useState<null | { mode: 'add' } | { mode: 'swap'; index: number }>(null)
  const [menu, setMenu] = useState<number | null>(null)
  const [plateFor, setPlateFor] = useState<number | null>(null)
  const [workFor, setWorkFor] = useState<number | null>(null)
  const [prev, setPrev] = useState<Record<string, SetEntry[] | null>>({})
  const [backoff, setBackoff] = useState<Record<number, { from: number; w: number; why: string }>>({})
  const info0 = (id: string) => map.get(id)
  const [lastSame, setLastSame] = useState<Workout | null>(null)
  const [best, setBest] = useState<Record<string, number>>({})
  const fired = useRef<number | null>(null)
  useWakeLock(true)

  // Kayıt
  const save = (next: Workout) => { setW(next); setKV('active', next) }
  const updEx = (i: number, fn: (e: WorkoutExercise) => WorkoutExercise) =>
    save({ ...w, exercises: w.exercises.map((e, j) => (j === i ? fn(e) : e)) })
  const updSet = (i: number, si: number, patch: Partial<SetEntry>) =>
    updEx(i, (e) => ({ ...e, sets: e.sets.map((s, k) => (k === si ? { ...s, ...patch } : s)) }))

  // Önceki performans ve rekorlar
  const ids = w.exercises.map((e) => e.exerciseId).join(',')
  useEffect(() => {
    let alive = true
    ;(async () => {
      const p: Record<string, SetEntry[] | null> = {}
      const b: Record<string, number> = {}
      const history = await db.workouts.toArray()
      for (const id of new Set(w.exercises.map((e) => e.exerciseId))) {
        p[id] = await lastSetsFor(id, w.startedAt)
        b[id] = Math.max(0, ...history.flatMap((h) => h.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.map((s) => e1rm(s.weight, s.reps, s.rir)))))
      }
      const same = w.routineId ? history.filter((h) => h.routineId === w.routineId && h.startedAt < w.startedAt && h.endedAt).sort((a, z) => z.startedAt - a.startedAt)[0] : undefined
      if (alive) { setPrev(p); setBest(b); setLastSame(same ?? null) }
    })()
    return () => { alive = false }
  }, [ids, w.startedAt])

  // Dinlenme sayacı
  const restLeft = rest ? Math.ceil((rest.endAt - now) / 1000) : 0
  useEffect(() => {
    if (rest && restLeft <= 0 && fired.current !== rest.endAt) {
      fired.current = rest.endAt
      restDone()
      setKV('rest', null)
    }
  }, [rest, restLeft])
  const startRest = (sec: number) => { if (sec > 0) setKV('rest', { endAt: Date.now() + sec * 1000, total: sec }) }
  // Arka planda sayaç yavaşlasa bile bitişte uyar
  useEffect(() => {
    if (!rest) return
    const ms = rest.endAt - Date.now()
    if (ms <= 0) return
    const id = setTimeout(() => { if (fired.current !== rest.endAt) { fired.current = rest.endAt; restDone(); setKV('rest', null) } }, ms)
    return () => clearTimeout(id)
  }, [rest?.endAt])
  const adjustRest = (d: number) => rest && setKV('rest', { endAt: rest.endAt + d * 1000, total: Math.max(1, rest.total + d) })

  const toggleDone = (i: number, si: number) => {
    unlockAudio()
    const ex = w.exercises[i]
    const s = ex.sets[si]
    const p = prev[ex.exerciseId]?.filter((x) => x.type !== 'warmup')
    const fill: Partial<SetEntry> = {}
    if (!s.done) {
      // Boş alanları önceki değerle doldur
      const ref = p?.[si] ?? ex.sets[si - 1]
      if (s.weight == null && ref?.weight != null) fill.weight = ref.weight
      if (s.reps == null && ref?.reps != null) fill.reps = ref.reps
      if (s.seconds == null && ref?.seconds != null) fill.seconds = ref.seconds
    }
    updSet(i, si, { done: !s.done, ...fill })
    if (!s.done && s.type !== 'warmup' && info0(ex.exerciseId)?.kind !== 'time') {
      // Tükenişe gidildiyse ya da hedef aralığın altında kalındıysa kalan setler için hafifletme (back-off) öner
      const w0 = s.weight ?? fill.weight, reps = s.reps ?? fill.reps
      const lo = parseRange(ex.target)?.[0]
      const failed = s.rir === 0 || s.type === 'failure' || (lo != null && reps != null && reps < lo)
      const rest = ex.sets.slice(si + 1).filter((x) => !x.done && x.type !== 'warmup' && (x.weight ?? w0 ?? 0) >= (w0 ?? 0))
      if (failed && w0 && rest.length) {
        const step = info0(ex.exerciseId)?.equipment === 'dumbbell' ? 1 : 2.5
        const nw = Math.max(step, Math.round((w0 * 0.9) / step) * step)
        if (nw < w0) setBackoff((b) => ({ ...b, [i]: { from: si, w: nw, why: s.rir === 0 || s.type === 'failure' ? 'Set tükenişe gitti' : `${reps} tekrar, hedefin (${lo}) altında` } }))
      }
    }
    if (!s.done) {
      // Süpersette grubun son hareketinden sonra dinlen
      const next = w.exercises[i + 1]
      const inSuperset = ex.superset && next?.superset === ex.superset
      if (!inSuperset) startRest(dynamicRest(ex.restSec, map.get(ex.exerciseId), { ...s, ...fill }, profile))
    }
  }

  const addExercises = async (idsToAdd: string[]) => {
    const added = await Promise.all(idsToAdd.map((id) => makeExercise(id, 3)))
    save({ ...w, exercises: [...w.exercises, ...added] })
    setPicker(null)
  }
  const swapExercise = async (i: number, id: string) => {
    const fresh = await makeExercise(id, w.exercises[i].sets.length, w.exercises[i].restSec, w.exercises[i].superset)
    save({ ...w, exercises: w.exercises.map((e, j) => (j === i ? fresh : e)) })
    setPicker(null)
  }

  const finish = async () => {
    const done = w.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done).length, 0)
    if (!done) { if (await ask('Hiç set tamamlanmadı. Antrenmanı iptal edeyim mi?')) await discardWorkout(); return }
    const undone = w.exercises.reduce((t, e) => t + e.sets.filter((s) => !s.done).length, 0)
    if (!await ask(undone ? `${undone} set işaretlenmemiş; bunlar kaydedilmeyecek. Bitirilsin mi?` : 'Antrenman bitirilsin mi?')) return
    const id = await finishWorkout(w)
    onFinished(id)
  }
  const cancel = async () => { if (await ask('Antrenman silinsin mi? Bu geri alınamaz.')) await discardWorkout() }

  return (
    <div className="sheet workout">
      <div className="sheet-head workout-head">
        <button className="btn ghost" onClick={onMinimize} aria-label="Küçült">Küçült</button>
        <button className="stack center" style={{ gap: 0 }} aria-label="Başlangıç saatini değiştir" onClick={async () => {
          const d = new Date(w.startedAt)
          const v = await askText('Antrenmanı başlatmayı unuttuysan gerçek başlangıç saatini gir.', { title: 'Başlangıç saati', value: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, placeholder: 'SS:DD', ok: 'Kaydet' })
          const m = v?.trim().match(/^(\d{1,2})[:.](\d{2})$/)
          if (!m) { if (v != null) notify('Saati SS:DD biçiminde gir, örneğin 18:30.'); return }
          const t = new Date(w.startedAt); t.setHours(+m[1], +m[2], 0, 0)
          let ts = t.getTime(); if (ts > Date.now()) ts -= 86400000
          save({ ...w, startedAt: ts })
        }}><span className="timer">{fmtDuration(now - w.startedAt)}</span><span className="muted tiny">{new Date(w.startedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}'den beri · {workoutBurn(w, map, profile, now).kcal} kcal</span></button>
        <button className="btn primary sm" onClick={finish}>Bitir</button>
      </div>

      {rest && restLeft > 0 && (
        <div className="rest">
          <div className="rest-bar" style={{ width: `${Math.min(100, (restLeft / rest.total) * 100)}%` }} />
          <button onClick={() => adjustRest(-15)}>−15</button>
          <span className="num-d">{fmtDuration(restLeft * 1000)}</span>
          <button onClick={() => adjustRest(15)}>+15</button>
          <button onClick={() => setKV('rest', null)}>Geç</button>
        </div>
      )}

      <div className="sheet-body">
        {meso && <div className={`meso-line ${meso.deload ? 'dl' : ''}`}><b>{meso.title}</b> · {meso.deload ? 'ağırlık ve set azaltıldı, setleri 3-4 tekrar yedekte bitir' : `hedef RIR ${meso.rir}: her seti ${meso.rir} tekrar yedekte bitir`}</div>}
        {lastSame && <TotalDiff w={w} last={lastSame} />}
        <input className="input title-input" value={w.name} onChange={(e) => save({ ...w, name: e.target.value })} />

        {w.exercises.map((ex, i) => {
          const info = map.get(ex.exerciseId)
          const p = prev[ex.exerciseId] ?? []
          const pWork = p.filter((s) => s.type !== 'warmup')
          const kind = info?.kind ?? 'weight'
          const restricted = info?.flags.some((f) => profile.restrictions.includes(f))
          let workIdx = 0
          return (
            <section key={i} className={`card wex ${ex.superset ? 'ss' : ''}`}>
              <div className="row-between">
                <div>
                  <strong className="ex-name">{info?.name ?? ex.exerciseId}</strong>
                  {ex.superset && <span className="ss-tag">Süperset {ex.superset.toUpperCase()}</span>}
                  {info && <FlagBadges flags={info.flags} active={profile.restrictions} alt={info.alt?.filter((a) => hasGear(a, profile.equipment)).map((a) => map.get(a)?.name ?? a)} />}
                </div>
                <button className="icon-btn" onClick={() => setMenu(menu === i ? null : i)} aria-label="Seçenekler">⋯</button>
              </div>

              {restricted && info?.alt?.some((a) => hasGear(a, profile.equipment)) ? (
                <div className="alt">
                  Daha güvenli alternatif:{' '}
                  {info.alt.filter((a) => hasGear(a, profile.equipment)).map((a) => <button key={a} className="link" onClick={() => swapExercise(i, a)}>{map.get(a)?.name ?? a}</button>)}
                </div>
              ) : null}
              {ex.advice && (
                <p className="small advice" data-tone={ex.adviceTone}>
                  <b>{ex.adviceTone === 'up' ? '▲ Öneri' : ex.adviceTone === 'down' ? '▼ Öneri' : 'Öneri'}{ex.target ? ` · hedef ${ex.target}` : ''}:</b> {ex.advice}
                </p>
              )}
              {info?.note && <p className="muted small">{info.note}</p>}

              {menu === i && (
                <div className="menu">
                  <button onClick={() => { setPicker({ mode: 'swap', index: i }); setMenu(null) }}>Hareketi değiştir</button>
                  {kind === 'weight' && (
                    <button onClick={() => {
                      const top = ex.sets.find((s) => s.type !== 'warmup')?.weight ?? pWork[0]?.weight
                      if (!top) { notify('Önce çalışma ağırlığını gir.'); return }
                      const wu = warmupSets(top, profile.barWeight).map<SetEntry>((s) => ({ ...s, type: 'warmup', done: false }))
                      updEx(i, (e) => ({ ...e, sets: [...wu, ...e.sets] })); setMenu(null)
                    }}>Isınma setleri ekle</button>
                  )}
                  {kind === 'weight' && best[ex.exerciseId] > 0 && (
                    <button onClick={() => { setWorkFor(i); setMenu(null) }}>Çalışma ağırlığı hesapla</button>
                  )}
                  {kind === 'weight' && info?.equipment === 'barbell' && (
                    <button onClick={() => { setPlateFor(ex.sets.find((s) => !s.done)?.weight ?? ex.sets[0]?.weight ?? profile.barWeight); setMenu(null) }}>Plaka hesapla</button>
                  )}
                  <button onClick={() => {
                    const sided = ex.sets.some((x) => x.side)
                    updEx(i, (e) => ({ ...e, sets: sided
                      ? e.sets.filter((x) => x.side !== 'R').map(({ side: _s, ...x }) => x)
                      : e.sets.flatMap((x) => (x.type === 'warmup' ? [x] : [{ ...x, side: 'L' as const }, { ...x, side: 'R' as const, done: false }])) }))
                    setMenu(null)
                  }}>{ex.sets.some((x) => x.side) ? 'Sağ/sol ayrımını kaldır' : 'Sağ ve sol ayrı kaydet'}</button>
                  <label className="inline">Dinlenme
                    <input type="number" inputMode="numeric" value={ex.restSec} onChange={(e) => updEx(i, (x) => ({ ...x, restSec: +e.target.value || 0 }))} /> sn
                  </label>
                  <button className="danger" onClick={() => { save({ ...w, exercises: w.exercises.filter((_, j) => j !== i) }); setMenu(null) }}>Hareketi kaldır</button>
                </div>
              )}

              <table className="sets">
                <thead>
                  <tr>
                    <th>Set</th><th>Önceki</th>
                    {kind === 'time' ? <th>Süre (dk)</th> : <th>{kind === 'assisted' ? '−kg' : kind === 'reps' ? '+kg' : 'kg'}</th>}
                    {kind !== 'time' && <th>Tekrar</th>}
                    {kind !== 'time' && <th title="Tükenişe kalan tekrar">RIR</th>}
                    <th>✓</th>
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((s, si) => {
                    const label = s.type === 'normal' ? String(s.side === 'R' ? workIdx : ++workIdx) : TYPE_LABEL[s.type]
                    const ps = s.type === 'warmup' ? undefined : pWork[workIdx - 1]
                    const isPr = s.done && s.type !== 'warmup' && kind === 'weight' && e1rm(s.weight, s.reps, s.rir) > (best[ex.exerciseId] ?? 0) && (best[ex.exerciseId] ?? 0) > 0
                    return (
                      <tr key={si} className={`${s.done ? 'done' : ''} t-${s.type}`}>
                        <td>
                          <button className="set-type" onClick={() => updSet(i, si, { type: TYPE_ORDER[(TYPE_ORDER.indexOf(s.type) + 1) % 4] })}>{label}{s.side && <small className="side-tag">{s.side === 'L' ? 'sol' : 'sağ'}</small>}</button>
                        </td>
                        <td className="prev">{ps ? (kind === 'time' ? `${Math.round((ps.seconds ?? 0) / 60)} dk` : `${ps.weight ? fmtKg(ps.weight) + '×' : ''}${ps.reps ?? ''}`) : '—'}</td>
                        {kind === 'time' ? (
                          <td><NumInput value={s.seconds != null ? s.seconds / 60 : undefined} placeholder={ps?.seconds ? String(Math.round(ps.seconds / 60)) : ''} onChange={(v) => updSet(i, si, { seconds: v == null ? undefined : Math.round(v * 60) })} /></td>
                        ) : (
                          <>
                            <td><NumInput value={s.weight} placeholder={ps?.weight != null ? fmtKg(ps.weight) : ''} onChange={(v) => updSet(i, si, { weight: v })} /></td>
                            <td><NumInput value={s.reps} integer placeholder={ps?.reps != null ? String(ps.reps) : ''} onChange={(v) => updSet(i, si, { reps: v })} /></td>
                          </>
                        )}
                        {kind !== 'time' && (
                          <td>
                            <button className={`rir ${s.rir != null ? 'set' : ''}`} aria-label="RIR" onClick={() => updSet(i, si, { rir: s.rir == null ? 2 : s.rir >= 4 ? undefined : s.rir === 0 ? 1 : s.rir === 1 ? 0 : s.rir + 1 })}>
                              {s.rir == null ? '–' : s.rir >= 4 ? '4+' : s.rir}
                            </button>
                          </td>
                        )}
                        <td>
                          <button className={`done-btn ${s.done ? 'on' : ''}`} onClick={() => toggleDone(i, si)} aria-label="Tamamlandı">{isPr ? '★' : '✓'}</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {backoff[i] && ex.sets.slice(backoff[i].from + 1).some((x) => !x.done && x.type !== 'warmup') && (
                <div className="advice small backoff" data-tone="down">
                  <b>▼ {backoff[i].why}.</b> Kalan setleri {fmtKg(backoff[i].w)} kg ile yapmak (yaklaşık %10 hafif) tekrar kalitesini korur.
                  <div className="row" style={{ marginTop: 6 }}>
                    <button className="btn sm primary" onClick={() => { const b = backoff[i]; updEx(i, (e) => ({ ...e, sets: e.sets.map((x, k) => (k > b.from && !x.done && x.type !== 'warmup' ? { ...x, weight: b.w } : x)) })); setBackoff(({ [i]: _x, ...r }) => r) }}>Uygula</button>
                    <button className="btn sm ghost" onClick={() => setBackoff(({ [i]: _x, ...r }) => r)}>Aynı kalsın</button>
                  </div>
                </div>
              )}
              {kind !== 'time' && <LiveDiff cur={ex.sets} prev={pWork} kind={kind} />}
              <div className="row-between">
                <button className="link" onClick={() => updEx(i, (e) => {
                  const last = e.sets[e.sets.length - 1]
                  const base = { type: 'normal' as const, done: false, weight: last?.weight, reps: last?.reps, seconds: last?.seconds }
                  return { ...e, sets: [...e.sets, ...(last?.side ? [{ ...base, side: 'L' as const }, { ...base, side: 'R' as const }] : [base])] }
                })}>+ Set ekle</button>
                {ex.sets.length > 1 && <button className="link muted" onClick={() => updEx(i, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}>Son seti sil</button>}
              </div>
            </section>
          )
        })}

        <button className="btn block" onClick={() => setPicker({ mode: 'add' })}>+ Hareket ekle</button>

        <div className="card">
          <div className="fields">
            <label>Ort. nabız<input type="number" inputMode="numeric" value={w.heartRateAvg ?? ''} onChange={(e) => save({ ...w, heartRateAvg: +e.target.value || undefined })} /></label>
            <label>Maks. nabız<input type="number" inputMode="numeric" value={w.heartRateMax ?? ''} onChange={(e) => save({ ...w, heartRateMax: +e.target.value || undefined })} /></label>
            <label>Kilo (kg)<input type="number" inputMode="decimal" placeholder={String(profile.bodyweight)} value={w.bodyweight ?? ''} onChange={(e) => save({ ...w, bodyweight: parseFloat(e.target.value.replace(',', '.')) || undefined })} /></label>
          </div>
          <textarea className="input" placeholder="Antrenman notu (ağrı, his, enerji…)" value={w.note ?? ''} onChange={(e) => save({ ...w, note: e.target.value })} />
        </div>

        <button className="btn danger block" onClick={cancel}>Antrenmanı iptal et</button>
      </div>

      {picker && (
        <ExercisePicker
          multi={picker.mode === 'add'}
          onClose={() => setPicker(null)}
          onPick={(picked) => (picker.mode === 'add' ? addExercises(picked) : swapExercise(picker.index, picked[0]))}
        />
      )}
      {plateFor != null && <PlateModal initial={plateFor} onClose={() => setPlateFor(null)} />}
      {workFor != null && (
        <WorkModal
          name={map.get(w.exercises[workFor].exerciseId)?.name ?? ''}
          oneRm={best[w.exercises[workFor].exerciseId]}
          onClose={() => setWorkFor(null)}
          onApply={(kg) => { updEx(workFor, (e) => ({ ...e, sets: e.sets.map((s) => (s.done || s.type === 'warmup' ? s : { ...s, weight: kg })) })); setWorkFor(null) }}
        />
      )}
    </div>
  )
}

function NumInput({ value, onChange, placeholder, integer }: { value?: number; onChange: (v: number | undefined) => void; placeholder?: string; integer?: boolean }) {
  const [text, setText] = useState(value != null ? String(value).replace('.', ',') : '')
  useEffect(() => {
    const parsed = parseFloat(text.replace(',', '.'))
    if (value == null ? text !== '' && !isNaN(parsed) : parsed !== value) setText(value != null ? String(value).replace('.', ',') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      className="num"
      inputMode={integer ? 'numeric' : 'decimal'}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,]/g, '')
        setText(t)
        const n = parseFloat(t.replace(',', '.'))
        onChange(t === '' || isNaN(n) ? undefined : n)
      }}
    />
  )
}

function PlateModal({ initial, onClose }: { initial: number; onClose: () => void }) {
  const profile = useProfile()
  const [total, setTotal] = useState(initial)
  const { out, rest } = platesFor(total, profile.barWeight, profile.plates)
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Plaka hesaplayıcı</h2>
        <label className="inline">Toplam
          <input type="number" inputMode="decimal" value={total} onChange={(e) => setTotal(+e.target.value || 0)} /> kg
        </label>
        <p className="muted small">Bar: {profile.barWeight} kg · Her tarafa:</p>
        <div className="plates">
          <span className="bar" />
          {out.length ? out.map((p, i) => <span key={i} className="plate" style={{ height: 34 + p * 2.6, background: PLATE_COLORS(p) }}>{fmtKg(p)}</span>) : <span className="muted">Sadece bar</span>}
        </div>
        {rest > 0 && <p className="warn small">{fmtKg(rest)} kg eksik kalıyor (plaka yok).</p>}
        <button className="btn block" onClick={onClose}>Kapat</button>
      </div>
    </div>
  )
}

function WorkModal({ name, oneRm, onClose, onApply }: { name: string; oneRm: number; onClose: () => void; onApply: (kg: number) => void }) {
  const [rir, setRir] = useState(2)
  const [sel, setSel] = useState<number | null>(null)
  const rows = [3, 5, 6, 8, 10, 12, 15]
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Çalışma ağırlığı</h2>
        <p className="muted small">{name} · en iyi tahmini 1RM {fmtKg(oneRm)} kg</p>
        <div className="seg">
          {[0, 1, 2, 3].map((r) => <button key={r} className={rir === r ? 'on' : ''} onClick={() => setRir(r)}>{r} RIR</button>)}
        </div>
        <table className="sets read">
          <tbody>
            {rows.map((reps) => {
              const kg = workingWeight(oneRm, reps, rir)
              return (
                <tr key={reps} onClick={() => setSel(kg)} style={{ cursor: 'pointer', background: sel === kg ? 'var(--accent-soft)' : undefined }}>
                  <td>{reps} tekrar</td><td><b>{fmtKg(kg)} kg</b></td><td className="muted tiny">%{Math.round((kg / oneRm) * 100)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Kapat</button>
          <button className="btn primary" disabled={sel == null} onClick={() => sel != null && onApply(sel)}>Setlere uygula</button>
        </div>
      </div>
    </div>
  )
}

const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null)
function Diff({ label, v, sub }: { label: string; v: number | null; sub?: string }) {
  if (v == null) return null
  const r = Math.round(v * 10) / 10
  return (
    <span className="diff-chip">
      {label} <b className={r > 0 ? 'good' : r < 0 ? 'bad' : 'muted'}>{r > 0 ? '+' : ''}{r.toLocaleString('tr-TR')}%</b>{sub && <span className="muted"> {sub}</span>}
    </span>
  )
}

/** Hareket bazında geçen seferle anlık fark: tahmini 1RM, aynı set sayısındaki hacim ve toplam hacim. */
function LiveDiff({ cur, prev, kind }: { cur: SetEntry[]; prev: SetEntry[]; kind: string }) {
  const done = cur.filter((s) => s.done && s.type !== 'warmup')
  if (!done.length || !prev.length) return null
  if (kind !== 'weight') {
    const reps = (l: SetEntry[]) => l.reduce((a, s) => a + (s.reps ?? 0), 0)
    return <div className="diff-row"><span className="muted tiny">Geçen sefere göre</span><Diff label="Tekrar" v={pct(reps(done), reps(prev.slice(0, done.length)))} sub={`(${done.length} set)`} /></div>
  }
  const best = (l: SetEntry[]) => Math.max(0, ...l.map((s) => e1rm(s.weight, s.reps, s.rir)))
  const vol = (l: SetEntry[]) => l.reduce((a, s) => a + setVolume(s), 0)
  const cv = vol(done), pv = vol(prev)
  return (
    <div className="diff-row">
      <span className="muted tiny">Geçen sefere göre</span>
      <Diff label="1RM" v={pct(best(done), best(prev))} sub={`${fmtKg(best(done))} kg`} />
      <Diff label="Hacim" v={pct(cv, vol(prev.slice(0, done.length)))} sub={`(${done.length} set)`} />
      {pv > 0 && <span className="diff-chip">Toplam <b>{fmtKg(cv)}</b><span className="muted"> / {fmtKg(pv)} kg</span></span>}
    </div>
  )
}

/** Aynı rutinin son antrenmanına göre toplam hacim ve set. */
function TotalDiff({ w, last }: { w: Workout; last: Workout }) {
  const v = workoutVolume(w), lv = workoutVolume(last)
  if (!workoutSetCount(w) || !lv) return null
  return (
    <div className="card diff-total">
      <div className="row-between small"><b>Geçen sefer · {last.name}</b><span className="muted tiny">{fmtDate(last.startedAt)}</span></div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (v / lv) * 100)}%` }} /></div>
      <p className="small">Hacim <b>{fmtKg(v)}</b> / {fmtKg(lv)} kg (%{Math.round((v / lv) * 100)}) · Set {workoutSetCount(w)} / {workoutSetCount(last)}</p>
    </div>
  )
}
