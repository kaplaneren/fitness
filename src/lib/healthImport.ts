import { db, getProfile, setKV } from '../db'
import { todayKey } from './nutrition'

/**
 * iPhone Kısayollar ile Apple Sağlık verisi: Kısayol, uygulamayı şu adresle açar:
 *   https://<site>/?w=80.2&steps=8500&sleep=7.2&kcal=520&date=2026-11-04
 * w: kilo (kg), steps: adım, sleep: uyku (saat), kcal: Sağlık'taki aktif enerji (bilgi amaçlı), date: gün (boşsa bugün).
 */
export async function importFromUrl(): Promise<string | null> {
  const p = new URLSearchParams(location.search)
  const keys = ['w', 'steps', 'sleep', 'kcal']
  if (!keys.some((k) => p.has(k))) return null
  const num = (k: string) => { const v = parseFloat((p.get(k) ?? '').replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : undefined }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.get('date') ?? '') ? p.get('date')! : todayKey()
  const w = num('w'), steps = num('steps'), sleep = num('sleep'), kcal = num('kcal')
  const done: string[] = []
  if (w && w > 30 && w < 250) {
    const [y, m, d] = date.split('-').map(Number)
    const t = date === todayKey() ? Date.now() : new Date(y, m - 1, d, 8).getTime()
    await db.measurements.add({ date: t, weight: w })
    if (date === todayKey()) await setKV('profile', { ...(await getProfile()), bodyweight: w })
    done.push(`kilo ${w} kg`)
  }
  if (steps || sleep) {
    const c = (await db.checkins.get(date)) ?? { date }
    await db.checkins.put({ ...c, ...(steps ? { steps: Math.round(steps) } : {}), ...(sleep ? { sleepHours: Math.round(sleep * 10) / 10 } : {}) })
    if (steps) done.push(`${Math.round(steps)} adım`)
    if (sleep) done.push(`${sleep.toFixed(1)} saat uyku`)
  }
  if (kcal) { await setKV('healthKcal:' + date, Math.round(kcal)); done.push(`${Math.round(kcal)} kcal aktif enerji`) }
  history.replaceState(null, '', location.pathname + location.hash)
  return done.length ? `Apple Sağlık'tan alındı: ${done.join(', ')}.` : null
}
