import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportBackup, getProfile, importBackup, setKV, type Profile } from '../db'
import { FLAG_INFO, type Flag } from '../data/exercises'
import { useProfile } from '../hooks'
import { fmtDate } from '../lib/calc'

export default function ProfileScreen() {
  const profile = useProfile()
  const fileRef = useRef<HTMLInputElement>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const count = useLiveQuery(() => db.workouts.count(), []) ?? 0

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
      if (!confirm('Yedek geri yüklensin mi? Telefondaki mevcut verilerin tamamı yedektekiyle değiştirilecek.')) return
      await importBackup(json)
      alert('Yedek geri yüklendi.')
    } catch (e) { alert((e as Error).message || 'Dosya okunamadı.') }
  }

  const backupAge = profile.lastBackup ? Math.floor((Date.now() - profile.lastBackup) / 86400000) : null

  return (
    <div className="screen">
      <h1>Profil</h1>

      <div className="card">
        <h3>Ölçüler ve ayarlar</h3>
        <div className="fields">
          <label>Vücut ağırlığı (kg)<input type="number" inputMode="decimal" value={profile.bodyweight} onChange={(e) => update({ bodyweight: parseFloat(e.target.value) || 0 })} /></label>
          <label>Varsayılan dinlenme (sn)<input type="number" inputMode="numeric" value={profile.defaultRest} onChange={(e) => update({ defaultRest: +e.target.value || 0 })} /></label>
          <label>Bar ağırlığı (kg)<input type="number" inputMode="decimal" value={profile.barWeight} onChange={(e) => update({ barWeight: parseFloat(e.target.value) || 0 })} /></label>
        </div>
      </div>

      <div className="card">
        <h3>Sağlık kısıtları</h3>
        <p className="muted small">Açık olan kısıtlara takılan hareketler ⚠ ile işaretlenir ve daha güvenli alternatif önerilir.</p>
        {(Object.keys(FLAG_INFO) as Flag[]).map((f) => (
          <label key={f} className="toggle">
            <input type="checkbox" checked={profile.restrictions.includes(f)} onChange={() => toggleFlag(f)} />
            <span>{FLAG_INFO[f].label}</span>
          </label>
        ))}
      </div>

      <div className="card">
        <h3>Veri ve yedek</h3>
        <p className="small">Tüm verin yalnızca bu telefonda duruyor ({count} antrenman). Uygulamayı silersen veya Safari verilerini temizlersen kaybolur; düzenli yedek al ve dosyayı iCloud Drive'a kaydet.</p>
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

      <p className="muted tiny center">Form · sürüm 0.1 · Veriler cihazda saklanır</p>
    </div>
  )
}
