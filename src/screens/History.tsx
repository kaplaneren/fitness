import { ask, notify } from '../components/Dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, setKV, type Workout } from '../db'
import { useExercises, useProfile } from '../hooks'
import { workoutBurn } from '../lib/health'
import { e1rm, fmtDate, fmtDuration, fmtKg, workoutSetCount, workoutVolume, fmtNum, fmtSets } from '../lib/calc'
import { DAY, analyzeWorkout, bestE1rmByExercise, trend } from '../lib/analysis'
import LineChart from '../components/LineChart'
import { ExerciseDetail } from './Exercises'
import { startWorkout } from '../lib/workout'
import { activityMet } from '../lib/activity'
import ActivitySheet from '../components/ActivitySheet'
import WorkoutEditor from '../components/WorkoutEditor'
import type { Exercise } from '../data/exercises'
import VersionFooter from '../components/VersionFooter'

/** Antrenmanın paylaşılabilir metin özeti. */
export function workoutText(w: Workout, map: Map<string, Exercise>) {
  if (w.activity) return [`🏃 ${w.name} · ${fmtDate(w.startedAt, true)}`, `⏱ ${w.activity.min} dk${w.activity.km ? ` · ${fmtKg(w.activity.km)} km` : ''}`, ...(w.note ? ['', `Not: ${w.note}`] : []), '', 'Fitness uygulamasıyla kaydedildi'].join('\n')
  const lines = [`🏋️ ${w.name} · ${fmtDate(w.startedAt, true)}`, `⏱ ${fmtDuration((w.endedAt ?? w.startedAt) - w.startedAt)} · ${fmtKg(workoutVolume(w))} kg hacim · ${workoutSetCount(w)} set`, '']
  for (const e of w.exercises) {
    lines.push(`• ${map.get(e.exerciseId)?.name ?? e.exerciseId}: ${fmtSets(e.sets.filter((x) => x.type !== 'warmup'))}`)
  }
  if (w.note) lines.push('', `Not: ${w.note}`)
  lines.push('', 'Fitness uygulamasıyla kaydedildi')
  return lines.join('\n')
}

export async function shareText(text: string, title: string) {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return }
  } catch (e) { if ((e as Error).name === 'AbortError') return }
  try { await navigator.clipboard.writeText(text); notify('Panoya kopyalandı; WhatsApp veya mesaja yapıştırabilirsin.') }
  catch { notify(text, 'Kopyalayıp paylaş') }
}

/** Geçmiş bir antrenmanı aynı hareket ve set sayılarıyla yeniden başlatır. */
export async function repeatWorkout(w: Workout) {
  if (await db.kv.get('active')) { if (!await ask('Devam eden bir antrenman var. Onu silip bunu başlatayım mı?', { danger: true, ok: 'Başlat' })) return false }
  await startWorkout({ name: w.name, routineId: w.routineId, updatedAt: 0, exercises: w.exercises.map((e) => {
    const work = e.sets.filter((x) => x.type !== 'warmup')
    const mins = work.find((x) => x.seconds && x.reps == null)?.seconds
    return { exerciseId: e.exerciseId, sets: Math.max(1, work.length), reps: e.target ?? (mins ? `${Math.round(mins / 60)} dk` : '8-12'), restSec: e.restSec, superset: e.superset }
  }) } as never)
  return true
}

function HistoryCharts({ onOpen }: { onOpen: (w: Workout) => void }) {
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').toArray(), []) ?? []
  const { map } = useExercises()
  const counts = new Map<string, number>()
  for (const w of workouts) for (const e of w.exercises) if (map.get(e.exerciseId)?.kind === 'weight') counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1)
  const options = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const [sel, setSel] = useState<string>('')
  const [metric, setMetric] = useState<'e1rm' | 'max' | 'vol'>('e1rm')
  const id = sel || options[0]
  if (!id) return null
  const series = workouts.flatMap((w) => {
    const sets = w.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.filter((s) => s.type !== 'warmup'))
    if (!sets.length) return []
    const v = metric === 'e1rm' ? Math.max(0, ...sets.filter((s) => (s.reps ?? 99) <= 12).map((s) => e1rm(s.weight, s.reps, s.rir)))
      : metric === 'max' ? Math.max(0, ...sets.map((s) => s.weight ?? 0))
      : sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0)
    return v > 0 ? [{ t: w.startedAt, v }] : []
  })
  const tr = metric === 'e1rm' ? trend(series.filter((p) => p.t > Date.now() - 70 * DAY)) : null
  const last = series[series.length - 1]
  const proj = tr && tr.slope > 0 && last ? [last, { t: last.t + 28 * DAY, v: tr.at(last.t + 28 * DAY) }] : undefined
  return (
    <div className="card">
      <h3>Hareket grafikleri</h3>
      <select id="hist-ex" className="input" value={id} onChange={(e) => setSel(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{map.get(o)?.name} ({counts.get(o)} seans)</option>)}
      </select>
      <div className="seg">
        <button className={metric === 'e1rm' ? 'on' : ''} onClick={() => setMetric('e1rm')}>Tahmini 1RM</button>
        <button className={metric === 'max' ? 'on' : ''} onClick={() => setMetric('max')}>Maks. kg</button>
        <button className={metric === 'vol' ? 'on' : ''} onClick={() => setMetric('vol')}>Hacim</button>
      </div>
      <LineChart points={series} projection={proj} unit=" kg" onOpen={(p) => { const w = workouts.find((x) => x.startedAt === p.t); if (w) onOpen(w) }} />
      {tr && tr.slope > 0 && <p className="small">Eğilim haftada <b>+{fmtKg(tr.slope)} kg</b>; kesikli çizgi 4 haftalık tahmin.</p>}
      {series.length >= 2 && metric !== 'e1rm' && <p className="small">İlk seanstan bu yana <b>{fmtKg(series[series.length - 1].v - series[0].v)} kg</b> fark.</p>}
    </div>
  )
}

type Period = 'all' | '30' | '90' | 'year'

export default function HistoryScreen({ onStarted }: { onStarted?: () => void }) {
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().toArray(), []) ?? []
  const { map } = useExercises()
  const [open, setOpen] = useState<Workout | null>(null)
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [charts, setCharts] = useState(false)
  const since = period === 'all' ? 0 : period === 'year' ? new Date(new Date().getFullYear(), 0, 1).getTime() : Date.now() - +period * DAY
  const words = q.trim().toLocaleLowerCase('tr').split(/\s+/).filter(Boolean)
  const list = workouts.filter((w) => w.startedAt >= since && words.every((x) => `${w.name} ${w.note ?? ''} ${w.exercises.map((e) => map.get(e.exerciseId)?.name ?? '').join(' ')}`.toLocaleLowerCase('tr').includes(x)))
  const byMonth = new Map<string, Workout[]>()
  for (const w of list) {
    const k = new Date(w.startedAt).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    byMonth.set(k, [...(byMonth.get(k) ?? []), w])
  }
  const totalMin = list.reduce((a, w) => a + ((w.endedAt ?? w.startedAt) - w.startedAt) / 60000, 0)
  const totalVol = list.reduce((a, w) => a + workoutVolume(w), 0)
  const toggle = (id: number) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); setSel(n) }
  const chosen = list.filter((w) => sel.has(w.id!))
  const delSelected = async () => {
    if (!chosen.length) return
    if (!await ask(`${chosen.length} antrenman silinsin mi? Bu geri alınamaz.`, { danger: true, ok: 'Sil' })) return
    await db.workouts.bulkDelete(chosen.map((w) => w.id!)); setSel(new Set()); setSelecting(false)
  }
  const shareSelected = () => chosen.length && shareText([...chosen].reverse().map((w) => workoutText(w, map)).join('\n\n———\n\n'), `${chosen.length} antrenman`)

  return (
    <div className="screen">
      <div className="screen-head row-between">
        <h1>Geçmiş</h1>
        {workouts.length > 0 && <button className="btn ghost" onClick={() => { setSelecting(!selecting); setSel(new Set()) }}>{selecting ? 'Bitti' : 'Seç'}</button>}
      </div>
      {workouts.length === 0 ? (
        <div className="card empty"><h3>Henüz antrenman yok</h3><p className="muted small">Bitirdiğin antrenmanlar burada listelenir; buradan açabilir, tekrarlayabilir, paylaşabilir veya silebilirsin.</p></div>
      ) : (
        <>
          <input className="input" placeholder="Antrenman, hareket veya not ara" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            {([['all', 'Tümü'], ['30', 'Son 30 gün'], ['90', 'Son 3 ay'], ['year', 'Bu yıl']] as const).map(([v, l]) => (
              <button key={v} className={`chip ${period === v ? 'on' : ''}`} onClick={() => setPeriod(v)}>{l}</button>
            ))}
          </div>
          <div className="stat-row">
            <div className="stat"><b>{list.length}</b><span>antrenman</span></div>
            <div className="stat"><b>{Math.round(totalMin / 60)}</b><span>saat</span></div>
            <div className="stat"><b>{fmtKg(totalVol / 1000)}</b><span>ton hacim</span></div>
          </div>
          {!selecting && <button className="btn" onClick={() => setCharts(!charts)}>{charts ? 'Grafikleri gizle' : 'Hareket grafiklerini göster'}</button>}
          {charts && !selecting && <HistoryCharts onOpen={setOpen} />}
          {list.length === 0 && <p className="muted small">Aramana uyan antrenman yok.</p>}
          {[...byMonth].map(([month, ws]) => (
            <section key={month} className="stack">
              <span className="section-label">{month} · {ws.length} antrenman</span>
              {ws.map((w) => (
                <WorkoutCard key={w.id} w={w} selecting={selecting} selected={sel.has(w.id!)}
                  onClick={() => (selecting ? toggle(w.id!) : setOpen(w))}
                  onRepeat={async () => { if (await repeatWorkout(w)) onStarted?.() }}
                  onShare={() => shareText(workoutText(w, map), w.name)}
                  onDelete={async () => { if (await ask(`"${w.name}" (${fmtDate(w.startedAt)}) silinsin mi?`, { danger: true, ok: 'Sil' })) await db.workouts.delete(w.id!) }}
                />
              ))}
            </section>
          ))}
        </>
      )}
      <VersionFooter />
      {selecting && <div style={{ height: 64 }} />}
      {selecting && (
        <div className="select-bar">
          <span><b>{chosen.length}</b> seçili</span>
          <button className="btn sm" onClick={() => setSel(chosen.length === list.length ? new Set() : new Set(list.map((w) => w.id!)))}>{chosen.length === list.length ? 'Hiçbiri' : 'Tümü'}</button>
          <button className="btn sm" disabled={!chosen.length} onClick={shareSelected}>Paylaş</button>
          <button className="btn sm danger" disabled={!chosen.length} onClick={delSelected}>Sil</button>
        </div>
      )}
      {open && <WorkoutDetail w={open} onClose={() => setOpen(null)} onStarted={onStarted} />}
    </div>
  )
}

function WorkoutCard({ w, onClick, selecting, selected, onRepeat, onShare, onDelete }: { w: Workout; onClick: () => void; selecting: boolean; selected: boolean; onRepeat: () => void; onShare: () => void; onDelete: () => void }) {
  const { map } = useExercises()
  const profile = useProfile()
  const [menu, setMenu] = useState(false)
  return (
    <div className={`card hist-card ${selected ? 'selected' : ''}`}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <button className="stack grow" style={{ gap: 4, textAlign: 'left' }} onClick={onClick}>
          <div className="row" style={{ gap: 10 }}>
            {selecting && <span className={`sel-check ${selected ? 'on' : ''}`} aria-hidden="true">{selected ? '✓' : ''}</span>}
            <h3>{w.name}</h3>
          </div>
          <span className="muted small">{w.activity ? `${fmtDate(w.startedAt, true)} · ${w.activity.min} dk${w.activity.km ? ` · ${fmtKg(w.activity.km)} km` : ''} · ${workoutBurn(w, map, profile).kcal} kcal` : `${fmtDate(w.startedAt, true)} · ${fmtDuration((w.endedAt ?? w.startedAt) - w.startedAt)} · ${fmtKg(workoutVolume(w))} kg · ${workoutSetCount(w)} set`}</span>
        </button>
        {!selecting && <button className="icon-btn" aria-label="Seçenekler" onClick={() => setMenu(!menu)}>⋯</button>}
      </div>
      {menu && !selecting && (
        <div className="menu">
          <button onClick={() => { setMenu(false); onClick() }}>Detayı aç</button>
          {!w.activity && <button onClick={() => { setMenu(false); onRepeat() }}>Bu antrenmanı tekrarla</button>}
          <button onClick={() => { setMenu(false); onShare() }}>Paylaş</button>
          <button className="danger" onClick={() => { setMenu(false); onDelete() }}>Sil</button>
        </div>
      )}
      <button onClick={onClick} style={{ textAlign: 'left' }}>
        <ul className="mini">
          {w.exercises.slice(0, w.exercises.length > 5 ? 4 : 5).map((e, i) => {
            const work = e.sets.filter((s) => s.type !== 'warmup')
            return <li key={i}><span className="ellipsis">{map.get(e.exerciseId)?.name ?? e.exerciseId}</span><span className="muted mono">{fmtSets(work)}</span></li>
          })}
          {w.exercises.length > 5 && <li className="muted"><span>+{w.exercises.length - 4} hareket daha</span><span /></li>}
        </ul>
      </button>
    </div>
  )
}

type DetailProps = { w: Workout; onClose: () => void; justFinished?: boolean; onStarted?: () => void }
export function WorkoutDetail(props: DetailProps) {
  const [cur, setCur] = useState(props.w)
  const [editing, setEditing] = useState(false)
  if (cur.activity) return <ActivityDetail w={cur} onClose={props.onClose} />
  if (editing) return <WorkoutEditor w={cur} onClose={() => setEditing(false)} onSaved={(n) => { setCur(n); setEditing(false) }} />
  return <GymDetail {...props} w={cur} onEdit={() => setEditing(true)} />
}

function ActivityDetail({ w, onClose }: { w: Workout; onClose: () => void }) {
  const profile = useProfile()
  const { map } = useExercises()
  const [edit, setEdit] = useState(false)
  const a = w.activity!
  const burn = workoutBurn(w, map, profile)
  const { met, from } = activityMet(a)
  const remove = async () => { if (await ask('Bu aktivite silinsin mi?', { danger: true, ok: 'Sil' })) { await db.workouts.delete(w.id!); onClose() } }
  if (edit) return <ActivitySheet w={w} onClose={() => { setEdit(false); onClose() }} />
  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Kapat</button>
        <strong className="ellipsis">{w.name}</strong>
        <button className="btn ghost" onClick={() => setEdit(true)}>Düzenle</button>
      </div>
      <div className="sheet-body">
        <p className="muted">{fmtDate(w.startedAt, true)}</p>
        <div className="stat-row">
          <div className="stat"><b>{a.min}</b><span>dk</span></div>
          {a.km ? <div className="stat"><b>{fmtKg(a.km)}</b><span>km</span></div> : null}
          <div className="stat"><b>{burn.kcal}</b><span>kcal yakıldı</span></div>
          {w.heartRateAvg && <div className="stat"><b>{w.heartRateAvg}</b><span>ort. nabız</span></div>}
        </div>
        <p className="muted tiny">{burn.method === 'hr' ? `Ortalama nabız (${w.heartRateAvg}), kilo, yaş ve cinsiyetten Keytel formülüyle hesaplandı; dinlenme metabolizması düşüldü.` : `MET ${fmtNum(met, 1)} (${from}), ${w.bodyweight ?? profile.bodyweight} kg, ${a.min} dk; yaş, boy ve cinsiyetten hesaplanan dinlenme metabolizması düşüldü. Tahminidir.`}</p>
        {w.note && <div className="card"><p>{w.note}</p></div>}
        <button className="btn block" onClick={() => shareText(workoutText(w, map), w.name)}>Paylaş</button>
        <button className="btn danger block" onClick={remove}>Aktiviteyi sil</button>
      </div>
    </div>
  )
}

function GymDetail({ w, onClose, justFinished, onStarted, onEdit }: DetailProps & { onEdit: () => void }) {
  const { map } = useExercises()
  const prs = useLiveQuery(async () => {
    const before = (await db.workouts.toArray()).filter((x) => x.startedAt < w.startedAt)
    const best = bestE1rmByExercise(before)
    const list: { name: string; v: number }[] = []
    for (const e of w.exercises) {
      const top = Math.max(0, ...e.sets.filter((s) => s.type !== 'warmup' && (s.reps ?? 99) <= 12).map((s) => e1rm(s.weight, s.reps, s.rir)))
      if (top > 0 && best[e.exerciseId] && top > best[e.exerciseId].v) list.push({ name: map.get(e.exerciseId)?.name ?? '', v: top })
    }
    return list
  }, [w.id, map]) ?? []
  const analysis = analyzeWorkout(w, map)
  const profile = useProfile()
  const burn = workoutBurn(w, map, profile)
  const [openEx, setOpenEx] = useState<string | null>(null)

  const remove = async () => { if (await ask('Bu antrenman silinsin mi?', { danger: true, ok: 'Sil' })) { await db.workouts.delete(w.id!); onClose() } }
  const resume = async () => {
    if (await db.kv.get('active')) { notify('Önce devam eden antrenmanı bitir.'); return }
    if (!await ask('Antrenman yeniden açılsın mı? Süre başlangıç saatinden saymaya devam eder; yeni hareket ve set ekleyip Bitir dediğinde yeniden kaydedilir.', { ok: 'Devam et' })) return
    // Aradan 30 dakikadan fazla geçtiyse süre kaldığı yerden devam eder (başlangıç ileri kayar); yoksa ara da süreye sayılır
    const dur = (w.endedAt ?? w.startedAt) - w.startedAt
    const gap = Date.now() - (w.endedAt ?? w.startedAt)
    const startedAt = gap > 30 * 60000 ? Date.now() - dur : w.startedAt
    await db.workouts.delete(w.id!)
    await setKV('active', { ...w, id: undefined, endedAt: undefined, startedAt, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) })) })
    onClose(); onStarted?.()
    if (gap > 30 * 60000) notify(`Aradan uzun süre geçtiği için süre kaldığı yerden (${Math.round(dur / 60000)} dk) devam ediyor. Gerekirse üstteki süreye dokunup başlangıç saatini değiştirebilirsin.`)
  }
  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Kapat</button>
        <strong className="ellipsis">{justFinished ? 'Tebrikler' : w.name}</strong>
        <button className="btn ghost" onClick={onEdit}>Düzenle</button>
      </div>
      <div className="sheet-body">
        {justFinished && <div className="stack"><span className="eyebrow">Antrenman kaydedildi</span><h1>{w.name}</h1></div>}
        <p className="muted">{fmtDate(w.startedAt, true)}</p>
        <div className="stat-row">
          <div className="stat"><b>{fmtDuration((w.endedAt ?? w.startedAt) - w.startedAt)}</b><span>süre</span></div>
          <div className="stat"><b>{fmtKg(workoutVolume(w))}</b><span>kg hacim</span></div>
          <div className="stat"><b>{workoutSetCount(w)}</b><span>set</span></div>
          <div className="stat"><b>{burn.kcal}</b><span>kcal yakıldı</span></div>
          {w.heartRateAvg && <div className="stat"><b>{w.heartRateAvg}</b><span>ort. nabız</span></div>}
        </div>
        <p className="muted tiny">{burn.method === 'hr' ? `Yakılan kalori ortalama nabız (${w.heartRateAvg}), kilo, yaş ve cinsiyetten Keytel formülüyle hesaplandı; dinlenme metabolizması düşüldü.` : <>Yakılan kalori: {Math.round(burn.weightMin)} dk ağırlık × {profile.kcalWeights} kcal/saat{burn.cardioMin >= 1 ? ` + ${Math.round(burn.cardioMin)} dk kardiyo × ${profile.kcalCardio} kcal/saat` : ''}. Ortalama nabız girersen kişiye özel hesaplanır.</>}</p>
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
              <button className="row-between" onClick={() => setOpenEx(e.exerciseId)} style={{ textAlign: 'left' }}><h3>{info?.name ?? e.exerciseId}</h3><span className="link">Grafik ›</span></button>
              <table className="sets read">
                <tbody>
                  {e.sets.map((s, si) => (
                    <tr key={si} className={`t-${s.type}`}>
                      <td style={{ width: 28 }}><b>{s.type === 'normal' ? ++n : s.type === 'warmup' ? 'I' : s.type === 'drop' ? 'D' : 'F'}</b></td>
                      <td className="mono">{s.seconds != null ? `${Math.round(s.seconds / 60)} dk` : `${s.weight != null ? fmtKg(s.weight) + ' kg × ' : ''}${s.reps ?? ''}`}{s.rir != null ? ` · RIR ${s.rir}` : ''}</td>
                      <td className="muted tiny">{s.weight && s.reps && s.type !== 'warmup' ? `1RM ≈ ${fmtKg(e1rm(s.weight, s.reps, s.rir))}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
        <div className="row">
          <button className="btn grow" onClick={() => shareText(workoutText(w, map), w.name)}>Paylaş</button>
          <button className="btn grow" onClick={async () => { if (await repeatWorkout(w)) { onClose(); onStarted?.() } }}>Tekrarla</button>
        </div>
        <button className="btn block" onClick={resume}>Devam et (antrenmanı yeniden aç)</button>
        <button className="btn danger block" onClick={remove}>Antrenmanı sil</button>
      </div>
      {openEx && map.get(openEx) && <ExerciseDetail ex={map.get(openEx)!} onClose={() => setOpenEx(null)} />}
    </div>
  )
}
