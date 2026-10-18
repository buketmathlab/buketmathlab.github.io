/**
 * ÇÖZÜM SAYFALARI (0054; 0078: her sayfa zorunlu) — ödevin sayfa sayısı.
 *
 * Ağa ve React'e dokunmayan her kural burada, testli: sayfa yolu, sınırın
 * okunması, seçime ekleme/çıkarma ve deponun "zaten var" cevabı. Ekran
 * (`OdevTeslim`) yalnız bunları çağırıyor.
 *
 * VARSAYILAN 1. Sınırı 1 olan ödevde yol, bugünkü tek yolla birebir aynı —
 * `cozumSayfaYolu(o, s, 1)` 0009'dan beri kullanılan `cozum/o/s.jpg`.
 */

import { NUMARA_KURALI } from '@/lib/el-yazisi-metni';

/** Sunucudaki tablo kısıtıyla aynı (0054: 1–8; 0078: 1–40). */
export const EN_FAZLA_SAYFA = 40;

/** Deneme numarasının üst sınırı — sunucudaki kalıpla aynı (0082). */
export const EN_FAZLA_DENEME = 50;

/**
 * n. sayfanın deposundaki yolu. Sunucu (`_cozum_yolu_gecerli`) tam bu
 * kalıbı bekliyor; uydurulan bir yol reddedilir.
 *
 *   1. deneme, 1. sayfa:  cozum/<odev>/<ogrenci>.jpg      ← 0009'dan beri, EKSİZ
 *   1. deneme, n. sayfa:  cozum/<odev>/<ogrenci>-<n>.jpg  (n = 2…40)
 *   k. deneme, 1. sayfa:  cozum/<odev>/<ogrenci>-d<k>.jpg (k = 2…50, 0082)
 *   k. deneme, n. sayfa:  cozum/<odev>/<ogrenci>-d<k>-<n>.jpg
 *
 * `-1` ve `-d1` yazımları YOK: 1. sayfanın ya da 1. denemenin iki farklı
 * yolu olsaydı sunucu ikisini de tanımak zorunda kalırdı.
 *
 * DENEME (0082): gönderim her yeniden açıldığında bir artıyor ve sunucudan
 * geliyor (`ogrenci_odevleri.deneme_no`). Varsayılan 1, yani bu
 * fonksiyonun 0082 öncesindeki her çağrısı BİREBİR aynı yolu üretiyor.
 * Ayrı yol gerekli, çünkü deponun üzerine yazması kapalı ve eski
 * gönderimin fotoğrafı denetim izinde kayıtlı — üzerine yazmak o kaydı
 * yalancı yapardı.
 */
export function cozumSayfaYolu(
  odevId: string,
  ogrenciId: string,
  sayfa: number,
  deneme = 1,
): string {
  if (!Number.isInteger(sayfa) || sayfa < 1 || sayfa > EN_FAZLA_SAYFA) {
    throw new RangeError(`Sayfa numarası 1–${EN_FAZLA_SAYFA} olmalı: ${sayfa}`);
  }
  if (!Number.isInteger(deneme) || deneme < 1 || deneme > EN_FAZLA_DENEME) {
    throw new RangeError(`Deneme numarası 1–${EN_FAZLA_DENEME} olmalı: ${deneme}`);
  }
  const d = deneme === 1 ? '' : `-d${deneme}`;
  const s = sayfa === 1 ? '' : `-${sayfa}`;
  return `cozum/${odevId}/${ogrenciId}${d}${s}.jpg`;
}

/**
 * Sunucudan gelen sınırı okur. Geçerli bir sayı değilse 1.
 *
 * NEDEN 1'E DÜŞÜYOR: `odev_sayfa_siniri` ucu henüz kurulmamış (0054
 * çalıştırılmamış) ya da o an ulaşılamıyor olabilir. 1 HER ödevde geçerli
 * bir değer — en kötü sonuç bugünkü tek sayfalık davranış. Bir ayarın
 * okunamaması teslim ekranını bozmamalı.
 */
export function sayfaSiniriniOku(ham: unknown): number {
  return typeof ham === 'number' && Number.isInteger(ham) && ham >= 1 && ham <= EN_FAZLA_SAYFA
    ? ham
    : 1;
}

/**
 * ÖDEVİN SAYFA KURALI (0078).
 *
 *   sayfa        ödevin sayfa sayısı (öğrencinin göndereceği çözüm sayfası)
 *   tumSayfalar  true: TAM `sayfa` kadar sayfa zorunlu (0078 sonrası ödev)
 *                false: eski kural, en az 1 en fazla `sayfa`
 *
 * İki biçim okunuyor: `odev_sayfa_kurali` ({sayfa, tum_sayfalar}) ve eski
 * `odev_sayfa_siniri` (yalnız sayı). Hiçbiri okunamazsa {1, false} — her
 * ödevde geçerli; bir ayarın okunamaması teslim ekranını bozmamalı.
 */
export type SayfaKurali = { sayfa: number; tumSayfalar: boolean };

export function sayfaKuraliniOku(kural: unknown, eskiSinir?: unknown): SayfaKurali {
  if (kural && typeof kural === 'object') {
    const k = kural as { sayfa?: unknown; tum_sayfalar?: unknown };
    const sayfa = sayfaSiniriniOku(k.sayfa);
    if (sayfa === k.sayfa) return { sayfa, tumSayfalar: k.tum_sayfalar === true };
  }
  return { sayfa: sayfaSiniriniOku(eskiSinir), tumSayfalar: false };
}

/**
 * Seçilen dosyaları sıranın SONUNA ekler; sınırı aşanları eklemez.
 *
 * Kesmek yerine reddetmek düşünüldü: 3 sınırlı ödevde 2 sayfa seçiliyken 4
 * fotoğraf seçen öğrencinin hiçbirini almamak, ilk birini almaktan daha
 * kötü. Alınmayanların SAYISI dönüyor ki ekran bunu açıkça söylesin —
 * sessiz kesme yok.
 */
export function sahneyeEkle<T>(
  mevcut: readonly T[],
  yeniler: readonly T[],
  sinir: number,
): { liste: T[]; tasan: number } {
  const yer = Math.max(0, sinir - mevcut.length);
  return {
    liste: [...mevcut, ...yeniler.slice(0, yer)],
    tasan: Math.max(0, yeniler.length - yer),
  };
}

/** Bir sayfayı çıkarır; kalanlar kendiliğinden yeniden numaralanır (sıra = dizi). */
export function sahnedenCikar<T>(liste: readonly T[], sira: number): T[] {
  return liste.filter((_, i) => i !== sira);
}

/**
 * Deponun cevabı "bu yolda dosya zaten var" mı?
 *
 * Storage bu durumu iki biçimde söyleyebiliyor: doğrudan 409, ya da 400
 * gövdesinde `"statusCode":"409"` / `"error":"Duplicate"`. İkisi de
 * tanınıyor.
 *
 * DAR tutuluyor ve bu bilinçli: başka bir hatayı "zaten var" sanmak,
 * dosyası HİÇ yüklenmemiş bir gönderimin kabul edilmesi demek olurdu.
 * Emin olunamayan her durum `false` — yani sıradan bir hata.
 */
export function depoZatenVarMi(durum: number, govde: string): boolean {
  if (durum === 409) return true;
  if (durum !== 400) return false;
  try {
    const g = JSON.parse(govde) as { statusCode?: unknown; error?: unknown };
    return String(g.statusCode) === '409' || g.error === 'Duplicate';
  } catch {
    return false;
  }
}

/**
 * Sayaç. Her sayfası zorunlu ödevde eksik sayfayı da söylüyor:
 *   "5 / 8 sayfa eklendi · 3 sayfa eksik"   "8 / 8 sayfa eklendi · tamam"
 * Eski ödevde: "2 / 3 sayfa seçildi".
 */
export function sayfaSayacMetni(secili: number, sinir: number, zorunlu = false): string {
  if (!zorunlu) return `${secili} / ${sinir} sayfa seçildi`;
  const eksik = Math.max(0, sinir - secili);
  return eksik === 0
    ? `${secili} / ${sinir} sayfa eklendi · tamam`
    : `${secili} / ${sinir} sayfa eklendi · ${eksik} sayfa eksik`;
}

/**
 * Yükleme alanının açıklaması.
 *
 * NUMARA KURALI BURADA, çünkü ÖĞRENCİNİN OKUDUĞU İPUCU BU. Kural önce
 * `el-yazisi-metni.ts`'teki `YUKLEME_IPUCU` sabitine yazılmıştı ve o sabit
 * ÖLÜ ÇIKTI: hiçbir ekran onu çizmiyordu, yalnız kendi testi okuyordu.
 * Ekran görüntüsü aldığımızda görüldü — ipucu hâlâ eski cümleydi. Ölü
 * sabit silindi; kural buraya, gerçekten çizilen metne taşındı.
 *
 * Ders: bir metni değiştirmek, onun ekrana ulaştığını kanıtlamaz.
 */
export function sayfaIpucuMetni(sinir: number, zorunlu: boolean): string {
  const nasil =
    `Çıktı alınmış soru kâğıdına ya da boş kâğıda çözdüysen (boş kâğıtta ${NUMARA_KURALI}) ` +
    'her sayfanın fotoğrafını çek; tablette çözdüysen görsel ya da PDF ' +
    "yükleyebilirsin, PDF'in her sayfası ayrı bir sayfa sayılır.";
  if (!zorunlu) {
    return `Bu ödevde en fazla ${sinir} sayfa gönderebilirsin; sırayla ekle, öğretmenin bu sırayla görecek. ${nasil}`;
  }
  return sinir === 1
    ? `Bu ödev 1 sayfa. ${nasil}`
    : `Bu ödev ${sinir} sayfa. Her sayfanın çözümünü sırayla ekle: önce 1. sayfa, sonra 2. sayfa… ${nasil}`;
}

/**
 * Neden her sayfa zorunlu — öğrenciye bir kez, kısa. Puan tehdidi değil,
 * öğrenmenin dili: öğretmen çözüm YOLUNU görmek istiyor.
 */
export const HER_SAYFA_GEREKCESI =
  'Öğretmenin çözüm yolunun tamamını görebilsin diye ödevin her sayfası zorunlu. ' +
  'Boş bıraktığın bir soru olsa da o sayfayı ekle; denediğin her adım öğrenmenin parçası.';

/** Eksik sayfayla göndermeye çalışınca. */
export function eksikSayfaMetni(eksik: number): string {
  return `${eksik} sayfa eksik. Ödevi gönderebilmek için her sayfanın çözümünü eklemelisin.`;
}

/** Sınırı aşan seçimde öğrenciye söylenen. */
export function tasmaMetni(sinir: number, tasan: number, zorunlu = false): string {
  return zorunlu
    ? `Bu ödev ${sinir} sayfa; fazladan seçtiğin ${tasan} görsel eklenmedi.`
    : `Bu ödevde en fazla ${sinir} sayfa yükleyebilirsin. ${tasan} görsel eklenmedi.`;
}

/**
 * Yükleme yarıda kaldığında. Gönderim YAPILMADI — `odev_gonder` ancak bütün
 * sayfalar yüklendikten sonra çağrılıyor — ve seçim duruyor.
 *
 * Sayıya ek getirilmiyor ("2'si", "1'i", "3'ü"): ek sayıya göre değişiyor
 * ve yanlışı göze batıyor. "2/3" biçimi eksiz okunuyor.
 */
export function yarimKalanMetni(yuklenen: number, toplam: number): string {
  return (
    `Yüklenen sayfa: ${yuklenen}/${toplam}. Ödevin henüz gönderilmedi. ` +
    'Bağlantını kontrol edip tekrar dene — seçtiğin görseller duruyor.'
  );
}

/**
 * Yeniden denemede önceden yüklenmiş bulunan sayfalar.
 *
 * DÜRÜST OLMAK ZORUNDA: o sayfalar ilk denemedeki hâlleriyle gidiyor.
 * Öğrenci arada fotoğrafı değiştirdiyse bunu bilmeli.
 */
export function oncedenYuklenenMetni(sayfalar: readonly number[]): string | null {
  if (sayfalar.length === 0) return null;
  const liste = sayfalar.map((s) => `${s}.`).join(', ');
  return sayfalar.length === 1
    ? `${liste} sayfa önceki denemende yüklenmişti; o hâliyle gönderildi.`
    : `${liste} sayfalar önceki denemende yüklenmişti; o hâlleriyle gönderildi.`;
}

/** Kutudaki değeri doğrular: 1–40 tam sayı, değilse hata metni. */
export function sayfaSayisiHatasi(deger: string): string | null {
  const n = Number(deger);
  if (deger.trim() === '') return 'Ödevin sayfa sayısını yazın.';
  if (!Number.isInteger(n) || n < 1 || n > EN_FAZLA_SAYFA) {
    return `Sayfa sayısı 1 ile ${EN_FAZLA_SAYFA} arasında olmalı.`;
  }
  return null;
}
