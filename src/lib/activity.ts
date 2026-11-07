import type { Profile, Workout } from '../db'

// Salon dışı aktiviteler (tenis, yüzme, koşu, yürüyüş...). Kalori: MET değerleri 2011/2024 Compendium of Physical Activities'ten.
// Brüt harcama = MET × 3,5 ml/kg/dk × kilo / 200 (kcal/dk). Aktif kalori = brüt − dinlenme metabolizması
// (Mifflin-St Jeor BMR / 1440: yaş, boy, kilo ve cinsiyetten). Böylece yaş ve cinsiyet de hesaba girer.
// Koşu ve yürüyüşte mesafe girilirse MET hızdan ACSM denklemiyle, bisiklette hız aralığından bulunur.

export type Intensity = 'hafif' | 'orta' | 'yogun'
export interface ActivityInfo { type: string; min: number; intensity: Intensity; km?: number }

export interface ActivityDef { id: string; name: string; met: [number, number, number]; hint: [string, string, string]; distance?: boolean }

export const ACTIVITIES: ActivityDef[] = [
  { id: 'walk', name: 'Yürüyüş', met: [3.0, 3.5, 5.0], hint: ['yavaş, ~4 km/sa', 'normal, ~5 km/sa', 'tempolu, 6+ km/sa'], distance: true },
  { id: 'run', name: 'Koşu', met: [7.0, 9.8, 11.5], hint: ['hafif tempo, ~8 km/sa', '~10 km/sa', '12+ km/sa'], distance: true },
  { id: 'swim', name: 'Yüzme', met: [5.8, 8.3, 10.0], hint: ['rahat, molalı', 'sürekli serbest stil', 'hızlı, antrenman'], distance: true },
  { id: 'tennis', name: 'Tenis', met: [5.0, 7.3, 8.0], hint: ['çiftler / top çalışması', 'genel oyun', 'tekler, maç'] },
  { id: 'padel', name: 'Padel', met: [5.0, 6.5, 7.5], hint: ['rahat', 'genel oyun', 'maç'] },
  { id: 'cycle', name: 'Bisiklet (dış)', met: [4.0, 6.8, 10.0], hint: ['gezinti, <16 km/sa', '16-19 km/sa', '22+ km/sa'], distance: true },
  { id: 'hike', name: 'Doğa yürüyüşü', met: [5.3, 6.0, 7.8], hint: ['düz parkur', 'inişli çıkışlı', 'dik / sırt çantalı'], distance: true },
  { id: 'football', name: 'Futbol', met: [6.0, 7.0, 10.0], hint: ['top çevirme', 'halı saha', 'maç'] },
  { id: 'basketball', name: 'Basketbol', met: [4.5, 6.5, 8.0], hint: ['şut çalışması', 'genel oyun', 'maç'] },
  { id: 'volleyball', name: 'Voleybol', met: [3.0, 4.0, 6.0], hint: ['rahat', 'genel oyun', 'maç / plaj'] },
  { id: 'badminton', name: 'Badminton', met: [4.5, 5.5, 7.0], hint: ['rahat', 'genel oyun', 'maç'] },
  { id: 'tabletennis', name: 'Masa tenisi', met: [3.0, 4.0, 5.0], hint: ['rahat', 'genel oyun', 'maç'] },
  { id: 'squash', name: 'Squash', met: [6.0, 7.3, 12.0], hint: ['rahat', 'genel oyun', 'maç'] },
  { id: 'boxing', name: 'Boks / kickboks', met: [5.5, 7.8, 10.0], hint: ['kum torbası', 'antrenman', 'sparring'] },
  { id: 'martial', name: 'Dövüş sanatları', met: [5.3, 7.0, 10.3], hint: ['teknik', 'genel', 'yoğun'] },
  { id: 'climb', name: 'Tırmanış', met: [5.0, 5.8, 8.0], hint: ['bouldering, rahat', 'genel', 'zor rota'] },
  { id: 'yoga', name: 'Yoga', met: [2.3, 2.8, 4.0], hint: ['esneme', 'hatha', 'power / vinyasa'] },
  { id: 'pilates', name: 'Pilates', met: [2.8, 3.0, 3.8], hint: ['rahat', 'genel', 'yoğun / reformer'] },
  { id: 'dance', name: 'Dans', met: [3.0, 5.0, 7.3], hint: ['yavaş', 'genel', 'aerobik / zumba'] },
  { id: 'rope', name: 'İp atlama', met: [8.8, 11.8, 12.3], hint: ['yavaş', 'orta', 'hızlı'] },
  { id: 'ski', name: 'Kayak / snowboard', met: [4.3, 5.3, 8.0], hint: ['rahat', 'genel', 'yarış / zor pist'] },
  { id: 'skate', name: 'Paten', met: [5.0, 7.0, 9.8], hint: ['rahat', 'genel', 'hızlı'] },
  { id: 'row_out', name: 'Kano / kürek (dış)', met: [3.5, 5.8, 12.0], hint: ['gezinti', 'genel', 'yarış'] },
  { id: 'other', name: 'Diğer', met: [3.5, 5.5, 8.0], hint: ['hafif', 'orta', 'yoğun'] }
]
export const activityDef = (id: string) => ACTIVITIES.find((a) => a.id === id) ?? ACTIVITIES[ACTIVITIES.length - 1]
const IDX: Record<Intensity, number> = { hafif: 0, orta: 1, yogun: 2 }

/** Kullanılan MET ve nereden geldiği. */
export function activityMet(a: ActivityInfo): { met: number; from: string } {
  const def = activityDef(a.type)
  if (a.km && a.min > 0) {
    const kmh = a.km / (a.min / 60)
    const mpm = (kmh * 1000) / 60
    if (a.type === 'run' && kmh >= 6) return { met: (3.5 + 0.2 * mpm) / 3.5, from: `${kmh.toFixed(1)} km/sa hızdan` }
    if (a.type === 'walk' && kmh < 8) return { met: (3.5 + 0.1 * mpm) / 3.5, from: `${kmh.toFixed(1)} km/sa hızdan` }
    if (a.type === 'cycle') return { met: kmh < 16 ? 4 : kmh < 19 ? 6.8 : kmh < 22 ? 8 : kmh < 25 ? 10 : kmh < 30 ? 12 : 15.8, from: `${kmh.toFixed(1)} km/sa hızdan` }
  }
  return { met: def.met[IDX[a.intensity]], from: `${def.name.toLowerCase()}, ${a.intensity === 'yogun' ? 'yoğun' : a.intensity}` }
}

export function bmr(p: Pick<Profile, 'sex' | 'age' | 'height'>, kg: number) {
  return 10 * kg + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161)
}

/** Aktif kalori (dinlenme düşülmüş). */
export function activityKcal(a: ActivityInfo, profile: Profile, kg = profile.bodyweight) {
  const { met } = activityMet(a)
  const gross = (met * 3.5 * kg) / 200
  return Math.max(0, Math.round((gross - bmr(profile, kg) / 1440) * a.min))
}

export const isActivity = (w: Workout) => !!w.activity
