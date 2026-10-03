import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast-baglam';
import { dosyayiAc, type AcmaSonucu } from '@/services/dosya-ac';

/**
 * İmzalı adres 60 sn geçerli (Edge Function `dosya-url`). Bağlantı biraz
 * önce kalkıyor ki süresi dolmuş bir adrese dokunulmasın.
 */
const BAGLANTI_OMRU_MS = 55_000;

/**
 * Dosya açma — açılır pencere engelleyicisine karşı yedek bağlantıyla.
 *
 * `ac(adres)` sekmeyi dokunuş anında açar (`services/dosya-ac.ts`). Adres
 * gelince ekranın altında küçük bir kart beliriyor:
 *  - sekme açıldıysa: "Dosya yeni sekmede açıldı. Açılmadıysa: Dosyayı aç"
 *  - engellendiyse: "Dosya hazır. Açmak için dokunun: Dosyayı aç"
 *
 * KART HER İKİ DURUMDA DA ÇIKIYOR: bazı uygulama içi tarayıcılar sekme
 * açılmış gibi davranıp hiçbir şey göstermiyor; o öğrencinin de bir yolu
 * olsun. Bağlantıya dokunmak doğrudan bir dokunuş olduğu için hiçbir
 * tarayıcı engellemiyor.
 */
export function useDosyaAc() {
  const { bildir } = useToast();
  const [hazir, setHazir] = useState<AcmaSonucu | null>(null);
  const zamanlayici = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (zamanlayici.current !== null) window.clearTimeout(zamanlayici.current);
    },
    [],
  );

  /**
   * @param yokMetni Dosya yoksa (adres null) gösterilecek uyarı; `null`
   *                 verilirse uyarı yok (çağıran kendisi karar veriyor).
   */
  async function ac(
    adres: () => Promise<string | null>,
    {
      yokMetni = 'Bu dosya bulunamadı.' as string | null,
      hataMetni = 'Dosya açılamadı.',
    } = {},
  ): Promise<AcmaSonucu | null> {
    setHazir(null);
    try {
      const sonuc = await dosyayiAc(adres);
      if (!sonuc) {
        if (yokMetni) bildir(yokMetni, 'hata');
        return null;
      }
      setHazir(sonuc);
      if (zamanlayici.current !== null) window.clearTimeout(zamanlayici.current);
      zamanlayici.current = window.setTimeout(() => setHazir(null), BAGLANTI_OMRU_MS);
      return sonuc;
    } catch (e) {
      bildir(e instanceof Error ? e.message : hataMetni, 'hata');
      return null;
    }
  }

  const yedek = hazir && (
    <div
      className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sk-alt-guvenli"
      role="status"
      aria-live="polite"
    >
      <div className="flex max-w-md flex-wrap items-center gap-x-3 gap-y-2 rounded-sk-md border border-line bg-surface px-4 py-3 text-[14px] text-ink shadow-sk-md">
        <span>
          {hazir.sekme
            ? 'Dosya yeni sekmede açıldı. Açılmadıysa:'
            : 'Dosya hazır. Açmak için dokunun:'}
        </span>
        <a
          href={hazir.url}
          target="_blank"
          rel="noopener"
          onClick={() => setHazir(null)}
          className="inline-flex min-h-[44px] items-center font-bold text-link underline"
        >
          Dosyayı aç
        </a>
        <button
          type="button"
          onClick={() => setHazir(null)}
          className="ml-auto inline-flex min-h-[44px] items-center text-muted underline"
        >
          Kapat
        </button>
      </div>
    </div>
  );

  return { ac, yedek };
}
