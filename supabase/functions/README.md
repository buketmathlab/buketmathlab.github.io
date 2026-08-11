# Edge Function — imzalı dosya URL'i

## Ne işe yarar

Storage bucket'ı private. Bir dosyaya erişmek için kısa ömürlü **imzalı URL**
gerekiyor ve bunu üretmek Storage API istiyor — SQL'den yapılamıyor.

Ama yetki kararını buraya taşımıyoruz. İş bölümü:

1. Fonksiyon veritabanına sorar: `dosya_erisim_izni(token, yol)`
2. Cevap `true` ise `service_role` ile imzalı URL üretir

Yani **karar SQL'de, imza burada**. Yetki kuralları değişirse tek yerde,
veritabanında değişir.

`service_role` anahtarı yalnız fonksiyonun ortam değişkeninde durur;
tarayıcıya hiçbir zaman gitmez.

## Kurulum

Supabase panelinde **Edge Functions → Deploy a new function**:

```
https://supabase.com/dashboard/project/oymueccauhprkgdrbqtv/functions
```

1. Fonksiyon adı: **`dosya-url`** (tire ile, birebir böyle)
2. `index.ts` içeriğini yapıştırın — dosya bu klasörde
3. Deploy

### Ortam değişkenleri

`SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` Supabase tarafından Edge
Function'lara **otomatik sağlanır**; elle eklemenize gerek yok.

> **Uyarı:** `service_role` anahtarını başka hiçbir yere yazmayın —
> `app/.env` dosyasına, istemci koduna, mesajlara. O anahtar tüm güvenlik
> katmanını atlar. Yalnız Edge Function ortamında kalmalı.

## Doğrulama

Kurulumdan sonra yetkisiz bir istek **403** dönmeli:

```bash
curl -s -X POST \
  "https://oymueccauhprkgdrbqtv.supabase.co/functions/v1/dosya-url" \
  -H "Content-Type: application/json" \
  -H "apikey: <anon anahtarı>" \
  -d '{"token":"gecersiz-jeton-123456789012345678901234567890","yol":"a/b.jpg"}'
```

Beklenen: `{"hata":"Oturumunuz sona erdi. Tekrar giriş yapın."}` (401)
ya da `{"hata":"Bu dosyaya erişim izniniz yok."}` (403).

**200 ve bir URL dönerse durun ve bana haber verin** — bu, yetki kontrolünün
çalışmadığı anlamına gelir.

## Ne zaman gerekli

Dosya akışları bu fonksiyon kurulmadan çalışmaz:

- Ödev sorusu ve cevap anahtarı PDF'i yükleme (öğretmen)
- Çözüm fotoğrafı yükleme (öğrenci)
- Yüklenen dosyaları görüntüleme

Faz 2A'da (giriş, pano, sınıflar, öğrenciler) bu akışların hiçbiri
kullanılmıyor — yani kurulumu Faz 2B'ye kadar erteleyebilirsiniz. Kurmadan
önce dosyalara kimse erişemez; güvenli taraf.

## Tasarım notları

- İmzalı URL ömrü **60 saniye**. Bağlantı paylaşılsa bile hızla ölür.
- Yol doğrulaması: `..` içeren veya `/` ile başlayan yollar reddedilir.
- Yetkisiz istekte dosyanın var olup olmadığı **sızdırılmaz** — hem yok hem
  yetkisiz durumda aynı cevap döner.
- Hata ayrıntıları yalnız sunucu günlüğüne yazılır, kullanıcıya gitmez.
