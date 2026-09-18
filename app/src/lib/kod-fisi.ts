/**
 * Kod fişinin METNİ — React'siz, doğrudan test edilebilir (`lib/` ilkesi).
 *
 * CÜMLELER TASLAK VE TEK DOSYADA. `ewalu-puan.ts` ve `karne-sozu.ts` ile
 * aynı desen: öğretmen beğenmezse tek yerden değişir, ekranlara dağılmış
 * metin aramak gerekmez.
 *
 * ÖĞRENCİ FİŞİ VE VELİ FİŞİ AYRI — ve bu bir tasarım tercihi değil,
 * ölçülmüş bir zorunluluk:
 *
 *   1. `veli_paneli` özel ders öğrencisinde ÖDEMELERİ döndürüyor. Veli
 *      kodunu eline alan öğrenci borç bilgisini görür — öğretmenin kalıcı
 *      kuralı bunu yasaklıyor.
 *   2. 0025'in bütün varlık sebebi veli↔öğretmen yazışmasını öğrenciden
 *      ayırmaktı ("Ali son zamanlarda tembelleşti" gibi cümleler). Veli
 *      kodunu alan öğrenci o yazışmayı okur.
 *
 * Tek fişe iki kodu basmak, çocuğun eline velinin kanalını vermek olurdu.
 */

/**
 * Öğrencinin ve velinin adres çubuğuna yazacağı yer.
 *
 * NEDEN SADECE ALAN ADI, `/yeni/` YOK: bu satırı bir çocuk telefonda
 * ELLE yazıyor. Kökteki sayfa zaten `/yeni/`'ye düşürüyor ve o
 * yönlendirme üç katmanlı — `kok-denetimi.mjs` JavaScript kapalıyken
 * bile çalıştığını ölçüyor. Altı karakter fazla yazdırmanın ve eğik
 * çizgiyi yanlış koyan çocuğu kaybetmenin karşılığı yok.
 *
 * ESKİ ADRES ÖLMEDİ: `buketmathlab.github.io/yeni/` yazan eski fişler
 * çalışmaya devam ediyor, GitHub onları 301 ile buraya yönlendiriyor
 * (18 Eylül'de ölçüldü). Yani dağıtılmış kâğıtları toplamak gerekmiyor.
 */
export const ADRES = 'sekizkyal.com';

export type FisTuru = 'ogrenci' | 'veli';

export type Fis = {
  /** Fişin sahibi kim — başlıkta yazıyor. */
  tur: FisTuru;
  /** Öğrencinin adı. Veli fişinde de var: hangi çocuğun velisi olduğu. */
  ad: string;
  /**
   * Okul numarası — yoksa `null`.
   *
   * Fişler 0044'ten sonra NUMARA SIRASINDA basılıyor. Numara fişte
   * görünmeseydi sıra keyfî görünürdü; üstelik dağıtırken öğretmenin
   * aradığı şey zaten numara.
   */
  no: string | null;
  sinif: string;
  kod: string;
};

/**
 * KURULUM YÖNERGESİ — telefona uygulama olarak ekleme.
 *
 * NEDEN FİŞTE: öğretmen istedi, ve sebebi ürünün kendisinde. SEKİZ ana
 * ekrana eklenince tarayıcı çubuğu olmadan, kendi simgesiyle, uygulama
 * olarak açılıyor. Bunu bilmeyen bir veli her seferinde adresi yeniden
 * yazar; çoğu da bir daha hiç açmaz.
 *
 * VAAT GERÇEK Mİ — ÖNCE ONU ÖLÇTÜK. Kâğıda basılan her cümle bir söz;
 * olmayan bir şeyi 720 aileye taahhüt edemezdik. Dört şey yerinde:
 * `apple-touch-icon` (iOS manifest simgelerini kullanmıyor),
 * `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` ve
 * manifest'te `display: standalone`.
 *
 * TARAYICININ ADI VE DÜĞMENİN YERİ YAZILIYOR — İKİSİ DE ÖLÇÜLDÜ.
 * İlk yazımda satır yalnız "Paylaş → Ana Ekrana Ekle" diyordu. Öğretmen
 * kendi iPhone'unda DENEDİ VE YAPAMADI: bağlantıyı bir uygulamanın
 * içinden açmıştı ve iOS'ta uygulama içi tarayıcıda "Ana Ekrana Ekle"
 * seçeneği HİÇ YOKTUR. Safari'de açınca hemen oldu.
 *
 * Sonra öğretmen ikinci eksiği söyledi: "Safari'de açtıktan sonra paylaş
 * butonunu nereden bulacak?" Haklıydı — iPhone'da o düğme EKRANIN ALT
 * ORTASINDA ve simgesi tarif edilmeden bulunmuyor. Tarif artık düğmenin
 * YERİNİ ve GÖRÜNÜŞÜNÜ söylüyor.
 *
 * "UYGULAMAYI YÜKLE" ALTERNATİFİ Android satırında duruyor: Chrome
 * koşullar sağlanınca menüde "Ana ekrana ekle" yerine bunu yazıyor. Tek
 * etiket yazsaydık, öteki etiketi gören veli aradığını bulamazdı.
 *
 * MENÜ SİMGESİ ÇİZİLMİYOR (⋮ gibi): yazı tipine göre kutu çıkabilir.
 * "Üç nokta" kelimesi her yazı tipinde doğru.
 *
 * İKİ AYRI DİZİ: öğrenciye "dokun", veliye "dokunun". Fişin geri
 * kalanında verilen kararın aynısı; tek ortak metin yazmak kolay olurdu
 * ama veliye "sen" demek olurdu.
 */
const KURULUM_OGRENCI: readonly string[] = [
  'iPhone: Sayfayı Safari ile aç.',
  'Ekranın alt ortasındaki paylaş simgesine dokun — içinden yukarı ok çıkan kare.',
  'Listede aşağı in, “Ana Ekrana Ekle” → “Ekle”.',
  'Android: Sayfayı Chrome ile aç.',
  'Sağ üstteki üç nokta menüsüne dokun.',
  '“Ana ekrana ekle” ya da “Uygulamayı yükle” → “Ekle”.',
];

const KURULUM_VELI: readonly string[] = [
  'iPhone: Sayfayı Safari ile açın.',
  'Ekranın alt ortasındaki paylaş simgesine dokunun — içinden yukarı ok çıkan kare.',
  'Listede aşağı inin, “Ana Ekrana Ekle” → “Ekle”.',
  'Android: Sayfayı Chrome ile açın.',
  'Sağ üstteki üç nokta menüsüne dokunun.',
  '“Ana ekrana ekle” ya da “Uygulamayı yükle” → “Ekle”.',
];

/**
 * Fişin başlığı, giriş yönergesi ve kurulum yönergesi.
 *
 * NE GÖRECEĞİ SAYILARAK YAZILDI, HAYAL EDİLEREK DEĞİL. Cümleler
 * kabuklardaki gerçek sekmelerden çıktı (`OgrenciKabuk.tsx`,
 * `VeliKabuk.tsx`): öğrencide Pano · Ödevler · Konularım · Mesajlar,
 * velide Pano · Ödevler · Konular · Mesajlar. Teslim fotoğrafla
 * yapılıyor (`gonderimler.foto_yolu`).
 *
 * `Ödemeler` HİÇ GEÇMİYOR ve bu bilinçli: o sekme yalnız özel ders
 * velisinde var, okul velisinde yok. Yazsaydık yüzlerce kişiye olmayan
 * bir şey vaat etmiş olurduk. Öğretmenin ödeme kuralı da ayrıca bunu
 * yasaklıyor.
 *
 * MESAJLAŞMA DA GEÇMİYOR — ama sebebi başka ve öğretmenin kararı:
 * *"o mesajlaşma kısmına hiç girme."* Özellik duruyor, fişte
 * anlatılmıyor. Fiş bir tanıtım broşürü değil, giriş kâğıdı; her
 * yeteneği saymak yerine çocuğun ve velinin ilk gün ne yapacağını
 * söylüyor. Cümleler bu yüzden kısaldı: takip et, gönder, gelişimini
 * izle.
 *
 * İMZA YOK. Fişte önce "Buket Topuzoğlu · Matematik" yazıyordu;
 * öğretmen kaldırttı. Üstte 8 simgesi ve "Öğrenci girişi" / "Veli
 * girişi" kalıyor — fişi eline alan kimin verdiğini zaten biliyor,
 * satır yalnız yer kaplıyordu.
 */
export function fisMetni(tur: FisTuru): {
  baslik: string;
  kodEtiketi: string;
  satirlar: readonly string[];
  kurulumBasligi: string;
  kurulum: readonly string[];
} {
  if (tur === 'ogrenci') {
    return {
      baslik: 'Öğrenci girişi',
      kodEtiketi: 'Öğrenci kodun',
      satirlar: [
        `Adrese git: ${ADRES}`,
        'Kodunu yaz ve giriş yap.',
        'Ödevlerini takip eder, çözümünü gönderir, konulardaki gelişimini izlersin.',
      ],
      kurulumBasligi: 'Telefonuna uygulama olarak ekle',
      kurulum: KURULUM_OGRENCI,
    };
  }
  return {
    baslik: 'Veli girişi',
    kodEtiketi: 'Veli kodunuz',
    satirlar: [
      `Adrese girin: ${ADRES}`,
      'Kodu yazıp giriş yapın.',
      'Çocuğunuzun ödevlerini takip eder, konulardaki gelişimini izlersiniz.',
    ],
    kurulumBasligi: 'Telefonunuza uygulama olarak ekleyin',
    kurulum: KURULUM_VELI,
  };
}

/**
 * Bir sınıfın kod listesini fişlere çevirir.
 *
 * KODU OLMAYAN ÖĞRENCİ FİŞ ÜRETMEZ. Boş bir fiş basmak, öğretmenin eline
 * kesip dağıtacağı işe yaramaz bir kâğıt vermek olurdu; eksik kod ekranda
 * ayrıca söyleniyor.
 */
export function fisleriUret(
  kayitlar: readonly {
    ad: string;
    no?: string | null;
    sinif: string;
    kodlar: { ogrenci?: string; veli?: string };
  }[],
  tur: FisTuru,
): Fis[] {
  const fisler: Fis[] = [];
  for (const k of kayitlar) {
    const kod = tur === 'ogrenci' ? k.kodlar.ogrenci : k.kodlar.veli;
    if (!kod) continue;
    fisler.push({ tur, ad: k.ad, no: k.no ?? null, sinif: k.sinif, kod });
  }
  return fisler;
}

/**
 * A4'e sığan fiş sayısı — 2 sütun × 4 satır.
 *
 * 10'DAN 8'E İNDİ VE SEBEBİ ÖLÇÜLDÜ. Öğretmen kurulum tarifinin
 * ayrıntılandırılmasını istedi (paylaş düğmesi nerede, menü nerede).
 * Ölçüm şunu söyledi: 9px yazıda bir satır 2,62 mm tutuyor, sayfada ise
 * yalnız 9,8 mm pay vardı — yani fiş başına 2 mm, **tek satır bile
 * eklenemezdi.** İmzayı kaldırmak da yetmedi.
 *
 * Bedeli kâğıt ve öğretmen bilerek kabul etti: 720 öğrenci için bir
 * takım fiş 72 yerine 90 sayfa. Karşılığı, velinin tarifi okuyup
 * uygulayabilmesi — bunu yapamayan veli zaten hiç girmiyor.
 */
export const SAYFA_BASINA = 8;

/** Fişleri sayfalara böler; yazdırma düzeni sayfa sayfa çiziliyor. */
export function sayfalaraBol(fisler: readonly Fis[]): Fis[][] {
  const sayfalar: Fis[][] = [];
  for (let i = 0; i < fisler.length; i += SAYFA_BASINA) {
    sayfalar.push(fisler.slice(i, i + SAYFA_BASINA));
  }
  return sayfalar;
}
