import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, DEFAULT_PROFILE, allExercises, type Profile, type Workout } from './db'
import type { Exercise } from './data/exercises'
import { dayBurn } from './lib/health'
import { targets } from './lib/nutrition'

export function useProfile(): Profile {
  const row = useLiveQuery(() => db.kv.get('profile'), [])
  return { ...DEFAULT_PROFILE, ...((row?.value as Partial<Profile>) ?? {}) }
}

export function useExercises() {
  const custom = useLiveQuery(() => db.customExercises.toArray(), []) ?? []
  return useMemo(() => {
    const list = allExercises(custom)
    const map = new Map<string, Exercise>(list.map((e) => [e.id, e]))
    return { list, map }
  }, [custom])
}

export function useActiveWorkout() {
  const row = useLiveQuery(async () => (await db.kv.get('active')) ?? null, [], 'loading' as const)
  return { loaded: row !== 'loading', workout: row && row !== 'loading' ? (row.value as Workout) : null }
}

export function useNow(interval = 1000, enabled = true) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!enabled) return
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [interval, enabled])
  return now
}

/** Antrenman sırasında ekranın kapanmasını engeller (iOS 16.4+). */
export function useWakeLock(enabled: boolean) {
  const lock = useRef<WakeLockSentinel | null>(null)
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let cancelled = false
    const req = () => navigator.wakeLock.request('screen').then((l) => { if (cancelled) l.release(); else lock.current = l }).catch(() => {})
    req()
    const onVis = () => { if (document.visibilityState === 'visible') req() }
    document.addEventListener('visibilitychange', onVis)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVis); lock.current?.release().catch(() => {}) }
  }, [enabled])
}

let audio: AudioContext | null = null
export function unlockAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') audio.resume()
  } catch { /* yok */ }
}
export function beep(times = 3) {
  if (!audio) return
  for (let i = 0; i < times; i++) {
    const o = audio.createOscillator(), g = audio.createGain()
    const t = audio.currentTime + i * 0.35
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    o.connect(g).connect(audio.destination)
    o.start(t); o.stop(t + 0.3)
  }
  navigator.vibrate?.(300)
}

/** Bir günün yakılan kalorisi ve o güne göre beslenme hedefleri. */
export function useDayEnergy(day: string) {
  const profile = useProfile()
  const { map } = useExercises()
  const { workout } = useActiveWorkout()
  const ws = useLiveQuery(() => {
    const [y, m, d] = day.split('-').map(Number)
    const s = new Date(y, m - 1, d).getTime()
    return db.workouts.where('startedAt').between(s, s + 86400000).toArray()
  }, [day]) ?? []
  const checkin = useLiveQuery(() => db.checkins.get(day), [day])
  const healthKcal = useLiveQuery(async () => ((await db.kv.get('healthKcal:' + day))?.value as number | undefined) ?? null, [day]) ?? null
  useNow(60000, !!workout)
  const burn = dayBurn(day, ws, map, profile, workout)
  const training = burn.parts.length > 0
  const t = targets(profile, { burn: burn.kcal, steps: checkin?.steps, training })
  return { profile, burn, t, steps: checkin?.steps ?? null, training, healthKcal }
}

/** Dinlenme bitti uyarısı: ses + titreşim (Android) + uygulama arka plandaysa bildirim (izin verildiyse). */
export function restDone() {
  beep()
  try { navigator.vibrate?.([250, 120, 250]) } catch { /* yok */ }
  if (typeof document !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const opts = { body: 'Sıradaki sete geçebilirsin.', tag: 'rest', icon: './apple-touch-icon.png' }
    navigator.serviceWorker?.ready.then((r) => r.showNotification('Dinlenme bitti', opts)).catch(() => { try { new Notification('Dinlenme bitti', opts) } catch { /* yok */ } })
  }
}
