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

export function eksikKonuYazisi(konu: string | null): string {
  return konu && konu.trim() !== '' ? konu : KONU_BOS;
}

/** Sınıf kutusunun başlığı ve boş durumu. */
export const SINIF_KUTUSU_BASLIGI = 'Sınıflar';
export const SINIF_KUTUSU_ACIKLAMASI = 'Bir sınıfa dokunun; listesi açılır.';
export const SINIF_YOK = 'Henüz sınıf yok.';

/** Sınıf listesinden geri dönüş. */
export const GERI = '← Sınıflar';
