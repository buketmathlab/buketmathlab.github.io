import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type AlanProps = {
  etiket: string;
  /** Alanın altında görünen yardım metni. */
  ipucu?: string;
  /** Doluysa alan hatalı sayılır ve mesaj ekran okuyucuya duyurulur. */
  hata?: string;
  zorunlu?: boolean;
  children: (kimlik: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode;
};

/**
 * Form alanı sarmalayıcısı.
 *
 * Etiket, ipucu ve hata mesajının `id` bağlantılarını kendisi kurar; böylece
 * "label unutuldu" ya da "hata mesajı ekran okuyucuya ulaşmıyor" hatası
 * yapısal olarak imkânsız hâle gelir.
 */
export function Field({ etiket, ipucu, hata, zorunlu, children }: AlanProps) {
  const temel = useId();
  const alanId = `${temel}-alan`;
  const ipucuId = ipucu ? `${temel}-ipucu` : undefined;
  const hataId = hata ? `${temel}-hata` : undefined;
  const aciklayan = [ipucuId, hataId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="mb-4">
      <label htmlFor={alanId} className="mb-1 block text-[13px] font-bold text-muted">
        {etiket}
        {zorunlu && (
          <>
            <span aria-hidden="true" className="text-danger">
              {' '}
              *
            </span>
            <span className="sk-gizli-metin"> (zorunlu)</span>
          </>
        )}
      </label>

      {children({
        id: alanId,
        ...(aciklayan ? { 'aria-describedby': aciklayan } : {}),
        ...(hata ? { 'aria-invalid': true as const } : {}),
      })}

      {ipucu && (
        <p id={ipucuId} className="mt-1 text-[12px] text-muted">
          {ipucu}
        </p>
      )}
      {hata && (
        <p id={hataId} role="alert" className="mt-1 text-[12px] font-semibold text-danger">
          {hata}
        </p>
      )}
    </div>
  );
}

const TABAN =
  'w-full min-h-[44px] rounded-sk-sm border border-line bg-surface px-3 py-2 text-[15px] text-ink ' +
  'placeholder:text-muted/70 aria-[invalid=true]:border-danger';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(TABAN, className)} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...rest} className={cn(TABAN, className)}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  rows = 4,
  ...rest
}: InputHTMLAttributes<HTMLTextAreaElement> & { rows?: number }) {
  return <textarea {...rest} rows={rows} className={cn(TABAN, 'resize-y', className)} />;
}
