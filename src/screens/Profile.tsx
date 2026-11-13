import { ask, notify } from '../components/Dialog'
import { useEffect, useRef, useState } from 'react'
import NumBox from '../components/NumBox'
import { useLiveQuery } from 'dexie-react-hooks'
import { backupSummary, db, exportBackup, getProfile, importBackup, setKV, type Profile } from '../db'
import { FLAG_INFO, type Flag } from '../data/exercises'
import { useExercises, useProfile } from '../hooks'
import { diaryCsv, importStrong, saveFile, shareFile, workoutsCsv } from '../lib/csv'
import { fmtDate, fmtNum } from '../lib/calc'
import { targets } from '../lib/nutrition'
import { MesoSetting } from '../components/MesoCard'
import EquipmentPicker from '../components/EquipmentPicker'
import VersionFooter from '../components/VersionFooter'

function Num({ id, label, value, onChange, step }: { id: string; label: string; value?: number; onChange: (v: number | undefined) => void; step?: string }) {
  return (
    <label className="field" htmlFor={id}>{label}
      <NumBox id={id} integer={step == null} value={value} onChange={onChange} />
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

  // Yedek dosyası önceden hazırlanır: iOS paylaşım sayfası dokunuştan hemen sonra açılmalı, araya veritabanı okuması girerse engellenir.
  const [ready, setReady] = useState<File | null>(null)
  const dataStamp = useLiveQuery(async () => `${await db.workouts.count()}-${await db.diary.count()}-${await db.measurements.count()}-${await db.checkins.count()}-${await db.routines.count()}`, [])
  useEffect(() => {
    let alive = true
    exportBackup().then((data) => {
      const name = `fitness-yedek-${new Date().toISOString().slice(0, 10)}.json`
      if (alive) setReady(new File([JSON.stringify(data)], name, { type: 'application/json' }))
    }).catch(() => {})
    return () => { alive = false }
  }, [dataStamp])
  const doExport = async () => {
    const file = ready ?? new File([JSON.stringify(await exportBackup())], `fitness-yedek-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
    const r = await saveFile(file)
    if (r === 'cancel') return
    await update({ lastBackup: Date.now() })
    if (r === 'downloaded') notify(`Yedek "${file.name}" olarak indirildi. iPhone'da Dosyalar → İndirilenler, Android'de Dosyalar → İndirilenler klasöründe bulursun; Drive veya iCloud'a taşıman önerilir.`)
  }
  const doImport = async (f: File) => {
    try {
      const json = JSON.parse(await f.text())
      const s = backupSummary(json)
      if (!s) throw new Error('Bu dosya geçerli bir Fitness yedeği değil.')
      if (!await ask(`Yedekte: ${s.text}.${s.date ? ` Alınma tarihi: ${fmtDate(s.date, true)}.` : ''}\n\nTelefondaki mevcut verilerin tamamı bununla değiştirilecek.`, { title: 'Yedek geri yüklensin mi?', danger: true, ok: 'Geri yükle' })) return
      await importBackup(json)
      notify('Yedek geri yüklendi.')
    } catch (e) { notify((e as Error).message || 'Dosya okunamadı. Fitness uygulamasından alınmış bir .json yedeği seç.') }
  }
  const backupAge = profile.lastBackup ? Math.floor((Date.now() - profile.lastBackup) / 86400000) : null

  return (
    <div className="screen">
      <div className="screen-head"><h1>Profil</h1></div>

      <div className="card">
        <h3>Ölçüler</h3>
        <div className="fields">
          <Num id="p-bw" label="Kilo (kg)" value={profile.bodyweight} step="0.1" onChange={(v) => v && update({ bodyweight: v })} />
          <Num id="p-h" label="Boy (cm)" value={profile.height} onChange={(v) => v && update({ height: v })} />
          <Num id="p-age" label="Yaş" value={profile.age} onChange={(v) => v && update({ age: v })} />
          <Num id="p-tw" label="Hedef kilo (kg)" value={profile.targetWeight} step="0.1" onChange={(v) => update({ targetWeight: v })} />
          <Num id="p-wt" label="Gün/hafta" value={profile.weeklyTarget} onChange={(v) => v && update({ weeklyTarget: v })} />
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
          <button className={profile.goal === 'bulk' ? 'on' : ''} onClick={() => update({ goal: 'bulk' })}>Kas</button>
        </div>
        <div className="fields">
          <Num id="p-steps" label="Günlük adım" value={profile.steps} onChange={(v) => v != null && update({ steps: v })} />
          <Num id="p-kw" label="Ağırlık kcal/sa" value={profile.kcalWeights} onChange={(v) => v != null && update({ kcalWeights: v })} />
          <Num id="p-kc" label="Kardiyo kcal/sa" value={profile.kcalCardio} onChange={(v) => v != null && update({ kcalCardio: v })} />
        </div>
        <p className="small">Diyet hedefi: bazal metabolizma <b>{t.bmr}</b> + günlük yaşam <b>{t.base - t.bmr}</b>{profile.eatBack ? <> + adım <b>{t.steps}</b> + antrenman ortalaması <b>{t.training}</b></> : ''} {profile.goal === 'cut' ? '− 450' : profile.goal === 'bulk' ? '+ 250' : ''} → <b>{t.kcal}</b> kcal, <b>{t.protein}</b> g protein, <b>{t.carbs}</b> g karbonhidrat, <b>{t.fat}</b> g yağ.</p>
        {!profile.eatBack && <p className="small">Adım ({t.steps} kcal) ve antrenman (ortalama {t.training} kcal) diyetten düşülmez, ekstra açık olur. Toplam harcama ≈ {t.tdee} kcal, günlük açık ≈ <b>{t.deficit}</b> kcal, haftada ≈ <b>{t.weeklyKg.toLocaleString('tr-TR')} kg</b>.</p>}
        <p className="muted tiny">Adım kalorisi kilona göre hesaplanır (adım başına ≈ {fmtNum(profile.bodyweight * 0.00045, 3)} kcal). Antrenman ortalaması: haftada {profile.weeklyTarget} × 1 saat × {profile.kcalWeights} kcal ÷ 7.</p>
        <label className="toggle">
          <input type="checkbox" checked={profile.eatBack} onChange={() => update({ eatBack: !profile.eatBack })} />
          <span>Yakılan kaloriyi diyet hedefine ekle (kapalıyken adım ve antrenman ekstra açık sayılır)</span>
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
          <Num id="p-water" label="Su (bardak)" value={profile.waterTarget} onChange={(v) => v && update({ waterTarget: v })} />
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
        <p className="muted small">Sende olanları işaretle. Bu kısıtlara takılan hareketler ⚠ ile gösterilir, program sihirbazı onları seçmez, antrenmanda güvenli alternatif önerilir ve bu hareketlerde ağırlık artışı daha temkinli yapılır. Günlük kontrolde o bölgede ağrı 4/10 ve üstüyse ağırlık %15 düşürülür.</p>
        {(Object.keys(FLAG_INFO) as Flag[]).map((f) => (
          <label key={f} className="toggle">
            <input type="checkbox" checked={profile.restrictions.includes(f)} onChange={() => toggleFlag(f)} />
            <span>{FLAG_INFO[f].label}</span>
          </label>
        ))}
      </div>

      <div className="card">
        <h3>Ekipman</h3>
        <EquipmentPicker value={profile.equipment} />
      </div>

      <div className="card">
        <h3>Antrenman ayarları</h3>
        <div className="fields">
          <Num id="p-rest" label="Dinlenme (sn)" value={profile.defaultRest} onChange={(v) => v && update({ defaultRest: v })} />
          <Num id="p-bar" label="Bar ağırlığı (kg)" value={profile.barWeight} onChange={(v) => v != null && update({ barWeight: v })} />
        </div>
        <label className="toggle">
          <input type="checkbox" checked={profile.dynamicRest} onChange={() => update({ dynamicRest: !profile.dynamicRest })} />
          <span>Dinamik dinlenme: ağır setlerde ve tükenişe yakın setlerde süreyi uzat, hafif setlerde kısalt</span>
        </label>
        <RestNotify />
      </div>

      <div className="card">
        <h3>Döngü (periyotlama)</h3>
        <MesoSetting />
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
        <p className="small">Tüm verin yalnızca bu telefonda ({count} antrenman). Uygulamayı silersen veya tarayıcı verilerini temizlersen kaybolur. Düzenli yedek al: iPhone'da paylaşım menüsünden \"Dosyalar'a Kaydet\" (iCloud Drive), Android'de Drive veya Dosyalar'ı seç. Geri yüklemek için yeni telefonda Yedekten geri yükle'ye dokunup bu .json dosyasını seç.</p>
        <p className={`small ${backupAge == null || backupAge > 7 ? 'warn' : 'muted'}`}>
          {profile.lastBackup ? `Son yedek: ${fmtDate(profile.lastBackup)}${backupAge! > 7 ? ` (${backupAge} gün önce)` : ''}` : 'Henüz yedek alınmadı.'}
        </p>
        {persisted === false && <p className="muted tiny">Kalıcı depolama için uygulamayı ana ekrana ekle: iPhone'da Safari → Paylaş → Ana Ekrana Ekle, Android'de Chrome → ⋮ → Uygulamayı yükle.</p>}
        <div className="row">
          <button className="btn primary" onClick={doExport}>Yedek al</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Yedekten geri yükle</button>
        </div>
        <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = '' }} />
      </div>

      <div className="card">
        <h3>Dışa ve içe aktarma</h3>
        <p className="muted small">CSV dosyasını Excel veya Numbers'ta açabilirsin.</p>
        <div className="row">
          <button className="btn grow" onClick={async () => { try { await shareFile(`fitness-antrenman-${new Date().toISOString().slice(0, 10)}.csv`, await workoutsCsv(map)) } catch { /* iptal */ } }}>Antrenman CSV</button>
          <button className="btn grow" onClick={async () => { try { await shareFile(`fitness-beslenme-${new Date().toISOString().slice(0, 10)}.csv`, await diaryCsv()) } catch { /* iptal */ } }}>Beslenme CSV</button>
        </div>
        <button className="btn" onClick={() => strongRef.current?.click()}>Strong'dan içe aktar</button>
        <p className="muted tiny">Strong → Profil → Ayarlar → Verileri dışa aktar ile aldığın CSV'yi seç. Aynı antrenman iki kez eklenmez, eşleşmeyen hareketler özel hareket olarak eklenir.</p>
        <input ref={strongRef} type="file" accept=".csv,text/csv,text/comma-separated-values,text/plain" hidden onChange={async (e) => {
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
          <li><b>URL'leri Aç</b> eylemini ekle. Ana ekrandaki Fitness'ı açması için adres, uygulamayı yüklediğin adresle aynı olmalı.</li>
          <li>Otomasyon → Günün saati (ör. 09:00) → bu kısayolu çalıştır.</li>
        </ol>
        <p className="muted tiny">Kilo ölçümlere, adım ve uyku günlük kontrole yazılır; adım kalorisi gerçek adımınla hesaplanır. Android'de tarayıcı uygulamaları Health Connect'e erişemez; adımı ana sayfadaki günlük kontrolden elle girebilirsin, girmezsen Profil'deki ortalama adım kullanılır.</p>
      </div>

      <VersionFooter />
    </div>
  )
}

function RestNotify() {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied')
  if (!supported) return <p className="muted tiny">Dinlenme bitince ses çalar ve (Android'de) telefon titrer. Bu tarayıcı bildirim desteklemiyor; iPhone'da bildirim için uygulamayı ana ekrana ekle.</p>
  return (
    <div className="row-between" style={{ gap: 10 }}>
      <span className="small grow">Dinlenme bitince bildirim (uygulama arka plandayken){perm === 'denied' ? ': telefon ayarlarından kapatılmış' : ''}</span>
      {perm === 'granted' ? <span className="pill good">açık</span> : perm === 'default' && <button className="btn sm" onClick={async () => setPerm(await Notification.requestPermission())}>İzin ver</button>}
    </div>
  )
}
