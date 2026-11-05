import { useLiveQuery } from 'dexie-react-hooks'
import { db, getKV, setKV } from '../db'

// Mezosiklus (blok periyotlama): N hafta yükleme + 1 hafta planlı deload, sonra döngü kendiliğinden yeniden başlar.
// Yükleme haftalarında hedef RIR (yedekte kalan tekrar) haftadan haftaya azalır: zorluk kademeli artar.

export interface Meso { start: number; load: number }

const DAY = 86400000
const WEEK = 7 * DAY

/** Verilen zamanın içinde bulunduğu haftanın pazartesisi, 00:00. */
export function mondayOf(t = Date.now()) {
  const d = new Date(t); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

const RIR: Record<number, string[]> = {
  3: ['3', '2', '1'],
  4: ['3', '2', '1-2', '0-1'],
  5: ['3', '3', '2', '1', '0-1']
}

export interface MesoState {
  cycle: number; week: number; total: number; deload: boolean
  rir: string; title: string; text: string; daysLeft: number
}

export function mesoState(m: Meso | null | undefined, now = Date.now()): MesoState | null {
  if (!m) return null
  const total = m.load + 1
  const elapsed = Math.max(0, Math.floor((mondayOf(now) - mondayOf(m.start)) / WEEK))
  const cycle = Math.floor(elapsed / total) + 1
  const week = (elapsed % total) + 1
  const deload = week === total
  const daysLeft = Math.ceil((mondayOf(now) + WEEK - now) / DAY)
  if (deload) return {
    cycle, week, total, deload, rir: '3-4', daysLeft,
    title: 'Deload haftası',
    text: 'Planlı toparlanma haftası: önerilen ağırlıklar %10, set sayıları %40 azaltıldı. Setleri 3-4 tekrar yedekte bitir. Gelecek hafta yeni döngü başlıyor.'
  }
  const rir = (RIR[m.load] ?? RIR[4])[week - 1] ?? '1'
  const last = week === m.load
  return {
    cycle, week, total, deload, rir, daysLeft,
    title: `Yükleme haftası ${week}/${m.load}`,
    text: week === 1
      ? `Döngünün başı: setleri ${rir} tekrar yedekte bitir. Ağırlıklar rahat hissettirmeli.`
      : last
        ? `Döngünün en zor haftası: setleri ${rir} tekrar yedekte bitir. Sonraki hafta deload.`
        : `Setleri ${rir} tekrar yedekte bitir. Tekrar aralığının üstüne çıktığın harekette ağırlığı artır.`
  }
}

export const getMeso = () => getKV<Meso | null>('meso', null)
export const setMeso = (m: Meso | null) => setKV('meso', m)
export const startMeso = (load: number) => setMeso({ start: mondayOf(), load })

export function useMeso() {
  const row = useLiveQuery(() => db.kv.get('meso'), [])
  const m = (row?.value as Meso | null | undefined) ?? null
  return { meso: m, state: mesoState(m) }
}
