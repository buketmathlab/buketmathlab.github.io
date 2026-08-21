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

/** Öğrencinin ve velinin adres çubuğuna yazacağı yer. */
export const ADRES = 'buketmathlab.github.io/yeni/';

export type FisTuru = 'ogrenci' | 'veli';

export type Fis = {
  /** Fişin sahibi kim — başlıkta yazıyor. */
  tur: FisTuru;
  /** Öğrencinin adı. Veli fişinde de var: hangi çocuğun velisi olduğu. */
  ad: string;
  sinif: string;
  kod: string;
};

/** Fişin üstündeki tek satırlık kimlik. */
export const IMZA = 'Buket Topuzoğlu · Matematik';

/**
 * Fişin başlığı ve iki satırlık yönergesi.
 *
 * İKİ SATIR, DAHA FAZLASI DEĞİL: fiş kesilip dağıtılacak bir kâğıt parçası;
 * uzun metin hem sığmaz hem okunmaz. Anlatılması gereken tek şey var —
 * adrese git, kodu yaz.
 */
export function fisMetni(tur: FisTuru): {
  baslik: string;
  kodEtiketi: string;
  satirlar: [string, string];
} {
  if (tur === 'ogrenci') {
    return {
      baslik: 'Öğrenci girişi',
      kodEtiketi: 'Öğrenci kodun',
      satirlar: [
        `Adrese git: ${ADRES}`,
        'Kodunu yaz ve gir. Ödevlerini burada görürsün.',
      ],
    };
  }
  return {
    baslik: 'Veli girişi',
    kodEtiketi: 'Veli kodunuz',
    satirlar: [
      `Adrese girin: ${ADRES}`,
      'Kodu yazıp girin. Çocuğunuzun ödev durumunu görürsünüz.',
    ],
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
  kayitlar: readonly { ad: string; sinif: string; kodlar: { ogrenci?: string; veli?: string } }[],
  tur: FisTuru,
): Fis[] {
  const fisler: Fis[] = [];
  for (const k of kayitlar) {
    const kod = tur === 'ogrenci' ? k.kodlar.ogrenci : k.kodlar.veli;
    if (!kod) continue;
    fisler.push({ tur, ad: k.ad, sinif: k.sinif, kod });
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
