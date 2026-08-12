import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tur = 'notr' | 'basari' | 'uyari' | 'tehlike' | 'bilgi';

const TURLER: Record<Tur, string> = {
  notr: 'bg-line-soft text-muted',
  basari: 'bg-success-bg text-success',
  uyari: 'bg-warning-bg text-warning',
  tehlike: 'bg-danger-bg text-danger',
  bilgi: 'bg-info-bg text-link',
};

/**
 * Durum etiketi. Renk tek başına anlam taşımaz — metin her zaman durumu
 * açıkça yazar (renk körlüğü ve WCAG 1.4.1).
 */
export function Tag({
  tur = 'notr',
  children,
  className,
}: {
  tur?: Tur;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // `word-spacing`: Manrope'un boşluğu 12 px kalında çok dar kalıyor ve
        // "Süresi doldu" bitişik okunuyordu. Etiket metinleri kısa olduğu için
        // burada biraz açmak hizayı bozmuyor, okunaklılığı belirgin artırıyor.
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold [word-spacing:0.12em]',
        TURLER[tur],
        className,
      )}
    >
      {children}
    </span>
  );
}
