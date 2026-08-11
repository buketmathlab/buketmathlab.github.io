# Güvenlik Test Matrisi

**Durum: İSKELET. Faz 0'da hazırlandı, Faz 11'de doldurulacak.**

Aşağıdaki 15 madde Part XLIX'un saldırı listesidir. Her satır Faz 11'de
fiilen denenip **RİSK / DURUM / ÖNLEM / KALAN RİSK** olarak doldurulacak.

Kural: **çözülmemiş risk gizlenmez.** Bir madde "test edilmedi" ise öyle
yazılır; "muhtemelen güvenli" diye geçilmez.

## Durum etiketleri

| Etiket | Anlamı |
|---|---|
| `AÇIK` | Açık doğrulandı, henüz kapatılmadı |
| `KAPALI` | Kapatıldı ve test edilerek doğrulandı |
| `TEST EDİLMEDİ` | Henüz denenmedi |
| `İNCELENİYOR` | Kısmi bilgi var, kesinleşmedi |

## Matris

| # | Saldırı | Durum | Bilinen |
|---|---|---|---|
| 1 | Öğrenci A, öğrenci B'nin verisine erişebilir mi? | TEST EDİLMEDİ | Erişim RPC'lerden geçiyor; gövde incelenmedi |
| 2 | Öğrenci başka bir öğrencinin gönderimine erişebilir mi? | TEST EDİLMEDİ | Dosyalar public bucket'ta — URL sızarsa evet |
| 3 | Öğrenci öğretmen fonksiyonlarını çağırabilir mi? | TEST EDİLMEDİ | Öğretmen RPC'leri `p_pin` istiyor; doğrulama gövdede |
| 4 | Veli başka bir velinin verisine erişebilir mi? | TEST EDİLMEDİ | |
| 5 | Yetkisiz kullanıcı cevap anahtarına erişebilir mi? | **AÇIK** | Anahtar PDF'leri public bucket'ta; URL bilen herkes açar |
| 6 | Cevap anahtarı teslim öncesi alınabilir mi? | İNCELENİYOR | Anahtar `odevler` satırının içinde; `ogrenci_odevleri`'nin kırptığı doğrulanmadı |
| 7 | İstemci tarafı yetkilendirme atlatılabilir mi? | TEST EDİLMEDİ | Tablolar anon'a kapalı — iyi işaret |
| 8 | PIN / giriş deneme limiti atlatılabilir mi? | **AÇIK** | Limit **yok**; `giris_denemeleri` tablosu mevcut değil |
| 9 | Dosyalara URL tahmin ederek erişilebilir mi? | **AÇIK** (kısmi) | Bucket public; URL'ler UUID olduğu için tahmin zor ama koruma yok |
| 10 | Mesajlar üzerinden XSS çalıştırılabilir mi? | TEST EDİLMEDİ | Mevcut uygulama `esc()` ile kaçışlıyor; SEKİZ'de React varsayılan kaçışı |
| 11 | SQL enjeksiyonu mümkün mü? | TEST EDİLMEDİ | RPC parametreleri tipli; gövdede dinamik SQL var mı bilinmiyor |
| 12 | Öğrenci mükerrer gönderimle notu manipüle edebilir mi? | **AÇIK** | `gonderimler`'da `(odev_id, ogrenci_id)` UNIQUE kısıtı **yok** — şemadan doğrulandı |
| 13 | Yeniden puanlama yetkisiz tetiklenebilir mi? | GEÇERSİZ | Yeniden puanlama özelliği henüz yok (Faz 5) |
| 14 | Silinen öğrenci erişimini koruyabilir mi? | TEST EDİLMEDİ | Kod tabanlı giriş; kod silinince erişim düşmeli |
| 15 | Sınıf değişikliği geçmiş veriyi sızdırır mı? | TEST EDİLMEDİ | `sinif` serbest metin; ödev sınıf adına göre eşleşiyor |

## Faz 0'da doğrulanmış açıklar

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
