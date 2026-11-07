import type { DiaryEntry, Food, Profile } from '../db'

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function shiftDay(key: string, delta: number) {
  const [y, m, d] = key.split('-').map(Number)
  return todayKey(new Date(y, m - 1, d + delta))
}

/** Adım başına net kalori ≈ 0,00045 × kilo (80 kg için 7500 adım ≈ 270 kcal). */
export const stepKcal = (steps: number, kg: number) => Math.round(steps * kg * 0.00045)

export interface DayContext {
  /** O gün antrenmanla yakılan aktif kalori (biliniyorsa) */
  burn?: number
  /** O günkü gerçek adım sayısı (Sağlık'tan geldiyse) */
  steps?: number
  /** O gün antrenman günü mü */
  training?: boolean
}

/** Mifflin-St Jeor bazal metabolizma + adım + antrenman kalorisi ile günlük harcama ve hedefler. */
export function targets(p: Profile, day: DayContext = {}) {
  const bmr = 10 * p.bodyweight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161)
  const base = bmr * 1.2
  const steps = stepKcal(day.steps ?? p.steps, p.bodyweight)
  // Ortalama antrenman günü 1 saat ağırlık antrenmanı varsayılır
  const avgTraining = (p.weeklyTarget * p.kcalWeights) / 7
  const training = day.burn != null ? day.burn : avgTraining
  // Gerçek harcama: bazal + günlük yaşam + adım + antrenman
  const tdee = base + steps + training
  // Varsayılan: yakılan kalori diyete eklenmez, hedef bazal + günlük yaşam üzerinden kurulur; adım ve antrenman ekstra açıktır.
  const eatBase = p.eatBack ? tdee : base
  const adj = p.goal === 'cut' ? -450 : p.goal === 'bulk' ? 250 : 0
  let kcal = p.kcalTarget || Math.round((eatBase + adj) / 10) * 10
  // Karbonhidrat döngüsü: antrenman günü +200 kcal karbonhidrat, dinlenme günleri haftalık dengeyi korur
  let cycle = 0
  if (p.carbCycling && !p.eatBack && day.training != null) {
    const w = Math.min(6, Math.max(1, p.weeklyTarget))
    cycle = day.training ? 200 : -Math.round((200 * w) / (7 - w))
    kcal += cycle
  }
  const protein = p.proteinTarget || Math.round(p.bodyweight * (p.goal === 'cut' ? 2.1 : 1.8))
  const fat = p.fatTarget || Math.round(p.bodyweight * 0.8)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  const deficit = Math.round(tdee - kcal)
  return { bmr: Math.round(bmr), base: Math.round(base), steps, training: Math.round(training), tdee: Math.round(tdee), kcal, protein, fat, carbs, cycle, deficit, weeklyKg: Math.round((deficit * 7 / 7700) * 100) / 100 }
}

export function portion(food: Food, grams: number) {
  const k = grams / 100
  const r = (x: number) => Math.round(x * k * 10) / 10
  return { kcal: Math.round(food.kcal * k), p: r(food.p), c: r(food.c), f: r(food.f) }
}

export function sumEntries(es: DiaryEntry[]) {
  return es.reduce((t, e) => ({ kcal: t.kcal + e.kcal, p: t.p + e.p, c: t.c + e.c, f: t.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 })
}

export const MEALS = [
  { id: 'kahvalti', name: 'Kahvaltı' },
  { id: 'ogle', name: 'Öğle' },
  { id: 'aksam', name: 'Akşam' },
  { id: 'ara', name: 'Ara öğün' }
] as const

export function normalizeTr(s: string) {
  return s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
}

/** claude.ai önizlemesinde mi çalışıyoruz? Orada dış internete bağlantı tarayıcı tarafından engellenir. */
export const inPreview = () => /claude\.ai$|claudeusercontent\.com$/.test(location.hostname) || (() => { try { return window.top !== window.self && /claude\.ai/.test(document.referrer) } catch { return true } })()

const OFF_FIELDS = 'code,product_name,product_name_tr,brands,nutriments,serving_quantity,serving_size'

/** Zaman aşımlı fetch: Open Food Facts bazen çok yavaş yanıt verir, sonsuza kadar beklemeyelim. */
async function getJson(url: string, ms = 9000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally { clearTimeout(t) }
}

/** Open Food Facts'ten barkodla ürün getirir (telefonda internet varken). */
export async function fetchOffProduct(barcode: string): Promise<Food | null> {
  const code = encodeURIComponent(barcode)
  let j
  try { j = await getJson(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`) } catch (e) {
    // Yedek: Türkiye alt alan adı aynı veritabanına gider
    j = await getJson(`https://tr.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`).catch(() => { throw e })
  }
  return j?.product ? offToFood(j.product) : null
}

/** Ürün adıyla arama. Önce yeni arama servisi (hızlı), sonuç yoksa veya hata verirse eski arama. */
export async function searchOff(q: string): Promise<Food[]> {
  const term = encodeURIComponent(q)
  let firstErr: unknown = null
  try {
    const j = await getJson(`https://search.openfoodfacts.org/search?q=${term}&page_size=30&langs=tr,en&fields=${OFF_FIELDS}`)
    const foods = (j?.hits ?? []).map(offToFood).filter(Boolean) as Food[]
    if (foods.length) return foods
  } catch (e) { firstErr = e }
  try {
    const j = await getJson(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${term}&search_simple=1&json=1&page_size=30&countries_tags_en=turkey&fields=${OFF_FIELDS}`, 15000)
    return (j?.products ?? []).map(offToFood).filter(Boolean) as Food[]
  } catch (e) { throw firstErr ?? e }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function offToFood(p: any): Food | null {
  const n = p.nutriments ?? {}
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : undefined)
  const pick = (v: unknown) => (typeof v === 'string' ? v : v && typeof v === 'object' ? Object.values(v as Record<string, string>)[0] : undefined)
  const name = pick(p.product_name_tr) || pick(p.product_name)
  if (kcal == null || !name) return null
  const sq = Number(p.serving_quantity)
  return {
    id: 'off_' + p.code, barcode: p.code, name, brand: (Array.isArray(p.brands) ? p.brands.join(',') : p.brands || '').split(',')[0]?.trim() || undefined,
    kcal: Math.round(kcal), p: +(n.proteins_100g ?? 0), c: +(n.carbohydrates_100g ?? 0), f: +(n.fat_100g ?? 0), fiber: n.fiber_100g,
    servings: sq > 0 ? [{ label: p.serving_size || `1 porsiyon`, g: sq }] : undefined,
    source: 'off'
  }
}
