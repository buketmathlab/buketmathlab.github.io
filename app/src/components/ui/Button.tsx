import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tur = 'birincil' | 'ikincil' | 'sade' | 'tehlike';
type Olcu = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tur?: Tur;
  olcu?: Olcu;
  yukleniyor?: boolean;
  /** Yükleme sırasında ekran okuyucuya duyurulacak metin. */
  yuklenmeMetni?: string;
  tamGenislik?: boolean;
  children: ReactNode;
};

const TURLER: Record<Tur, string> = {
  birincil: 'bg-ink text-paper hover:bg-ink-soft active:bg-ink-soft',
  ikincil: 'bg-olive text-paper hover:brightness-110',
  sade: 'bg-surface text-ink border border-line hover:bg-line-soft',
  tehlike: 'bg-danger text-paper hover:brightness-110',
};

/**
 * Dokunma hedefi: Part XVII gereği hiçbir buton 44px'in altına inmez.
 * 'sm' ölçüsü bile min-height 44px korur; yalnız yatay dolgu daralır.
 * Görsel olarak küçük görünen ama parmakla ıskalanan buton kabul edilemez.
 */
const OLCULER: Record<Olcu, string> = {
  sm: 'min-h-[44px] px-4 text-[14px]',
  md: 'min-h-[44px] px-5 text-[15px]',
  lg: 'min-h-[52px] px-6 text-[16px]',
};

export function Button({
  tur = 'birincil',
  olcu = 'md',
  yukleniyor = false,
  yuklenmeMetni = 'İşleniyor',
  tamGenislik = false,
  disabled,
  className,
  children,
  ...rest
}: Props) {
  const pasif = disabled || yukleniyor;

  return (
    <button
      type="button"
      {...rest}
      disabled={pasif}
      aria-busy={yukleniyor || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sk-sm font-semibold',
        'transition-[background-color,filter] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        TURLER[tur],
        OLCULER[olcu],
        tamGenislik && 'w-full',
        className,
      )}
    >
      {yukleniyor && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      <span>{children}</span>
      {yukleniyor && <span className="sk-gizli-metin">{yuklenmeMetni}</span>}
    </button>
  );
}
