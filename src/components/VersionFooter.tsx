import { useState } from 'react'
import { notify } from './Dialog'

export const CHANGELOG: { v: string; date: string; items: string[] }[] = [
  { v: '0.2.0', date: '4 Kasım 2026', items: [
    'Beslenme takibi: günlük öğünler, makro hedefleri, su, barkod ve Open Food Facts araması',
    'Program sihirbazı: gün sayısı, devamlılık, süre ve hedefe göre program',
    'İlerleme: güç skoru, kas ısı haritası, haftalık set hacmi, 1RM grafikleri ve projeksiyon',
    'Vücut ölçüleri, FFMI ve ilerleme fotoğrafları',
    'Setlere RIR girişi, dinamik dinlenme süresi, antrenman analizi',
    'Yeni tasarım, açık/koyu tema, anatomik kas haritası',
    'Bitir ve silme onayları artık uygulama içinde açılıyor'
  ] },
  { v: '0.1.0', date: '4 Kasım 2026', items: ['İlk sürüm: rutinler, canlı antrenman, dinlenme sayacı, geçmiş, yedek'] }
]

export async function checkForUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined)
  if (!reg) { location.reload(); return }
  await reg.update().catch(() => {})
  if (reg.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    setTimeout(() => location.reload(), 400)
    return
  }
  if (reg.installing) { notify('Yeni sürüm indiriliyor, birkaç saniye sonra uygulama yenilenecek.'); setTimeout(() => location.reload(), 3000); return }
  notify(`En güncel sürümü kullanıyorsun (${__APP_VERSION__}).`)
}

export default function VersionFooter() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const built = new Date(__BUILD_TIME__).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <footer className="footer">
      <span>Form {__APP_VERSION__} · {built}</span>
      <div className="row">
        <button className="btn sm" disabled={busy} onClick={async () => { setBusy(true); await checkForUpdate(); setBusy(false) }}>{busy ? 'Kontrol ediliyor…' : 'Güncellemeleri kontrol et'}</button>
        <button className="btn sm" onClick={() => setOpen(true)}>Sürüm notları</button>
      </div>
      {open && (
        <div className="modal" onClick={() => setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Sürüm notları</h2>
            {CHANGELOG.map((c) => (
              <div key={c.v} className="stack">
                <div className="row-between"><strong>{c.v}</strong><span className="muted tiny">{c.date}</span></div>
                <ul className="note-list">{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
            <button className="btn block" onClick={() => setOpen(false)}>Kapat</button>
          </div>
        </div>
      )}
    </footer>
  )
}
