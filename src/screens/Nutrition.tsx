import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, getKV, setKV, type DiaryEntry, type Meal } from '../db'
import { useProfile } from '../hooks'
import { MEALS, shiftDay, sumEntries, targets, todayKey } from '../lib/nutrition'
import FoodSearch from './FoodSearch'
import VersionFooter from '../components/VersionFooter'
import { Bars } from '../components/LineChart'
import { ask } from '../components/Dialog'

export function MacroRing({ eaten, target }: { eaten: number; target: number }) {
  const r = 52, c = 2 * Math.PI * r
  const pct = Math.min(1, eaten / Math.max(1, target))
  const over = eaten > target
  return (
    <div className="ring">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={over ? 'var(--danger)' : 'var(--accent)'} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${pct * c} ${c}`} />
      </svg>
      <div className="ring-label">
        <b>{Math.abs(Math.round(target - eaten))}</b>
        <span>{over ? 'kcal fazla' : 'kcal kaldı'}</span>
      </div>
    </div>
  )
}

export function MacroBars({ p, c, f, t }: { p: number; c: number; f: number; t: { protein: number; carbs: number; fat: number } }) {
  const rows = [
    { l: 'Protein', v: p, g: t.protein, col: 'var(--plate-red)' },
    { l: 'Karbonhidrat', v: c, g: t.carbs, col: 'var(--plate-yellow)' },
    { l: 'Yağ', v: f, g: t.fat, col: 'var(--plate-green)' }
  ]
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map((r) => (
        <div key={r.l} className="macro">
          <span>{r.l}</span><span className="mono">{Math.round(r.v)} / {r.g} g</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, (r.v / Math.max(1, r.g)) * 100)}%`, background: r.col }} /></div>
        </div>
      ))}
    </div>
  )
}

export default function NutritionScreen() {
  const [day, setDay] = useState(todayKey())
  const [adding, setAdding] = useState<Meal | null>(null)
  const [editEntry, setEditEntry] = useState<DiaryEntry | null>(null)
  const profile = useProfile()
  const t = targets(profile)
  const entries = useLiveQuery(() => db.diary.where('date').equals(day).sortBy('createdAt'), [day]) ?? []
  const water = useLiveQuery(() => getKV<number>('water:' + day, 0), [day]) ?? 0
  const week = useLiveQuery(async () => {
    const days = Array.from({ length: 7 }, (_, i) => shiftDay(day, i - 6))
    const all = await db.diary.where('date').anyOf(days).toArray()
    return days.map((d) => ({ d, kcal: Math.round(sumEntries(all.filter((e) => e.date === d)).kcal) }))
  }, [day]) ?? []
  const total = sumEntries(entries)
  const isToday = day === todayKey()
  const label = isToday ? 'Bugün' : day === shiftDay(todayKey(), -1) ? 'Dün' : new Date(day).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
  const logged = week.filter((w) => w.kcal > 0)
  const avg = logged.length ? Math.round(logged.reduce((a, w) => a + w.kcal, 0) / logged.length) : 0

  const copyYesterday = async (meal: Meal) => {
    const prev = await db.diary.where('date').equals(shiftDay(day, -1)).filter((e) => e.meal === meal).toArray()
    await db.diary.bulkAdd(prev.map(({ id: _id, ...e }) => ({ ...e, date: day, createdAt: Date.now() })))
  }
  const byMeal = useMemo(() => Object.fromEntries(MEALS.map((m) => [m.id, entries.filter((e) => e.meal === m.id)])), [entries])

  return (
    <div className="screen">
      <div className="screen-head"><h1>Beslenme</h1></div>
      <div className="date-nav">
        <button className="icon-btn" aria-label="Önceki gün" onClick={() => setDay(shiftDay(day, -1))}>‹</button>
        <strong>{label}</strong>
        <button className="icon-btn" aria-label="Sonraki gün" disabled={isToday} style={{ opacity: isToday ? 0.3 : 1 }} onClick={() => setDay(shiftDay(day, 1))}>›</button>
      </div>

      <div className="card">
        <div className="macro-ring">
          <MacroRing eaten={total.kcal} target={t.kcal} />
          <div className="stack">
            <div className="row-between small"><span className="muted">Alınan</span><b className="mono">{Math.round(total.kcal)} kcal</b></div>
            <div className="row-between small"><span className="muted">Hedef</span><b className="mono">{t.kcal} kcal</b></div>
            <MacroBars p={total.p} c={total.c} f={total.f} t={t} />
          </div>
        </div>
      </div>

      {MEALS.map((m) => {
        const list = byMeal[m.id] ?? []
        const s = sumEntries(list)
        return (
          <div key={m.id} className="card">
            <div className="meal-head">
              <h3>{m.name}</h3>
              <span className="muted small mono">{Math.round(s.kcal)} kcal · P {Math.round(s.p)} g</span>
            </div>
            {list.map((e) => (
              <button key={e.id} className="food-row" onClick={() => setEditEntry(e)} style={{ textAlign: 'left' }}>
                <div className="stack grow" style={{ gap: 1 }}>
                  <span className="ellipsis">{e.name}</span>
                  <span className="muted tiny">{e.label ?? `${e.grams} g`} · P {e.p} · K {e.c} · Y {e.f}</span>
                </div>
                <b className="mono small">{e.kcal}</b>
              </button>
            ))}
            <div className="row">
              <button className="btn sm primary" onClick={() => setAdding(m.id)}>+ Ekle</button>
              {list.length === 0 && <button className="btn sm" onClick={() => copyYesterday(m.id)}>Dünküyü kopyala</button>}
            </div>
          </div>
        )
      })}

      <div className="card">
        <div className="card-title"><h3>Su</h3><span className="muted small mono">{water} / {profile.waterTarget} bardak · {(water * 0.2).toFixed(1)} L</span></div>
        <div className="water">
          {Array.from({ length: Math.max(profile.waterTarget, water) }, (_, i) => (
            <button key={i} className={`glass ${i < water ? 'full' : ''}`} aria-label={`${i + 1}. bardak`} onClick={() => setKV('water:' + day, i < water ? i : i + 1)} />
          ))}
        </div>
      </div>

      {logged.length > 0 && (
        <div className="card">
          <div className="card-title"><h3>Son 7 gün</h3><span className="muted small">ortalama {avg} kcal</span></div>
          <Bars values={week.map((w) => w.kcal)} labels={week.map((w) => new Date(w.d).toLocaleDateString('tr-TR', { weekday: 'short' }))} />
          <p className="muted tiny">Hedef {t.kcal} kcal. Kayıt girilen {logged.length} günün ortalaması {avg > t.kcal ? `${avg - t.kcal} kcal fazla` : `${t.kcal - avg} kcal altında`}.</p>
        </div>
      )}

      <VersionFooter />
      {adding && <FoodSearch day={day} meal={adding} onClose={() => setAdding(null)} />}
      {editEntry && (
        <div className="modal" onClick={() => setEditEntry(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{editEntry.name}</h2>
            <p className="small">{editEntry.label ?? `${editEntry.grams} g`} · {editEntry.kcal} kcal · P {editEntry.p} g · K {editEntry.c} g · Y {editEntry.f} g</p>
            <div className="dialog-actions">
              <button className="btn danger" onClick={async () => { if (await ask('Bu kayıt silinsin mi?', { danger: true, ok: 'Sil' })) { await db.diary.delete(editEntry.id!); setEditEntry(null) } }}>Sil</button>
              <button className="btn" onClick={() => setEditEntry(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
