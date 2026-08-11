import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Props = {
  children: ReactNode;
  /** Sol kenarda durum şeridi — dikkat çekmesi gereken kartlar için. */
  vurgu?: 'yok' | 'tehlike' | 'uyari' | 'basari';
  className?: string;
};

const VURGULAR = {
  yok: '',
  tehlike: 'border-l-[3px] border-l-danger',
  uyari: 'border-l-[3px] border-l-warning',
  basari: 'border-l-[3px] border-l-success',
} as const;

export function Card({ children, vurgu = 'yok', className }: Props) {
  return (
    <div
      className={cn(
        'rounded-sk-md border border-line bg-surface p-4 shadow-sk-sm',
        VURGULAR[vurgu],
        className,
      )}
    >
      {children}
    </div>
  );
}
