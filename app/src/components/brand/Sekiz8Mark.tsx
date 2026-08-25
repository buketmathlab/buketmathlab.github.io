import { useEffect, useRef, useState } from 'react';
import { useHareketAzalt } from '@/hooks/useHareketAzalt';

type Props = {
  boyut?: number;
  /** true ise işaret 8'den ∞'a döner. false ise sabit 8 kalır. */
  sonsuz?: boolean;
  /** Takıldığı anda bir kez 8 → ∞ dönüşümü oynatır. */
  acilistaDonsun?: boolean;
  /**
   * İşaret EKRANA GİRDİĞİNDE bir kez döner.
   *
   * Sayfanın altındaki bir işaret için `acilistaDonsun` yanlış davranış:
   * dönüş sayfa yüklenirken oynuyor ve okuyucu oraya kaydırdığında çoktan
   * bitmiş oluyor — yani hareket hiç görülmüyor. Ölçüldü, tanıtım
   * sayfasının kapanışında tam olarak bu oluyordu.
   */
  gorununceDonsun?: boolean;
  /** Dönüşümden önceki bekleme (ms). */
  gecikme?: number;
  className?: string;
  /** Ekran okuyucu metni. null verilirse işaret dekoratif sayılır. */
  etiket?: string | null;
};

/**
 * Dönüşün süresi.
 *
 * 700 ms'ti ve öğretmen "çok hızlı, ziyaretçiler fark etmez" dedi —
 * haklıydı. İki şey birden değişti: süre iki katına çıktı VE eğri
 * yumuşak giriş-çıkışa döndü (`--ease-sk` başta hızlı davranıyor,
 * hareketin kısa görünmesinin asıl sebebi oydu).
 */
const SURE_MS = 1500;

/**
 * SEKİZ marka işareti — 8 → ∞.
 *
 * Fikir geometrik olarak gerçektir: üst üste binmiş iki halka dikeyken "8",
 * 90° döndürülünce "∞" olur. Tek bir şekil, iki anlam.
 *
 * Kullanım yeri BİLİNÇLİ OLARAK SINIRLIDIR (Kural 12): uygulama açılışı,
 * ödev teslim başarısı, ilerleme tamamlanması, landing hero. Başka yerde yok.
 *
 * Erişilebilirlik: `prefers-reduced-motion: reduce` açıkken dönüş hiç
 * oynatılmaz, işaret doğrudan ∞ olarak çizilir — aynı anlam, hareketsiz.
 */
export function Sekiz8Mark({
  boyut = 40,
  sonsuz = false,
  acilistaDonsun = false,
  gorununceDonsun = false,
  gecikme = 200,
  className,
  etiket = null,
}: Props) {
  const hareketAzalt = useHareketAzalt();
  const [dondu, setDondu] = useState(false);
  const kok = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!acilistaDonsun || hareketAzalt) return;
    const z = window.setTimeout(() => setDondu(true), gecikme);
    return () => window.clearTimeout(z);
  }, [acilistaDonsun, gecikme, hareketAzalt]);

  useEffect(() => {
    if (!gorununceDonsun || hareketAzalt) return;
    const oge = kok.current;
    if (!oge) return;

    // IntersectionObserver YOKSA (çok eski tarayıcı, bazı test ortamları)
    // işaret hareketsiz kalmasın: doğrudan döndürülüyor. Yedek davranış
    // her zaman "hiçbir şey olmasın"dan iyi (Part VIII).
    if (typeof IntersectionObserver !== 'function') {
      setDondu(true);
      return;
    }

    let z: number | undefined;
    const gozlemci = new IntersectionObserver(
      (girisler) => {
        if (!girisler.some((g) => g.isIntersecting)) return;
        // Tek seferlik: dönüş bir kez oynar, kaydırdıkça tekrarlamaz.
        gozlemci.disconnect();
        z = window.setTimeout(() => setDondu(true), gecikme);
      },
      { threshold: 0.6 },
    );
    gozlemci.observe(oge);

    return () => {
      gozlemci.disconnect();
      if (z !== undefined) window.clearTimeout(z);
    };
  }, [gorununceDonsun, gecikme, hareketAzalt]);

  // Hareket azaltılmışsa, dönüşüm istenen her durumda doğrudan sonuç gösterilir.
  const sonsuzGoster = hareketAzalt
    ? sonsuz || acilistaDonsun || gorununceDonsun
    : sonsuz || dondu;
  const dekoratif = etiket === null;

  return (
    <svg
      ref={kok}
      viewBox="0 0 48 48"
      width={boyut}
      height={boyut}
      className={className}
      role={dekoratif ? 'presentation' : 'img'}
      aria-hidden={dekoratif || undefined}
      aria-label={dekoratif ? undefined : etiket}
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={3.6}
        style={{
          transform: sonsuzGoster ? 'rotate(90deg)' : 'rotate(0deg)',
          transformOrigin: '24px 24px',
          transition: hareketAzalt
            ? 'none'
            : `transform ${SURE_MS}ms var(--ease-sk-yumusak)`,
        }}
      >
        <circle cx="24" cy="15" r="9.4" />
        <circle cx="24" cy="33" r="9.4" />
      </g>
    </svg>
  );
}
