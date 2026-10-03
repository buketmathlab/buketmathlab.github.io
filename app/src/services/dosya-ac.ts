/**
 * Bir dosyayı yeni sekmede açmak — açılır pencere engelleyicisine takılmadan.
 *
 * OLAY: bazı öğrenciler "Soruları aç (PDF)"a basınca hiçbir şey olmadığını,
 * üç cihazda denediklerini söyledi. Eski kalıp şuydu:
 *
 *     window.open(await dosyaAdresi(yol), '_blank', 'noopener')
 *
 * Sekme, sunucudan imzalı adres GELDİKTEN sonra açılıyordu; o anda
 * kullanıcının dokunuşu geçmiş oluyor. iPhone Safari, WhatsApp/Instagram
 * içi tarayıcı ve sunucu yavaş cevap verdiğinde (Edge Function soğuk
 * başlangıcı) Android Chrome da bunu açılır pencere sayıp SESSİZCE
 * engelliyor. `noopener` yüzünden `window.open` her durumda null döndüğü
 * için engel algılanamıyor, öğrenciye uyarı da gösterilmiyordu.
 *
 * ŞİMDİ: sekme dokunuş anında, BEKLEMEDEN boş açılıyor ("Dosya
 * açılıyor…"), adres gelince oraya yönlendiriliyor. Sekme hiç açılamadıysa
 * adres çağırana dönüyor; ekran dokunulabilir bir bağlantı gösteriyor
 * (`components/DosyaAcici.tsx`).
 */

export type AcmaSonucu = {
  /** İmzalı adres (60 sn geçerli). */
  url: string;
  /** Sekme açıldı ve yönlendirildi mi. false → engellendi, bağlantı göster. */
  sekme: boolean;
};

const BEKLEME_METNI = 'Dosya açılıyor… Büyük dosyalar mobil veride biraz sürebilir.';

/**
 * @param adres  İmzalı adresi getirir; dosya yoksa null.
 * @param pencereAc  Test için; varsayılan `window.open`.
 * @returns Dosya yoksa null.
 * @throws `adres`ın hatası (boş sekme kapatılmış olarak).
 */
export async function dosyayiAc(
  adres: () => Promise<string | null>,
  pencereAc: (url: string, hedef: string) => Window | null = (u, h) => window.open(u, h),
): Promise<AcmaSonucu | null> {
  // DOKUNUŞ ANINDA — hiçbir `await`ten önce.
  let pencere: Window | null = null;
  try {
    pencere = pencereAc('', '_blank');
  } catch {
    pencere = null;
  }
  if (pencere) {
    try {
      pencere.document.title = 'SEKİZ';
      pencere.document.body.style.font = '16px system-ui, sans-serif';
      pencere.document.body.style.padding = '24px';
      pencere.document.body.textContent = BEKLEME_METNI;
    } catch {
      // Bazı uygulama içi tarayıcılar boş sekmeye yazmaya izin vermiyor;
      // yönlendirme yine çalışır.
    }
  }

  let url: string | null;
  try {
    url = await adres();
  } catch (e) {
    pencere?.close();
    throw e;
  }
  if (!url) {
    pencere?.close();
    return null;
  }

  if (pencere && !pencere.closed) {
    try {
      // Açılan sayfa SEKİZ sekmesine erişemesin (`noopener`ın yaptığı iş).
      pencere.opener = null;
    } catch {
      /* bazı tarayıcılarda salt okunur */
    }
    pencere.location.replace(url);
    return { url, sekme: true };
  }
  return { url, sekme: false };
}
