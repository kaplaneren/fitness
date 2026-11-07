import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, getKV, setKV, type DiaryEntry, type Food, type Meal, type MealTemplate } from '../db'
import { BASE_FOODS, FOOD_CATEGORIES } from '../data/foods'
import { MEALS, fetchOffProduct, inPreview, normalizeTr, portion, searchOff } from '../lib/nutrition'
import { ask, notify } from '../components/Dialog'

type Tab = 'ara' | 'son' | 'barkod' | 'yeni' | 'tarif' | 'sablon'

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
    try { setOnline(await searchOff(q.trim())) } catch { notify(inPreview() ? 'Bu önizleme claude.ai içinde açılıyor ve claude.ai güvenlik nedeniyle dış sitelere bağlanmayı engelliyor. Uygulamayı kendi adresinden (Cloudflare Pages) açınca internet araması çalışır.' : 'Open Food Facts\'e ulaşılamadı. Bağlantını kontrol et ya da biraz sonra tekrar dene; servis bazen yavaş yanıt veriyor.') }
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
        <div className="chips">
          {([['ara', 'Ara'], ['son', 'Son'], ['sablon', 'Şablonlar'], ['barkod', 'Barkod'], ['tarif', 'Tarif'], ['yeni', 'Yeni ürün']] as const).map(([v, l]) => (
            <button key={v} className={`chip ${tab === v ? 'on' : ''}`} onClick={() => setTab(v)}>{l}</button>
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
                <button className="btn wrap-btn" disabled={busy} onClick={searchOnline}>{busy ? 'Aranıyor…' : `"${q}" için markalı ürünlerde ara (Open Food Facts)`}</button>
                {online && (online.length ? <FoodList foods={online} onPick={setPicked} /> : <p className="muted small">İnternette sonuç bulunamadı. "Yeni" sekmesinden etiketteki değerlerle ekleyebilirsin.</p>)}
              </div>
            )}
          </>
        )}
        {tab === 'son' && (recent.length ? <FoodList foods={recent.map((id) => map.get(id)).filter(Boolean) as Food[]} onPick={setPicked} /> : <p className="muted">Eklediğin yiyecekler burada çıkar.</p>)}
        {tab === 'barkod' && <Barcode onFound={setPicked} />}
        {tab === 'yeni' && <NewFood onSaved={setPicked} />}
        {tab === 'tarif' && <Recipe foods={list} onSaved={setPicked} />}
        {tab === 'sablon' && <Templates day={day} meal={meal} onAdded={onClose} />}
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
            <span className="muted tiny">{f.brand ? f.brand + ' · ' : ''}100 g: P {f.p} · K {f.c} · Y {f.f}{f.source === 'off' ? ' · OFF' : f.source === 'usda' ? ' · USDA' : f.source === 'user' ? ' · senin' : ''}</span>
          </div>
          <b className="mono small">{f.kcal}<span className="muted tiny"> kcal</span></b>
        </li>
      ))}
    </ul>
  )
}

/** Kayıtlı bir öğün girişinden 100 g değerlerini geri hesaplar (yiyecek listede yoksa). */
function foodFromEntry(e: DiaryEntry): Food {
  const k = 100 / Math.max(1, e.grams)
  return { id: e.foodId, name: e.name, kcal: Math.round(e.kcal * k), p: +(e.p * k).toFixed(1), c: +(e.c * k).toFixed(1), f: +(e.f * k).toFixed(1) }
}

/** Eklenmiş bir yemeği düzenleme: miktar, porsiyon, öğün, gün; kopyalama ve silme. */
export function EditEntrySheet({ entry, onClose }: { entry: DiaryEntry; onClose: () => void }) {
  const { map } = useAllFoods()
  const food = map.get(entry.foodId) ?? foodFromEntry(entry)
  return <AmountSheet food={food} day={entry.date} meal={entry.meal} entry={entry} onClose={onClose} onAdded={onClose} />
}

function AmountSheet({ food, day, meal, onClose, onAdded, entry }: { food: Food; day: string; meal: Meal; onClose: () => void; onAdded: () => void; entry?: DiaryEntry }) {
  const servings = food.servings ?? []
  // Düzenlemede mevcut porsiyonu etiketinden bul ("2 × 1 kase" gibi)
  const initServing = (() => {
    if (!entry) return servings.length ? 0 : -1
    if (!entry.label) return -1
    return servings.findIndex((x) => entry.label!.endsWith(x.label))
  })()
  const initCount = entry && initServing >= 0 ? Math.round((entry.grams / servings[initServing].g) * 2) / 2 || 1 : 1
  const [serving, setServing] = useState<number>(initServing)
  const [count, setCount] = useState(initCount)
  const [grams, setGrams] = useState(entry ? entry.grams : servings[0]?.g ?? 100)
  const [m, setM] = useState<Meal>(entry?.meal ?? meal)
  const [date, setDate] = useState(entry?.date ?? day)
  const g = serving >= 0 ? servings[serving].g * count : grams
  const v = portion(food, g)
  const label = serving >= 0 ? `${count !== 1 ? count + ' × ' : ''}${servings[serving].label}` : undefined
  const save = async () => {
    if (!entry) return add()
    await db.diary.update(entry.id!, { date, meal: m, grams: Math.round(g), label, ...v })
    onAdded()
  }
  const duplicate = async () => {
    if (!entry) return
    const { id: _id, ...rest } = entry
    await db.diary.add({ ...rest, date, meal: m, grams: Math.round(g), label, ...v, createdAt: Date.now() })
    notify('Kopyası eklendi.')
    onAdded()
  }
  const remove = async () => {
    if (entry && await ask('Bu kayıt silinsin mi?', { danger: true, ok: 'Sil' })) { await db.diary.delete(entry.id!); onAdded() }
  }
  const add = async () => {
    if (food.source === 'off' && !(await db.foods.get(food.id))) await db.foods.put(food)
    await db.diary.add({
      date: day, meal: m, foodId: food.id, name: food.brand ? `${food.name} (${food.brand})` : food.name, grams: Math.round(g),
      label, ...v, createdAt: Date.now()
    })
    onAdded()
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{entry ? entry.name : food.name}</h2>
        {food.brand && !entry && <p className="muted small">{food.brand}</p>}
        {entry && <p className="muted small">Şu an: {entry.label ?? `${entry.grams} g`} · {entry.kcal} kcal. Miktarı, öğünü veya günü değiştirebilirsin.</p>}
        {servings.length > 0 && (
          <div className="chips wrap">
            {servings.map((s, i) => <button key={i} className={`chip ${serving === i ? 'on' : ''}`} onClick={() => setServing(i)}>{s.label} · {s.g} g</button>)}
            <button className={`chip ${serving === -1 ? 'on' : ''}`} onClick={() => { setGrams(Math.round(g)); setServing(-1) }}>Gram</button>
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
          <>
            <label className="inline">Miktar <input id="amt-g" type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(+e.target.value || 0)} /> g</label>
            <div className="chips wrap">
              {[25, 50, 100, 150, 200, 250].map((x) => <button key={x} className={`chip ${grams === x ? 'on' : ''}`} onClick={() => setGrams(x)}>{x} g</button>)}
            </div>
          </>
        )}
        <div className="stat-row">
          <div className="stat"><b>{v.kcal}</b><span>kcal</span></div>
          <div className="stat"><b>{v.p}</b><span>protein</span></div>
          <div className="stat"><b>{v.c}</b><span>karb.</span></div>
          <div className="stat"><b>{v.f}</b><span>yağ</span></div>
        </div>
        <div className="fields">
          <label className="field" htmlFor="amt-meal">Öğün
            <select id="amt-meal" value={m} onChange={(e) => setM(e.target.value as Meal)}>
              {MEALS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          {entry && <label className="field" htmlFor="amt-date">Gün<input id="amt-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>}
        </div>
        {entry ? (
          <>
            <div className="dialog-actions">
              <button className="btn" onClick={onClose}>Vazgeç</button>
              <button className="btn primary" onClick={save}>Kaydet</button>
            </div>
            <div className="row">
              <button className="btn sm grow" onClick={duplicate}>Kopyasını ekle</button>
              <button className="btn sm grow danger" onClick={remove}>Sil</button>
            </div>
          </>
        ) : (
          <div className="dialog-actions">
            <button className="btn" onClick={onClose}>Vazgeç</button>
            <button className="btn primary" onClick={save}>Ekle</button>
          </div>
        )}
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
    } catch { setStatus(inPreview() ? 'Önizlemede (claude.ai) dış bağlantılar engelli; uygulamayı kendi adresinden açınca barkod araması çalışır.' : 'Open Food Facts\'e ulaşılamadı. Bağlantını kontrol edip tekrar dene.') }
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


function Recipe({ foods, onSaved }: { foods: Food[]; onSaved: (f: Food) => void }) {
  const [name, setName] = useState('')
  const [items, setItems] = useState<{ food: Food; g: number }[]>([])
  const [q, setQ] = useState('')
  const [cooked, setCooked] = useState('')
  const [portions, setPortions] = useState('4')
  const nq = normalizeTr(q.trim())
  const hits = nq.length > 1 ? foods.filter((f) => nq.split(/\s+/).every((w) => normalizeTr(`${f.name} ${f.brand ?? ''}`).includes(w))).slice(0, 8) : []
  const raw = items.reduce((a, i) => a + i.g, 0)
  const total = items.reduce((t, i) => { const v = portion(i.food, i.g); return { kcal: t.kcal + v.kcal, p: t.p + v.p, c: t.c + v.c, f: t.f + v.f } }, { kcal: 0, p: 0, c: 0, f: 0 })
  const weight = parseFloat(cooked.replace(',', '.')) || raw
  const n = Math.max(1, parseInt(portions) || 1)
  const per100 = (x: number) => Math.round((x / Math.max(1, weight)) * 1000) / 10
  const save = async () => {
    if (!name.trim() || !items.length) { notify('Tarif adı ve en az bir malzeme gir.'); return }
    const food: Food = {
      id: 'r_' + Date.now(), name: name.trim(), source: 'recipe', cat: 'Tariflerim',
      kcal: Math.round((total.kcal / weight) * 100), p: per100(total.p), c: per100(total.c), f: per100(total.f),
      servings: [{ label: '1 porsiyon', g: Math.round(weight / n) }, { label: 'Tamamı', g: Math.round(weight) }],
      ingredients: items.map((i) => ({ foodId: i.food.id, g: i.g }))
    }
    await db.foods.put(food)
    onSaved(food)
  }
  return (
    <div className="card">
      <p className="muted small">Malzemeleri çiğ gramajlarıyla ekle. Pişmiş toplam ağırlığı girersen 100 g değerleri ona göre hesaplanır.</p>
      <label className="field" htmlFor="rc-name">Tarif adı<input id="rc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Tavuklu bulgur pilavı" /></label>
      {items.map((it, i) => (
        <div key={i} className="row-between small" style={{ gap: 8 }}>
          <span className="grow ellipsis">{it.food.name}</span>
          <input className="num" style={{ width: 70 }} inputMode="decimal" value={it.g} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, g: parseFloat(e.target.value) || 0 } : x)))} aria-label="gram" />
          <span className="muted tiny">g</span>
          <button className="link muted" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Kaldır">✕</button>
        </div>
      ))}
      <input className="input" placeholder="Malzeme ara ve ekle" value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.length > 0 && (
        <ul className="list">
          {hits.map((f) => <li key={f.id} onClick={() => { setItems([...items, { food: f, g: f.servings?.[0]?.g ?? 100 }]); setQ('') }}><span className="title grow">{f.name}</span><span className="muted tiny">+ ekle</span></li>)}
        </ul>
      )}
      <div className="fields">
        <label className="field" htmlFor="rc-cooked">Pişmiş ağırlık (g)<input id="rc-cooked" inputMode="decimal" placeholder={String(Math.round(raw))} value={cooked} onChange={(e) => setCooked(e.target.value)} /></label>
        <label className="field" htmlFor="rc-por">Porsiyon sayısı<input id="rc-por" inputMode="numeric" value={portions} onChange={(e) => setPortions(e.target.value)} /></label>
      </div>
      {items.length > 0 && <p className="small">Toplam {Math.round(total.kcal)} kcal · P {Math.round(total.p)} g · porsiyon başı <b>{Math.round(total.kcal / n)} kcal</b>, {Math.round(total.p / n)} g protein.</p>}
      <button className="btn primary" onClick={save}>Tarifi kaydet ve ekle</button>
    </div>
  )
}

function Templates({ day, meal, onAdded }: { day: string; meal: Meal; onAdded: () => void }) {
  const list = useLiveQuery(() => getKV<MealTemplate[]>('mealTemplates', []), []) ?? []
  const add = async (t: MealTemplate) => {
    await db.diary.bulkAdd(t.items.map((i) => ({ ...i, date: day, meal, createdAt: Date.now() })))
    onAdded()
  }
  if (!list.length) return <p className="muted small">Henüz şablonun yok. Beslenme ekranında bir öğünü doldurduktan sonra "Şablon olarak kaydet" de; sık yediğin kahvaltıyı tek dokunuşla eklersin.</p>
  return (
    <ul className="list">
      {list.map((t) => {
        const kcal = t.items.reduce((a, i) => a + i.kcal, 0), p = t.items.reduce((a, i) => a + i.p, 0)
        return (
          <li key={t.id} onClick={() => add(t)}>
            <div className="stack grow" style={{ gap: 2 }}>
              <span className="title">{t.name}</span>
              <span className="muted tiny ellipsis">{t.items.map((i) => i.name).join(', ')}</span>
            </div>
            <b className="mono small">{Math.round(kcal)}<span className="muted tiny"> kcal · P {Math.round(p)}</span></b>
            <button className="link muted" aria-label="Şablonu sil" onClick={async (e) => {
              e.stopPropagation()
              if (await ask(`"${t.name}" şablonu silinsin mi?`, { danger: true, ok: 'Sil' })) await setKV('mealTemplates', list.filter((x) => x.id !== t.id))
            }}>✕</button>
          </li>
        )
      })}
    </ul>
  )
}
