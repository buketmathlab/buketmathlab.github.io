# Veritabanı kurulumu — telefondan adım adım

Bu adımları telefondan yapabilirsiniz. **23 kısa parça** var; her biri tek seferde
yapıştırılacak kadar kısadır (mobil tarayıcı uzun metinleri kırptığı için bilerek
bölündü). Toplam 15–20 dakika sürer.

Ara verirseniz sorun olmaz: kaldığınız adımdan devam edin. Bir adımı yanlışlıkla iki
kez çalıştırmak da zarar vermez.

---

## Başlamadan

1. Telefonda tarayıcıyı açın, **supabase.com** adresine girin ve hesabınıza girin.
2. **oymueccauhprkgdrbqtv** projesini seçin (Zürih bölgesindeki proje).
3. Soldaki menüden **SQL Editor**'ü açın.
4. Bu depoda `supabase/migrations/` klasörünü açın (GitHub uygulamasından ya da
   tarayıcıdan). Dosyalar 0001'den 0023'e kadar numaralıdır.

## Her adımda yapacağınız şey

1. Dosyayı açın, **Raw** (ham) görünüme geçin.
2. Metnin tamamını seçip kopyalayın.
3. SQL Editor'e yapıştırın, **Run** düğmesine basın.
4. Altta yeşil bir sonuç görürseniz o adım tamam. **Kırmızı hata görürseniz durun**
   ve hata metnini bana gönderin.

Adımları **sırayla** çalıştırın — sonraki adımlar öncekilere dayanır.

---

## Adımlar

| # | Dosya | Ne yapar |
|---|---|---|
| 1 | `0001_uzantilar_ve_ayarlar.sql` | Şifreleme uzantısı ve ayar tablosu |
| 2 | `0002_donem_ve_siniflar.sql` | Eğitim dönemi ve sınıflar |
| 3 | `0003_ogrenciler.sql` | Öğrenciler ve giriş kodları |
| 4 | `0004_odevler.sql` | Ödevler (soru ve anahtar PDF'i ayrı alanlarda) |
| 5 | `0005_gonderimler.sql` | Gönderimler (bir ödev bir kez gönderilir) |
| 6 | `0006_iletisim.sql` | Mesajlar ve bildirimler |
| 7 | `0007_ozel_ders.sql` | Özel ders planı ve ödeme |
| 8 | `0008_oturum_ve_denemeler.sql` | Oturumlar ve giriş denemeleri |
| 9 | `0009_rls_ve_yetkiler.sql` | **Güvenlik:** tabloları dışarıya kapatır |
| 10 | `0010_fn_yardimci.sql` | Kod üretimi ve özetleme |
| 11 | `0011_fn_kilit.sql` | Kaba kuvvet kilidi |
| 12 | `0012_fn_oturum.sql` | Oturum açma ve doğrulama |
| 13 | `0013_fn_giris.sql` | Öğrenci ve veli girişi |
| 14 | `0014_fn_giris_ogretmen.sql` | Öğretmen girişi ve PIN değiştirme |
| 15 | `0015_fn_siniflar.sql` | Sınıf ekleme, düzenleme, arşivleme |
| 16 | `0016_fn_sinif_sil.sql` | Sınıf silme (iki adımlı onay) |
| 17 | `0017_fn_ogrenciler.sql` | Öğrenci ekleme ve listeleme |
| 18 | `0018_fn_kod_ve_silme.sql` | Kod yenileme, sınıf değiştirme, öğrenci silme |
| 19 | `0019_fn_odev_anahtar.sql` | **Cevap anahtarı kapısı** |
| 20 | `0020_fn_gonderim.sql` | Çözüm gönderme kuralları |
| 21 | `0021_depolama.sql` | Dosya deposu (özel kova) |
| 22 | `0022_kurulum.sql` | **PIN'inizi belirler — önce düzenleyin!** |
| 23 | `0023_fn_odev_olustur.sql` | Ödev oluşturma ve yayınlama |

---

## 22. adım özel dikkat ister

Bu dosyayı **olduğu gibi çalıştırmayın**. İçinde iki yer var:

**PIN'iniz.** Dosyada şu satır var:

```
v_pin constant text := 'DEGISTIRIN-8HANE';
```

`DEGISTIRIN-8HANE` yazan yeri silip kendi PIN'inizi yazın. Tırnak işaretleri kalsın:

```
v_pin constant text := 'sizin-pininiz';
```

- En az 8 hane olmalı (rakam ve harf karışık olabilir).
- Doğum tarihi, telefon numarası gibi tahmin edilebilir bir şey seçmeyin.
- Kimseyle paylaşmayın. Öğrencilerin ayrı kodu var, sizin PIN'inize ihtiyaçları yok.
- Unutursanız aynı adımı yeni PIN'le tekrar çalıştırabilirsiniz.

**Dönem tarihleri.** `2025–2026 Güz` ve tarihleri kendi eğitim yılınıza göre
düzenleyin.

Bu adımı çalıştırdıktan sonra **SQL Editor'deki metni silin** — PIN'iniz tarayıcı
geçmişinde durmasın.

---

## Bittikten sonra

SQL Editor'e şunu yapıştırıp çalıştırın. Kurulum doğruysa 12 satır gelir ve hepsinde
`rowsecurity` sütunu `true` olur:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;
```

Sonra bana haber verin — girişin gerçekten çalıştığını ben uzaktan kontrol edeceğim
(sizin PIN'inizi görmeden; yalnız yanlış PIN'in reddedildiğini ve tabloların
kapalı olduğunu denerim).

---

## Sık karşılaşılan iki hata

**"relation ... does not exist"** — Bir önceki adım çalışmamış demektir. Sıradaki
adıma geçmeden önceki adımı tekrar çalıştırın.

**"permission denied"** — SQL Editor'de değil, uygulamadan çalıştırmaya çalışıyor
olabilirsiniz. Adımlar yalnız Supabase panelindeki SQL Editor'den çalıştırılır.
