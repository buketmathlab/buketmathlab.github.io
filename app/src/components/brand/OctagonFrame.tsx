import { useId, type ReactNode } from 'react';
import { sekizgenYolu } from '@/lib/geometri';

type Props = {
  boyut?: number;
  children: ReactNode;
  /** Sekizgen kenarlığı çizilsin mi? */
  cerceve?: boolean;
  className?: string;
};

/**
 * Sekizgen çerçeve — Selçuklu geometrisinin işlevsel kullanımı.
 *
 * İki işi aynı anda yapar:
 *   1) Marka dilini yapısal biçimde taşır (süs olarak değil),
 *   2) Ewalu görsellerinin dikdörtgen arka planını kırpar — karakterin
 *      kimliğine dokunmadan (Kural 9) yalnızca kabını değiştirir.
 */
export function OctagonFrame({ boyut = 96, children, cerceve = true, className }: Props) {
  const id = useId();
  const kirpmaId = `sekizgen-${id.replace(/:/g, '')}`;
  const yol = sekizgenYolu(100);

  return (
    <div
      className={className}
      style={{ width: boyut, height: boyut, position: 'relative', flexShrink: 0 }}
    >
      <svg
        viewBox="0 0 100 100"
        width={0}
        height={0}
        style={{ position: 'absolute' }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={kirpmaId} clipPathUnits="objectBoundingBox">
            {/* 0-1 aralığına normalize edilmiş sekizgen */}
            <path d={sekizgenYolu(1)} />
          </clipPath>
        </defs>
      </svg>

      <div
        style={{
          width: '100%',
          height: '100%',
          clipPath: `url(#${kirpmaId})`,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>

      {cerceve && (
        <svg
          viewBox="0 0 100 100"
          width={boyut}
          height={boyut}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          aria-hidden="true"
          focusable="false"
        >
          <path d={yol} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.35} />
        </svg>
      )}
    </div>
  );
}
