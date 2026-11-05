import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, type Measurement } from '../db'
import { MUSCLE_NAMES, type Muscle } from '../data/exercises'
import { useExercises, useProfile } from '../hooks'
import { DAY, LEVELS, WEEKLY_RANGE, bestE1rmByExercise, ffmi, hasStandard, levelIndex, levelOf, liftScore, muscleSets, strengthProfile, volumeStatus } from '../lib/analysis'
import { fmtDate, fmtKg, workoutVolume } from '../lib/calc'
import BodyMap from '../components/BodyMap'
import LineChart, { Bars } from '../components/LineChart'
import ExerciseLibrary, { ExerciseDetail } from './Exercises'
import { HealthView } from './Health'
import VersionFooter from '../components/VersionFooter'
import { notify } from '../components/Dialog'
import { NutritionAnalysis, WeeklyReport, WeightAnalysis } from './Analysis'
import { MultiLine } from '../components/LineChart'
import { bodyFatSeries, groupVolumeWeeks, seriesTrend } from '../lib/insights'

const GROUP_COLORS: [string, string][] = [['Göğüs', 'var(--plate-red)'], ['Sırt', 'var(--accent)'], ['Omuz', 'var(--plate-yellow)'], ['Kol', 'var(--ink-2)'], ['Bacak', 'var(--plate-green)'], ['Karın', 'color-mix(in srgb, var(--accent) 45%, var(--plate-red))']]

type View = 'rapor' | 'guc' | 'kas' | 'vucut' | 'saglik' | 'beslenme'

export default function ProgressScreen() {
  const [view, setView] = useState<View>('rapor')
  return (
    <div className="screen">
      <div className="screen-head"><h1>İlerleme</h1></div>
      <div className="chips">
        {([['rapor', 'Haftalık rapor'], ['guc', 'Güç'], ['kas', 'Kaslar'], ['vucut', 'Vücut'], ['saglik', 'Sağlık'], ['beslenme', 'Beslenme']] as const).map(([v, l]) => (
          <button key={v} className={`chip ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>{l}</button>
        ))}
      </div>
      {view === 'rapor' && <WeeklyReport />}
      {view === 'beslenme' && <NutritionAnalysis />}
      {view === 'guc' && <Strength />}
      {view === 'kas' && <Muscles />}
      {view === 'vucut' && <Body />}
      {view === 'saglik' && <HealthView />}
      <VersionFooter />
    </div>
  )
}

function Strength() {
  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? []
  const profile = useProfile()
  const { map } = useExercises()
  const [open, setOpen] = useState<string | null>(null)
  const sp = strengthProfile(workouts, profile.bodyweight, profile.sex)
  const best = bestE1rmByExercise(workouts)
  const ranked = Object.entries(best).sort((a, b) => b[1].v - a[1].v)
  const levels: Partial<Record<Muscle, number>> = {}
  for (const r of sp.regions) for (const m of r.muscles) levels[m] = r.score / 100

  const weeks = useMemo(() => {
    const now = new Date(); const day = (now.getDay() + 6) % 7
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).getTime()
    return Array.from({ length: 8 }, (_, i) => {
      const s = monday - (7 - i) * 7 * DAY
      const ws = workouts.filter((w) => w.startedAt >= s && w.startedAt < s + 7 * DAY)
      return { label: new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric' }), n: ws.length }
    })
  }, [workouts])

  return (
    <>
      <div className="card">
        <span className="eyebrow">Toplam güç</span>
        {sp.covered ? (
          <>
            <div className="row-between">
              <span className="score-big">{Math.round(sp.total)}</span>
              <span className="pill">{levelOf(sp.total)}</span>
            </div>
            <LevelScale p={sp.total} />
            <p className="small">{fmtKg(profile.bodyweight)} kg bir {profile.sex === 'f' ? 'kadın' : 'erkek'} olarak, kaydettiğin hareketlere göre {profile.sex === 'f' ? 'kadınların' : 'erkeklerin'} yaklaşık <b>%{Math.round(sp.total)}</b>'inden güçlüsün. Bu bir tahmindir.</p>
            <p className="muted tiny">Kaynak: strengthlevel.com {profile.sex === 'f' ? 'kadın standartları (60 kg' : 'erkek standartları (80 kg'} tablosu, kilona göre (kilo/{profile.sex === 'f' ? 60 : 80})^0,67 ile ölçeklenmiş). {sp.covered}/6 bölge ölçüldü.</p>
          </>
        ) : <p className="muted small">Bench, lat pulldown, row, shoulder press, leg press veya hip thrust gibi standart hareketlerden birini kaydettiğinde güç seviyen hesaplanır.</p>}
      </div>

      {sp.covered > 0 && (
        <div className="card">
          <h3>Bölgelere göre güç</h3>
          <BodyMap levels={levels} />
          <div className="legend"><span><i style={{ background: 'var(--muscle)' }} />Ölçülmedi</span><span><i style={{ background: 'color-mix(in srgb, var(--plate-red) 50%, var(--muscle))' }} />Orta</span><span><i style={{ background: 'var(--plate-red)' }} />Güçlü</span></div>
          {sp.regions.map((r) => (
            <button key={r.name} className="stack" style={{ gap: 4, textAlign: 'left', padding: '6px 0', borderTop: '1px solid var(--line)' }} onClick={() => r.id && setOpen(r.id)}>
              <div className="row-between"><b>{r.name}</b>{r.score ? <span className="pill">{levelOf(r.score)} · {Math.round(r.score)}</span> : <span className="muted tiny">kayıt yok</span>}</div>
              {r.score > 0 && <LevelScale p={r.score} />}
              {r.lifts.length > 0 && <span className="muted tiny">{r.lifts.map((l) => `${map.get(l.id)?.name}: ${fmtKg(l.e1)} kg (${levelOf(l.score)})`).join(' · ')}</span>}
            </button>
          ))}
        </div>
      )}

      {sp.notes.length > 0 && (
        <div className="card">
          <h3>Vücudun kendi içinde</h3>
          {sp.notes.map((n) => <p key={n} className="small">{n}</p>)}
        </div>
      )}

      <div className="card">
        <h3>Haftalık antrenman sayısı</h3>
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
                  <span className="muted tiny">{fmtDate(b.date)} · kilonun {(b.v / profile.bodyweight).toFixed(2)} katı{hasStandard(id) ? ` · ${levelOf(liftScore(id, b.v, profile.bodyweight, profile.sex))}` : ''}</span>
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

export function LevelScale({ p }: { p: number }) {
  const li = levelIndex(p)
  return (
    <div className="stack" style={{ gap: 3 }}>
      <div className="level-scale">{[0, 1, 2, 3, 4].map((i) => <div key={i} className={i <= li ? 'on' : ''} />)}</div>
      <div className="level-scale" style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink-2)' }}>{LEVELS.map((l) => <span key={l} style={{ textAlign: 'center' }}>{l}</span>)}</div>
    </div>
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
  const trendWeeks = groupVolumeWeeks(workouts, map)

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

      <div className="card">
        <h3>Kas grubu hacmi (8 hafta)</h3>
        <MultiLine labels={trendWeeks.map((w) => new Date(w.t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric' }))}
          series={GROUP_COLORS.map(([name, color]) => ({ name, color, values: trendWeeks.map((w) => w.groups[name] ?? 0) }))} />
        <p className="muted tiny">Haftalık set sayısı (yardımcı kas 0,5).</p>
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
  const [form, setForm] = useState<Partial<Measurement>>({})
  const [metric, setMetric] = useState<'weight' | 'waist' | 'bodyFat'>('waist')
  const last = [...ms].reverse()
  const lastWith = (k: keyof Measurement) => last.find((m) => m[k] != null)?.[k] as number | undefined

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
  const bfs = bodyFatSeries(ms, profile.sex, profile.bodyweight)
  const rawSeries = metric === 'bodyFat' ? (bfs.measured.length >= 2 ? bfs.measured : bfs.est) : ms.filter((m) => m[metric] != null).map((m) => ({ t: m.date, v: m[metric] as number }))
  const tr = seriesTrend(rawSeries)
  const estNow = bfs.est.length ? seriesTrend(bfs.est).smooth.slice(-1)[0].v : null
  const wt = lastWith('weight') ?? profile.bodyweight
  const bf = lastWith('bodyFat') ?? estNow ?? undefined
  const ff = bf ? ffmi(wt, profile.height, bf) : null

  return (
    <>
      <WeightAnalysis />
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
          <div className="stat"><b>%{fmtKg(bf!)}</b><span>{lastWith('bodyFat') ? 'yağ oranı' : 'tahmini yağ (bel+kilo)'}</span></div>
          <div className="stat"><b>{ff.ffmi.toFixed(1)}</b><span>FFMI</span></div>
          <div className="stat"><b>{fmtKg(ff.lean)}</b><span>yağsız kütle (kg)</span></div>
          <div className="stat"><b>{fmtKg(wt - ff.lean)}</b><span>yağ kütlesi (kg)</span></div>
        </div>
      )}
      {ff && <p className="muted tiny">FFMI 18-20 ortalama, 20-22 antrenmanlı, 22-25 çok gelişmiş kas kütlesi.</p>}

      <div className="card">
        <div className="seg">
          <button className={metric === 'waist' ? 'on' : ''} onClick={() => setMetric('waist')}>Bel çevresi</button>
          <button className={metric === 'bodyFat' ? 'on' : ''} onClick={() => setMetric('bodyFat')}>Yağ oranı</button>
        </div>
        {metric === 'bodyFat' && bfs.measured.length < 2 && bfs.est.length > 0 && <p className="muted tiny">Ölçülmüş yağ oranı az olduğu için bel ve kilodan hesaplanan tahmin gösteriliyor (YMCA formülü, ±3-4 puan).</p>}
        <LineChart points={tr.smooth} raw={tr.raw} unit={metric === 'bodyFat' ? '%' : metric === 'waist' ? ' cm' : ' kg'} target={metric === 'weight' ? profile.targetWeight : undefined} />
        {tr.smooth.length >= 2 && (() => {
          const d = tr.smooth[tr.smooth.length - 1].v - tr.smooth[0].v
          return <p className="small">Trend (hareketli ortalama): {fmtDate(tr.smooth[0].t)} tarihinden beri <b className={d <= 0 ? 'good' : 'warn'}>{d > 0 ? '+' : ''}{fmtKg(d)}{metric === 'bodyFat' ? ' puan' : metric === 'waist' ? ' cm' : ' kg'}</b>{tr.rate != null && <> · haftada {tr.rate > 0 ? '+' : ''}{tr.rate.toFixed(2)}</>}</p>
        })()}
      </div>

      {last.length > 0 && (
        <div className="card">
          <h3>Ölçüm geçmişi</h3>
          {last.slice(0, 10).map((m) => (
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
