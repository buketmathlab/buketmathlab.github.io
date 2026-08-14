# Güvenlik Test Matrisi

**Durum: Faz 1 sonrası. Maddelerin çoğu artık gerçek bir veritabanında
çalıştırılarak doğrulandı.**

Kural: **çözülmemiş risk gizlenmez.** Bir madde "test edilmedi" ise öyle
yazılır; "muhtemelen güvenli" diye geçilmez.

## Nasıl doğrulandı

Testler yerel bir PostgreSQL 16.13 üzerinde, migration'lar sıfırdan
uygulanarak çalıştırıldı — varsayım değil, çalıştırılmış kod:

```bash
supabase/testler/calistir.sh
```

- `supabase/testler/guvenlik_testleri.sql` — 18 davranış grubu
- `supabase/testler/anon_izolasyon.sql` — 13 tablo + 7 dahili fonksiyon

Son çalıştırma: **hepsi geçti.**

> **Önemli uyarı:** Bu sonuçlar YEREL veritabanı içindir. Migration'lar
> Supabase projesine henüz uygulanmadı. Uygulandıktan sonra aynı testler
> canlı ortamda tekrarlanmalı.

## Faz 1'de YAKALANAN gerçek açık

Test yazmasaydım gözden kaçacaktı:

**Dahili fonksiyonlar dışarıdan çağrılabiliyordu.** PostgreSQL yeni
fonksiyonlara varsayılan olarak `PUBLIC` rolüne `EXECUTE` verir. Yetkiler
`anon`'dan çekilmişti ama `PUBLIC`'ten çekilmemişti ve `anon` `PUBLIC`'ten
miras alır. Sonuç: `_oturum_ac('ogretmen', null)` anon rolüyle
çağrılabiliyordu — **PIN bilmeden öğretmen jetonu üretmek mümkündü.**
Tam kimlik doğrulama atlatması.

Kapatıldı: `0005_fonksiyon_yetkileri.sql` tüm hakları `PUBLIC` dahil
sıfırlıyor ve yalnız izin listesindekileri geri veriyor. `anon_izolasyon.sql`
bu açığın geri gelmemesi için nöbette.

İkinci bulgu (güvenlik değil, hata): `_yeni_kod()` içinde yerel değişken adı
sütun adıyla çakışıyordu; öğrenci ekleme tamamen kırıktı. Test yakaladı.

## Durum etiketleri

| Etiket | Anlamı |
|---|---|
| `AÇIK` | Açık doğrulandı, henüz kapatılmadı |
| `KAPALI` | Kapatıldı ve test edilerek doğrulandı |
| `TEST EDİLMEDİ` | Henüz denenmedi |
| `İNCELENİYOR` | Kısmi bilgi var, kesinleşmedi |

## Matris

| # | Saldırı | Durum | Önlem / kanıt |
|---|---|---|---|
| 1 | Öğrenci A, öğrenci B'nin verisine erişebilir mi? | **KAPALI** | Öğrenci kimliği parametreden değil jetondan okunur. `ogrenci_odevleri` yalnız `o.ogrenci_id` üzerinden sorgular. Ayrıca `odev_gonder` ödevin öğrencinin sınıfına ait olduğunu doğrular. |
| 2 | Öğrenci başka bir öğrencinin gönderimine erişebilir mi? | **KAPALI** | `dosya_erisim_izni` yalnız kendi `foto_yolu` kaydına izin verir. Bucket private. |
| 3 | Öğrenci öğretmen fonksiyonlarını çağırabilir mi? | **KAPALI** | Test 13: `ogretmen_panosu(t_ogrenci)` → `insufficient_privilege`. |
| 4 | Veli başka bir velinin verisine erişebilir mi? | **KAPALI** | `veli_paneli` yalnız jetondaki `ogrenci_id`'yi kullanır; parametre almaz. |
| 5 | Yetkisiz kullanıcı cevap anahtarına erişebilir mi? | **KAPALI** | Bucket private (0002). `dosya_erisim_izni` veliye anahtarı vermez. Test 12: veli çıktısında `cevap_anahtari` yok. |
| 6 | Cevap anahtarı teslim öncesi alınabilir mi? | **KAPALI** | Test 8: teslim yokken `cevap_anahtari` ve `anahtar_yolu` sorguda `null`. Karar sunucuda, istemcide gizleme yok. |
| 7 | İstemci tarafı yetkilendirme atlatılabilir mi? | **KAPALI** | Anon izolasyon testi: 13 tablonun tamamı `permission denied`. Yetki kararı yalnız sunucuda. |
| 8 | PIN / giriş deneme limiti atlatılabilir mi? | **KAPALI** | `giris_denemeleri` + `_kilitli_mi`: 15 dakikada 8 hatalı deneme → kilit. IP hash'lenerek saklanır. |
| 9 | Dosyalara URL tahmin ederek erişilebilir mi? | **KAPALI** | Bucket `public = false`. `storage.objects` üzerinde anon politikası `using (false)`. |
| 10 | Mesajlar üzerinden XSS çalıştırılabilir mi? | **KAPALI (tasarım)** | Mesaj düz metin saklanır; React varsayılan kaçışı uygular, `dangerouslySetInnerHTML` hiç kullanılmaz. Arayüz Faz 3E'de geldi ve denendi: `Veliler`/`VeliPanel` mesajı düz metin olarak basıyor, `dangerouslySetInnerHTML` depoda hiç geçmiyor. |
| 11 | SQL enjeksiyonu mümkün mü? | **KAPALI** | Tüm RPC parametreleri tipli. Dinamik SQL yalnız iki yerde: 0002'deki migration döngüsü (sabit dizi) ve testler. Kullanıcı girdisiyle string birleştirme yok. |
| 12 | Öğrenci mükerrer gönderimle notu manipüle edebilir mi? | **KAPALI** | `gonderim_tek UNIQUE (odev_id, ogrenci_id)`. Test 11: ikinci gönderim `unique_violation`, tabloda tek kayıt. |
| 13 | Yeniden puanlama yetkisiz tetiklenebilir mi? | **KAPALI** | 0008'de geldi. `odev_guncelle` `_ogretmen(p_token)` şartı taşıyor; öğrenci ve veli çağıramıyor (`odev_duzenleme_testleri.sql`). Anahtar değişip gönderim varsa puanlar `_puanla` ile yeniden hesaplanıyor ve **puanı değişen her öğrenci `denetim_izi`'ne yazılıyor** (Part XLIII). Öğretmene eski→yeni puan listesi gösteriliyor; sessiz not değişikliği yok. |
| 14 | Silinen öğrenci erişimini koruyabilir mi? | **KAPALI** | Test 16: pasifleştirme kodları siler ve oturumları iptal eder; sonraki çağrı reddedilir. |
| 15 | Sınıf değişikliği geçmiş veriyi sızdırır mı? | **KISMEN** | Ödev artık `sinif_id` FK ile bağlı, serbest metin değil. Ancak öğrenci sınıf değiştirirse eski sınıfın ödevleri listesinden düşer — geçmiş notlar `gonderimler`'de durur ama görünürlük Faz 2'de ele alınmalı. |
| + | Dahili fonksiyonlar dışarıdan çağrılabilir mi? | **KAPALI** | *Bu madde listede yoktu, test sırasında ortaya çıktı.* Bkz. yukarıdaki "yakalanan gerçek açık". |

## Kalan riskler — gizlenmiyor

1. ~~Migration'lar Supabase'e uygulanmadı.~~ **ÇÖZÜLDÜ.** 0001–0021
   canlıda; uçlar canlıya karşı yoklanarak doğrulandı. "KAPALI" işaretleri
   hem yerelde hem canlıda geçerli.
2. ~~İmzalı URL Edge Function'ı deploy edilmedi.~~ **ÇÖZÜLDÜ.**
   `dosya-url` canlıda; ödev PDF'i ve çözüm fotoğrafı akışları çalışıyor.
   Yetki kararı hâlâ SQL'de (`dosya_erisim_izni`), fonksiyon yalnız imzalıyor.
3. **XSS arayüz geldikten sonra da yalnız tasarım düzeyinde kapalı.**
   Arayüz Faz 2–3E'de geldi ve `dangerouslySetInnerHTML` hiç kullanılmadı,
   ama saldırgan girdisiyle sistematik bir deneme YAPILMADI. Faz 11'e ait.
4. **Madde 15 kısmen açık.** Sınıf değiştiren öğrencinin geçmiş ödev
   görünürlüğü Faz 2'de karara bağlanacak.
5. **Deneme limiti IP'ye dayanıyor.** Aynı okul ağından çıkan öğrenciler
   aynı IP'yi paylaşabilir; bir öğrencinin hatalı denemeleri diğerlerini
   kilitleyebilir. Faz 11'de kod bazlı ayrı sayaç değerlendirilecek.

## Faz 0'da doğrulanmış açıklar (silinen projedeydi — tarihsel kayıt)

Üçü ölçümle kesinleşti:

**A. Public storage bucket (madde 5, 9).** `/storage/v1/object/public/odevler/…`
isteği "Bucket not found" değil `NoSuchKey` döndürdü ⇒ bucket var ve public
okuma açık. Cevap anahtarı PDF'leri ve öğrenci çözüm fotoğrafları korunmasız.

**B. Giriş deneme limiti yok (madde 8).** `giris_denemeleri` tablosu
veritabanında mevcut değil. Öğrenci ve veli kodları kısa; limit olmadan kaba
kuvvet zaman meselesi.

**C. Mükerrer teslim kısıtı yok (madde 12).** `gonderimler` şemasında yalnız
`PRIMARY KEY (id)` var. Aynı öğrenci aynı ödeve birden çok gönderim
yapabilir. RPC kontrol etse bile uygulama katmanı kontrolü yarış koşuluna
açıktır — kısıt veritabanında olmalı.

## Faz 1 kapatma sırası

1. Bucket private + imzalı URL (A)
2. `ogrenci_odevleri` anahtar kırpma doğrulaması (madde 6)
3. `UNIQUE (odev_id, ogrenci_id)` (C)
4. PIN hash + oturum jetonu (madde 3, 7)
5. `giris_denemeleri` + kilitleme (B)
