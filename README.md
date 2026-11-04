# Fitness

Antrenman takibi, analiz ve beslenme takibi için Türkçe PWA. Tüm veriler telefondaki IndexedDB'de kalır; sunucu yoktur.

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ klasörüne üretim çıktısı
```

## Yayın (Cloudflare Pages)

- Framework preset: **None** (veya Vite)
- Build command: `npm run build`
- Build output directory: `dist`
- Node sürümü: `.nvmrc` (22)

`main` dalına her push'ta Cloudflare otomatik yeniden yayınlar. Uygulamadaki "Güncellemeleri kontrol et" yeni sürümü yükler.

## Telefona yükleme

- iPhone: Safari → Paylaş → Ana Ekrana Ekle
- Android: Chrome → ⋮ → Uygulamayı yükle

## Yapı

- `src/lib`: hesaplamalar (ilerleme, analiz, beslenme, sağlık, program sihirbazı)
- `src/screens`: ekranlar
- `src/data`: hareket kütüphanesi ve temel yiyecek listesi
- `src/db.ts`: Dexie veritabanı ve yedekleme
