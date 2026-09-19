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
 * İKİ BLOK, İÇ İÇE DEĞİL — ÖĞRETMENİN SON DÜZELTMESİ.
 *
 * Önceki yazımda satırlar iki telefon arasında gidip geliyordu: önce ortak
 * bir kural, sonra iki markanın tarayıcı adları aynı satırda, sonra
 * iPhone, sonra Samsung. Öğretmen okuyunca şunu söyledi: *"Anlatırken bir
 * iOS'a bir Android'e geçme. iOS için tarifi bir bütün şeklinde anlat,
 * sonra Android için."*
 *
 * Haklıydı ve sebebi fişin kullanıldığı yerde: bunu okuyan kişi elinde
 * TEK bir telefon tutuyor. Kendini ilgilendirmeyen satırları atlaya
 * atlaya okumak zorunda kalıyordu. Artık iki blok var — önce iPhone'un
 * tamamı, sonra Android'in tamamı — ve her blok kendi başlığıyla açılıyor
 * ("iPhone:", "Android:"). Okuyan kişi kendi bloğunu bulup üstten alta
 * okuyor.
 *
 * Bu yüzden Chrome/Google yasağı da TEK bir ortak satır değil: her iki
 * blokta ayrı ayrı yazıyor. Tekrar gibi görünüyor ama tekrar değil —
 * bloğunu okuyan kişi öteki bloğu hiç okumuyor, ve yasak turun çekirdeği.
 *
 * YASAĞIN KENDİSİ: TELEFONUN KENDİ TARAYICISI.
 *
 * Bu satır ürünün en pahalı öğrenilmiş dersi ve tamamı SAHADAN geldi.
 * Öğretmen tarifi dört kez düzeltti; dördünün de ortak kökü aynı
 * çıktı: **"uygulama olarak ekle" seçeneği tarayıcıya özgüdür.**
 *
 *   - iOS'ta uygulama içi tarayıcıda (bir mesajdaki bağlantıya dokununca
 *     açılan pencere) seçenek HİÇ YOK. Öğretmen kendi iPhone'unda
 *     deneyip yapamadı; Safari'de açınca hemen oldu.
 *   - Android'de Chrome'un tarifini yazdık, öğretmen Samsung'unda
 *     denedi: **o menüde öyle bir şey yoktu.** Kendi telefonunun
 *     "Browser" adlı tarayıcısında ise vardı ve çalıştı.
 *
 * Öğretmenin sözü: *"Samsung'da Google'dan ya da Chrome'dan değil,
 * kendi internet tarayıcısından girmek gerekiyor. Mesela Apple'da
 * Safari'den. Bu çok önemli bir detay."*
 *
 * Bu yüzden ilk satır Chrome'u ve Google uygulamasını AÇIKÇA ELİYOR.
 * Önceki sürümlerde Android satırı "Sayfayı Chrome ile aç" diyordu —
 * yani fiş, işe yaramayan yolu tarif ediyordu. Marka marka tarayıcı adı
 * saymak mümkün değil (Huawei, Xiaomi, Oppo… her birinde başka ad), o
 * yüzden KURAL yazılıyor ve iki örnek veriliyor: iPhone'da Safari,
 * Samsung'da "Browser".
 *
 * SAMSUNG YOLU CİHAZDA DOĞRULANDI — öğretmenin ekran görüntüleriyle.
 * Üst çubuktaki "içinde aşağı ok olan kare" simgesi → "uygulama olarak
 * ekle" → çıkan pencerede "Ekle" ("Bu web sayfası Uygulamalar ekranına
 * eklensin mi?"). Bu, tarifin cihazda doğrulanan İLK Android yolu;
 * öncekilerin hepsi belgeden ya da hafızadan yazılmıştı.
 *
 * iPHONE YOLU DA CİHAZDA DOĞRULANDI: alttaki üç nokta → Paylaş → Ana
 * Ekrana Ekle → Ekle. (Apple'ın belgesi de böyle diyor: "tap the share
 * button (three dots), then tap Share".) Bazı sekme ayarlarında orada
 * üç nokta yerine paylaş simgesi çıkıyor; o veli de aynı listeyi
 * izliyor, yalnız bir adım eksik yaşıyor ve aradığını buluyor.
 *
 * BAŞKA MARKALAR İÇİN SÖZ VERİLMİYOR, YER SÖYLENİYOR. Son satır
 * "aynı seçenek tarayıcının menüsünde" diyor — elimizde o cihazlar yok
 * ve olmayan bir bilgiyi kâğıda basmak, dört yanlış tariften sonra
 * yapılacak en son şey olurdu.
 *
 * SİMGE ÇİZİLMİYOR (⋮ ya da aşağı ok gibi): yazı tipine göre boş kutu
 * çıkıyor ve kâğıtta bunu düzeltmenin yolu yok. Simge KELİMEYLE
 * anlatılıyor — "üç nokta", "aşağı oklu kare".
 *
 * MUHATAP YALNIZ BLOK BAŞLIKLARINDA AYRILIYOR (aç / açın): adım satırları
 * ok zinciri, yani fiilsiz. Veliye "sen" demeden iki fişin ortak
 * kalabildiği tek nokta bu.
 *
 * AÇIK KALAN: depoda service worker YOK (bilinçli karar, `pwa-denetimi`
 * her koşuda ölçüyor). Bu yüzden fiş "uygulama olarak ekle" diyor ama
 * ekranın tarayıcı çubuğu olmadan açılacağına dair bir SÖZ VERMİYOR.
 */
const KURULUM_OGRENCI: readonly string[] = [
  'iPhone: Sayfayı Safari ile aç — Chrome ya da Google ile değil.',
  'Alttaki üç nokta → “Paylaş” → “Ana Ekrana Ekle” → “Ekle”.',
  'Android: Sayfayı telefonun kendi tarayıcısıyla aç.',
  'Chrome ya da Google değil — Samsung’da adı “Browser”.',
  'Üstteki aşağı oklu kare ya da menü → “Uygulama olarak ekle” → “Ekle”.',
];

const KURULUM_VELI: readonly string[] = [
  'iPhone: Sayfayı Safari ile açın — Chrome ya da Google ile değil.',
  'Alttaki üç nokta → “Paylaş” → “Ana Ekrana Ekle” → “Ekle”.',
  'Android: Sayfayı telefonunuzun kendi tarayıcısıyla açın.',
  'Chrome ya da Google değil — Samsung’da adı “Browser”.',
  'Üstteki aşağı oklu kare ya da menü → “Uygulama olarak ekle” → “Ekle”.',
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
