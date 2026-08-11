import { sekizYildizYolu } from '@/lib/geometri';

type Props = {
  boyut?: number;
  /** 'dolu' rozet için, 'cizgi' ayırıcı ve ince vurgular için. */
  bicim?: 'dolu' | 'cizgi';
  className?: string;
  etiket?: string | null;
};

/**
 * Sekiz köşeli Selçuk yıldızı (Rub el Hizb) — 45° döndürülmüş iki karenin
 * üst üste binmesiyle oluşur. Oran `lib/geometri` içinde hesaplanır.
 *
 * Kullanım: rozet, başarı nişanı, bölüm işareti. Bir ekranda en fazla bir
 * geometrik vurgu — süs yığını yasak (Kural 10).
 */
export function StarEight({ boyut = 24, bicim = 'dolu', className, etiket = null }: Props) {
  const dekoratif = etiket === null;
  return (
    <svg
      viewBox="0 0 100 100"
      width={boyut}
      height={boyut}
      className={className}
      role={dekoratif ? 'presentation' : 'img'}
      aria-hidden={dekoratif || undefined}
      aria-label={dekoratif ? undefined : etiket}
      focusable="false"
    >
      <path
        d={sekizYildizYolu(100)}
        fill={bicim === 'dolu' ? 'currentColor' : 'none'}
        stroke={bicim === 'cizgi' ? 'currentColor' : 'none'}
        strokeWidth={bicim === 'cizgi' ? 4 : 0}
        strokeLinejoin="round"
      />
    </svg>
  );
}
