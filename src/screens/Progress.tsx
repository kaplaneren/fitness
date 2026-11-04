import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, type Measurement } from '../db'
import { MUSCLE_NAMES, type Muscle } from '../data/exercises'
import { useExercises, useProfile } from '../hooks'
import { DAY, WEEKLY_RANGE, bestE1rmByExercise, ffmi, levelOf, muscleSets, strengthProfile, volumeStatus } from '../lib/analysis'
import { fmtDate, fmtKg, workoutVolume } from '../lib/calc'
import BodyMap from '../components/BodyMap'
import LineChart, { Bars } from '../components/LineChart'
import { HistoryList } from './History'
import ExerciseLibrary, { ExerciseDetail } from './Exercises'
import VersionFooter from '../components/VersionFooter'
import { ask, notify } from '../components/Dialog'

type View = 'guc' | 'kas' | 'vucut' | 'gecmis'

export default function ProgressScreen() {
  const [view, setView] = useState<View>('guc')
  return (
    <div className="screen">
      <div className="screen-head"><h1>İlerleme</h1></div>
      <div className="seg">
        {([['guc', 'Güç'], ['kas', 'Kaslar'], ['vucut', 'Vücut'], ['gecmis', 'Geçmiş']] as const).map(([v, l]) => (
          <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{l}</button>
        ))}
      </div>
      {view === 'guc' && <Strength />}
      {view === 'kas' && <Muscles />}
      {view === 'vucut' && <Body />}
      {view === 'gecmis' && <HistoryList />}
      <VersionFooter />
    </div>
  )
}

function Strength() {
  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? []
  const profile = useProfile()
  const { map } = useExercises()
  const [open, setOpen] = useState<string | null>(null)
  const sp = strengthProfile(workouts, profile.bodyweight)
  const best = bestE1rmByExercise(workouts)
  const ranked = Object.entries(best).sort((a, b) => b[1].v - a[1].v)

  // Haftalık antrenman sayısı (son 8 hafta)
  const weeks = useMemo(() => {
    const now = new Date(); const day = (now.getDay() + 6) % 7
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime()
    return Array.from({ length: 8 }, (_, i) => {
      const s = monday - (7 - i) * 7 * DAY, e = s + 7 * DAY
      const ws = workouts.filter((w) => w.startedAt >= s && w.startedAt < e)
      return { label: new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric' }), n: ws.length, vol: Math.round(ws.reduce((a, w) => a + workoutVolume(w), 0) / 1000) }
    })
  }, [workouts])

  return (
    <>
      <div className="card">
        <span className="eyebrow">Güç skoru</span>
        {sp.covered ? (
          <>
            <div className="row-between">
              <span className="score-big">{Math.round(sp.total)}</span>
              <span className="pill">{levelOf(sp.total)}</span>
            </div>
            <div className="level-scale">{[0, 1, 2, 3, 4].map((i) => <div key={i} className={sp.total >= (i + 1) * 20 ? 'on' : ''} />)}</div>
            <p className="muted tiny">Kilona ({fmtKg(profile.bodyweight)} kg) göre normalize edilmiş, {sp.covered}/7 hareket kalıbının ortalaması. Seviyeler bu uygulamanın yaklaşık tablosudur.</p>
          </>
        ) : <p className="muted small">Bench, lat pulldown, row, shoulder press, leg press veya hip thrust gibi temel hareketlerden birini kaydettiğinde skorun hesaplanır.</p>}
      </div>

      {sp.covered > 0 && (
        <div className="card">
          <h3>Hareket kalıpları</h3>
          {sp.patterns.map((p) => (
            <div key={p.name} className="vol-row" onClick={() => p.id && setOpen(p.id)} style={{ cursor: p.id ? 'pointer' : undefined }}>
              <span>{p.name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${p.score}%` }} /></div>
              <span className="mono" style={{ textAlign: 'right' }}>{p.score ? Math.round(p.score) : '–'}</span>
            </div>
          ))}
          <p className="muted tiny">Skor 20: Başlangıç, 40: Acemi, 60: Orta, 80: İleri, 100: Elit. En zayıf kalıp, programda öncelik vermen gereken yer.</p>
        </div>
      )}

      <div className="card">
        <h3>Haftalık antrenman</h3>
        <Bars values={weeks.map((w) => w.n)} labels={weeks.map((w) => w.label)} />
      </div>

      {ranked.length > 0 && (
        <div className="card">
          <h3>Tahmini 1RM'ler</h3>
          <ul className="list" style={{ border: 0 }}>
            {ranked.map(([id, b]) => (
              <li key={id} onClick={() => setOpen(id)}>
                <div className="stack" style={{ gap: 2 }}>
                  <span className="title">{map.get(id)?.name ?? id}</span>
                  <span className="muted tiny">{fmtDate(b.date)} · kilonun {(b.v / profile.bodyweight).toFixed(2)} katı</span>
                </div>
                <b className="mono">{fmtKg(b.v)} kg</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      {open && map.get(open) && <ExerciseDetail ex={map.get(open)!} onClose={() => setOpen(null)} />}
    </>
  )
}

function Muscles() {
  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? []
  const { map } = useExercises()
  const [range, setRange] = useState<7 | 28>(7)
  const [lib, setLib] = useState<Muscle | null>(null)
  const sets = muscleSets(workouts, map, Date.now() - range * DAY)
  const perWeek = (m: Muscle) => (sets[m] ?? 0) / (range / 7)
  const levels = Object.fromEntries((Object.keys(WEEKLY_RANGE) as Muscle[]).map((m) => [m, perWeek(m) / Math.max(1, WEEKLY_RANGE[m][1])]))
  const rows = (Object.keys(WEEKLY_RANGE) as Muscle[]).filter((m) => WEEKLY_RANGE[m][0] > 0 || perWeek(m) > 0)
  const low = rows.filter((m) => volumeStatus(m, perWeek(m)) === 'low')
  const high = rows.filter((m) => volumeStatus(m, perWeek(m)) === 'high')

  return (
    <>
      <div className="card">
        <div className="card-title"><h3>Kas ısı haritası</h3>
          <div className="seg" style={{ width: 150 }}>
            <button className={range === 7 ? 'on' : ''} onClick={() => setRange(7)}>7 gün</button>
            <button className={range === 28 ? 'on' : ''} onClick={() => setRange(28)}>4 hafta</button>
          </div>
        </div>
        <BodyMap levels={levels} onPick={(m) => setLib(m)} />
        <div className="legend"><span><i style={{ background: 'var(--muscle)' }} />Çalışmadı</span><span><i style={{ background: 'color-mix(in srgb, var(--plate-red) 45%, var(--muscle))' }} />Az</span><span><i style={{ background: 'var(--plate-red)' }} />Hedefe ulaştı</span></div>
        <p className="muted tiny">Bir kasa dokunursan o kası çalıştıran hareketler açılır.</p>
      </div>

      {(low.length > 0 || high.length > 0) && (
        <div className="card">
          <h3>Dikkat</h3>
          {low.length > 0 && <p className="small"><b className="warn">Az çalışan:</b> {low.map((m) => MUSCLE_NAMES[m]).join(', ')}</p>}
          {high.length > 0 && <p className="small"><b className="bad">Fazla yüklenen:</b> {high.map((m) => MUSCLE_NAMES[m]).join(', ')}</p>}
        </div>
      )}

      <div className="card">
        <h3>Haftalık set sayısı</h3>
        <p className="muted tiny">Ana kas 1, yardımcı kas 0,5 set sayılır. Çizgi hedef aralığı gösterir.</p>
        {rows.map((m) => {
          const v = perWeek(m), [lo, hi] = WEEKLY_RANGE[m], max = Math.max(hi + 6, v)
          const st = volumeStatus(m, v)
          return (
            <div key={m} className="vol-row">
              <span>{MUSCLE_NAMES[m]}</span>
              <div className="bar-track" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: `${(lo / max) * 100}%`, width: `${((hi - lo) / max) * 100}%`, top: 0, bottom: 0, background: 'color-mix(in srgb, var(--good) 22%, transparent)' }} />
                <div className="bar-fill" style={{ position: 'relative', width: `${(v / max) * 100}%`, background: st === 'ok' ? 'var(--good)' : st === 'low' ? 'var(--warn)' : 'var(--danger)' }} />
              </div>
              <span className="mono" style={{ textAlign: 'right' }}>{fmtKg(v)}</span>
            </div>
          )
        })}
      </div>
      {lib && <ExerciseLibrary initialMuscle={lib} onClose={() => setLib(null)} />}
    </>
  )
}

function Body() {
  const profile = useProfile()
  const ms = useLiveQuery(() => db.measurements.orderBy('date').toArray(), []) ?? []
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), []) ?? []
  const [form, setForm] = useState<Partial<Measurement>>({})
  const [metric, setMetric] = useState<'weight' | 'waist' | 'bodyFat'>('weight')
  const fileRef = useRef<HTMLInputElement>(null)
  const last = [...ms].reverse()
  const lastWith = (k: keyof Measurement) => last.find((m) => m[k] != null)?.[k] as number | undefined
  const bf = lastWith('bodyFat'), wt = lastWith('weight') ?? profile.bodyweight
  const ff = bf ? ffmi(wt, profile.height, bf) : null

  const save = async () => {
    const clean = Object.fromEntries(Object.entries(form).filter(([, v]) => v != null && !Number.isNaN(v))) as Partial<Measurement>
    if (!Object.keys(clean).length) { notify('En az bir ölçü gir.'); return }
    await db.measurements.add({ date: Date.now(), ...clean })
    if (clean.weight) await db.kv.put({ key: 'profile', value: { ...(await db.kv.get('profile'))?.value as object, bodyweight: clean.weight } })
    setForm({})
  }
  const field = (k: keyof Measurement, label: string) => (
    <label className="field" htmlFor={`m-${k}`}>{label}
      <input id={`m-${k}`} type="number" inputMode="decimal" step="0.1" placeholder={lastWith(k) != null ? String(lastWith(k)) : ''} value={(form[k] as number | undefined) ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value === '' ? undefined : parseFloat(e.target.value) })} />
    </label>
  )
  const series = ms.filter((m) => m[metric] != null).map((m) => ({ t: m.date, v: m[metric] as number }))

  return (
    <>
      <div className="card">
        <h3>Yeni ölçüm</h3>
        <div className="fields">
          {field('weight', 'Kilo (kg)')}{field('waist', 'Bel (cm)')}{field('bodyFat', 'Yağ (%)')}
          {field('chest', 'Göğüs (cm)')}{field('arm', 'Kol (cm)')}{field('thigh', 'Bacak (cm)')}
        </div>
        <button className="btn primary" onClick={save}>Kaydet</button>
      </div>

      {ff && (
        <div className="stat-row">
          <div className="stat"><b>{ff.ffmi.toFixed(1)}</b><span>FFMI</span></div>
          <div className="stat"><b>{fmtKg(ff.lean)}</b><span>yağsız kütle (kg)</span></div>
          <div className="stat"><b>{fmtKg(wt - ff.lean)}</b><span>yağ kütlesi (kg)</span></div>
        </div>
      )}
      {ff && <p className="muted tiny">FFMI 18-20 ortalama, 20-22 antrenmanlı, 22-25 çok gelişmiş kas kütlesi.</p>}

      <div className="card">
        <div className="seg">
          <button className={metric === 'weight' ? 'on' : ''} onClick={() => setMetric('weight')}>Kilo</button>
          <button className={metric === 'waist' ? 'on' : ''} onClick={() => setMetric('waist')}>Bel</button>
          <button className={metric === 'bodyFat' ? 'on' : ''} onClick={() => setMetric('bodyFat')}>Yağ %</button>
        </div>
        <LineChart points={series} unit={metric === 'bodyFat' ? '%' : metric === 'waist' ? ' cm' : ' kg'} />
        {series.length >= 2 && (() => {
          const d = series[series.length - 1].v - series[0].v
          const days = Math.max(1, (series[series.length - 1].t - series[0].t) / DAY)
          return <p className="small">{fmtDate(series[0].t)} tarihinden beri <b className={d <= 0 ? 'good' : 'warn'}>{d > 0 ? '+' : ''}{fmtKg(d)}</b> ({fmtKg((d / days) * 7)} / hafta)</p>
        })()}
      </div>

      <div className="card">
        <div className="card-title"><h3>İlerleme fotoğrafları</h3><button className="btn sm" onClick={() => fileRef.current?.click()}>+ Fotoğraf</button></div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (f) await db.photos.add({ date: Date.now(), blob: f })
        }} />
        {photos.length === 0 ? <p className="muted small">Aynı ışıkta, aynı açıdan, haftada bir fotoğraf çek. Fotoğraflar sadece telefonunda kalır.</p> : (
          <div className="photo-grid">{photos.map((p) => <PhotoThumb key={p.id} id={p.id!} blob={p.blob} date={p.date} />)}</div>
        )}
      </div>

      {last.length > 0 && (
        <div className="card">
          <h3>Ölçüm geçmişi</h3>
          {last.slice(0, 20).map((m) => (
            <div key={m.id} className="hist-row">
              <span className="muted small">{fmtDate(m.date)}</span>
              <span className="mono small">{[m.weight && `${fmtKg(m.weight)} kg`, m.waist && `bel ${m.waist}`, m.bodyFat && `%${m.bodyFat}`, m.chest && `göğüs ${m.chest}`, m.arm && `kol ${m.arm}`, m.thigh && `bacak ${m.thigh}`].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function PhotoThumb({ id, blob, date }: { id: number; blob: Blob; date: number }) {
  const [url, setUrl] = useState('')
  useEffect(() => { const u = URL.createObjectURL(blob); setUrl(u); return () => URL.revokeObjectURL(u) }, [blob])
  return (
    <button onClick={async () => { if (await ask(`${fmtDate(date)} tarihli fotoğraf silinsin mi?`, { danger: true, ok: 'Sil' })) await db.photos.delete(id) }} style={{ padding: 0 }}>
      {url && <img src={url} alt={`İlerleme fotoğrafı, ${fmtDate(date)}`} />}
      <span className="tiny muted">{new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
    </button>
  )
}
