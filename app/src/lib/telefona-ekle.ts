/**
 * TELEFONA UYGULAMA OLARAK EKLEME — TEK KAYNAK.
 *
 * NEDEN BU DOSYA VAR: aynı tarif İKİ YERDE gösteriliyor — kesilip
 * dağıtılan kod fişinde ve giriş ekranında. İki kopya tutulsaydı biri
 * düzeltilip öteki unutulurdu, ve bu dosyanın bütün hikâyesi zaten
 * yanlış kalmış bir tarifin hikâyesi.
 *
 * DÖRT TURDA DÖRT KEZ YANLIŞ YAZILDI. Sırayla:
 *
 *   1. "Paylaş → Ana Ekrana Ekle" — öğretmen kendi telefonunda YAPAMADI:
 *      bağlantıyı bir uygulamanın içinden açmıştı ve iOS'ta uygulama içi
 *      tarayıcıda o seçenek HİÇ YOKTUR. "Safari" eklendi.
 *   2. Düğmenin YERİ eksikti: "paylaş butonunu nereden bulacak?"
 *   3. Yeri yazdım ama düğme yanlıştı: bugünkü iOS'ta alttaki düğme ÜÇ
 *      NOKTA, ve Paylaş onun içinden çıkıyor (Apple'ın kendi belgesi).
 *   4. Android tarifi baştan sona yanlıştı — öğretmen EKRAN GÖRÜNTÜSÜYLE
 *      kanıtladı: telefonu SEKİZ'i Chrome değil SAMSUNG INTERNET ile
 *      açıyor, orada üç nokta SAĞ ALTTA ve menüde "Ana ekrana ekle"
 *      diye bir şey YOK; yerine "Sayfa ekle" var.
 *
 * ORTAK KÖK, VE BU DOSYANIN ASIL DERSİ: tarayıcı menüleri sürümden
 * sürüme, markadan markaya değişiyor; kâğıt ise basıldıktan sonra
 * düzeltilemiyor. O yüzden aynı metin artık EKRANDA DA duruyor —
 * ekrandaki yanlışı bir yayınla düzeltebiliyoruz, 720 kâğıdı
 * düzeltemiyoruz.
 *
 * TÜRKİYE'DE SAMSUNG INTERNET KENAR DURUM DEĞİL. Öğretmenin telefonunda
 * varsayılan tarayıcı oydu; öğrencilerin çoğunda da öyle olacak. Üç
 * tarayıcı da yazılıyor.
 *
 * TİPOGRAFİK ÜÇ NOKTA (⋮, ⋯) YAZILMIYOR: yazı tipine göre boş kutu
 * çıkıyor ve kâğıtta bunu düzeltmenin yolu yok. Kelime her yerde doğru.
 */

export type TelefonYolu = {
  /** Başlık: hangi telefon, hangi tarayıcı. */
  ad: string;
  /** Kod fişindeki TEK SATIRLIK hâli — kâğıtta yer dar. */
  kisa: string;
  /** Giriş ekranındaki ayrıntılı adımlar — orada yer bol. */
  adimlar: readonly string[];
  /**
   * BU YOL GERÇEK BİR CİHAZDA GÖRÜLDÜ MÜ.
   *
   * Ekranda gösterilmiyor; belgeler ve testler için. Neyi bildiğimizi ve
   * neyi BİLMEDİĞİMİZİ kodda tutmak, bir sonraki turda yine hafızadan
   * yazmayı engelliyor. Dört yanlış tarifin dördü de "biliyorum"
   * sanmaktan çıktı.
   */
  cihazda_dogrulandi: boolean;
};

/**
 * "iPhone" DEĞİL "iOS" — öğretmenin kararı.
 *
 * Gerekçesi sağlam: iPad de aynı işletim sistemini kullanıyor ve tarif
 * orada da aynı; "iPhone" yazmak iPad'i olan veliyi dışarıda bırakırdı.
 * Karşısındaki "Android" de zaten bir sistem adı, yani iki taraf artık
 * simetrik.
 */
export const TELEFON_YOLLARI: readonly TelefonYolu[] = [
  {
    ad: 'iOS · Safari',
    kisa: 'iOS/Safari: alttaki üç nokta → Paylaş → Ana Ekrana Ekle.',
    adimlar: [
      'Sayfayı Safari ile açın. (Bir uygulamanın içinden açılan pencerede bu seçenek yoktur.)',
      'Ekranın altındaki üç nokta düğmesine dokunun.',
      '“Paylaş”a dokunun.',
      '“Ana Ekrana Ekle” → “Ekle”.',
    ],
    // Öğretmen kendi telefonunda denedi ve oldu.
    cihazda_dogrulandi: true,
  },
  {
    ad: 'Android · Chrome',
    // İKİ ETİKET DE YAZIYOR: Chrome sürüme göre "Ana ekrana ekle" ya da
    // "Yükle" gösteriyor. Tek satıra sıkıştırırken "Yükle"yi düşürmüştüm;
    // fiş testi yakaladı. Öteki etiketi gören veli aradığını bulamazdı.
    kisa: 'Android/Chrome: sağ üstteki üç nokta → Ana ekrana ekle / Yükle.',
    adimlar: [
      'Sayfayı Chrome ile açın.',
      'Sağ üstteki üç nokta menüsüne dokunun.',
      '“Ana ekrana ekle” ya da “Yükle” seçeneğine dokunun.',
    ],
    // Google'ın belgesindeki yol; hiçbir Android cihazda görülmedi.
    cihazda_dogrulandi: false,
  },
  {
    ad: 'Android · Samsung Internet',
    kisa: 'Android/Samsung: sağ alttaki üç nokta → Sayfa ekle → Ana ekran.',
    adimlar: [
      'Sayfayı Samsung Internet ile açın.',
      'Sağ ALTTAKİ üç nokta menüsüne dokunun. (Chrome’dakinin aksine altta.)',
      '“Sayfa ekle”ye dokunun.',
      '“Ana ekran”ı seçin.',
    ],
    // Menünün kendisi öğretmenin ekran görüntüsünde görüldü; son adım
    // (Sayfa ekle → Ana ekran) Samsung kaynaklarından. Cihazda
    // doğrulanmadı.
    cihazda_dogrulandi: false,
  },
];

/** Fişteki ve ekrandaki başlık. Öğrenciye "ekle", veliye "ekleyin". */
export function telefonBasligi(muhatap: 'sen' | 'siz'): string {
  return muhatap === 'sen'
    ? 'Telefonuna uygulama olarak ekle'
    : 'Telefonunuza uygulama olarak ekleyin';
}

/** Giriş ekranındaki açılır bölümün başlığı. */
export const GIRIS_EKRANI_BASLIGI = 'Telefona uygulama olarak nasıl eklerim?';

/**
 * NASIL AÇILACAĞINA DAİR SÖZ VERİLMİYOR — ve bu bilinçli.
 *
 * iOS'ta ana ekrana eklenen SEKİZ tarayıcı çubuğu olmadan açılıyor;
 * gereken etiketler (`apple-touch-icon`, `apple-mobile-web-app-capable`,
 * manifest'te `display: standalone`) yerinde ve ölçüldü. Android'de ise
 * depoda service worker OLMADIĞI için (bilinçli karar) eklenen simge
 * sayfayı tarayıcı içinde açıyor olabilir — bu bizde ölçülmedi.
 *
 * Bu yüzden metin "uygulama olarak ekle" diyor ama "tarayıcı çubuğu
 * görünmeyecek" gibi bir şey VAAT ETMİYOR.
 */
export const KAPANIS_NOTU =
  'Simge ana ekranınıza gelir; SEKİZ’i bir daha adres yazmadan açarsınız.';
