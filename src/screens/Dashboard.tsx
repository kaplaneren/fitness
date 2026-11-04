import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Routine } from '../db'
import { useActiveWorkout, useExercises, useProfile } from '../hooks'
import { DAY, WEEKLY_RANGE, levelOf, muscleSets, strengthProfile } from '../lib/analysis'
import { fmtDate, fmtKg, workoutSetCount, workoutVolume } from '../lib/calc'
import { sumEntries, targets, todayKey } from '../lib/nutrition'
import { startWorkout } from '../lib/workout'
import BodyMap from '../components/BodyMap'
import { MacroBars, MacroRing } from './Nutrition'
import VersionFooter from '../components/VersionFooter'
import { ask } from '../components/Dialog'
import type { Tab } from '../App'
import type { Muscle } from '../data/exercises'

export default function Dashboard({ go, onStarted }: { go: (t: Tab) => void; onStarted: () => void }) {
  const profile = useProfile()
  const { map } = useExercises()
  const { workout } = useActiveWorkout()
  const t = targets(profile)
  const today = useLiveQuery(() => db.diary.where('date').equals(todayKey()).toArray(), []) ?? []
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').toArray(), []) ?? []
  const routines = useLiveQuery(() => db.routines.toArray(), []) ?? []
  const total = sumEntries(today)

  const weekAgo = Date.now() - 7 * DAY
  const thisWeek = workouts.filter((w) => w.startedAt >= weekAgo)
  const sets = muscleSets(workouts, map, weekAgo)
  const levels = Object.fromEntries((Object.keys(WEEKLY_RANGE) as Muscle[]).map((m) => [m, (sets[m] ?? 0) / Math.max(1, WEEKLY_RANGE[m][1])]))
  const sp = strengthProfile(workouts, profile.bodyweight)
  const last = workouts[workouts.length - 1]

  // Sıradaki rutin: en son kullanılan rutinin klasöründe sıradaki
  let next: Routine | undefined
  if (routines.length) {
    const lastR = last?.routineId ? routines.find((r) => r.id === last.routineId) : undefined
    const folder = routines.filter((r) => (r.folder ?? '') === (lastR?.folder ?? routines[0].folder ?? '')).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    const idx = lastR ? folder.findIndex((r) => r.id === lastR.id) : -1
    next = folder[(idx + 1) % folder.length]
  }
  const startNext = async () => {
    if (workout && !await ask('Devam eden bir antrenman var. Onu silip yenisini başlatayım mı?', { danger: true, ok: 'Yenisini başlat' })) return
    await startWorkout(next); onStarted()
  }
  const hello = new Date().getHours() < 12 ? 'Günaydın' : new Date().getHours() < 18 ? 'İyi günler' : 'İyi akşamlar'

  return (
    <div className="screen">
      <div className="screen-head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>{hello}</h1>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><h3>Bugünkü antrenman</h3>{last && <span className="muted tiny">son: {fmtDate(last.startedAt)}</span>}</div>
        {next ? (
          <>
            <h2>{next.name}</h2>
            <p className="muted small clamp">{next.exercises.map((e) => map.get(e.exerciseId)?.name).join(', ')}</p>
            <button className="btn primary" onClick={startNext}>Başlat</button>
          </>
        ) : (
          <>
            <p className="muted small">Henüz programın yok. Birkaç soruya cevap ver, kısıtlarına uygun program hazırlayalım.</p>
            <button className="btn primary" onClick={() => go('workout')}>Program oluştur</button>
          </>
        )}
      </div>

      <button className="card" onClick={() => go('food')}>
        <div className="card-title"><h3>Beslenme</h3><span className="link">Öğün ekle ›</span></div>
        <div className="macro-ring">
          <MacroRing eaten={total.kcal} target={t.kcal} />
          <MacroBars p={total.p} c={total.c} f={total.f} t={t} />
        </div>
      </button>

      <div className="stat-row">
        <div className="stat"><b>{thisWeek.length}</b><span>antrenman / 7 gün</span></div>
        <div className="stat"><b>{thisWeek.reduce((a, w) => a + workoutSetCount(w), 0)}</b><span>set / 7 gün</span></div>
        <div className="stat"><b>{fmtKg(thisWeek.reduce((a, w) => a + workoutVolume(w), 0) / 1000)}</b><span>ton hacim</span></div>
      </div>

      <button className="card" onClick={() => go('progress')}>
        <div className="card-title"><h3>Bu hafta çalışan kaslar</h3><span className="link">Detay ›</span></div>
        <BodyMap levels={levels} />
      </button>

      <button className="card" onClick={() => go('progress')}>
        <div className="card-title"><h3>Güç skoru</h3>{sp.covered > 0 && <span className="pill">{levelOf(sp.total)}</span>}</div>
        {sp.covered ? (
          <div className="row-between">
            <span className="score-big">{Math.round(sp.total)}</span>
            <span className="muted small" style={{ maxWidth: 180, textAlign: 'right' }}>En zayıf kalıp: <b>{[...sp.patterns].filter((p) => p.score).sort((a, b) => a.score - b.score)[0]?.name}</b></span>
          </div>
        ) : <p className="muted small">Temel hareketleri kaydettikçe kilona göre güç skorun hesaplanır.</p>}
      </button>

      <VersionFooter />
    </div>
  )
}
