/**
 * ÇÖZÜM SAYFALARI (0054) — öğretmenin seçtiği sayfa sınırı.
 *
 * Ağa ve React'e dokunmayan her kural burada, testli: sayfa yolu, sınırın
 * okunması, seçime ekleme/çıkarma ve deponun "zaten var" cevabı. Ekran
 * (`OdevTeslim`) yalnız bunları çağırıyor.
 *
 * VARSAYILAN 1. Sınırı 1 olan ödevde yol, bugünkü tek yolla birebir aynı —
 * `cozumSayfaYolu(o, s, 1)` 0009'dan beri kullanılan `cozum/o/s.jpg`.
 */

/** Sunucudaki tablo kısıtıyla aynı (0054: 1–8). */
export const EN_FAZLA_SAYFA = 8;

/**
 * n. sayfanın deposundaki yolu. Sunucu (`_cozum_yolu_gecerli`) tam bu
 * kalıbı bekliyor; uydurulan bir yol reddedilir.
 *
 *   1. sayfa:  cozum/<odev>/<ogrenci>.jpg      ← 0009'dan beri, EKSİZ
 *   n. sayfa:  cozum/<odev>/<ogrenci>-<n>.jpg  (n = 2…8)
 *
 * `-1` yazımı YOK: 1. sayfanın iki farklı yolu olsaydı sunucu ikisini de
 * tanımak zorunda kalırdı.
 */
export function cozumSayfaYolu(odevId: string, ogrenciId: string, sayfa: number): string {
  if (!Number.isInteger(sayfa) || sayfa < 1 || sayfa > EN_FAZLA_SAYFA) {
    throw new RangeError(`Sayfa numarası 1–${EN_FAZLA_SAYFA} olmalı: ${sayfa}`);
  }
  return sayfa === 1
    ? `cozum/${odevId}/${ogrenciId}.jpg`
    : `cozum/${odevId}/${ogrenciId}-${sayfa}.jpg`;
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

/** "2/3 sayfa seçildi" — sayaç. */
export function sayfaSayacMetni(secili: number, sinir: number): string {
  return `${secili}/${sinir} sayfa seçildi`;
}

/** Sınırı aşan seçimde öğrenciye söylenen. */
export function tasmaMetni(sinir: number, tasan: number): string {
  return `Bu ödevde en fazla ${sinir} sayfa yükleyebilirsin. ${tasan} görsel eklenmedi.`;
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
