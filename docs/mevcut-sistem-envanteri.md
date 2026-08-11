# Mevcut Sistem Envanteri (Faz 0 tespiti)

Bu belge, SEKİZ'e geçmeden önce **hâlihazırda canlıda çalışan** sistemin
tespitidir. Faz 1'in girdisidir. Buradaki her madde ölçülerek doğrulandı;
tahmin yoktur.

Tespit tarihi: Faz 0.

## Yayın

| Konu | Durum |
|---|---|
| Adres | `https://buketmathlab.github.io/` (HTTP 200, canlı) |
| Kaynak | Depo kökündeki tek dosya: `index.html`, 713 satır |
| Doğrulama | Canlı kopyanın md5'i depodaki dosyayla aynı (`6571fd91…`) |
| Build | Yok. `package.json` yok, `.github/` yok. |
| Bağımlılıklar | CDN'den: `@supabase/supabase-js@2`, `pdf.js@3.11.174`, Google Fonts |

## Supabase

- Proje: `udrzjlvjkolzqtjtpkgi.supabase.co`
- Anon anahtarı istemci kodunda gömülü (anon anahtarı için normaldir; koruma
  RLS/GRANT katmanında olmalıdır).
- **Tablo erişimi anon rolüne kapalı.** Her tabloda `42501 permission denied`
  alınıyor. Yani yetkilendirme tamamen `SECURITY DEFINER` fonksiyonlarda.
  Bu sağlam bir temeldir ve korunmalıdır.

- Bölge: **Zürih (eu-central-2)** — öğretmen tarafından teyit edildi.

### Mevcut tablolar
`ogrenciler`, `odevler`, `gonderimler`, `mesajlar`, `dersler`, `odemeler`,
`ayarlar`, `okundu`

### Bulunmayan tablolar
`siniflar`, `giris_denemeleri` — ikisi de Faz 1'de oluşturulacak.

### Şema (öğretmenden alındı, doğrulanmış)

```
ayarlar      (id int PK=1, ogretmen_pin text NOT NULL)
ogrenciler   (id uuid PK, ad, sinif text, tur CHECK(okul|ozel),
              ogrenci_kodu text UNIQUE, veli_kodu text UNIQUE, created_at)
odevler      (id uuid PK, baslik, aciklama, sinif text, tur CHECK(test|acik),
              son_tarih date, soru_sayisi int, cevap_anahtari jsonb,
              anahtar_url text, created_at)
gonderimler  (id uuid PK, odev_id FK, ogrenci_id FK, cevaplar jsonb,
              foto_url NOT NULL, dogru/yanlis/bos int, puan numeric,
              ogretmen_puan numeric, ogretmen_yorum, durum text
              DEFAULT 'incelemede', created_at)
mesajlar     (id uuid PK, ogrenci_id FK, kimden CHECK(ogretmen|veli),
              metin, created_at)
dersler      (id uuid PK, ogrenci_id FK, zaman timestamptz,
              mod CHECK(yuzyuze|online), link, created_at)
odemeler     (id uuid PK, ogrenci_id FK, tutar numeric, tarih date,
              odendi bool DEFAULT false, created_at)
okundu       (kod text PK, zaman timestamptz)
```

#### Şemadan çıkan doğrulanmış bulgular

1. **`gonderimler`'da `(odev_id, ogrenci_id)` UNIQUE kısıtı YOK.** Yalnız
   `PRIMARY KEY (id)` var. Aynı öğrenci aynı ödeve birden çok gönderim
   yapabilir — veritabanı engellemiyor. RPC kontrol etse bile uygulama
   katmanı kontrolü yarış koşuluna açıktır.
2. **Cevap anahtarı ödev satırının içinde** (`cevap_anahtari`, `anahtar_url`).
   `select *` yapan her sorgu anahtarı da getirir.
3. **Öğrenci/veli kodları düz metin.** `ogrenci_kodu`, `veli_kodu` düz metin
   UNIQUE; `okundu`'nun birincil anahtarı doğrudan `kod`. Bunlar kimlik
   bilgisi niteliğinde.
4. **`gonderimler.durum`'da CHECK yok.** Diğer tüm sıralı alanlarda CHECK var
   (`tur`, `kimden`, `mod`); bu alan serbest metin. Tutarsız.
5. **Yabancı anahtarlarda `ON DELETE CASCADE` yok.** `ogrenci_sil` çocuk
   kayıtları elle silmek zorunda; sıra yanlışsa hata, atomik değilse kısmi
   silme.
6. **Hiçbir tabloda `updated_at` yok.** Değişiklik izi tutulmuyor.

#### Diğer veritabanı nesneleri

`rls_auto_enable` — `public` şemasında yeni tablo oluşturulduğunda otomatik
`ENABLE ROW LEVEL SECURITY` çalıştıran DDL event trigger'ı. Sistem
şemalarını atlar, hataları `RAISE LOG` ile yutar.

> **Dikkat:** RLS'in *açık* olması *politika* olduğu anlamına gelmez.
> Politikasız RLS hiçbir satıra erişim vermez. Bugünkü koruma zaten RLS
> değil, `GRANT`'lerin anon rolünden çekilmiş olmasıdır. Faz 1'de açılan
> her tabloya politika **açıkça** yazılacak.

## RPC yüzeyi (istemci sözleşmesi)

Fonksiyon gövdeleri görünmüyor (service_role erişimi yok). Aşağıdaki tablo
istemci kodundan çıkarılan **çağrı sözleşmesidir**.

| Fonksiyon | Parametreler | Rol |
|---|---|---|
| `giris` | `p_kod` | herkes |
| `pin_ayarla` | `p_yeni` | ilk kurulum |
| `ogretmen_panosu` | `p_pin` | öğretmen |
| `ogrenci_ekle` | `p_pin, p_ad, p_sinif, p_tur` | öğretmen |
| `ogrenci_sil` | `p_pin, p_id` | öğretmen |
| `odev_olustur` | `p_pin, p_baslik, p_aciklama, p_sinif, p_tur, p_son_tarih, p_soru_sayisi, p_cevap_anahtari, p_anahtar_url` | öğretmen |
| `odev_sil` | `p_pin, p_id` | öğretmen |
| `acik_puanla` | `p_pin, p_gonderim, p_puan, p_yorum` | öğretmen |
| `mesajlar_ogretmen` | `p_pin, p_ogrenci` | öğretmen |
| `ders_ekle` | `p_pin, p_ogrenci, p_zaman, p_mod, p_link` | öğretmen |
| `ders_sil` | `p_pin, p_id` | öğretmen |
| `odeme_ekle` | `p_pin, p_ogrenci, p_tutar, p_tarih` | öğretmen |
| `odeme_degistir` | `p_pin, p_id` | öğretmen |
| `odeme_sil` | `p_pin, p_id` | öğretmen |
| `ogrenci_odevleri` | `p_kod` | öğrenci |
| `odev_gonder` | `p_kod, p_odev, p_foto, p_cevaplar?` | öğrenci |
| `veli_paneli` | `p_kod` | veli |
| `mesaj_gonder` | `p_kod, p_metin, p_ogrenci?` | öğretmen/veli |
| `okundu_isaretle` | `p_kod` | veli |

### Panolardan dönen veri şekilleri
- `ogretmen_panosu` → `{ ogrenciler, odevler, gonderimler, dersler, odemeler }`
- `ogrenci_odevleri` → `{ ogrenci, odevler[], dersler[] }`, ödevde `gonderim`,
  `anahtar`, `anahtar_url`, `soru_sayisi`
- `veli_paneli` → `{ ogrenci, odevler[], mesajlar[], odemeler[], dersler[], son_gorulme }`

## Korunması gereken davranışlar

1. **Test puanlama sunucuda ve deterministik.** `odev_gonder` doğru/yanlış/boş
   ve puanı kendisi hesaplayıp döndürüyor. Yapay zekâ yok — bu doğrudur ve
   böyle kalmalıdır.
2. **PDF'ten cevap anahtarı çıkarma + öğretmen onayı.** `pdfAnahtarOku` regex
   ile okuyor, öğretmen önizlemede düzeltip onaylıyor. Doğrulanmamış anahtar
   yayınlanmıyor.
3. **Fotoğraf sıkıştırma.** Yüklemeden önce 1400px / kalite 0.72 JPEG.
4. **Öğrenci/veli kod ayrımı.** Her öğrenci için ayrı öğrenci ve veli kodu.
5. **Ödeme yalnız özel ders öğrencisinde.** Okul öğrencisinde ödeme sekmesi
   hiç görünmüyor.

## Faz 1'de düzeltilecek eksikler

| # | Eksik | Kanıt |
|---|---|---|
| 1 | `odevler` storage bucket'ı **public** | `/object/public/odevler/…` isteği `NoSuchKey` döndürdü (bucket var, public okuma açık) |
| 2 | Öğretmen PIN'i `localStorage`'da düz metin, her istekte gönderiliyor | `kaydetOturum({rol,kod})`, `p_pin: oturum.kod` |
| 3 | Oturum süresi ve iptal yok | Kod tabanında karşılığı yok |
| 4 | Giriş deneme limiti yok | `giris_denemeleri` tablosu mevcut değil |
| 5 | Sınıflar kodda sabit | `const SINIFLAR = ["9A","9B","10C","11B"]` |
| 6 | Cevap anahtarı revizyonu ve yeniden puanlama yok | RPC yüzeyinde karşılığı yok |
| 7 | Denetim izi (audit trail) yok | Tablo yok |
| 8 | Sayfalama, arama, filtre yok | Tüm listeler tek seferde çiziliyor |
| 9 | Öğrenci silme "tüm kayıtları" siliyor | `ogrenci_sil` onay metni; geri alınamaz |
| 10 | **Mükerrer teslim DB'de engellenmiyor** | Şema: `gonderimler`'da UNIQUE kısıtı yok |
| 11 | `gonderimler.durum` serbest metin | Şema: CHECK kısıtı yok |
| 12 | Kodlar DB'de düz metin | Şema: `ogrenci_kodu`, `veli_kodu`, `okundu.kod` |

## Bilinmeyenler (Faz 1 öncesi cevaplanmalı)

1. PIN `ayarlar.ogretmen_pin` içinde hash'li mi saklanıyor, düz metin mi?
   Sütun tipi `text` — bcrypt hash'i de `text` olacağı için tip tek başına
   kanıt değil. Sütun adının `pin_hash` yerine `ogretmen_pin` olması ve
   istemcinin PIN'i her istekte ham göndermesi düz metni işaret ediyor,
   ama kesin cevap `pin_ayarla` / `giris` gövdesinde.
2. `ogrenci_odevleri`, teslim edilmemiş ödevin cevap anahtarını sunucuda
   gerçekten kırpıyor mu? (İstemci `d.anahtar` yoksa göstermiyor ama bu
   yeterli değil — karar sunucuda olmalı.) Şema riski artırıyor: anahtar
   ödev satırının içinde.
3. `odev_gonder` mükerrer teslimi nasıl engelliyor? Veritabanı kısıtı yok.

Üçünün cevabı da fonksiyon gövdelerinde. Aşağıdaki sorgu hepsini döker:

```sql
select p.proname as fonksiyon, pg_get_functiondef(p.oid) as tanim
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by p.proname;
```

**Önemli:** Sorgu doğru projede çalıştırılmalı. İlk denemede alınan dışa
aktarım `public` şemasında yalnız `rls_auto_enable` içeriyordu ve 19 RPC'nin
hiçbiri yoktu — yani boş bir başka projeden alınmıştı. Doğru adres:
`https://supabase.com/dashboard/project/udrzjlvjkolzqtjtpkgi/sql`.
Doğru projede çıktıda `giris` görünmeli.
