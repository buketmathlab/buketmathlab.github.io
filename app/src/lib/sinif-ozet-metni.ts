/**
 * Sınıf öğrenci özeti ekranının METNİ — React'siz, doğrudan test edilebilir.
 *
 * `odev-kiyasi-metni.ts` ve `mesaj-listesi-metni.ts` deseninin aynısı.
 */

/**
 * Ortalamayı ekranda yazılacak hâle getirir.
 *
 * TÜRKÇE ONDALIK AYIRICI VİRGÜL. `toFixed` nokta koyuyor ve "48.5"
 * öğretmenin okuduğu sayı değil.
 *
 * TEK HANE YETİYOR. Sunucu iki hane döndürüyor (`round(...,2)`) çünkü
 * hesabın kendisi öyle; ekranda ikinci hane 30 öğrencilik bir listede
 * yalnız gürültü.
 *
 * `null` = süresi dolmuş hiç ödev yok. Bu "sıfır" DEĞİL ve öyle
 * gösterilmiyor: dönem başında herkesin karşısına 0 yazmak, ödev
 * vermediğimiz için çocuğu başarısız göstermek olurdu.
 */
export function ortalamaYazisi(ortalama: number | null): string {
  if (ortalama === null || Number.isNaN(ortalama)) return 'Henüz ödev yok';
  return ortalama.toLocaleString('tr-TR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Ortalamanın altındaki küçük satır: kaç ödev üzerinden. */
export function odevSayisiYazisi(odevSayisi: number): string {
  return `${odevSayisi} ödev`;
}

/**
 * YAPILAN / YAPILMAYAN (0052).
 *
 * Öğretmenin isteği: *"öğrencilerin verilen kaç tane ödevi yaptıklarını,
 * kaç tanesini yapmadıkları… göstersin."*
 *
 * İKİ SAYI DA YAZILIYOR, BİRİ ÖTEKİNDEN ÇIKARILMIYOR. "8/10" yazmak daha
 * kısa olurdu ama öğretmenin sorduğu şey iki ayrı sayı ve ikisi de aynı
 * anda görünmeli. Sıfır olan taraf da yazılıyor: "0 yapılmadı" bir
 * bilgidir, boşluk değil.
 *
 * Süresi dolmuş hiç ödev yoksa CÜMLE KURULMUYOR — "0 yapıldı · 0
 * yapılmadı" hiçbir şey söylemez ve ortalama zaten "Henüz ödev yok" diyor.
 */
export function yapilanYazisi(yapilan: number, yapilmayan: number): string | null {
  if (yapilan + yapilmayan === 0) return null;
  return `${yapilan} yapıldı · ${yapilmayan} yapılmadı`;
}

/**
 * En eksik konu sütunu.
 *
 * BOŞ GELMESİNİN İKİ AYRI SEBEBİ VAR ve ekran ikisini AYIRT EDEMİYOR:
 *   (a) o öğrencinin hiçbir konuda 5 soruluk birikimi yok
 *   (b) hiç yanlışı yok
 *
 * Bu yüzden buraya CÜMLE YAZILMIYOR, tire konuyor. "Yeterli veri yok"
 * demek (b) durumundaki öğrenci için YANLIŞ olurdu; "eksik yok" demek
 * (a) durumundaki için yanlış olurdu. Tire hiçbir şey iddia etmiyor ve
 * listenin altındaki açıklama iki sebebi birden söylüyor.
 *
 * Öğretmenin dil kuralı da aynı yöne bakıyor: GERÇEĞİ GİZLEME, ama
 * bilmediğin bir şeyi de söyleme.
 */
export const KONU_BOS = '—';

/**
 * Liste altındaki açıklama.
 *
 * ÖĞRETMENİN DÜZELTMESİ: *"'En eksik konular' cümlesini bu şekilde değil
 * de daha pedagojik yaz."* İlk sürüm yalnız tirenin ne anlama geldiğini
 * anlatan teknik bir dipnottu ("5 soruluk birikimi olan bir konusu
 * yoktur") ve satırdaki konunun NE İŞE YARADIĞINI hiç söylemiyordu.
 *
 * Yeni cümle üç şeyi birden yapıyor:
 *   1. Konuyu bir EKSİK ETİKETİ değil, bir BAŞLANGIÇ NOKTASI olarak
 *      koyuyor — "şu sıralar en çok tekrara ihtiyaç duyduğu konu".
 *   2. Gerçeği gizlemiyor: yanlışın ve boşun orada biriktiğini açıkça
 *      söylüyor. Öğretmenin kuralı bunu şart koşuyor —
 *      *"Yanlış kelimesini her durumda daha yumuşak bir ifadeyle
 *      değiştirmeye çalışma."*
 *   3. Dayatmıyor: "başlanabilir". Çıkarım bir öneridir; ne yapılacağına
 *      öğretmen karar verir.
 *
 * Tirenin iki sebebi cümlenin sonunda aynen duruyor — o bilgi kayıp
 * değil, ikinci sıraya geçti.
 */
export const KONU_ACIKLAMASI =
  'Adın altındaki konu, o öğrencinin şu sıralar en çok tekrara ihtiyaç ' +
  'duyduğu konudur: yanlışı ve boşu en çok orada birikmiş. Bir sonraki ' +
  'çalışmaya buradan başlanabilir. “—” ise iki şeyden birini söyler: ' +
  'öğrenci henüz hiçbir konuda 5 soru çözmemiştir ya da çözdüklerinde ' +
  'yanlışı yoktur.';

/**
 * SAYILARIN HANGİ ÖDEVLERİ KAPSADIĞI (0052).
 *
 * Üç sayı da aynı kümeden geliyor: teslim süresi dolmuş ödevler. Bunu
 * yazmasaydık öğretmen "bu hafta verdiğim ödev neden görünmüyor" diye
 * haklı olarak sorardı. Süresi devam eden ödev "yapılmadı" sayılmıyor —
 * teslim tarihi gelmemiş bir ödev yüzünden çocuk bugünden eksik
 * görünmesin.
 */
export const KAPSAM_ACIKLAMASI =
  'Sayılar ve ortalama, teslim süresi dolmuş ödevleri kapsar; süresi ' +
  'devam eden ödev hiçbir sayıya girmez.';

/**
 * 0053: alan artık bir DİZİ ve ekran İLK elemanı gösteriyor.
 *
 * Ekranda tek konu yazmak bilinçli: satır dar ve öğretmen listeye göz
 * gezdiriyor. Üç konunun tamamı YAZDIRILAN kâğıtta — orada okumak için
 * yer ve zaman var.
 */
export function eksikKonuYazisi(konular: readonly string[] | null): string {
  const ilk = konular?.[0];
  return ilk && ilk.trim() !== '' ? ilk : KONU_BOS;
}

/** Sınıf kutusunun başlığı ve boş durumu. */
export const SINIF_KUTUSU_BASLIGI = 'Sınıflar';
export const SINIF_KUTUSU_ACIKLAMASI = 'Bir sınıfa dokunun; listesi açılır.';
export const SINIF_YOK = 'Henüz sınıf yok.';

/** Sınıf listesinden geri dönüş. */
export const GERI = '← Sınıflar';
