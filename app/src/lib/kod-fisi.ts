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

/** Fişin üstündeki tek satırlık kimlik. */
export const IMZA = 'Buket Topuzoğlu · Matematik';

/**
 * KURULUM YÖNERGESİ — iki satır, ikisi de fişte.
 *
 * NEDEN FİŞTE: öğretmen istedi, ve sebebi ürünün kendisinde. SEKİZ ana
 * ekrana eklenince tarayıcı çubuğu olmadan, kendi simgesiyle, uygulama
 * gibi açılıyor. Bunu bilmeyen bir veli her seferinde adresi yeniden
 * yazar; çoğu da bir daha hiç açmaz.
 *
 * VAAT GERÇEK Mİ — ÖNCE ONU ÖLÇTÜK. Kâğıda basılan her cümle bir söz;
 * olmayan bir şeyi 720 aileye taahhüt edemezdik. Dört şey yerinde:
 * `apple-touch-icon` (iOS manifest simgelerini kullanmıyor),
 * `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` ve
 * manifest'te `display: standalone`. İlk üçü kaynakta, sonuncusu
 * `pwa-denetimi.mjs` tarafından bildirilen boyutlarıyla birlikte
 * ölçülüyor.
 *
 * İKİ AYRI SATIR, ÇÜNKÜ İKİ AYRI YOL: iPhone'da menü "Paylaş"ın içinde,
 * Android'de tarayıcı menüsünde. Tek bir "menüden ekleyin" cümlesi,
 * telefonunda o menüyü bulamayan veliyi yolda bırakırdı.
 *
 * MENÜ SİMGESİ YAZILMIYOR (⋮ gibi): yazı tipine göre kutu çıkabilir ve
 * Samsung Internet'te menü altta duruyor. Kelime her yerde doğru.
 */
const KURULUM: readonly [string, string] = [
  'iPhone: Paylaş → Ana Ekrana Ekle',
  'Android: tarayıcı menüsü → Ana ekrana ekle',
];

/**
 * Fişin başlığı, giriş yönergesi ve kurulum yönergesi.
 *
 * GİRİŞ YÖNERGESİ İKİ SATIR, DAHA FAZLASI DEĞİL: fiş kesilip dağıtılacak
 * bir kâğıt parçası; uzun metin hem sığmaz hem okunmaz. Anlatılması
 * gereken tek şey var — adrese git, kodu yaz.
 *
 * Kurulum ayrı bir alan, `satirlar`ın ucuna eklenmiş üçüncü bir cümle
 * değil: ayrı bir iş, ayrı bir başlıkla çiziliyor ve ayrı ölçülüyor.
 */
export function fisMetni(tur: FisTuru): {
  baslik: string;
  kodEtiketi: string;
  satirlar: [string, string];
  kurulumBasligi: string;
  kurulum: readonly [string, string];
} {
  if (tur === 'ogrenci') {
    return {
      baslik: 'Öğrenci girişi',
      kodEtiketi: 'Öğrenci kodun',
      satirlar: [
        `Adrese git: ${ADRES}`,
        'Kodunu yaz ve gir. Ödevlerini burada görürsün.',
      ],
      kurulumBasligi: 'Telefonuna uygulama gibi ekle:',
      kurulum: KURULUM,
    };
  }
  return {
    baslik: 'Veli girişi',
    kodEtiketi: 'Veli kodunuz',
    satirlar: [
      `Adrese girin: ${ADRES}`,
      'Kodu yazıp girin. Çocuğunuzun ödev durumunu görürsünüz.',
    ],
    kurulumBasligi: 'Telefonunuza uygulama gibi ekleyin:',
    kurulum: KURULUM,
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

/** A4'e sığan fiş sayısı — 2 sütun × 5 satır. Sayfalama buna göre. */
export const SAYFA_BASINA = 10;

/** Fişleri sayfalara böler; yazdırma düzeni sayfa sayfa çiziliyor. */
export function sayfalaraBol(fisler: readonly Fis[]): Fis[][] {
  const sayfalar: Fis[][] = [];
  for (let i = 0; i < fisler.length; i += SAYFA_BASINA) {
    sayfalar.push(fisler.slice(i, i + SAYFA_BASINA));
  }
  return sayfalar;
}
