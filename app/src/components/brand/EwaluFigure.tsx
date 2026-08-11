import { OctagonFrame } from './OctagonFrame';
import { EWALU_POZLARI, type EwaluPoz } from './ewalu';

type Props = {
  poz: EwaluPoz;
  /** 'portre' sekizgen çerçeveli yüz; 'tam' bütün figür. */
  bicim?: 'portre' | 'tam';
  boyut?: number;
  /** Dekoratif kullanımda ekran okuyucudan gizlenir. */
  dekoratif?: boolean;
  className?: string;
};

/**
 * Ewalu görseli.
 *
 * Portre biçiminde sekizgen çerçeve kullanılır: bu hem Selçuklu geometrisini
 * işlevsel hâle getirir hem de kaynak görsellerin dikdörtgen arka planını
 * kırpar. Karakterin kendisine dokunulmaz (Kural 9).
 */
export function EwaluFigure({
  poz,
  bicim = 'portre',
  boyut = 96,
  dekoratif = false,
  className,
}: Props) {
  const taban = import.meta.env.BASE_URL;
  const bilgi = EWALU_POZLARI[poz];
  const alt = dekoratif ? '' : bilgi.alt;

  if (bicim === 'tam') {
    return (
      <img
        src={`${taban}ewalu/${poz}-tam-640.webp`}
        srcSet={`${taban}ewalu/${poz}-tam-640.webp 640w, ${taban}ewalu/${poz}-tam-1200.webp 1200w`}
        sizes={`${boyut}px`}
        alt={alt}
        aria-hidden={dekoratif || undefined}
        loading="lazy"
        decoding="async"
        className={className}
        style={{ width: boyut, height: 'auto', borderRadius: 'var(--radius-sk-lg)' }}
      />
    );
  }

  const kaynak = boyut <= 128 ? 128 : boyut <= 256 ? 256 : 512;

  return (
    <OctagonFrame boyut={boyut} className={`text-ink ${className ?? ''}`}>
      <img
        src={`${taban}ewalu/${poz}-portre-${kaynak}.webp`}
        srcSet={`${taban}ewalu/${poz}-portre-256.webp 256w, ${taban}ewalu/${poz}-portre-512.webp 512w`}
        sizes={`${boyut}px`}
        alt={alt}
        aria-hidden={dekoratif || undefined}
        loading="lazy"
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </OctagonFrame>
  );
}
