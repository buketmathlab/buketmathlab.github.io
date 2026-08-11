import { useRef } from 'react';
import { cn } from '@/lib/cn';

export type Sekme<T extends string> = { anahtar: T; etiket: string; rozet?: number };

type Props<T extends string> = {
  sekmeler: ReadonlyArray<Sekme<T>>;
  secili: T;
  onDegis: (anahtar: T) => void;
  etiket: string;
};

/**
 * Sekme çubuğu — WAI-ARIA tablist deseni.
 * Ok tuşlarıyla gezinme, Home/End desteği ve roving tabindex uygulanır;
 * klavye kullanıcısı sekmeler arasında Tab'a basmadan geçebilir.
 */
export function Tabs<T extends string>({ sekmeler, secili, onDegis, etiket }: Props<T>) {
  const kapsayici = useRef<HTMLDivElement>(null);

  function tusaBasildi(e: React.KeyboardEvent) {
    const yon = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const suan = sekmeler.findIndex((s) => s.anahtar === secili);
    let hedef = -1;

    if (yon !== 0) hedef = (suan + yon + sekmeler.length) % sekmeler.length;
    else if (e.key === 'Home') hedef = 0;
    else if (e.key === 'End') hedef = sekmeler.length - 1;
    else return;

    e.preventDefault();
    const s = sekmeler[hedef];
    if (!s) return;
    onDegis(s.anahtar);
    kapsayici.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[hedef]?.focus();
  }

  return (
    <div
      ref={kapsayici}
      role="tablist"
      aria-label={etiket}
      onKeyDown={tusaBasildi}
      className="flex gap-1 overflow-x-auto pb-2"
    >
      {sekmeler.map((s) => {
        const aktif = s.anahtar === secili;
        return (
          <button
            key={s.anahtar}
            role="tab"
            type="button"
            aria-selected={aktif}
            tabIndex={aktif ? 0 : -1}
            onClick={() => onDegis(s.anahtar)}
            className={cn(
              'min-h-[44px] shrink-0 rounded-sk-sm px-4 text-[14px] font-bold transition-colors',
              aktif ? 'bg-ink text-paper' : 'text-muted hover:bg-line-soft',
            )}
          >
            {s.etiket}
            {s.rozet !== undefined && s.rozet > 0 && (
              <span
                className={cn(
                  'ml-2 inline-block rounded-full px-1.5 text-[11px]',
                  aktif ? 'bg-paper/20 text-paper' : 'bg-danger text-paper',
                )}
              >
                {s.rozet}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
