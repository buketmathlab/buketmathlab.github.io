import { Sekiz8Mark } from './Sekiz8Mark';

type Props = {
  /** 'tam' iki satırlık imza; 'sade' yalnız ad. */
  bicim?: 'tam' | 'sade';
  boyut?: 'sm' | 'md' | 'lg';
  acilistaDonsun?: boolean;
  className?: string;
};

const OLCU = {
  sm: { isaret: 28, ad: 'text-[18px]', alt: 'text-[11px]' },
  md: { isaret: 40, ad: 'text-[24px]', alt: 'text-[12px]' },
  lg: { isaret: 56, ad: 'text-[34px]', alt: 'text-[14px]' },
} as const;

/**
 * SEKİZ marka imzası — ürün kimliği ile öğretmen kimliğini birlikte taşır.
 * Küçük bağlamlarda okul mührü yerine bu kullanılır (bkz. SchoolCrest).
 */
export function SekizWordmark({
  bicim = 'tam',
  boyut = 'md',
  acilistaDonsun = false,
  className,
}: Props) {
  const o = OLCU[boyut];

  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ''}`}>
      <Sekiz8Mark boyut={o.isaret} acilistaDonsun={acilistaDonsun} className="text-ink" />
      <span className="leading-tight">
        <span
          className={`block font-display font-semibold tracking-[0.14em] text-ink ${o.ad}`}
          // Türkçe'de "SEKİZ" büyük harfle yazılır; tracking okunurluğu artırır.
        >
          SEKİZ
        </span>
        {bicim === 'tam' && (
          <span className={`block text-muted ${o.alt}`}>Buket Topuzoğlu · Matematik</span>
        )}
      </span>
    </span>
  );
}
