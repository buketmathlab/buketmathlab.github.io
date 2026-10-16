/**
 * YAZDIRMA ADIMI — hangi cihazda yazdırma komutu nerede.
 *
 * React yok, `navigator` yok: girdi dize, çıktı cümle (`lib/` ilkesi).
 * `navigator.userAgent` ve `maxTouchPoints` ÇAĞIRAN tarafta okunuyor;
 * burada okunsaydı dosya testlenemezdi.
 *
 * -----------------------------------------------------------------------------
 * NEDEN BİR ADIM CÜMLESİ GEREKİYOR
 *
 * SEKİZ dosyayı KENDİSİ YAZDIRMIYOR ve yazdıramaz: soru PDF'i imzalı bir
 * adreste duruyor, öğrencinin tarayıcısında açılıyor ve yazdırma komutu
 * tarayıcının kendisinde. Gizli bir `<iframe>`e PDF yükleyip `print()`
 * çağırmak masaüstünde çalışır, telefonda çalışmaz — ve bu düğmenin
 * geçmişinde tam o kapıdan gelmiş gerçek bir arıza var: `dosya-ac.ts`'in
 * başındaki nota göre öğrenciler "Soruları aç (PDF)"a basınca hiçbir şey
 * olmadığını bildirmişti.
 *
 * Yani düğme dosyayı açıyor, yazdırmayı öğrenci yapıyor. Adımı yazmazsak
 * "bastım, yazdırmadı" diyen öğrenci çıkar. Cümle bu boşluğu kapatıyor.
 *
 * -----------------------------------------------------------------------------
 * TANINMAYAN CİHAZ BOŞ DÖNMÜYOR
 *
 * Boş dönseydi bilinmeyen bir tarayıcıda öğrenci hiçbir şey okumazdı.
 * Nötr cümle her cihazda doğru: her tarayıcıda bir yazdırma seçeneği var.
 */

/**
 * iPadOS 13'TEN BERİ iPad KENDİNİ Mac GİBİ TANITIYOR.
 *
 * Safari'nin "masaüstü sitesi iste" varsayılanı yüzünden iPad'in tarayıcı
 * dizesi `Macintosh; Intel Mac OS X` diyor — dokunmatik bir cihaza
 * "⌘ + P" demek yanlış olurdu. Ayrım dizede değil `maxTouchPoints`'te;
 * o yüzden ayrı bir parametre.
 */
export type Cihaz = {
  /** `navigator.userAgent`. */
  ua: string;
  /** `navigator.maxTouchPoints`. Mac gibi görünen iPad'i ayırıyor. */
  dokunmaNoktasi?: number;
};

export const IOS_ADIMI = 'Açılan sayfada Paylaş ⬆ → Yazdır';
export const ANDROID_ADIMI = 'Açılan sayfada ⋮ menüsü → Yazdır';
export const MAC_ADIMI = 'Açılan sayfada ⌘ + P';
export const PC_ADIMI = 'Açılan sayfada Ctrl + P';
export const GENEL_ADIM = "Açılan sayfada tarayıcının yazdırma seçeneğini kullan";

export function yazdirmaAdimi({ ua, dokunmaNoktasi = 0 }: Cihaz): string {
  const d = (ua ?? '').toLocaleLowerCase('tr');

  // iPhone / iPod açıkça yazıyor; iPad yazmayabiliyor (yukarıdaki not).
  if (/iphone|ipod|ipad/.test(d)) return IOS_ADIMI;
  if (/android/.test(d)) return ANDROID_ADIMI;

  // Mac gibi görünen ama dokunmatik olan cihaz = iPad.
  const macGibi = /macintosh|mac os x/.test(d);
  if (macGibi) return dokunmaNoktasi > 1 ? IOS_ADIMI : MAC_ADIMI;

  if (/windows|linux|cros|x11/.test(d)) return PC_ADIMI;

  return GENEL_ADIM;
}

/**
 * Tarayıcıdan cihazı okur. YALNIZ bu işlev `navigator`a dokunuyor; bütün
 * karar `yazdirmaAdimi`'nda ve saf.
 *
 * Sunucuda çizim (SSR) ya da `navigator`ın olmadığı bir ortamda genel
 * cümleye düşüyor — ekran çizilmemezlik etmiyor.
 */
export function buCihazinYazdirmaAdimi(): string {
  if (typeof navigator === 'undefined') return GENEL_ADIM;
  return yazdirmaAdimi({
    ua: navigator.userAgent ?? '',
    dokunmaNoktasi: navigator.maxTouchPoints ?? 0,
  });
}
