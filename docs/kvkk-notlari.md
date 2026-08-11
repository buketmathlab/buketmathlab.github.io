# KVKK ve Gizlilik Notları

**Bu belge hukuki görüş değildir.** Teknik bir envanter ve dikkat
listesidir. Doğrulanmamış hiçbir hukuki iddia yazılmamıştır. Uyum
değerlendirmesi için okul yönetimi ve gerekiyorsa hukuk desteği gerekir.

## Neden önemli

Sistemde **reşit olmayan öğrencilerin** kişisel verisi işleniyor. Bu, KVKK
açısından özel dikkat gerektiren bir durumdur ve velinin bilgilendirilmesi
ile okulun onayı büyük olasılıkla gerekir.

## İşlenen veri envanteri

| Veri | Nerede | Kim görebiliyor |
|---|---|---|
| Öğrenci adı soyadı | `ogrenciler.ad` | Öğretmen, ilgili öğrenci, ilgili veli |
| Sınıf | `ogrenciler.sinif` | aynı |
| Öğrenci / veli giriş kodu | `ogrenciler.ogrenci_kodu`, `veli_kodu` | Öğretmen üretir ve paylaşır |
| Ödev çözümü fotoğrafı | Storage `odevler` bucket | **şu an URL'i bilen herkes** |
| Cevaplar, puan, öğretmen yorumu | `gonderimler` | Öğretmen, öğrenci, veli |
| Öğretmen–veli mesajları | `mesajlar` | Öğretmen ve ilgili veli |
| Ders planı | `dersler` | Özel ders öğrencisi ve velisi |
| Ödeme kaydı | `odemeler` | Özel ders öğrencisi velisi |

**Açık uyarı:** Çözüm fotoğrafları bugün korumasız. Öğrencinin el yazısı,
bazen adı, bazen çevresi bu fotoğraflarda görünür. Bu, envanterdeki en
hassas kalem ve Faz 1'in ilk işi.

## Barındırma ve yurt dışı aktarım

Supabase projesi **Zürih (eu-central-2)** bölgesinde — öğretmen tarafından
teyit edildi. Yani veriler **İsviçre'de** tutuluyor.

Bu, KVKK açısından bir **yurt dışına aktarım** durumudur. Değerlendirilmesi
gereken noktalar:

- Aktarımın hangi hukuki dayanağa göre yapıldığı (açık rıza, taahhütname,
  yeterlilik kararı vb.) belirlenmelidir.
- KVKK'nın yurt dışına aktarım rejimi 2024'te değişti; güncel mevzuata göre
  değerlendirme yapılmalıdır.
- Bu belgeyi yazan taraf hukukçu değildir; **hangi dayanağın geçerli olduğu
  konusunda iddia içermez.**

**Yapılması gereken:** Okul yönetimine barındırma bölgesinin İsviçre olduğu
bildirilmeli ve uygun dayanağın belirlenmesi istenmelidir.

## Yapay zekâ işlemesi

Faz 6'da açık uçlu ödev değerlendirmesinde yapay zekâ kullanılması
planlanıyor. Bu, **öğrenci çalışmasının üçüncü taraf bir servise
gönderilmesi** demektir ve ayrı değerlendirme gerektirir.

Şimdiden karar altına alınan kısıtlar:

- Test puanlamasında yapay zekâ **kullanılmaz** (Kural 5). Deterministik,
  denetlenebilir, tekrarlanabilir hesap yapılır.
- Yapay zekâ kullanılacaksa hangi verinin gönderildiği açıkça belgelenir.
- Yapay zekâ servisi kapalıyken ürünün geri kalanı çalışmaya devam eder.
- API anahtarları tarayıcıya **hiçbir koşulda** konmaz.
- Yapay zekâ önerisi karar değildir; öğretmen onaylar, düzenler veya
  reddeder.

Faz 6'ya gelmeden önce velinin bilgilendirilmesi gerekip gerekmediği
netleştirilmelidir.

## Veri saklama ve silme

Bugün eksik olanlar:

- **Saklama süresi tanımlı değil.** Mezun olan öğrencinin verisi ne kadar
  tutulacak?
- **Silme geri alınamaz ve izsiz.** `ogrenci_sil` tüm kayıtları siliyor;
  denetim izi yok.
- **Dışa aktarma yok.** Veli ya da öğrenci kendi verisinin kopyasını
  isteyebilir; bugün karşılığı yok.

Faz 1'de denetim izi, Faz 10'da yedekleme ve dışa aktarma planlanıyor.

## Üçüncü taraflara giden veri

| Taraf | Ne gidiyor | Durum |
|---|---|---|
| Supabase (İsviçre) | Tüm uygulama verisi | Zorunlu altyapı |
| GitHub Pages | Statik dosyalar; ziyaretçi IP'si erişim loglarında | Barındırma |
| ~~Google Fonts~~ | ~~Ziyaretçi IP'si~~ | **Kaldırıldı** — fontlar self-host |
| ~~jsDelivr / cdnjs~~ | ~~Ziyaretçi IP'si~~ | **Kaldırıldı** — CDN bağımlılığı yok |

Mevcut uygulama Google Fonts ve iki CDN kullanıyor; SEKİZ'de üçünün de
bağımlılığı kaldırıldı. Bu, üçüncü tarafa giden ziyaretçi IP'si sayısını
azaltıyor.

## Öğretmen için dikkat listesi

1. Okul yönetimine sistemin varlığını ve barındırma bölgesini bildirin.
2. Velileri hangi verinin işlendiği konusunda bilgilendirin.
3. Öğrenci ve veli kodlarını güvenli kanaldan paylaşın; kod bir şifredir.
4. Faz 6'dan önce yapay zekâ değerlendirmesi konusunda karar alın.
5. Faz 1 tamamlanana kadar çözüm fotoğrafı bağlantılarını kimseyle
   paylaşmayın — bugün korumasızlar.
