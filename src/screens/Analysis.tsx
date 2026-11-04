import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../db'
import { useExercises, useProfile } from '../hooks'
import { DAY } from '../lib/analysis'
import { fmtDate, fmtKg } from '../lib/calc'
import { adaptiveTdee, balance, consistency, goalEta, mondayOf, nutritionStats, strengthPlateaus, weeklyReport, weightPlateau, weightTrend } from '../lib/insights'
import { targets } from '../lib/nutrition'
import LineChart, { CalendarHeat } from '../components/LineChart'
import { ExerciseDetail } from './Exercises'

function Delta({ cur, prev, unit = '', digits = 0, invert = false }: { cur: number; prev: number; unit?: string; digits?: number; invert?: boolean }) {
  if (!prev) return <span className="muted tiny">geçen hafta yok</span>
  const d = cur - prev
  const good = invert ? d < 0 : d > 0
  return <span className={`tiny ${d === 0 ? 'muted' : good ? 'good' : 'warn'}`}>{d > 0 ? '▲' : d < 0 ? '▼' : '='} {Math.abs(d).toFixed(digits)}{unit}</span>
}

export function WeeklyReport() {
  const profile = useProfile()
  const { map } = useExercises()
  const [offset, setOffset] = useState(0)
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').toArray(), []) ?? []
  const diary = useLiveQuery(() => db.diary.toArray(), []) ?? []
  const ms = useLiveQuery(() => db.measurements.orderBy('date').toArray(), []) ?? []
  const [open, setOpen] = useState<string | null>(null)
  const weekStart = mondayOf(Date.now()) - offset * 7 * DAY
  const r = weeklyReport(weekStart, workouts, diary, ms, map, profile)
  const cons = consistency(workouts, profile.weeklyTarget)
  const plateaus = strengthPlateaus(workouts, map)
  const wp = weightPlateau(ms, profile)
  const bal = balance(workouts, map)
  const tdee = adaptiveTdee(diary, ms)
  const t = targets(profile)
  const range = `${new Date(weekStart).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${new Date(weekStart + 6 * DAY).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`

  return (
    <>
      <div className="date-nav">
        <button className="icon-btn" aria-label="Önceki hafta" onClick={() => setOffset(offset + 1)}>‹</button>
        <strong>{offset === 0 ? 'Bu hafta' : offset === 1 ? 'Geçen hafta' : range}</strong>
        <button className="icon-btn" aria-label="Sonraki hafta" disabled={offset === 0} style={{ opacity: offset === 0 ? 0.3 : 1 }} onClick={() => setOffset(offset - 1)}>›</button>
      </div>
      <p className="muted tiny center">{range} · geçen haftayla kıyas</p>

      <div className="stat-row">
        <div className="stat"><b>{r.a.n}<span className="muted" style={{ fontSize: 16 }}>/{profile.weeklyTarget}</span></b><span>antrenman</span><Delta cur={r.a.n} prev={r.b.n} /></div>
        <div className="stat"><b>{r.a.sets}</b><span>set</span><Delta cur={r.a.sets} prev={r.b.sets} /></div>
        <div className="stat"><b>{fmtKg(r.a.vol / 1000)}</b><span>ton hacim</span><Delta cur={r.a.vol / 1000} prev={r.b.vol / 1000} digits={1} unit=" t" /></div>
        <div className="stat"><b>{Math.round(r.a.mins)}</b><span>dk / antrenman</span><Delta cur={r.a.mins} prev={r.b.mins} unit=" dk" invert /></div>
      </div>
      <div className="stat-row">
        <div className="stat"><b>{r.avgKcal != null ? Math.round(r.avgKcal) : '–'}</b><span>ort. kcal (hedef {t.kcal})</span></div>
        <div className="stat"><b>{r.avgP != null ? Math.round(r.avgP) : '–'}</b><span>ort. protein (hedef {t.protein})</span></div>
        <div className="stat"><b>{r.wCur != null ? fmtKg(r.wCur) : '–'}</b><span>ort. kilo</span>{r.wCur != null && r.wPrev != null && <Delta cur={r.wCur} prev={r.wPrev} unit=" kg" digits={1} invert={profile.goal === 'cut'} />}</div>
      </div>

      <div className="card">
        <h3>Koç notları</h3>
        {r.notes.length ? r.notes.map((n, i) => <p key={i} className="small"><b className={n.tone === 'good' ? 'good' : n.tone === 'bad' ? 'bad' : 'warn'}>{n.tone === 'good' ? '✓' : '!'}</b> {n.text}</p>)
          : <p className="muted small">Bu hafta için henüz yeterli kayıt yok.</p>}
      </div>

      {r.prs.length > 0 && (
        <div className="card">
          <h3>Haftanın rekorları</h3>
          {r.prs.map((p) => (
            <button key={p.id} className="row-between small" onClick={() => setOpen(p.id)} style={{ textAlign: 'left' }}>
              <span>★ {p.name}</span><span className="mono"><b>{fmtKg(p.v)} kg</b> <span className="good tiny">+{fmtKg(p.gain)}</span></span>
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title"><h3>Devamlılık</h3><span className="pill">{cons.streak} hafta seri</span></div>
        <CalendarHeat grid={cons.grid} />
        <p className="small">Son 15 haftanın <b>%{Math.round(cons.hitRate * 100)}</b>'inde haftalık {profile.weeklyTarget} antrenman hedefini tutturdun.</p>
      </div>

      {(plateaus.length > 0 || wp) && (
        <div className="card warn-card">
          <h3>Plato uyarıları</h3>
          {wp && <p className="small"><b>Kilo:</b> son {wp.days} günde {wp.change > 0 ? '+' : ''}{wp.change.toFixed(1)} kg. {wp.tip}</p>}
          {plateaus.slice(0, 3).map((p) => (
            <button key={p.id} className="stack small" style={{ textAlign: 'left', gap: 2 }} onClick={() => setOpen(p.id)}>
              <span><b>{p.name}</b>: {p.weeks} haftadır rekor yok (en iyi 1RM {fmtKg(p.best)} kg).</span>
              <span className="muted">{p.tip}</span>
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Denge (son 4 hafta)</h3>
        <BalanceBar a={bal.pull} b={bal.push} la="Çekiş" lb="İtiş" />
        <p className="muted tiny">{bal.pull + bal.push === 0 ? 'Veri yok.' : bal.pull >= bal.push ? 'Çekiş hacmi itişten fazla; postür ve skolyoz için doğru yönde.' : 'İtiş hacmi çekişten fazla. Skolyoz ve postür için çekiş setlerini en az itiş kadar tut (ör. face pull, row ekle).'}</p>
        <BalanceBar a={bal.upper} b={bal.lower} la="Üst vücut" lb="Alt vücut" />
      </div>

      <div className="card">
        <h3>Gerçek kalori harcaman</h3>
        {tdee.tdee ? (
          <>
            <div className="row-between"><span className="score-big" style={{ fontSize: 44 }}>{tdee.tdee}</span><span className="muted small">kcal / gün</span></div>
            <p className="small">Son 3 haftada ortalama <b>{tdee.avgIntake}</b> kcal yedin ve kilo trendine göre hesaplanan harcaman <b>{tdee.tdee}</b> kcal. Formülle hesaplanan değer {t.tdee} kcal.</p>
            {profile.goal === 'cut' && <p className="small">Haftada yaklaşık 0,5 kg vermek için hedef: <b>{Math.round((tdee.tdee - 500) / 10) * 10} kcal</b>.</p>}
          </>
        ) : <p className="muted small">Hesaplamak için son 3 haftada en az 10 gün beslenme kaydı ve 2 kilo ölçümü gerekiyor. Şu an: {tdee.loggedDays} gün kayıt, {tdee.weightPoints} ölçüm.</p>}
      </div>
      {open && map.get(open) && <ExerciseDetail ex={map.get(open)!} onClose={() => setOpen(null)} />}
    </>
  )
}

function BalanceBar({ a, b, la, lb }: { a: number; b: number; la: string; lb: string }) {
  const tot = a + b || 1
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row-between tiny" style={{ fontWeight: 700 }}><span>{la} {Math.round(a)} set</span><span>{lb} {Math.round(b)} set</span></div>
      <div className="bar-track" style={{ display: 'flex', height: 10 }}>
        <div style={{ width: `${(a / tot) * 100}%`, background: 'var(--accent)' }} />
        <div style={{ width: `${(b / tot) * 100}%`, background: 'var(--plate-yellow)' }} />
      </div>
    </div>
  )
}

export function WeightAnalysis() {
  const profile = useProfile()
  const ms = useLiveQuery(() => db.measurements.orderBy('date').toArray(), []) ?? []
  const tr = weightTrend(ms, profile.bodyweight)
  if (tr.raw.length < 2) return <div className="card"><h3>Kilo trendi</h3><p className="muted small">Kilonu haftada birkaç kez, sabah aç karnına tartılıp gir. 2 ölçümden sonra trend çizilir.</p></div>
  const cur = tr.smooth[tr.smooth.length - 1].v
  const eta = goalEta(cur, profile.targetWeight, tr.rate)
  return (
    <div className="card">
      <div className="card-title"><h3>Kilo trendi</h3><span className="muted tiny">noktalar: tartı · çizgi: trend</span></div>
      <LineChart points={tr.smooth} raw={tr.raw} unit=" kg" target={profile.targetWeight} targetLabel="hedef" />
      <div className="stat-row">
        <div className="stat"><b>{fmtKg(cur)}</b><span>trend kilo</span></div>
        <div className="stat"><b>{tr.rate != null ? `${tr.rate > 0 ? '+' : ''}${tr.rate.toFixed(2)}` : '–'}</b><span>kg / hafta</span></div>
        <div className="stat"><b>{eta?.date ? new Date(eta.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '–'}</b><span>hedefe varış</span></div>
      </div>
      {tr.rate != null && profile.goal === 'cut' && (
        <p className="small">{tr.rate < -0.8 ? 'Hızlı düşüyor; kas kaybını önlemek için kaloriyi biraz artır.' : tr.rate <= -0.25 ? 'Yağ yakımı için ideal hız (haftada %0,3-1).' : 'Trend yatay. 1-2 hafta böyle giderse kaloriyi 150 kcal azalt veya kardiyo ekle.'}</p>
      )}
    </div>
  )
}

export function NutritionAnalysis() {
  const profile = useProfile()
  const diary = useLiveQuery(() => db.diary.toArray(), []) ?? []
  const [days, setDays] = useState<7 | 28>(28)
  const st = nutritionStats(diary, profile, days)
  if (!st) return <div className="card"><p className="muted small">Beslenme sekmesinde öğün kaydettikçe burada ortalamalar, makro dağılımı ve hedef uyumu görünecek.</p></div>
  const pct = (x: number) => `%${Math.round(x * 100)}`
  const w = (x: number) => `${Math.round(x * 1000) / 10}%`
  return (
    <>
      <div className="seg">
        <button className={days === 7 ? 'on' : ''} onClick={() => setDays(7)}>7 gün</button>
        <button className={days === 28 ? 'on' : ''} onClick={() => setDays(28)}>4 hafta</button>
      </div>
      <div className="stat-row">
        <div className="stat"><b>{Math.round(st.kcal)}</b><span>ort. kcal (hedef {st.t.kcal})</span></div>
        <div className="stat"><b>{st.proteinPerKg.toFixed(1)}</b><span>g protein / kg</span></div>
        <div className="stat"><b>{st.days}</b><span>kayıtlı gün</span></div>
      </div>
      <div className="card">
        <h3>Makro dağılımı</h3>
        <div className="bar-track" style={{ display: 'flex', height: 14 }}>
          <div style={{ width: w(st.split.p), background: 'var(--plate-red)' }} />
          <div style={{ width: w(st.split.c), background: 'var(--plate-yellow)' }} />
          <div style={{ width: w(st.split.f), background: 'var(--plate-green)' }} />
        </div>
        <div className="legend" style={{ justifyContent: 'space-between' }}>
          <span><i style={{ background: 'var(--plate-red)' }} />Protein {pct(st.split.p)} · {Math.round(st.p)} g</span>
          <span><i style={{ background: 'var(--plate-yellow)' }} />Karb. {pct(st.split.c)} · {Math.round(st.c)} g</span>
          <span><i style={{ background: 'var(--plate-green)' }} />Yağ {pct(st.split.f)} · {Math.round(st.f)} g</span>
        </div>
      </div>
      <div className="card">
        <h3>Hedef uyumu</h3>
        <div className="vol-row"><span>Kalori ±%10</span><div className="bar-track"><div className="bar-fill" style={{ width: w(st.onKcal) }} /></div><span className="mono">{pct(st.onKcal)}</span></div>
        <div className="vol-row"><span>Protein</span><div className="bar-track"><div className="bar-fill" style={{ width: w(st.onProtein), background: 'var(--plate-red)' }} /></div><span className="mono">{pct(st.onProtein)}</span></div>
        <p className="muted tiny">Kayıtlı günlerin kaçında hedefe ulaştığın.</p>
        {st.weekend != null && st.weekday != null && (
          <p className="small">Hafta sonu ortalaman <b>{Math.round(st.weekend)}</b> kcal, hafta içi <b>{Math.round(st.weekday)}</b> kcal.{st.weekend - st.weekday > 300 ? ' Hafta sonu fazlası haftalık açığın büyük kısmını siliyor.' : ''}</p>
        )}
      </div>
      <div className="card">
        <h3>Günlük kalori</h3>
        <LineChart points={st.series} unit="" target={st.t.kcal} />
      </div>
      <div className="card">
        <h3>Günlük protein</h3>
        <LineChart points={st.proteinSeries} unit=" g" target={st.t.protein} color="var(--plate-red)" />
      </div>
      <p className="muted tiny center">Son kayıt: {fmtDate(st.series[st.series.length - 1].t)}</p>
    </>
  )
}
