import { telefonBasligi, TELEFON_YOLLARI } from '@/lib/telefona-ekle';

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
 * KURULUM YÖNERGESİ ARTIK BURADA YAZMIYOR — `telefona-ekle.ts`'te.
 *
 * NEDEN TAŞINDI: aynı tarif iki yerde gösteriliyor, fişte ve giriş
 * ekranında. İki kopya tutulsaydı biri düzeltilip öteki unutulurdu ve o
 * dosyanın bütün hikâyesi zaten dört kez yanlış yazılmış bir tarifin
 * hikâyesi. Tek kaynak, tek düzeltme.
 *
 * FİŞTE KISA HÂLİ KULLANILIYOR (`kisa`): her tarayıcı TEK SATIR, ok
 * zinciriyle. Kâğıtta yer dar; ekranda bol, orada `adimlar` görünüyor.
 * Aynı bilgi, iki yoğunluk.
 *
 * SAMSUNG INTERNET EKLENDİĞİ HÂLDE FİŞ KISALDI: eskiden her tarayıcı üç
 * satırdı (aç · dokun · ekle), toplam yedi satır. Şimdi üç tarayıcı
 * dört satır. Eksik olan tarayıcı eklendi ve kâğıt yine de küçüldü.
 */

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
      kurulumBasligi: telefonBasligi('sen'),
      kurulum: TELEFON_YOLLARI.map((y) => y.kisa),
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
    kurulumBasligi: telefonBasligi('siz'),
    kurulum: TELEFON_YOLLARI.map((y) => y.kisa),
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
 * SONRA TARİF SIKIŞTI ve 10'a dönüp dönemeyeceğimiz TEKRAR ÖLÇÜLDÜ.
 * Her tarayıcı üç satırdan tek satıra inince fiş 65,4 mm'den 61,9 mm'ye
 * düştü ve sayfa payı 2,8 mm'den 20 mm'ye çıktı. "O hâlde 10 sığar"
 * demek kolaydı; denendi:
 *
 *   10 fiş (min-height 50 mm'e indirilerek bile) → ızgara 298,8 mm,
 *   A4'ün yazılabilir 277 mm'sini 21,8 mm AŞIYOR.
 *
 * İçerik beş satıra bölünecek kadar küçülmüyor. 8'de kalındı — kâğıt
 * kazanmak için sınırı zorlamak, bu dosyanın bütün dersine aykırı
 * olurdu. 720 öğrenci için bir takım fiş 90 sayfa.
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
