/**
 * OKUL YÖNETİMİ BİLGİLENDİRMESİ — 0039.
 *
 * `docs/kvkk-notlari.md`'nin dikkat listesindeki ilk madde: "Okul
 * yönetimine sistemin varlığını ve barındırma bölgesini bildirin."
 * Bugüne kadar metni yoktu.
 *
 * METİNDE RAKAM YOK — VE BU KURAL ÖLÇÜLÜYOR.
 *
 * Böyle bir belgenin en olası bozulma biçimi, yazıldığı gün doğru olup
 * altı ay sonra yanlış olmasıdır. Bu depoda iki kez yaşandı:
 *
 *   1. `docs/kvkk-notlari.md` bir ay boyunca "çözüm fotoğrafları
 *      korumasız" dedi; oysa o açık kapanmıştı.
 *   2. Onam metni "matematik zümresindeki öğretmenler — dört kişi" dedi;
 *      yanlıştı ve öğretmen yakaladı.
 *
 * Okul yönetimine verilen bir kâğıtta aynı şey olursa daha kötü. Bu
 * yüzden buradaki cümlelerde HİÇBİR SAYI YOK: kaç öğretmen, kaç sınıf,
 * kaç öğrenci, kaç veli onam vermiş — hepsi `okul_bilgilendirme` ucundan
 * canlı geliyor ve belgeye ayrı bir bölüm olarak basılıyor.
 * `okul-bilgilendirme.test.ts` metinde rakam ve "dört öğretmen" gibi
 * yazıyla sayı BULUNMADIĞINI ölçüyor.
 *
 * BURADAKİ HER CÜMLE ÜRÜNÜN GERÇEKTE YAPTIĞI ŞEY — kaynaklarıyla:
 *   - Zürih/İsviçre barındırma: `docs/kvkk-notlari.md` (öğretmen teyit etti)
 *   - kapsam kuralı: `_ogretmenin_ogrencisi`, `_yonetici` (0033)
 *   - şifreler bcrypt, yedeğe girmiyor: `disa_aktar` (0033)
 *   - fotoğraf private bucket + imzalı URL: `dosya-url/index.ts` (0009)
 *   - test puanlamasında yapay zekâ yok: Kural 5, `guvenlik_testleri.sql`
 *   - veli onamı ve sınıf dökümü: 0034–0038
 *
 * BU METİN HUKUKİ GÖRÜŞ DEĞİLDİR. Ürünün ne yaptığını dürüstçe anlatır;
 * mevzuata uygunluk değerlendirmesi okul yönetiminin ve gerekiyorsa bir
 * hukukçunun işidir.
 */

/** Belgeyi imzalayan — okul yönetimine hitap eden resmî bir bildirim. */
export const OKUL_SORUMLU = {
  ad: 'Buket Topuzoğlu',
  sifat: 'Matematik öğretmeni',
} as const;

export const OKUL_BASLIK = 'Okul Yönetimi Bilgilendirmesi';

export const OKUL_GIRIS =
  'Matematik derslerinde öğrencilerin ödevlerini vermek, topladığım ' +
  'çözümleri değerlendirmek ve velileri bilgilendirmek için SEKİZ adlı ' +
  'bir web uygulaması kullanıyorum. Bu belge, uygulamanın ne yaptığını, ' +
  'hangi bilgileri tuttuğunu ve bu bilgilerin nerede saklandığını okul ' +
  'yönetiminin bilgisine sunmak için hazırlandı.';

export type OkulBolumu = {
  readonly baslik: string;
  readonly maddeler: readonly string[];
};

export const OKUL_BOLUMLERI: readonly OkulBolumu[] = [
  {
    baslik: 'Uygulama ne yapıyor',
    maddeler: [
      'Öğretmen ödev yayınlıyor; öğrenci kendi giriş koduyla girip ' +
        'ödevini görüyor ve çözümünü gönderiyor.',
      'Test ödevlerinde puan, cevap anahtarıyla karşılaştırılarak ' +
        'hesaplanıyor. Aynı kâğıt her zaman aynı sonucu veriyor.',
      'Veli kendi giriş koduyla girip çocuğunun gidişatını izliyor ve ' +
        'öğretmenle yazışabiliyor.',
      'Uygulama ders saatlerinin dışında, öğrencinin kendi cihazından ' +
        'kullanılıyor. Okulun ağına, cihazlarına ya da sistemlerine ' +
        'bağlanmıyor.',
    ],
  },
  {
    baslik: 'Hangi bilgiler tutuluyor',
    maddeler: [
      'Öğrencinin adı ve soyadı.',
      'Sınıfı — yalnız seviye ve şube olarak. Okulun adı öğrenci ' +
        'kaydında tutulmuyor.',
      'Ödevleri: verdiği cevaplar, aldığı puan ve öğretmen yorumu.',
      'Ödev için yüklediği çözüm kâğıdı fotoğrafı.',
      'Öğretmenle veli arasındaki ve öğretmenle öğrenci arasındaki ' +
        'mesajlar — bu ikisi birbirine kapalı.',
      'Öğrenci ve veli giriş kodları.',
      'Adres, telefon, kimlik numarası, doğum tarihi ve öğrenci ' +
        'fotoğrafı İSTENMİYOR ve tutulmuyor.',
    ],
  },
  {
    baslik: 'Kim erişebiliyor',
    maddeler: [
      'Her öğretmen yalnız kendi sınıflarındaki öğrencilerin bilgilerini ' +
        'görüyor. Başka bir sınıfın öğretmeni erişemiyor; bu sınır ' +
        'uygulamanın kendisinde, sunucu tarafında kurulu.',
      'Platformu yürüten öğretmen, yönetim işleri için sistemin ' +
        'tamamını görebiliyor.',
      'Öğrenci ve veli yalnız kendilerine ait bilgileri görüyor.',
      'Okul dışından hiç kimsenin erişimi yok; uygulamada herkese açık ' +
        'bir öğrenci listesi ya da sonuç sayfası bulunmuyor.',
    ],
  },
  {
    baslik: 'Nerede saklanıyor ve nasıl korunuyor',
    maddeler: [
      'Bilgiler Supabase adlı hizmet üzerinde, İsviçre’nin Zürih ' +
        'bölgesindeki sunucularda tutuluyor. Yani veriler Türkiye ' +
        'dışında saklanıyor. Bu, mevzuat açısından değerlendirilmesi ' +
        'gereken bir noktadır ve bu belgenin hazırlanma sebeplerinden ' +
        'biridir.',
      'Şifreler açık hâlde saklanmıyor; geri döndürülemez biçimde ' +
        'saklanıyor ve yedeğe de girmiyor.',
      'Çözüm fotoğrafları internette açık bir adreste durmuyor. Her ' +
        'açılışta, yalnız o kişiye özel ve kısa ömürlü bir bağlantıyla ' +
        'getiriliyor.',
      'Veritabanına dışarıdan doğrudan erişim kapalı; her işlem yetki ' +
        'denetiminden geçen tanımlı uçlar üzerinden yapılıyor.',
      'Not ve kayıt değişiklikleri denetim izine yazılıyor.',
      'Yedek alınabiliyor ve geri yükleme düzenli olarak deneniyor.',
    ],
  },
  {
    baslik: 'Yapay zekâ kullanımı',
    maddeler: [
      'Test ödevlerinin puanlanmasında yapay zekâ KULLANILMIYOR. Puan, ' +
        'cevap anahtarıyla karşılaştırma sonucu çıkıyor.',
      'Öğrenci çalışmaları herhangi bir yapay zekâ hizmetine ' +
        'gönderilmiyor.',
    ],
  },
  {
    baslik: 'Velilerin bilgilendirilmesi',
    maddeler: [
      'Veli, uygulamaya ilk girişinde yukarıdakileri anlatan bir onam ' +
        'metnini okuyup adını yazarak onaylıyor. Onaylamayan veli veli ' +
        'paneline giremiyor.',
      'Onaylar tarihiyle birlikte kaydediliyor; sınıf başına bir onam ' +
        'dökümü yazdırılabiliyor. İstenirse okul yönetimine sunulabilir.',
      'Onam metninin tam hâli bu belgeye ek olarak verilebilir.',
    ],
  },
  {
    baslik: 'Talep hâlinde yapılabilecekler',
    maddeler: [
      'Bir öğrencinin kaydı, veli ya da okul yönetiminin talebiyle ' +
        'kapatılabilir.',
      'Uygulamanın kullanımı, okul yönetiminin uygun görmemesi hâlinde ' +
        'durdurulabilir.',
      'Bu belgedeki her madde hakkında ayrıntılı bilgi verilebilir.',
    ],
  },
];

export const OKUL_KAPANIS =
  'Bu belge bir hukuki uygunluk beyanı değildir; uygulamanın ne yaptığını ' +
  'olduğu gibi anlatır. Değerlendirmenizi ve varsa yönlendirmenizi rica ' +
  'ederim.';

/** Okul yönetiminin dolduracağı bölümün başlığı ve satırları. */
export const OKUL_ONAY_BASLIK = 'Okul yönetimi bölümü';

export const OKUL_ONAY_ACIKLAMA =
  'Bilgi alınmıştır. Aşağıdaki bölüm okul yönetimi tarafından doldurulur.';

export const OKUL_ONAY_ALANLARI: readonly string[] = [
  'Adı ve soyadı',
  'Unvanı',
  'Tarih',
  'İmza',
];

/**
 * Belgenin düz hâli — ölçümler bunu kullanıyor.
 *
 * Bölümlerden TÜRETİLİYOR: iki yerde tutulsaydı biri değişip diğeri
 * kalabilirdi.
 */
export const OKUL_METNI: string = [
  OKUL_BASLIK,
  OKUL_GIRIS,
  ...OKUL_BOLUMLERI.map(
    (b) => `${b.baslik}\n${b.maddeler.map((m) => `- ${m}`).join('\n')}`,
  ),
  OKUL_KAPANIS,
].join('\n\n');
