# Güvenlik Mimarisi

**Durum: HEDEF MİMARİ. Faz 0'da yazıldı, Faz 1'de uygulanacak.**
Bu belgedeki hiçbir madde henüz hayata geçirilmedi. Uygulanan maddeler
Faz 1'de "UYGULANDI" olarak işaretlenecek. Uygulanmamış bir korumayı
uygulanmış gibi göstermek, hiç korumamaktan daha tehlikelidir.

## Tehdit modeli

Sistemde reşit olmayan öğrencilerin kişisel verisi var: ad, sınıf, ödev
çözümleri, notlar, veli iletişimi. Saldırgan profili "hedefli bir dış
saldırgan"dan çok **meraklı bir öğrenci**: tarayıcı geliştirici araçlarını
açabilen, URL kurcalayabilen, arkadaşının kodunu deneyebilen biri.

Bu profil, korumanın nerede olması gerektiğini belirler: **istemcide alınan
hiçbir karar güvenlik sayılmaz.**

## 1. Oturum

### Mevcut (zayıf)
Öğretmen PIN'i `localStorage`'da düz metin duruyor ve her istekte
`p_pin` olarak gönderiliyor. Süre sonu yok, iptal yok.

### Hedef
- `giris`, kriptografik rastgele bir **oturum jetonu** üretir.
- Veritabanında yalnız jetonun **hash'i** saklanır (`oturumlar` tablosu:
  `token_hash`, `rol`, `ogrenci_id`, `olusturma`, `son_kullanma`, `iptal`).
- Tüm RPC'ler `p_pin` yerine `p_token` alır. PIN yalnız girişte bir kez gider.
- PIN, `ayarlar` tablosunda `pgcrypto` ile hash'lenir (`crypt` + `gen_salt`).
- Jeton süresi dolar; öğretmen tüm oturumları iptal edebilir.

**Neden jeton:** PIN sürekli ağda dolaşmamalı. Jeton sızarsa süresi dolar ve
iptal edilebilir; PIN sızarsa hesap kalıcı olarak düşer.

## 2. Giriş deneme limiti

`giris_denemeleri` tablosu: `kod_hash`, `ip_hash`, `zaman`, `basarili`.

- Belirli süredeki başarısız deneme sayısı aşılırsa kilit.
- Kilit süresi kademeli artar.
- Öğretmen için güvenli PIN sıfırlama yolu bulunur.
- Denenen kodun kendisi ham hâlde loglanmaz.

**Neden gerekli:** Öğrenci ve veli kodları kısa. Limit olmadan kaba kuvvetle
başka bir öğrencinin koduna ulaşmak zaman meselesidir.

## 3. Dosya erişimi

### Mevcut (kritik açık)
`odevler` bucket'ı public. Doğrulandı: public URL isteği "Bucket not found"
değil `NoSuchKey` döndürüyor — bucket var ve public okuma açık. Yani cevap
anahtarı PDF'leri ve öğrenci çözüm fotoğrafları, URL'i ele geçiren herkese
açık. URL'ler UUID tabanlı olduğu için tahmin edilemez, ama paylaşılan,
loglanan ya da tarayıcı geçmişine düşen her URL korumasızdır.

### Hedef
- Bucket **private** yapılır.
- İstemci dosyaya doğrudan erişmez. Erişim, yetkiyi kontrol eden bir
  `SECURITY DEFINER` fonksiyonun ürettiği **kısa ömürlü imzalı URL** ile olur.
- Veritabanındaki eski public URL'ler dosya yoluna dönüştürülür (veri kaybı
  olmadan).
- Yükleme sırasında dosya tipi ve boyutu sunucuda doğrulanır.

## 4. Cevap anahtarı

Ürünün en hassas verisi budur; sızarsa değerlendirmenin tamamı anlamsızlaşır.

- Cevap anahtarı, öğrenci teslim etmeden **tarayıcıya hiç gönderilmez**.
  `display:none`, koşullu render ya da istemci filtresi koruma sayılmaz.
- Kararı sunucu verir: `ogrenci_odevleri`, teslim yoksa `anahtar` ve
  `anahtar_url` alanlarını sorgudan **çıkarır**.
- **Veliye hiçbir koşulda gönderilmez** (Kural 6). Veli paneli anahtar
  alanlarını hiç seçmez.
- Faz 1'in ilk işlerinden biri: mevcut `ogrenci_odevleri` fonksiyonunun bunu
  gerçekten yaptığını doğrulamak.

## 5. Yetkilendirme

- Tablolara doğrudan erişim anon rolüne kapalı kalır (bugünkü durum korunur).
- Her `SECURITY DEFINER` fonksiyon, ilk satırında jetonu doğrular ve rolü
  belirler; parametreden gelen kimliğe güvenmez.
- Öğrenci yalnız kendi kaydına, veli yalnız kendi öğrencisine erişir.
  Bu kısıt sorgunun `WHERE` şartında olur, istemcide değil.
- `search_path` her fonksiyonda sabitlenir (`SECURITY DEFINER` fonksiyonlarda
  standart sertleştirme).

## 6. Veri bütünlüğü ve denetim izi

- Teslim, puanlama, cevap anahtarı revizyonu ve yeniden puanlama işlemleri
  atomik olur; kısmi durum bırakılmaz.
- Mükerrer teslim veritabanı kısıtıyla engellenir (uygulama kontrolü yeterli
  değil).
- `denetim_izi` tablosu: kim, ne zaman, neyi, hangi değerden hangi değere.
  Özellikle not değişiklikleri ve cevap anahtarı revizyonları.
- Not hiçbir zaman sessizce değişmez; değişirse iz kalır ve ilgili
  öğrenci/veli bilgilendirilir.

## 7. İstemci tarafı

- Metin her yerde kaçışlanır; `dangerouslySetInnerHTML` kullanılmaz.
  (React varsayılan olarak kaçışlar; kural bunu bozmamaktır.)
- Mesajlarda HTML render edilmez.
- Gizli anahtar istemciye konmaz. Yapay zekâ anahtarları yalnız sunucu
  tarafında (Edge Function) durur.
- Kullanıcıya teknik hata dökümü gösterilmez.

## Uygulama sırası (Faz 1)

1. Public bucket açığını kapat, dosyaları taşı.
2. `ogrenci_odevleri`'nin cevap anahtarını sunucuda kırptığını doğrula.
3. PIN hash'leme + oturum jetonu.
4. `giris_denemeleri` + kilitleme.
5. `siniflar` tablosu.
6. Denetim izi.
