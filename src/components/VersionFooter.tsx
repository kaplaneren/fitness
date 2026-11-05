import { useState } from 'react'
import { notify } from './Dialog'

export const CHANGELOG: { v: string; date: string; items: string[] }[] = [
  { v: '0.8.1', date: '5 Kasım 2026', items: [
    'Landmine press ve T-bar row artık ayrı "Landmine aparatı" ekipmanı istiyor; seçmezsen önerilmiyor',
    'Türk mutfağından 225 yeni yemek: yöresel çorbalar, kebaplar, zeytinyağlılar, mezeler, börek ve poğaçalar, pideler, sokak lezzetleri, şerbetli ve sütlü tatlılar, yöresel peynirler'
  ] },
  { v: '0.8.0', date: '5 Kasım 2026', items: [
    'Besin kütüphanesine USDA (ABD Tarım Bakanlığı) besin veritabanından 233 temel gıda eklendi: sebze, meyve, et, balık, peynir, tahıl, baklagil, kuruyemiş, yağ, baharat ve daha fazlası',
    'USDA kaynaklı gıdalar aramada "USDA" etiketiyle görünür, lif değeri de içerir',
    'Program sihirbazına "Ekipman kısıtın var mı?" sorusu eklendi; sadece elindeki ekipmanla yapılabilen hareketler önerilir',
    'Ekipman seçimi Profil sayfasından da değiştirilebilir; antrenmandaki güvenli alternatif önerileri de buna uyar'
  ] },
  { v: '0.7.2', date: '4 Kasım 2026', items: [
    'Strong içe aktarmada dinlenme satırları ("2 dk" gibi) artık set sayılmıyor, dinlenme süresi olarak kaydediliyor',
    'Daha önce aktarılmış antrenmanlardaki bu satırlar otomatik düzeltildi',
    'Isınma ve kardiyo gibi süreli hareketlerde de 2 dk gibi dinlenme satırları setlerden çıkarıldı'
  ] },
  { v: '0.7.1', date: '4 Kasım 2026', items: [
    'Eklenen yemekler düzenlenebiliyor: miktar, porsiyon, öğün ve gün değiştirme, kopyasını ekleme, silme'
  ] },
  { v: '0.7.0', date: '4 Kasım 2026', items: [
    'Alt menüde yeni Geçmiş sekmesi: tüm antrenmanlar aylara göre listelenir',
    'Arama (antrenman, hareket, not), dönem filtresi ve toplam süre/hacim özeti',
    'Her antrenman için menü: aç, tekrarla, paylaş, sil',
    'Seç modu ile birden fazla antrenmanı birlikte paylaşma veya silme',
    'Yeni logo'
  ] },
  { v: '0.6.0', date: '4 Kasım 2026', items: [
    'Program sihirbazı ısınma ve kardiyo süresini ve hareketini soruyor; ısınma başa, kardiyo sona ekleniyor',
    'Isınma ve kardiyo süresi toplam antrenman süresinden düşülüyor, ağırlık hareketleri kalan süreye sığacak kadar seçiliyor',
    'Kardiyo ve ısınma süresi antrenmanda otomatik dolduruluyor'
  ] },
  { v: '0.5.0', date: '4 Kasım 2026', items: [
    'Yakılan kalori artık diyetten düşülmüyor: adım ve antrenman ekstra açık sayılıyor (Profil\'den değiştirilebilir)',
    'Sağlık kısıtları herkese uygun hale geldi; omuz, dirsek, boyun, kalça, ayak bileği ve tansiyon eklendi',
    'Kısıta takılan hareketlerde ağırlık artışı temkinli; o bölgede ağrı 4/10 ve üstüyse ağırlık %15 düşer',
    'Günlük kontrole omuz ağrısı ve adım girişi eklendi',
    'Yedekleme iPhone ve Android\'de paylaşım menüsü veya indirme ile çalışıyor; geri yükleme her dosya seçiciyle açılıyor',
    'Kayan ve sıkışan butonlar düzeltildi (sekmeler, form alanları, alt çubuk)',
    'Uygulamanın adı Fitness oldu, yeni dambıl logosu'
  ] },
  { v: '0.4.0', date: '4 Kasım 2026', items: [
    'Yakılan kalori: ağırlık 380, kardiyo 500 kcal/saat ve 7500 adım varsayılanı (Profil\'den değişir); antrenman sonunda, beslenmede ve haftalık raporda gösterilir',
    'Günlük harcama artık bazal + günlük yaşam + adım + antrenman olarak hesaplanıyor; istersen hedef her gün gerçek antrenmana göre ayarlanır',
    'Günlük kontrol ve hazır olma skoru; skor düşükse o gün ağırlık artışı önerilmez',
    'Ağrı günlüğü (diz, bel, bilek) ve hangi hareketten sonra ağrının arttığı analizi',
    'Sağ ve sol ayrı set kaydı, taraf farkı analizi',
    'Deload haftası önerisi ve deload modu',
    'Isınma, mobilite ve omurga/bel bakımı rutinleri',
    'Nabız bölgeleri ve bölgelere göre kardiyo dakikası',
    'Tarif oluşturucu, öğün şablonları, takviye takibi, karbonhidrat döngüsü',
    'CSV dışa aktarma, Strong\'dan içe aktarma, Kısayollar ile Apple Sağlık verisi',
    'Fotoğraf özelliği kaldırıldı'
  ] },
  { v: '0.3.0', date: '4 Kasım 2026', items: [
    'Haftalık rapor: geçen haftayla kıyas, koç notları, haftanın rekorları',
    'strengthlevel.com standartlarıyla bölge bazlı güç haritası, toplam güç ve vücudun kendi içinde dengesi',
    'Sonraki antrenman için geçmişe göre dinamik ağırlık ve tekrar önerisi',
    'Özet ekranında haftalık takvim',
    'Geçmişte 1RM, maks. kg ve hacim grafikleri, 4 haftalık tahmin',
    'Kilo, bel ve yağ oranı için hareketli ortalama; bel ve kilodan yağ tahmini; hedef kiloya varış tarihi',
    'Gerçek kalori harcaması (adaptif TDEE), plato uyarıları, itiş/çekiş dengesi, devamlılık takvimi',
    'Beslenme analizi: makro dağılımı, hedef uyumu, hafta içi ve hafta sonu farkı',
    'Hareket detayında tekrar rekorları tablosu'
  ] },
  { v: '0.2.0', date: '4 Kasım 2026', items: [
    'Beslenme takibi: günlük öğünler, makro hedefleri, su, barkod ve Open Food Facts araması',
    'Program sihirbazı: gün sayısı, devamlılık, süre ve hedefe göre program',
    'İlerleme: güç skoru, kas ısı haritası, haftalık set hacmi, 1RM grafikleri ve projeksiyon',
    'Vücut ölçüleri ve FFMI',
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
      <span>Fitness {__APP_VERSION__} · {built}</span>
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
