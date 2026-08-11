import { useEffect, useState } from 'react';
import { useHareketAzalt } from '@/hooks/useHareketAzalt';

type Props = {
  boyut?: number;
  /** true ise işaret 8'den ∞'a döner. false ise sabit 8 kalır. */
  sonsuz?: boolean;
  /** Takıldığı anda bir kez 8 → ∞ dönüşümü oynatır. */
  acilistaDonsun?: boolean;
  /** Dönüşümden önceki bekleme (ms). */
  gecikme?: number;
  className?: string;
  /** Ekran okuyucu metni. null verilirse işaret dekoratif sayılır. */
  etiket?: string | null;
};

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
  gecikme = 200,
  className,
  etiket = null,
}: Props) {
  const hareketAzalt = useHareketAzalt();
  const [dondu, setDondu] = useState(false);

  useEffect(() => {
    if (!acilistaDonsun || hareketAzalt) return;
    const z = window.setTimeout(() => setDondu(true), gecikme);
    return () => window.clearTimeout(z);
  }, [acilistaDonsun, gecikme, hareketAzalt]);

  // Hareket azaltılmışsa, dönüşüm istenen her durumda doğrudan sonuç gösterilir.
  const sonsuzGoster = hareketAzalt ? sonsuz || acilistaDonsun : sonsuz || dondu;
  const dekoratif = etiket === null;

  return (
    <svg
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
          transition: hareketAzalt ? 'none' : 'transform 700ms var(--ease-sk)',
        }}
      >
        <circle cx="24" cy="15" r="9.4" />
        <circle cx="24" cy="33" r="9.4" />
      </g>
    </svg>
  );
}
