import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, type Food, type Meal } from '../db'
import { BASE_FOODS, FOOD_CATEGORIES } from '../data/foods'
import { MEALS, fetchOffProduct, normalizeTr, portion, searchOff } from '../lib/nutrition'
import { notify } from '../components/Dialog'

type Tab = 'ara' | 'son' | 'barkod' | 'yeni'

export function useAllFoods() {
  const extra = useLiveQuery(() => db.foods.toArray(), []) ?? []
  return useMemo(() => {
    const list = [...extra, ...BASE_FOODS]
    return { list, map: new Map(list.map((f) => [f.id, f])) }
  }, [extra])
}

export default function FoodSearch({ day, meal, onClose }: { day: string; meal: Meal; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('ara')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)
  const [online, setOnline] = useState<Food[] | null>(null)
  const [busy, setBusy] = useState(false)
  const { list, map } = useAllFoods()
  const recent = useLiveQuery(async () => {
    const es = await db.diary.orderBy('createdAt').reverse().limit(200).toArray()
    const seen = new Set<string>(); const out: string[] = []
    for (const e of es) if (!seen.has(e.foodId)) { seen.add(e.foodId); out.push(e.foodId) }
    return out.slice(0, 40)
  }, []) ?? []

  const results = useMemo(() => {
    const nq = normalizeTr(q.trim())
    const words = nq.split(/\s+/).filter(Boolean)
    return list.filter((f) => (!cat || f.cat === cat) && words.every((w) => normalizeTr(`${f.name} ${f.brand ?? ''}`).includes(w))).slice(0, 120)
  }, [list, q, cat])

  const searchOnline = async () => {
    if (!q.trim()) return
    setBusy(true)
    try { setOnline(await searchOff(q.trim())) } catch { notify('İnternet aramasına ulaşılamadı. Bağlantını kontrol et; önizleme sürümünde internet araması kapalıdır.') }
    setBusy(false)
  }

  return (
    <div className="sheet">
      <div className="sheet-head">
        <button className="btn ghost" onClick={onClose}>Kapat</button>
        <strong>{MEALS.find((m) => m.id === meal)?.name}</strong>
        <span />
      </div>
      <div className="sheet-body">
        <div className="seg">
          {([['ara', 'Ara'], ['son', 'Son'], ['barkod', 'Barkod'], ['yeni', 'Yeni']] as const).map(([v, l]) => (
            <button key={v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>

        {tab === 'ara' && (
          <>
            <input id="food-q" className="input" placeholder={`${list.length} yiyecek içinde ara (ör. mercimek, yoğurt)`} value={q} onChange={(e) => { setQ(e.target.value); setOnline(null) }} />
            <div className="chips">
              <button className={`chip ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>Tümü</button>
              {FOOD_CATEGORIES.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>)}
            </div>
            <FoodList foods={results} onPick={setPicked} />
            {q.trim().length > 1 && (
              <div className="stack">
                <button className="btn" disabled={busy} onClick={searchOnline}>{busy ? 'Aranıyor…' : `"${q}" için markalı ürünlerde ara (Open Food Facts)`}</button>
                {online && (online.length ? <FoodList foods={online} onPick={setPicked} /> : <p className="muted small">İnternette sonuç bulunamadı. "Yeni" sekmesinden etiketteki değerlerle ekleyebilirsin.</p>)}
              </div>
            )}
          </>
        )}
        {tab === 'son' && (recent.length ? <FoodList foods={recent.map((id) => map.get(id)).filter(Boolean) as Food[]} onPick={setPicked} /> : <p className="muted">Eklediğin yiyecekler burada çıkar.</p>)}
        {tab === 'barkod' && <Barcode onFound={setPicked} />}
        {tab === 'yeni' && <NewFood onSaved={setPicked} />}
      </div>
      {picked && <AmountSheet food={picked} day={day} meal={meal} onClose={() => setPicked(null)} onAdded={onClose} />}
    </div>
  )
}

function FoodList({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  if (!foods.length) return <p className="muted small">Sonuç yok.</p>
  return (
    <ul className="list">
      {foods.map((f) => (
        <li key={f.id} onClick={() => onPick(f)}>
          <div className="stack grow" style={{ gap: 2 }}>
            <span className="title">{f.name}</span>
            <span className="muted tiny">{f.brand ? f.brand + ' · ' : ''}100 g: P {f.p} · K {f.c} · Y {f.f}{f.source === 'off' ? ' · OFF' : f.source === 'user' ? ' · senin' : ''}</span>
          </div>
          <b className="mono small">{f.kcal}<span className="muted tiny"> kcal</span></b>
        </li>
      ))}
    </ul>
  )
}

function AmountSheet({ food, day, meal, onClose, onAdded }: { food: Food; day: string; meal: Meal; onClose: () => void; onAdded: () => void }) {
  const servings = food.servings ?? []
  const [serving, setServing] = useState<number>(servings.length ? 0 : -1)
  const [count, setCount] = useState(1)
  const [grams, setGrams] = useState(servings[0]?.g ?? 100)
  const [m, setM] = useState<Meal>(meal)
  const g = serving >= 0 ? servings[serving].g * count : grams
  const v = portion(food, g)
  const add = async () => {
    if (food.source === 'off' && !(await db.foods.get(food.id))) await db.foods.put(food)
    await db.diary.add({
      date: day, meal: m, foodId: food.id, name: food.brand ? `${food.name} (${food.brand})` : food.name, grams: Math.round(g),
      label: serving >= 0 ? `${count !== 1 ? count + ' × ' : ''}${servings[serving].label}` : undefined,
      ...v, createdAt: Date.now()
    })
    onAdded()
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{food.name}</h2>
        {food.brand && <p className="muted small">{food.brand}</p>}
        {servings.length > 0 && (
          <div className="chips wrap">
            {servings.map((s, i) => <button key={i} className={`chip ${serving === i ? 'on' : ''}`} onClick={() => setServing(i)}>{s.label} · {s.g} g</button>)}
            <button className={`chip ${serving === -1 ? 'on' : ''}`} onClick={() => setServing(-1)}>Gram</button>
          </div>
        )}
        {serving >= 0 ? (
          <div className="row">
            <button className="icon-btn" onClick={() => setCount(Math.max(0.5, count - 0.5))}>−</button>
            <span className="num-d" style={{ fontSize: 26, minWidth: 50, textAlign: 'center' }}>{count}</span>
            <button className="icon-btn" onClick={() => setCount(count + 0.5)}>+</button>
            <span className="muted small">= {Math.round(g)} g</span>
          </div>
        ) : (
          <label className="inline">Miktar <input id="amt-g" type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(+e.target.value || 0)} /> g</label>
        )}
        <div className="stat-row">
          <div className="stat"><b>{v.kcal}</b><span>kcal</span></div>
          <div className="stat"><b>{v.p}</b><span>protein</span></div>
          <div className="stat"><b>{v.c}</b><span>karb.</span></div>
          <div className="stat"><b>{v.f}</b><span>yağ</span></div>
        </div>
        <select className="input" value={m} onChange={(e) => setM(e.target.value as Meal)}>
          {MEALS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" onClick={add}>Ekle</button>
        </div>
      </div>
    </div>
  )
}

function Barcode({ onFound }: { onFound: (f: Food) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<string>('')
  const [scanning, setScanning] = useState(false)
  const stopRef = useRef<() => void>(() => {})

  const lookup = async (c: string) => {
    c = c.trim(); if (!c) return
    const local = (await db.foods.where('barcode').equals(c).first())
    if (local) { onFound(local); return }
    setStatus('İnternette aranıyor…')
    try {
      const f = await fetchOffProduct(c)
      if (f) { setStatus(''); onFound(f) } else setStatus('Bu barkod veritabanında yok. "Yeni" sekmesinden etiketteki değerlerle ekleyebilirsin.')
    } catch { setStatus('İnternete ulaşılamadı. Barkodlu ürünleri aramak için bağlantı gerekiyor.') }
  }

  const start = async () => {
    setStatus(''); setScanning(true)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (res) => {
        if (res) { controls.stop(); setScanning(false); setCode(res.getText()); lookup(res.getText()) }
      })
      stopRef.current = () => controls.stop()
    } catch {
      setScanning(false)
      setStatus('Kameraya erişilemedi. Ana ekrana eklenmiş uygulamada kamera izni ver; önizleme sürümünde kamera kapalıdır. Barkodu elle de yazabilirsin.')
    }
  }
  useEffect(() => () => stopRef.current(), [])

  return (
    <div className="stack scanner">
      <video ref={video} muted playsInline hidden={!scanning} />
      {!scanning ? <button className="btn primary block" onClick={start}>Kamerayı aç</button> : <button className="btn block" onClick={() => { stopRef.current(); setScanning(false) }}>Durdur</button>}
      <div className="row">
        <input id="barcode" className="input grow" inputMode="numeric" placeholder="Barkod numarası" value={code} onChange={(e) => setCode(e.target.value)} style={{ marginBottom: 0 }} />
        <button className="btn" onClick={() => lookup(code)}>Bul</button>
      </div>
      {status && <p className="small muted">{status}</p>}
    </div>
  )
}

function NewFood({ onSaved }: { onSaved: (f: Food) => void }) {
  const [f, setF] = useState({ name: '', brand: '', kcal: '', p: '', c: '', f: '', serving: '', barcode: '' })
  const num = (s: string) => parseFloat(s.replace(',', '.'))
  const save = async () => {
    if (!f.name.trim() || Number.isNaN(num(f.kcal))) { notify('En az ürün adı ve 100 g kalorisini gir.'); return }
    const food: Food = {
      id: 'u_' + Date.now(), name: f.name.trim(), brand: f.brand.trim() || undefined, kcal: num(f.kcal),
      p: num(f.p) || 0, c: num(f.c) || 0, f: num(f.f) || 0, barcode: f.barcode.trim() || undefined, source: 'user',
      servings: num(f.serving) > 0 ? [{ label: '1 porsiyon', g: num(f.serving) }] : undefined
    }
    await db.foods.put(food)
    onSaved(food)
  }
  const inp = (k: keyof typeof f, label: string, mode: 'text' | 'decimal' | 'numeric' = 'decimal') => (
    <label className="field" htmlFor={`nf-${k}`}>{label}<input id={`nf-${k}`} inputMode={mode} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  )
  return (
    <div className="card">
      <p className="muted small">Paketin arkasındaki "100 g için" değerlerini gir.</p>
      <div className="fields">{inp('name', 'Ürün adı', 'text')}{inp('brand', 'Marka', 'text')}</div>
      <div className="fields">{inp('kcal', 'Kalori')}{inp('p', 'Protein')}{inp('c', 'Karbonhidrat')}{inp('f', 'Yağ')}</div>
      <div className="fields">{inp('serving', 'Porsiyon (g)')}{inp('barcode', 'Barkod', 'numeric')}</div>
      <button className="btn primary" onClick={save}>Kaydet ve ekle</button>
    </div>
  )
}
