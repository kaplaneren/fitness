import { ask, notify } from '../components/Dialog'
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportBackup, getProfile, importBackup, setKV, type Profile } from '../db'
import { FLAG_INFO, type Flag } from '../data/exercises'
import { useExercises, useProfile } from '../hooks'
import { diaryCsv, importStrong, shareFile, workoutsCsv } from '../lib/csv'
import { fmtDate } from '../lib/calc'
import { targets } from '../lib/nutrition'
import VersionFooter from '../components/VersionFooter'

function Num({ id, label, value, onChange, step }: { id: string; label: string; value?: number; onChange: (v: number | undefined) => void; step?: string }) {
  return (
    <label className="field" htmlFor={id}>{label}
      <input id={id} type="number" inputMode="decimal" step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} />
    </label>
  )
}

export default function ProfileScreen() {
  const profile = useProfile()
  const fileRef = useRef<HTMLInputElement>(null)
  const strongRef = useRef<HTMLInputElement>(null)
  const [supp, setSupp] = useState('')
  const { map, list } = useExercises()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const count = useLiveQuery(() => db.workouts.count(), []) ?? 0
  const t = targets(profile)

  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => {}) }, [])

  const update = async (patch: Partial<Profile>) => setKV('profile', { ...(await getProfile()), ...patch })
  const toggleFlag = (f: Flag) => update({ restrictions: profile.restrictions.includes(f) ? profile.restrictions.filter((x) => x !== f) : [...profile.restrictions, f] })

  const doExport = async () => {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const name = `form-yedek-${new Date().toISOString().slice(0, 10)}.json`
    const file = new File([blob], name, { type: 'application/json' })
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name })
      else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob); a.download = name; a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      }
      await update({ lastBackup: Date.now() })
    } catch { /* paylaşım iptal edildi */ }
  }
  const doImport = async (f: File) => {
    try {
      const json = JSON.parse(await f.text())
      if (!await ask('Telefondaki mevcut verilerin tamamı yedektekiyle değiştirilecek.', { title: 'Yedek geri yüklensin mi?', danger: true, ok: 'Geri yükle' })) return
      await importBackup(json)
      notify('Yedek geri yüklendi.')
    } catch (e) { notify((e as Error).message || 'Dosya okunamadı. Form uygulamasından alınmış bir .json yedeği seç.') }
  }
  const backupAge = profile.lastBackup ? Math.floor((Date.now() - profile.lastBackup) / 86400000) : null

  return (
    <div className="screen">
      <div className="screen-head"><h1>Profil</h1></div>

      <div className="card">
        <h3>Ölçüler</h3>
        <div className="fields">
          <Num id="p-bw" label="Kilo (kg)" value={profile.bodyweight} step="0.1" onChange={(v) => update({ bodyweight: v ?? 0 })} />
          <Num id="p-h" label="Boy (cm)" value={profile.height} onChange={(v) => update({ height: v ?? 0 })} />
          <Num id="p-age" label="Yaş" value={profile.age} onChange={(v) => update({ age: v ?? 0 })} />
          <Num id="p-tw" label="Hedef kilo (kg)" value={profile.targetWeight} step="0.1" onChange={(v) => update({ targetWeight: v })} />
          <Num id="p-wt" label="Haftalık antrenman hedefi" value={profile.weeklyTarget} onChange={(v) => update({ weeklyTarget: v ?? 3 })} />
        </div>
        <div className="seg">
          <button className={profile.sex === 'm' ? 'on' : ''} onClick={() => update({ sex: 'm' })}>Erkek</button>
          <button className={profile.sex === 'f' ? 'on' : ''} onClick={() => update({ sex: 'f' })}>Kadın</button>
        </div>
      </div>

      <div className="card">
        <h3>Beslenme hedefi</h3>
        <div className="seg">
          <button className={profile.goal === 'cut' ? 'on' : ''} onClick={() => update({ goal: 'cut' })}>Yağ yakımı</button>
          <button className={profile.goal === 'maintain' ? 'on' : ''} onClick={() => update({ goal: 'maintain' })}>Koruma</button>
          <button className={profile.goal === 'bulk' ? 'on' : ''} onClick={() => update({ goal: 'bulk' })}>Kas kazanımı</button>
        </div>
        <div className="fields">
          <Num id="p-steps" label="Günlük adım" value={profile.steps} onChange={(v) => update({ steps: v ?? 0 })} />
          <Num id="p-kw" label="Ağırlık (kcal/saat)" value={profile.kcalWeights} onChange={(v) => update({ kcalWeights: v ?? 0 })} />
          <Num id="p-kc" label="Kardiyo (kcal/saat)" value={profile.kcalCardio} onChange={(v) => update({ kcalCardio: v ?? 0 })} />
        </div>
        <p className="small">Bazal metabolizma <b>{t.bmr}</b> + günlük yaşam <b>{t.base - t.bmr}</b> + {profile.steps.toLocaleString('tr-TR')} adım <b>{t.steps}</b> + antrenman ortalaması <b>{t.training}</b> = günlük harcama ≈ <b>{t.tdee}</b> kcal → hedef <b>{t.kcal}</b> kcal, <b>{t.protein}</b> g protein, <b>{t.carbs}</b> g karbonhidrat, <b>{t.fat}</b> g yağ.</p>
        <p className="muted tiny">Adım kalorisi kilona göre hesaplanır (adım başına ≈ {(profile.bodyweight * 0.00045).toFixed(3)} kcal). Antrenman ortalaması: haftada {profile.weeklyTarget} × 1 saat × {profile.kcalWeights} kcal ÷ 7.</p>
        <label className="toggle">
          <input type="checkbox" checked={profile.eatBack} onChange={() => update({ eatBack: !profile.eatBack })} />
          <span>Hedefi her gün gerçek antrenmana göre ayarla (yakılanı o günün hedefine ekle, ortalamayı kullanma)</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={profile.carbCycling} disabled={profile.eatBack} onChange={() => update({ carbCycling: !profile.carbCycling })} />
          <span>Karbonhidrat döngüsü: antrenman günü daha fazla, dinlenme günü daha az karbonhidrat (haftalık toplam aynı)</span>
        </label>
        <p className="muted tiny">Kendi hedeflerini girersen hesaplanan değerin yerine onlar kullanılır.</p>
        <div className="fields">
          <Num id="p-kcal" label="Kalori" value={profile.kcalTarget} onChange={(v) => update({ kcalTarget: v })} />
          <Num id="p-pro" label="Protein (g)" value={profile.proteinTarget} onChange={(v) => update({ proteinTarget: v })} />
          <Num id="p-fat" label="Yağ (g)" value={profile.fatTarget} onChange={(v) => update({ fatTarget: v })} />
          <Num id="p-water" label="Su (bardak)" value={profile.waterTarget} onChange={(v) => update({ waterTarget: v ?? 8 })} />
        </div>
      </div>

      <div className="card">
        <h3>Takviyeler</h3>
        <p className="muted small">Beslenme ekranında her gün işaretlenir.</p>
        <div className="chips wrap">
          {profile.supplements.map((x) => <button key={x} className="chip" onClick={() => update({ supplements: profile.supplements.filter((y) => y !== x) })}>{x} ✕</button>)}
        </div>
        <div className="row">
          <input className="input grow" style={{ marginBottom: 0 }} placeholder="ör. Magnezyum" value={supp} onChange={(e) => setSupp(e.target.value)} />
          <button className="btn" onClick={() => { if (supp.trim()) { update({ supplements: [...profile.supplements, supp.trim()] }); setSupp('') } }}>Ekle</button>
        </div>
      </div>

      <div className="card">
        <h3>Sağlık kısıtları</h3>
        <p className="muted small">Açık olan kısıtlara takılan hareketler ⚠ ile işaretlenir, program sihirbazı onları seçmez ve antrenmanda güvenli alternatif önerilir.</p>
        {(Object.keys(FLAG_INFO) as Flag[]).map((f) => (
          <label key={f} className="toggle">
            <input type="checkbox" checked={profile.restrictions.includes(f)} onChange={() => toggleFlag(f)} />
            <span>{FLAG_INFO[f].label}</span>
          </label>
        ))}
      </div>

      <div className="card">
        <h3>Antrenman ayarları</h3>
        <div className="fields">
          <Num id="p-rest" label="Varsayılan dinlenme (sn)" value={profile.defaultRest} onChange={(v) => update({ defaultRest: v ?? 90 })} />
          <Num id="p-bar" label="Bar ağırlığı (kg)" value={profile.barWeight} onChange={(v) => update({ barWeight: v ?? 20 })} />
        </div>
        <label className="toggle">
          <input type="checkbox" checked={profile.dynamicRest} onChange={() => update({ dynamicRest: !profile.dynamicRest })} />
          <span>Dinamik dinlenme: ağır setlerde ve tükenişe yakın setlerde süreyi uzat, hafif setlerde kısalt</span>
        </label>
      </div>

      <div className="card">
        <h3>Görünüm</h3>
        <div className="seg">
          <button className={profile.theme === 'system' ? 'on' : ''} onClick={() => update({ theme: 'system' })}>Sistem</button>
          <button className={profile.theme === 'light' ? 'on' : ''} onClick={() => update({ theme: 'light' })}>Açık</button>
          <button className={profile.theme === 'dark' ? 'on' : ''} onClick={() => update({ theme: 'dark' })}>Koyu</button>
        </div>
      </div>

      <div className="card">
        <h3>Veri ve yedek</h3>
        <p className="small">Tüm verin yalnızca bu telefonda ({count} antrenman). Uygulamayı silersen veya Safari verilerini temizlersen kaybolur; düzenli yedek al ve dosyayı iCloud Drive'a kaydet.</p>
        <p className={`small ${backupAge == null || backupAge > 7 ? 'warn' : 'muted'}`}>
          {profile.lastBackup ? `Son yedek: ${fmtDate(profile.lastBackup)}${backupAge! > 7 ? ` (${backupAge} gün önce)` : ''}` : 'Henüz yedek alınmadı.'}
        </p>
        {persisted === false && <p className="muted tiny">Kalıcı depolama için uygulamayı Safari'de Paylaş → Ana Ekrana Ekle ile yükle.</p>}
        <div className="row">
          <button className="btn primary" onClick={doExport}>Yedek al</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Yedekten geri yükle</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = '' }} />
      </div>

      <div className="card">
        <h3>Dışa ve içe aktarma</h3>
        <p className="muted small">CSV dosyasını Excel veya Numbers'ta açabilirsin.</p>
        <div className="row">
          <button className="btn grow" onClick={async () => { try { await shareFile(`form-antrenman-${new Date().toISOString().slice(0, 10)}.csv`, await workoutsCsv(map)) } catch { /* iptal */ } }}>Antrenmanlar CSV</button>
          <button className="btn grow" onClick={async () => { try { await shareFile(`form-beslenme-${new Date().toISOString().slice(0, 10)}.csv`, await diaryCsv()) } catch { /* iptal */ } }}>Beslenme CSV</button>
        </div>
        <button className="btn" onClick={() => strongRef.current?.click()}>Strong'dan içe aktar</button>
        <p className="muted tiny">Strong → Profil → Ayarlar → Verileri dışa aktar ile aldığın CSV'yi seç. Aynı antrenman iki kez eklenmez, eşleşmeyen hareketler özel hareket olarak eklenir.</p>
        <input ref={strongRef} type="file" accept=".csv,text/csv" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f) return
          try {
            const r = await importStrong(await f.text(), list.filter((x) => x.custom))
            notify(`${r.workouts} antrenman eklendi${r.skipped ? `, ${r.skipped} tanesi zaten vardı` : ''}${r.newExercises ? `, ${r.newExercises} yeni hareket oluşturuldu` : ''}.`)
          } catch (err) { notify((err as Error).message || 'Dosya okunamadı.') }
        }} />
      </div>

      <div className="card">
        <h3>Apple Sağlık (Kısayollar)</h3>
        <p className="small">PWA'lar Apple Sağlık'a doğrudan erişemez; iPhone'daki Kısayollar uygulaması veriyi uygulamaya taşıyabilir. Bir kez kur, sonra her sabah otomatik çalışsın:</p>
        <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Kısayollar → + → <b>Sağlık Örneklerini Bul</b>: Adımlar, bugün, toplam. Aynısını <b>Vücut Ağırlığı</b> (son 1), <b>Uyku Analizi</b> (dün gece) ve <b>Aktif Enerji</b> (bugün, toplam) için ekle.</li>
          <li><b>URL</b> eylemi ekle: <code className="tiny" style={{ wordBreak: 'break-all' }}>{location.origin + location.pathname}?steps=[Adımlar]&amp;w=[Ağırlık]&amp;sleep=[Uyku saat]&amp;kcal=[Aktif Enerji]</code></li>
          <li><b>URL'leri Aç</b> eylemini ekle. Ana ekrandaki Form'u açması için adres, uygulamayı yüklediğin adresle aynı olmalı.</li>
          <li>Otomasyon → Günün saati (ör. 09:00) → bu kısayolu çalıştır.</li>
        </ol>
        <p className="muted tiny">Kilo ölçümlere, adım ve uyku günlük kontrole yazılır; adım kalorisi gerçek adımınla hesaplanır.</p>
      </div>

      <VersionFooter />
    </div>
  )
}
