import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, getKV, setKV, type Checkin } from '../db'
import { useExercises, useProfile } from '../hooks'
import { DAY } from '../lib/analysis'
import { fmtDate, fmtNum } from '../lib/calc'
import { todayKey } from '../lib/nutrition'
import { strengthPlateaus } from '../lib/insights'
import { useMeso } from '../lib/meso'
import { JOINT_NAMES, cardioMinutes, deloadAdvice, hrZones, painLinks, readiness, type Joint } from '../lib/health'
import LineChart from '../components/LineChart'
import { ask } from '../components/Dialog'

type Key = keyof Omit<Checkin, 'date' | 'note'>

function Scale({ label, k, c, set, lo = 1, hi = 5, hint }: { label: string; k: Key; c: Checkin; set: (k: Key, v: number | undefined) => void; lo?: number; hi?: number; hint?: [string, string] }) {
  const vals = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row-between small"><b>{label}</b>{hint && <span className="muted tiny">{hint[0]} → {hint[1]}</span>}</div>
      <div className="seg">
        {vals.map((v) => <button key={v} className={c[k] === v ? 'on' : ''} onClick={() => set(k, c[k] === v ? undefined : v)}>{v}</button>)}
      </div>
    </div>
  )
}

/** Ana sayfadaki günlük kontrol kartı. */
export function CheckinCard() {
  const key = todayKey()
  const saved = useLiveQuery(() => db.checkins.get(key), [key])
  const [open, setOpen] = useState(false)
  const c: Checkin = saved ?? { date: key }
  const r = readiness(saved)
  const set = async (k: Key, v: number | undefined) => { await db.checkins.put({ ...c, [k]: v }) }

  return (
    <div className="card">
      <div className="card-title">
        <h3>Bugün nasılsın?</h3>
        <button className="link" onClick={() => setOpen(!open)}>{open ? 'Kapat' : saved ? 'Düzenle' : 'Doldur'}</button>
      </div>
      {r ? (
        <div className="row-between" style={{ alignItems: 'center', gap: 12 }}>
          <span className="score-big" style={{ color: r.score >= 75 ? 'var(--good)' : r.score >= 50 ? 'var(--warn)' : 'var(--danger)' }}>{r.score}</span>
          <span className="small grow">{r.advice}</span>
        </div>
      ) : !open && <p className="muted small">30 saniyelik kontrol: uyku, enerji, kas ağrısı ve eklem ağrısı. Hazır olma skoruna göre bugünkü ağırlık önerisi ayarlanır.</p>}
      {open && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="fields">
            <label className="field" htmlFor="ci-sleep">Uyku (saat)
              <input id="ci-sleep" type="number" inputMode="decimal" step="0.5" value={c.sleepHours ?? ''} onChange={(e) => set('sleepHours', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
            </label>
            <label className="field" htmlFor="ci-steps">Adım (dün/bugün)
              <input id="ci-steps" type="number" inputMode="numeric" value={c.steps ?? ''} onChange={(e) => set('steps', e.target.value === '' ? undefined : parseInt(e.target.value))} />
            </label>
          </div>
          <Scale label="Uyku kalitesi" k="sleepQuality" c={c} set={set} hint={['kötü', 'çok iyi']} />
          <Scale label="Enerji" k="energy" c={c} set={set} hint={['bitkin', 'zinde']} />
          <Scale label="Kas ağrısı" k="soreness" c={c} set={set} hint={['yok', 'çok']} />
          <Scale label="Stres" k="stress" c={c} set={set} hint={['yok', 'çok']} />
          <p className="eyebrow" style={{ margin: '4px 0 0' }}>Eklem ağrısı (0 yok, 10 çok şiddetli)</p>
          {(Object.keys(JOINT_NAMES) as Joint[]).map((j) => (
            <Scale key={j} label={JOINT_NAMES[j]} k={j} c={c} set={set} lo={0} hi={10} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Haftalık rapordaki deload kartı. */
export function DeloadCard() {
  const { map } = useExercises()
  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? []
  const checkins = useLiveQuery(() => db.checkins.toArray(), []) ?? []
  const until = useLiveQuery(() => getKV<number | null>('deloadUntil', null), [])
  const d = deloadAdvice(workouts, checkins, strengthPlateaus(workouts, map).length)
  const active = until && until > Date.now()
  const { state: meso } = useMeso()

  if (meso) return (
    <div className="card">
      <div className="card-title"><h3>Deload</h3><span className={`pill ${meso.deload ? 'warn' : ''}`}>{meso.deload ? 'bu hafta' : 'planlı'}</span></div>
      <p className="small">{meso.deload ? 'Döngünün planlı deload haftasındasın. Yeni antrenmanlarda ağırlık %10, set sayısı %40 azaltılır.' : `Döngü açık: deload ${meso.total - meso.week} hafta sonra kendiliğinden gelecek. Ayrıca deload başlatmana gerek yok.`}</p>
    </div>
  )

  if (active) return (
    <div className="card">
      <div className="card-title"><h3>Deload haftası</h3><span className="pill warn">aktif</span></div>
      <p className="small">{fmtDate(until!)} tarihine kadar yeni antrenmanlarda ağırlık %10, set sayısı %40 azaltılır. Amaç yorgunluğu atıp sonra daha güçlü dönmek.</p>
      <button className="btn sm" onClick={() => setKV('deloadUntil', null)}>Deload'u bitir</button>
    </div>
  )
  if (!d.suggest && !d.reasons.length) return null
  return (
    <div className="card">
      <div className="card-title"><h3>Deload</h3>{d.suggest && <span className="pill warn">önerilir</span>}</div>
      {d.reasons.map((r) => <p key={r} className="small">{r}</p>)}
      <p className="muted small">{d.suggest ? 'Bir hafta hafif çalışmak toparlanmayı hızlandırır ve platoyu kırar.' : 'Şimdilik gerek yok; bir işaret daha görülürse önerilecek.'}</p>
      <button className={`btn ${d.suggest ? 'primary' : 'sm'}`} onClick={async () => {
        if (await ask('7 gün boyunca ağırlık %10, set sayısı %40 azaltılsın mı?', { ok: 'Deload başlat' })) await setKV('deloadUntil', Date.now() + 7 * DAY)
      }}>Deload haftası başlat</button>
    </div>
  )
}

/** İlerleme → Sağlık. */
export function HealthView() {
  const profile = useProfile()
  const { map } = useExercises()
  const workouts = useLiveQuery(() => db.workouts.toArray(), []) ?? []
  const checkins = useLiveQuery(() => db.checkins.orderBy('date').toArray(), []) ?? []
  const [joint, setJoint] = useState<Joint>('painKnee')
  const series = checkins.map((c) => ({ t: new Date(c.date).getTime(), v: readiness(c)?.score })).filter((p): p is { t: number; v: number } => p.v != null).slice(-30)
  const sleep = checkins.filter((c) => c.sleepHours != null).slice(-30).map((c) => ({ t: new Date(c.date).getTime(), v: c.sleepHours! }))
  const steps = checkins.filter((c) => c.steps != null).slice(-30).map((c) => ({ t: new Date(c.date).getTime(), v: c.steps! }))
  const pl = painLinks(checkins, workouts, map, joint)
  const painSeries = checkins.filter((c) => c[joint] != null).slice(-30).map((c) => ({ t: new Date(c.date).getTime(), v: c[joint] as number }))
  const z = hrZones(profile.age)
  const cm = cardioMinutes(workouts, map, profile)
  const totalCardio = Object.values(cm).reduce((a, b) => a + b, 0)

  return (
    <>
      <div className="card">
        <h3>Hazır olma skoru (30 gün)</h3>
        <LineChart points={series} unit="" />
        <p className="muted tiny">Ana sayfadaki günlük kontrolden hesaplanır. 75 üstü iyi, 50 altı düşük.</p>
      </div>

      {sleep.length >= 2 && (
        <div className="card">
          <h3>Uyku</h3>
          <LineChart points={sleep} unit=" sa" target={7.5} targetLabel="hedef" />
          <p className="small">Son 7 kayıt ortalaması: <b>{fmtNum(sleep.slice(-7).reduce((a, b) => a + b.v, 0) / Math.min(7, sleep.length), 1)} saat</b></p>
        </div>
      )}
      {steps.length >= 2 && (
        <div className="card">
          <h3>Adım</h3>
          <LineChart points={steps} unit="" />
        </div>
      )}

      <div className="card">
        <h3>Ağrı günlüğü</h3>
        <div className="seg">
          {(Object.keys(JOINT_NAMES) as Joint[]).map((j) => <button key={j} className={joint === j ? 'on' : ''} onClick={() => setJoint(j)}>{JOINT_NAMES[j]}</button>)}
        </div>
        <LineChart points={painSeries} unit="" color="var(--plate-red)" />
        {pl.avg == null ? <p className="muted small">Analiz için en az 5 gün ağrı kaydı gerekiyor. Günlük kontrolde {JOINT_NAMES[joint].toLowerCase()} ağrını 0 da olsa işaretle.</p> : (
          <>
            <p className="small">Ortalama {JOINT_NAMES[joint].toLowerCase()} ağrın: <b>{fmtNum(pl.avg, 1)}/10</b>. Aşağıda, hareketi yaptığın günün ertesindeki ağrı ortalaması var.</p>
            {pl.links.length === 0 ? <p className="muted small">Henüz yeterli eşleşme yok (her hareket için en az 2 gün).</p> : (
              <ul className="list" style={{ border: 0 }}>
                {pl.links.slice(0, 8).map((l) => (
                  <li key={l.id}>
                    <div className="stack" style={{ gap: 2 }}>
                      <span className="title">{l.name}</span>
                      <span className="muted tiny">{l.n} gün · ertesi gün ort. {fmtNum(l.after, 1)}</span>
                    </div>
                    <b className={`mono ${l.diff >= 1 ? 'bad' : l.diff >= 0.4 ? 'warn' : 'good'}`}>{l.diff > 0 ? '+' : ''}{fmtNum(l.diff, 1)}</b>
                  </li>
                ))}
              </ul>
            )}
            {pl.links[0]?.diff >= 1 && <p className="small"><b className="bad">Dikkat:</b> {pl.links[0].name} sonrası ağrın belirgin artıyor. Alternatif hareketi dene veya fizyoterapistine danış.</p>}
            <p className="muted tiny">Bu bir korelasyon; neden-sonuç değildir. Az veriyle yanıltıcı olabilir.</p>
          </>
        )}
      </div>

      <div className="card">
        <h3>Nabız bölgeleri</h3>
        <p className="muted tiny">{profile.age} yaş için tahmini maksimum nabız {z.max} (Tanaka formülü). Antrenman sonunda ortalama nabzı girersen kardiyo dakikaları bölgelere ayrılır.</p>
        {z.zones.map((zz) => (
          <div key={zz.n} className="vol-row zone">
            <span>B{zz.n} · {zz.name}</span>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${totalCardio ? (cm[zz.n] / totalCardio) * 100 : 0}%`, background: zz.n <= 2 ? 'var(--good)' : zz.n === 3 ? 'var(--warn)' : 'var(--danger)' }} /></div>
            <span className="mono tiny" style={{ textAlign: 'right' }}>{zz.lo}-{zz.hi}</span>
          </div>
        ))}
        <p className="small">Son 4 hafta kardiyo: <b>{Math.round(totalCardio)} dk</b>{cm[0] > 0 && <span className="muted"> ({Math.round(cm[0])} dk nabızsız)</span>}. Yağ yakımı ve kalp sağlığı için haftada 150 dk bölge 2 hedefle.</p>
      </div>
    </>
  )
}
