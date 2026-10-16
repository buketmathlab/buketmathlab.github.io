/**
 * ANKET KAPSAMI CÜMLELERİ (0081) — React'siz, doğrudan test edilebilir.
 *
 * Öğretmenin isteği: *"benim dersine girdiğim öğrencilerin ve bu
 * öğrencilerin velilerinden oluşan anketi ben göreyim. Bir de tüm okulun …
 * anketlerini genel olarak göreyim. Ve diğer öğretmenler de kendi
 * girdikleri sınıfların anketlerini görsünler."*
 *
 * -----------------------------------------------------------------------------
 * GİZLİLİK NOTU DAR KAPSAMDA EKRANDA YAZIYOR
 *
 * Bu turun bedeli gerçek: yanıt artık bir sınıfa bağlı ve alt sınır yok
 * (0077, öğretmenin kararı). 30 kişilik bir sınıfta tek bir görüşün kime
 * ait olduğu tahmin edilebilir. Öğretmene sorulduğunda bedeli bilerek
 * seçti — ama ekranda yazmamak, kararı veren kişinin bedeli her gün
 * görmemesi demekti. Not dar kapsamda çıkıyor, genel kapsamda çıkmıyor:
 * orada yanıt bütün okula ait.
 *
 * -----------------------------------------------------------------------------
 * SINIFSIZ YANITLAR SESSİZCE YOK SAYILMIYOR
 *
 * 0081'den önce toplanan yanıtların sınıfı yok ve hiçbir yerde yazmıyor;
 * geriye dönük atanamıyorlar. Yalnız genel sonuçta görünüyorlar. Sayılarını
 * yazmamak, "benim sınıflarım" toplamları ile genel toplamın tutmamasına
 * ve öğretmenin sayılara güvenmemesine yol açardı.
 */

export type Kapsam = 'okul' | 'kendi' | 'sinif';

export const KAPSAM_OKUL = 'Tüm okul';
export const KAPSAM_KENDI = 'Kendi sınıflarım';

/** Sekme adı: sınıf kapsamında sınıfın kendi adı yazıyor. */
export function kapsamAdi(kapsam: Kapsam, sinifAdi?: string | null): string {
  if (kapsam === 'okul') return KAPSAM_OKUL;
  if (kapsam === 'kendi') return KAPSAM_KENDI;
  return (sinifAdi ?? '').trim() === '' ? 'Sınıf' : (sinifAdi as string);
}

/**
 * DAR KAPSAMIN GİZLİLİK NOTU.
 *
 * "Kimlik saklı" ve "tahmin edilebilir" AYNI cümlede: ikisi birden doğru
 * ve yalnız birini yazmak yanıltıcı olurdu.
 */
export function gizlilikNotu(kapsam: Kapsam, sinifAdi?: string | null): string | null {
  if (kapsam === 'okul') return null;
  const nerede =
    kapsam === 'sinif' && (sinifAdi ?? '').trim() !== ''
      ? `${sinifAdi} sınıfıyla`
      : 'derse girdiğiniz sınıflarla';
  return (
    `Bu bölümde yanıtlar ${nerede} sınırlı. Ad ve kimlik saklı; ` +
    'ama grup küçükse yazılan bir görüşün kime ait olduğu tahmin edilebilir.'
  );
}

/**
 * Genel kapsamda, sınıfı bilinmeyen yanıtların sayısı.
 *
 * `0` ise cümle hiç yazılmıyor: her açılışta "0 yanıt sınıfsız" demek
 * gürültü olurdu.
 */
export function sinifsizNotu(sayi: number): string | null {
  if (!Number.isFinite(sayi) || sayi <= 0) return null;
  return (
    `Bu yanıtların ${sayi} tanesi sınıf kaydı başlamadan önce toplandı; ` +
    'sınıfı bilinmiyor ve yalnız bu genel sonuçta sayılıyor.'
  );
}

/** Dar kapsamda hiç yanıt yoksa. Beklenti yaratmıyor. */
export const BOS_DAR = 'Bu kapsamda henüz yanıt yok.';

/**
 * ÖĞRETMEN ANKETİNİN NEDEN GÖRÜNMEDİĞİ — öğretmen ekranında yazılı.
 *
 * Yazmamak, öğretmenin "bir grup eksik, hata mı var?" diye düşünmesine yol
 * açardı. Sebebi gizlemek yerine söylüyoruz.
 */
export const OGRETMEN_GRUBU_NOTU =
  'Öğretmen anketinin sonuçları okul yönetimine açıktır; öğretmen görünümünde yer almaz.';

/** Ayarlar'daki "Derse girdiğim sınıflar" kartı. */
export const SINIF_SECIMI_BASLIK = 'Derse girdiğim sınıflar';
export const SINIF_SECIMI_ACIKLAMA =
  'Anket sonuçlarındaki “Kendi sınıflarım” kapsamı bu seçime göre hesaplanır.';
/**
 * KARTIN ALTINDAKİ GÜVENCE.
 *
 * Bu cümle olmadan öğretmen, işareti kaldırdığında o sınıfı tamamen
 * kaybedeceğini sanabilir — hiç işaretlemez ve özellik ölü doğardı.
 */
export const SINIF_SECIMI_GUVENCE =
  'Bu seçim yalnız anket sonuçlarını kapsar; bütün sınıflarınızı görmeye devam edersiniz.';
