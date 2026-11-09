import { useState } from 'react'
import { notify } from './Dialog'

export const CHANGELOG: { v: string; date: string; items: string[] }[] = [
  { v: '0.12.0', date: '9 Kasım 2026', items: [
    'Hiç yapmadığın harekette başlangıç ağırlığı öneriliyor: o bölgedeki güç seviyen (yoksa genel seviyen) strengthlevel standartlarına göre tahmini 1RM\'ye çevrilip 3 tekrar yedekte kalacak ağırlık hesaplanıyor; standardı olmayan 45 hareket benzer hareketin oranıyla',
    'Biten antrenmanda "Devam et": antrenman yeniden açılır, hareket ve set ekleyip tekrar bitirebilirsin',
    'Düzenle artık antrenmanı açmadan yerinde düzenliyor: ad, tarih, başlangıç ve bitiş saati, nabız, not, setlerin ağırlık/tekrar/RIR değerleri, set ve hareket silme',
    'Antrenman sırasında üstteki süreye dokunup başlangıç saatini değiştirebilirsin (başlatmayı unuttuysan)'
  ] },
  { v: '0.11.1', date: '9 Kasım 2026', items: [
    'Kas haritası ve haftalık set sayıları takvim haftasına bakıyor (pazartesiden bugüne); son 7 gün geçen haftanın antrenmanlarını da sayıyordu. İlerleme > Kaslar\'da Bu hafta / Geçen hafta / 4 hafta ortalaması',
    'Kas haritası kırmızı yerine mavi tonlarda: kırmızı uyarı gibi okunuyordu',
    'Süren hafta artık geçen haftanın aynı dönemiyle kıyaslanıyor (Özet kutuları ve Haftalık rapor); pazartesi her şey düşüş görünmüyor. Hafta bitmeden "az çalışan kas" ve "az beslenme kaydı" uyarısı çıkmıyor',
    'Kas grubu hacim grafiği sadece bitmiş haftaları gösteriyor; son noktadaki yapay düşüş kalktı',
    'Hareket ekranındaki güç yüzdesi kadın profilinde "kadınların" diyor (0.9.1\'de atlanmıştı)',
    'Ondalık sayılar her yerde Türkçe (virgüllü) gösteriliyor; ölçüm geçmişinde uzun ondalıklar düzeltildi',
    'Geçmiş kartlarında en fazla 5 hareket listeleniyor, gerisi "+N hareket daha"',
    'Tenis, yüzme gibi aktiviteler devamlılık takviminde ve haftalık seride sayılıyor'
  ] },
  { v: '0.11.0', date: '7 Kasım 2026', items: [
    'Salon dışı aktiviteler: tenis, padel, yüzme, koşu, yürüyüş, bisiklet, doğa yürüyüşü, futbol, basketbol, yoga, pilates, boks, dans ve daha fazlası (Antrenman > Spor / aktivite ekle)',
    'Aktivite kalorisi süre, kilo, yaş, boy ve cinsiyetten hesaplanıyor: Compendium MET değerleri, dinlenme metabolizması düşülerek; koşu, yürüyüş ve bisiklette mesafe girilirse hızdan. Nabız girilirse Keytel formülü',
    'Aktiviteler Geçmiş\'te listeleniyor, günlük yakılan kaloriye ve haftalık antrenman sayısına ekleniyor; düzenlenebiliyor',
    'Open Food Facts araması daha hızlı arama servisini kullanıyor, yanıt gelmezse eski aramaya geçiyor ve takılı kalmıyor; önizlemede neden çalışmadığı açıkça yazıyor'
  ] },
  { v: '0.10.0', date: '5 Kasım 2026', items: [
    'Döngü (periyotlama): 3+1, 4+1 veya 5+1 hafta. Yükleme haftalarında hedef RIR haftadan haftaya azalır, son hafta planlı deload ile ağırlık ve setler otomatik düşer',
    'Program sihirbazında döngü seçimi; Profil\'de döngüyü açma, kapatma ve uzunluğunu değiştirme',
    'Özet ve Antrenman ekranında döngü kartı (hangi haftadasın, bu haftanın hedefi), antrenman sırasında hafta ve hedef RIR satırı',
    'İlk açılış tanıtımı: cinsiyet, yaş, boy, kilo, hedef, ekipman ve sağlık kısıtları sorulup program sihirbazı açılıyor; yedekten geri yükleme seçeneği de var'
  ] },
  { v: '0.9.1', date: '5 Kasım 2026', items: [
    'Kadınlar için ayrı güç standartları (strengthlevel.com kadın tablosu); Profil\'de cinsiyet kadın seçiliyse seviye ve puan buna göre',
    'RIR girilen setlerde tahmini 1RM tükenişe kalan tekrarı da hesaba katıyor',
    'Antrenman sonunda ortalama nabız girildiyse yakılan kalori nabız, kilo, yaş ve cinsiyetten (Keytel formülü) hesaplanıyor',
    'Tükenişe giden veya hedef tekrarın altında kalan setten sonra kalan setler için %10 hafifletme (back-off) önerisi',
    'Dinlenme bitince titreşim (Android) ve uygulama arka plandaysa bildirim; izin Profil > Antrenman ayarları',
    'Son yedekten beri 3+ antrenman ve 7+ gün geçtiyse Özet\'te yedek hatırlatıcısı; geri yüklemeden önce yedeğin içeriği gösteriliyor',
    'Yiyecek eklerken 25-250 g hızlı gram butonları',
    '⚠ kısıt rozetine dokununca neden riskli olduğu, ipucu ve güvenli alternatifler',
    'Program paylaşım linkleri sıkıştırıldı (yaklaşık yarı uzunluk), içe aktarmada özet; programı QR kodla paylaşma'
  ] },
  { v: '0.9.0', date: '5 Kasım 2026', items: [
    'Grafiklere dokunup parmağını kaydırınca o tarihteki değer ve bir öncekine göre fark görünüyor; uzun geçmişte 1A/3A/6A/1Y/Tümü aralığı seçilebiliyor',
    'Geçmiş hareket grafiğinde seçilen noktanın antrenmanı tek dokunuşla açılıyor',
    'Rutine dokununca önce görüntüleniyor; Başlat, Düzenle ve Paylaş oradan',
    'Program klasörünün adı değiştirilebiliyor (klasörün ⋯ menüsü)',
    'Rutin ve programlar linkle paylaşılıyor; linki açan kişi programı kendi rutinlerine ekleyebiliyor (Antrenman > Paylaşılan programı içe aktar)',
    'Antrenman sırasında her harekette geçen sefere göre anlık % fark: tahmini 1RM, aynı set sayısındaki hacim ve toplam hacim; üstte rutinin geçen seferine göre toplam hacim'
  ] },
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
