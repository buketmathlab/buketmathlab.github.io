# Veritabanı — kurulum ve bakım

## Durum

| Konu | Değer |
|---|---|
| Proje | `oymueccauhprkgdrbqtv` |
| Migration'lar | `supabase/migrations/` — 6 dosya |
| Uygulandı mı? | **HAYIR — öğretmen tarafından çalıştırılması gerekiyor** |
| Yerel testler | **Geçti** (PostgreSQL 16.13 üzerinde, gerçek veritabanıyla) |

Migration'ları uygulamak için veritabanı şifresi ya da erişim jetonu
gerekiyor; bende yok. Aşağıdaki adımları öğretmenin çalıştırması gerekiyor.

## Nasıl uygulanır

Supabase panelinde **SQL Editor**'ü açın ve dosyaları **sırayla** çalıştırın:

```
https://supabase.com/dashboard/project/oymueccauhprkgdrbqtv/sql
```

| Sıra | Dosya | Ne yapar |
|---|---|---|
| 1 | `0001_temel_sema.sql` | Tablolar, kısıtlar, tetikleyiciler |
| 2 | `0002_yetkiler_rls.sql` | Tablo yetkilerini kapatır, RLS, private bucket |
| 3 | `0003_guvenlik_fonksiyonlari.sql` | PIN hash, oturum jetonu, deneme limiti |
| 4 | `0004_rpc_katmani.sql` | Uygulama fonksiyonları |
| 5 | `0005_fonksiyon_yetkileri.sql` | **İzin listesi — atlanırsa sistem açık kalır** |
| 6 | `0006_baslangic_verisi.sql` | 12 sınıf |

**Sıra önemli.** Özellikle `0005` atlanmamalı: PostgreSQL yeni fonksiyonlara
varsayılan olarak `PUBLIC` rolüne çalıştırma hakkı verir ve bu, dahili
fonksiyonların dışarıdan çağrılabilmesi anlamına gelir. Yerel testte tam da
bu yakalandı — `_oturum_ac('ogretmen', null)` dışarıdan çağrılabiliyor,
yani PIN bilmeden öğretmen jetonu üretilebiliyordu. `0005` bunu kapatır.

Her dosyanın sonunda hata çıkmadığını kontrol edin. `0006` çalıştığında
şu bildirimi görmelisiniz:

```
NOTICE: Sınıflar yüklendi: 12 adet, 9A … 12C
```

## Uygulandıktan sonra

1. **İlk PIN'i belirleyin.** Uygulamada giriş ekranına herhangi bir şey
   yazın; sistem PIN belirlenmemişse kurulum ekranına yönlendirir. PIN en az
   6 haneli olmalı ve **bcrypt ile hash'lenerek** saklanır — düz metin
   tutulmaz, panelden okunamaz.
2. **Sınıfları gözden geçirin.** 12 sınıf yüklü gelir; fazlasını arşivleyin,
   eksik varsa ekleyin.
3. **Öğrencileri girin.** Her öğrenci için otomatik olarak bir öğrenci ve bir
   veli kodu üretilir.

## Yerel test

Supabase'e hiç dokunmadan, sıfırdan bir PostgreSQL kurup tüm migration'ları
uygular ve davranış testlerini çalıştırır:

```bash
supabase/testler/calistir.sh
```

Test kapsamı (`supabase/testler/`):

- `guvenlik_testleri.sql` — 18 grup: PIN hash'leme, deterministik puanlama,
  cevap anahtarı sızıntısı, mükerrer teslim, rol ayrımı, oturum iptali,
  denetim izi, özel ders kısıtı
- `anon_izolasyon.sql` — 13 tablo ve 7 dahili fonksiyonun dışarıdan
  erişilemediğinin doğrulanması

Her ikisi de Faz 1'de geçti.

## Bilinen eksik: imzalı URL

Bucket private. Dosya erişim **kararı** SQL'de veriliyor
(`dosya_erisim_izni`), ama imzalı URL'i **üretmek** Storage API gerektiriyor
ve SQL'den yapılamıyor. Bu adım bir Edge Function'a düşecek: önce
`dosya_erisim_izni` çağrılacak, yetki varsa `service_role` ile imzalı URL
üretilecek.

Edge Function Faz 1'de **deploy edilmedi** (deploy erişimi yok). Dosya
yükleme/indirme akışı Faz 2–3'te arayüzle birlikte devreye girecek. Bu arada
bucket private olduğu için dosyalara kimse erişemez — güvenli taraf.

## Yedekleme

`disa_aktar(p_token)` fonksiyonu tüm veriyi tek bir JSON olarak döndürür:
sınıflar, öğrenciler, **giriş kodları**, ödevler, gönderimler, mesajlar,
dersler, ödemeler.

Bu fonksiyon Faz 10'dan Faz 1'e alındı. Sebebi somut: önceki canlı
veritabanı silindi ve geri getirilemedi. Geri getirilemeyen bir sistemde
yedeklemeyi sona bırakmak savunulabilir değil.

**Öğretmene öneri:** dönem başında ve her sınav döneminde bir dışa aktarım
alıp kendi bilgisayarınıza kaydedin. Özellikle giriş kodları kritik —
onlar olmadan tüm öğrenci ve velilere yeni kod dağıtmak gerekir.

## Şema kararları — neden böyle

| Karar | Gerekçe |
|---|---|
| `giris_kodlari` ayrı tablo | Eski şemada öğrenci ve veli kodu iki ayrı UNIQUE sütundu; **aralarında** çakışma engellenmiyordu. Tek tabloda birincil anahtar olunca bu hata sınıfı imkânsız. |
| Kodlar düz metin | Öğretmenin kodu öğrenciye yeniden gösterebilmesi gerekiyor; hash'lenirse bu iş akışı kırılır. Koruma entropi (8 karakter × 32 harf) ve deneme limitinden geliyor. |
| `gonderimler` UNIQUE kısıtı | Mükerrer teslimi uygulama katmanında kontrol etmek yarış koşullarına açık; kısıt veritabanında olmalı. |
| Öğrenci silinmez, pasifleşir | Eğitim kaydı sessizce yok edilmemeli. Pasif öğrencinin kodları silinir, oturumları iptal edilir — erişim anında düşer. |
| Sınıf silinmez, arşivlenir | Geçmiş ödev kayıtları sınıfa bağlı; silinirse tarih bozulur. |
| `seviye` + `sube` ayrı alan | Doğal sıralama. Metin sıralamasında "10A" < "9A" olurdu. |
| Ödev taslak başlar | Doğrulanmamış cevap anahtarı yayına çıkamaz (Part XXVIII). |
