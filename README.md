# SEKİZ

**Buket Topuzoğlu · Matematik**
Beşiktaş Arnavutköy Korkmaz Yiğit Anadolu Lisesi

Lise matematik dersi için ödev yönetimi, otomatik değerlendirme, veli iletişimi ve
öğrenci gelişim analitiği platformu.

Yayın adresi: <https://buketmathlab.github.io>

## Belgeler

- [MIMARI.md](./MIMARI.md) — teknoloji seçimleri, klasör düzeni, yayın yöntemi, anahtar yönetimi
- [TASARIM.md](./TASARIM.md) — renk, tipografi, aralık, imza öğeleri ve kalite kapıları

## Geliştirme

```bash
npm install     # bağımlılıkları kur
npm run dev     # geliştirme sunucusu
npm run build   # tip denetimi + üretim derlemesi
npm run onizle  # derlenmiş sürümü yerelde aç
```

Tasarım sistemi vitrini: uygulama açıkken `/tasarim` adresi.

## Yayın

`main` dalına push → GitHub Actions derler → GitHub Pages'e yayınlanır.
Tek seferlik ayar: **Settings → Pages → Source = GitHub Actions**.

## Güvenlik kuralı

Bu depoya **yalnız istemciye açık** Supabase anahtarları girer
(`VITE_SUPABASE_PUBLISHABLE_KEY`). `service_role` ve `sb_secret_…` anahtarları
asla depoya, koda veya iş akışı dosyalarına yazılmaz.
